import { Injectable, inject } from '@angular/core';
import { Auth, User } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class BaseFirebaseService {
  protected firestore = inject(Firestore);
  protected auth = inject(Auth);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
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

@Injectable({
  providedIn: 'root',
})
export class AlternativeBaseFirebaseService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(protected firestore: Firestore, protected auth: Auth) {
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
