import { Injectable } from '@angular/core';
import {
  Auth,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import {
  UserPermissionKey,
  UserProfile,
} from '../interfaces/user-profile.interface';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  public userProfile$ = this.userProfileSubject.asObservable();

  constructor(private auth: Auth, private firestore: Firestore) {
    // Initialize auth state listener
    onAuthStateChanged(this.auth, (user) => {
      this.userSubject.next(user);

      // If user is logged in, fetch their profile
      if (user) {
        this.fetchUserProfile(user.uid).subscribe();
      } else {
        this.userProfileSubject.next(null);
      }
    });
  }

  /**
   * Sign in with email and password
   */
  signIn(email: string, password: string): Observable<UserCredential> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      tap((userCredential) => {
        this.userSubject.next(userCredential.user);
        this.fetchUserProfile(userCredential.user.uid).subscribe();
      }),
      catchError((error) => {
        console.error('Sign in error:', error);
        throw error;
      })
    );
  }

  /**
   * Sign up with email and password, and create a user profile
   */
  signUp(
    email: string,
    password: string,
    userData: { firstName: string; lastName: string }
  ): Observable<void> {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password)
    ).pipe(
      switchMap(async (userCredential) => {
        // Update user profile with display name
        const displayName = `${userData.firstName} ${userData.lastName}`.trim();
        await updateProfile(userCredential.user, { displayName });

        // Create user document in Firestore
        const userDocRef = doc(
          this.firestore,
          `users/${userCredential.user.uid}`
        );
        return setDoc(userDocRef, {
          email: userCredential.user.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          name: displayName,
          role: 'user', // Default role
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          permissions: {
            // Default permissions
            canViewUnallocated: false,
            canAllocateJobs: false,
            canApproveExpenses: false,
            canCreateJobs: false,
            canEditJobs: false,
            canManageUsers: false,
            canViewReports: false,
            isAdmin: false,
          },
        });
      }),
      catchError((error) => {
        console.error('Sign up error:', error);
        throw error;
      })
    );
  }

  /**
   * Send password reset email
   */
  resetPassword(email: string): Observable<void> {
    return from(sendPasswordResetEmail(this.auth, email)).pipe(
      catchError((error) => {
        console.error('Password reset error:', error);
        throw error;
      })
    );
  }

  /**
   * Sign out
   */
  signOut(): Observable<void> {
    return from(signOut(this.auth)).pipe(
      tap(() => {
        this.userSubject.next(null);
        this.userProfileSubject.next(null);
      }),
      catchError((error) => {
        console.error('Sign out error:', error);
        throw error;
      })
    );
  }

  /**
   * Get the current user's profile
   */
  getUserProfile(): Observable<UserProfile | null> {
    return this.userProfile$;
  }

  /**
   * Get a user profile by ID
   */
  getUserById(userId: string): Observable<UserProfile | null> {
    if (!userId) {
      return of(null);
    }

    const userDocRef = doc(this.firestore, `users/${userId}`);

    return from(getDoc(userDocRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          const profile = this.convertFirebaseUserToProfile(
            userId,
            docSnap.data()
          );
          return profile;
        } else {
          return null;
        }
      }),
      catchError((error) => {
        console.error('Error fetching user profile by ID:', error);
        return of(null);
      })
    );
  }

  /**
   * Check if the current user has a specific permission
   */
  hasPermission(permission: string | UserPermissionKey): Observable<boolean> {
    return this.userProfile$.pipe(
      map((profile) => {
        if (!profile) return false;

        // Admin always has all permissions
        if (profile.permissions?.isAdmin) return true;

        // Check specific permission
        return !!profile.permissions?.[
          permission as keyof typeof profile.permissions
        ];
      })
    );
  }

  /**
   * Check if the current user has any of the specified permissions
   */
  hasAnyPermission(
    permissions: string[] | UserPermissionKey[]
  ): Observable<boolean> {
    return this.userProfile$.pipe(
      map((profile) => {
        if (!profile) return false;

        // Admin always has all permissions
        if (profile.permissions?.isAdmin) return true;

        // Check if user has any of the required permissions
        return permissions.some(
          (permission) =>
            profile.permissions &&
            (profile.permissions[
              permission as keyof typeof profile.permissions
            ] as boolean)
        );
      })
    );
  }

  /**
   * Get all drivers (users with role = 'driver')
   */
  getDrivers(): Observable<UserProfile[]> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('role', '==', 'driver'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return this.convertFirebaseUserToProfile(doc.id, doc.data());
        });
      }),
      catchError((error) => {
        console.error('Error fetching drivers:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all users with a specific role
   */
  getUsersByRole(role: string): Observable<UserProfile[]> {
    const usersRef = collection(this.firestore, 'users');
    const q = query(
      usersRef,
      where('role', '==', role),
      where('isActive', '==', true)
    );

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return this.convertFirebaseUserToProfile(doc.id, doc.data());
        });
      }),
      catchError((error) => {
        console.error(`Error fetching users with role ${role}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Update user profile
   */
  updateUserProfile(
    userId: string,
    profileData: Partial<UserProfile>
  ): Observable<void> {
    const userDocRef = doc(this.firestore, `users/${userId}`);

    // Remove id from the profileData to avoid overwriting it
    const { id, ...updateData } = profileData;

    // Add updatedAt timestamp
    const data = {
      ...updateData,
      updatedAt: serverTimestamp(),
    };

    return from(setDoc(userDocRef, data, { merge: true })).pipe(
      tap(() => {
        // Refresh the user profile if it's the current user
        if (this.auth.currentUser?.uid === userId) {
          this.fetchUserProfile(userId).subscribe();
        }
      }),
      catchError((error) => {
        console.error('Error updating user profile:', error);
        throw error;
      })
    );
  }

  /**
   * Check if the user is authenticated
   */
  isAuthenticated(): Observable<boolean> {
    return this.user$.pipe(map((user) => !!user));
  }

  /**
   * Check if the current user is an admin
   */
  isAdmin(): Observable<boolean> {
    return this.userProfile$.pipe(
      map((profile) => !!profile?.permissions?.isAdmin)
    );
  }

  /**
   * Fetch user profile from Firestore
   */
  private fetchUserProfile(uid: string): Observable<UserProfile | null> {
    const userDocRef = doc(this.firestore, `users/${uid}`);

    return from(getDoc(userDocRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          const profile = this.convertFirebaseUserToProfile(
            uid,
            docSnap.data()
          );
          this.userProfileSubject.next(profile);
          return profile;
        } else {
          this.userProfileSubject.next(null);
          return null;
        }
      }),
      catchError((error) => {
        console.error('Error fetching user profile:', error);
        this.userProfileSubject.next(null);
        return of(null);
      })
    );
  }

  /**
   * Convert Firebase user data to UserProfile interface
   */
  private convertFirebaseUserToProfile(uid: string, data: any): UserProfile {
    // Handle Firebase timestamps
    const convertTimestamp = (timestamp: any): Date | undefined => {
      if (!timestamp) return undefined;

      // Firebase timestamp object with toDate() method
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
        return timestamp.toDate();
      }

      // String or number timestamp
      if (timestamp) {
        return new Date(timestamp);
      }

      return undefined;
    };

    return {
      id: uid,
      email: data.email || '',
      name:
        data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      phoneNumber: data.phoneNumber || '',
      role: data.role || '',
      isActive: data.isActive !== false,
      permissions: data.permissions || {},
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    };
  }
}
