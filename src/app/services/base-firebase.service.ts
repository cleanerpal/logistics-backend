import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { first, map } from 'rxjs/operators';

@Injectable()
export class BaseFirebaseService {
  private userSubject = new BehaviorSubject<any>(null);
  protected currentUser$ = this.userSubject.asObservable();

  constructor(protected firestore: Firestore, protected auth: Auth) {
    // Initialize auth state listener
    this.auth.onAuthStateChanged((user) => {
      this.userSubject.next(user);
    });
  }

  /**
   * Get the current authenticated user
   */
  protected get currentUser(): any {
    return this.auth.currentUser;
  }

  /**
   * Get the current user ID
   */
  protected get currentUserId(): string | null {
    return this.currentUser?.uid || null;
  }

  /**
   * Check if a user is authenticated
   */
  protected isAuthenticated(): Observable<boolean> {
    return this.currentUser$.pipe(
      map((user) => !!user),
      first()
    );
  }

  /**
   * Convert Firebase timestamp to JavaScript Date
   */
  protected convertTimestamp(timestamp: any): Date | undefined {
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
  }
}
