import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

// Firebase imports
import {
  Auth,
  User as FirebaseUser,
  UserCredential,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  onSnapshot,
  DocumentData,
  QueryConstraint,
  addDoc,
  updateDoc,
  deleteDoc,
  DocumentReference,
  CollectionReference,
} from '@angular/fire/firestore';

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: 'SuperAdmin' | 'Admin' | 'Driver';
}

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private router: Router = inject(Router);

  user$: Observable<User | null>;

  constructor() {
    // Get auth state, then fetch firestore user document or return null
    this.user$ = new Observable<User | null>((observer) => {
      const unsubscribe = this.auth.onAuthStateChanged((user) => {
        if (user) {
          this.getUserData(user.uid).then((userData) => {
            if (userData) {
              observer.next({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                role: userData.role,
              });
            } else {
              observer.next({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
              });
            }
          });
        } else {
          observer.next(null);
        }
      });

      // Return unsubscribe function
      return { unsubscribe };
    });
  }

  // Get user data from Firestore
  private async getUserData(uid: string): Promise<any> {
    const userRef = doc(this.firestore, `users/${uid}`);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() : null;
  }

  // Email & Password Login
  async emailLogin(email: string, password: string): Promise<void> {
    try {
      const credential = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      return this.updateUserData(credential.user);
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  // Update user data in Firestore
  private async updateUserData(user: FirebaseUser): Promise<void> {
    if (!user) return;

    const userRef = doc(this.firestore, `users/${user.uid}`);

    const data: User = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
    };

    return setDoc(userRef, data, { merge: true });
  }

  // Get a document from Firestore with real-time updates
  getDocumentWithSnapshot<T>(
    collectionPath: string,
    id: string
  ): Observable<T | null> {
    return new Observable<T | null>((observer) => {
      const docRef = doc(this.firestore, `${collectionPath}/${id}`);

      const unsubscribe = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            observer.next({
              id: docSnap.id,
              ...docSnap.data(),
            } as unknown as T);
          } else {
            observer.next(null);
          }
        },
        (error) => {
          observer.error(error);
        }
      );

      // Return unsubscribe function to clean up when observable is unsubscribed
      return { unsubscribe };
    });
  }

  // Get a collection from Firestore with real-time updates
  getCollectionWithSnapshot<T>(
    collectionPath: string,
    queryConstraints?: QueryConstraint[]
  ): Observable<T[]> {
    return new Observable<T[]>((observer) => {
      const collectionRef = collection(this.firestore, collectionPath);
      let queryRef = query(collectionRef);

      if (queryConstraints && queryConstraints.length > 0) {
        queryRef = query(collectionRef, ...queryConstraints);
      }

      const unsubscribe = onSnapshot(
        queryRef,
        (snapshot) => {
          const items = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as unknown as T)
          );
          observer.next(items);
        },
        (error) => {
          observer.error(error);
        }
      );

      // Return unsubscribe function to clean up
      return { unsubscribe };
    });
  }

  // Add a document to Firestore
  async addDocument(collectionPath: string, data: any): Promise<string> {
    const collectionRef = collection(this.firestore, collectionPath);
    const docRef = await addDoc(collectionRef, data);
    return docRef.id;
  }

  // Update a document in Firestore
  async updateDocument(
    collectionPath: string,
    id: string,
    data: any
  ): Promise<void> {
    const docRef = doc(this.firestore, `${collectionPath}/${id}`);
    return updateDoc(docRef, data);
  }

  // Delete a document from Firestore
  async deleteDocument(collectionPath: string, id: string): Promise<void> {
    const docRef = doc(this.firestore, `${collectionPath}/${id}`);
    return deleteDoc(docRef);
  }

  // Check if user is authenticated
  isAuthenticated(): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      const unsubscribe = this.auth.onAuthStateChanged((user) => {
        observer.next(!!user);
      });

      return { unsubscribe };
    });
  }
}
