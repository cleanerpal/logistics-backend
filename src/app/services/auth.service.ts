import { Injectable } from '@angular/core';
import {
  Auth,
  User,
  UserCredential,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { UserPermissionKey, UserProfile } from '../interfaces/job.interface';

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
   * Check if the current user has a specific permission
   */
  hasPermission(permission: UserPermissionKey): Observable<boolean> {
    return this.userProfile$.pipe(
      map((profile) => {
        console.log(profile);
        if (!profile) return false;

        // Admin always has all permissions
        if (profile.permissions?.isAdmin) return true;

        // Check specific permission
        return !!profile.permissions?.[permission];
      })
    );
  }

  /**
   * Check if the current user has any of the specified permissions
   */
  hasAnyPermission(permissions: UserPermissionKey[]): Observable<boolean> {
    return this.userProfile$.pipe(
      map((profile) => {
        if (!profile) return false;

        // Admin always has all permissions
        if (profile.permissions?.isAdmin) return true;

        // Check if user has any of the specified permissions
        return permissions.some(
          (permission) => !!profile.permissions?.[permission]
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
    };
  }
}
