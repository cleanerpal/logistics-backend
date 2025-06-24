// src/app/services/base-firebase.service.ts
import { Injectable, inject } from '@angular/core';
import { Auth, User } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BaseFirebaseService {
  // Use inject() function for proper injection context
  protected firestore = inject(Firestore);
  protected auth = inject(Auth);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Listen to auth state changes
    this.auth.onAuthStateChanged((user) => {
      this.currentUserSubject.next(user);
    });
  }

  /**
   * Get current user
   */
  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Get current user ID
   */
  get currentUserId(): string | null {
    return this.currentUserValue?.uid || null;
  }

  /**
   * Convert Firebase timestamp to Date
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

  /**
   * Format date for Firestore
   */
  protected formatDateForFirestore(date: Date): Date {
    return date;
  }

  /**
   * Handle errors consistently
   */
  protected handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);

      // Let the app keep running by returning an empty result
      return new Observable<T>((observer) => {
        if (result !== undefined) {
          observer.next(result as T);
        }
        observer.complete();
      });
    };
  }
}

// Alternative implementation using direct injection in constructor
@Injectable({
  providedIn: 'root',
})
export class AlternativeBaseFirebaseService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(protected firestore: Firestore, protected auth: Auth) {
    // Listen to auth state changes
    this.auth.onAuthStateChanged((user) => {
      this.currentUserSubject.next(user);
    });
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get currentUserId(): string | null {
    return this.currentUserValue?.uid || null;
  }

  protected convertTimestamp(timestamp: any): Date | undefined {
    if (!timestamp) return undefined;

    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate();
    }

    if (timestamp) {
      return new Date(timestamp);
    }

    return undefined;
  }

  protected formatDateForFirestore(date: Date): Date {
    return date;
  }

  protected handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(`${operation} failed:`, error);

      return new Observable<T>((observer) => {
        if (result !== undefined) {
          observer.next(result as T);
        }
        observer.complete();
      });
    };
  }
}
