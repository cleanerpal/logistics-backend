import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { Job } from '../interfaces/job.interface';
import { ROLE_PERMISSION_PRESETS, UserProfile, UserRole } from '../interfaces/user-profile.interface';
import { Expense } from '../shared/models/expense.model';
import { AuthService } from './auth.service';
import { BaseFirebaseService } from './base-firebase.service';
import { NotificationService } from './notification.service';

export interface DriverNote {
  id: string;
  driverId: string;
  content: string;
  date: Date;
  authorId: string;
  authorName: string;
}

export interface DriverStats {
  totalJobs: number;
  pendingJobs: number;
  completedJobs: number;
  pendingExpenses: number;
}

@Injectable({
  providedIn: 'root',
})
export class DriverService extends BaseFirebaseService {
  private driversSubject = new BehaviorSubject<UserProfile[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public drivers$ = this.driversSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    protected override firestore: Firestore,
    protected override auth: Auth,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    super();
  }

  getAllDrivers(): Observable<UserProfile[]> {
    this.loadingSubject.next(true);

    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, orderBy('lastName'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const drivers = snapshot.docs.map((doc) => {
          return this.convertFirebaseUserToProfile(doc.id, doc.data());
        });
        this.driversSubject.next(drivers);
        return drivers;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching drivers:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  getDriversByRole(role: UserRole): Observable<UserProfile[]> {
    this.loadingSubject.next(true);

    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('role', '==', role), where('isActive', '==', true), orderBy('lastName'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const drivers = snapshot.docs.map((doc) => {
          return this.convertFirebaseUserToProfile(doc.id, doc.data());
        });
        return drivers;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching drivers with role ${role}:`, error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  getActiveDrivers(): Observable<UserProfile[]> {
    this.loadingSubject.next(true);

    const usersRef = collection(this.firestore, 'users');
    const q = query(usersRef, where('isActive', '==', true), orderBy('lastName'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const drivers = snapshot.docs.map((doc) => {
          return this.convertFirebaseUserToProfile(doc.id, doc.data());
        });
        return drivers;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching active drivers:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  getDriverById(driverId: string): Observable<UserProfile | null> {
    this.loadingSubject.next(true);

    if (!driverId) {
      this.loadingSubject.next(false);
      return of(null);
    }

    return this.authService.getUserById(driverId).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching driver ${driverId}:`, error);
        this.loadingSubject.next(false);
        return of(null);
      })
    );
  }

  createDriver(email: string, password: string, userData: Partial<UserProfile>, sendCredentials: boolean = true): Observable<string> {
    this.loadingSubject.next(true);

    return this.authService
      .signUp(email, password, {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
      })
      .pipe(
        switchMap(() => {
          return this.authService.getUserByEmail(email);
        }),
        switchMap((user) => {
          if (!user) {
            throw new Error('Failed to create user');
          }

          const role = (userData.role as UserRole) || UserRole.DRIVER;
          const permissions = ROLE_PERMISSION_PRESETS[role];

          return this.authService
            .updateUserProfile(user.id, {
              ...userData,
              name: `${userData.firstName} ${userData.lastName}`.trim(),
              role: role,
              isActive: true,
              permissions: permissions,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .pipe(
              map(() => {
                return user.id;
              })
            );
        }),
        tap(() => this.loadingSubject.next(false)),
        catchError((error) => {
          console.error('Error creating driver:', error);
          this.loadingSubject.next(false);
          return throwError(() => new Error(`Failed to create driver: ${error.message}`));
        })
      );
  }

  updateDriver(driverId: string, userData: Partial<UserProfile>): Observable<void> {
    this.loadingSubject.next(true);

    if (!driverId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Driver ID is required'));
    }

    let updatedData = { ...userData };
    if (userData.role) {
      const role = userData.role as UserRole;
      updatedData.permissions = ROLE_PERMISSION_PRESETS[role];
    }

    if (userData.firstName || userData.lastName) {
      updatedData.name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
    }

    updatedData.updatedAt = new Date();

    return this.authService.updateUserProfile(driverId, updatedData).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error updating driver ${driverId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => new Error(`Failed to update driver: ${error.message}`));
      })
    );
  }

  updateDriverPermissions(driverId: string, role: UserRole): Observable<void> {
    this.loadingSubject.next(true);

    if (!driverId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Driver ID is required'));
    }

    const permissions = ROLE_PERMISSION_PRESETS[role];
    if (!permissions) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Invalid role specified'));
    }

    return this.authService
      .updateUserProfile(driverId, {
        role: role,
        permissions: permissions,
        updatedAt: new Date(),
      })
      .pipe(
        tap(() => this.loadingSubject.next(false)),
        catchError((error) => {
          console.error(`Error updating driver permissions ${driverId}:`, error);
          this.loadingSubject.next(false);
          return throwError(() => new Error(`Failed to update driver permissions: ${error.message}`));
        })
      );
  }

  deactivateDriver(driverId: string): Observable<void> {
    this.loadingSubject.next(true);

    if (!driverId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Driver ID is required'));
    }

    return this.authService
      .updateUserProfile(driverId, {
        isActive: false,
        updatedAt: new Date(),
      })
      .pipe(
        tap(() => this.loadingSubject.next(false)),
        catchError((error) => {
          console.error(`Error deactivating driver ${driverId}:`, error);
          this.loadingSubject.next(false);
          return throwError(() => new Error(`Failed to deactivate driver: ${error.message}`));
        })
      );
  }

  getDriverStats(driverId: string): Observable<DriverStats> {
    this.loadingSubject.next(true);

    if (!driverId) {
      this.loadingSubject.next(false);
      return of({
        totalJobs: 0,
        pendingJobs: 0,
        completedJobs: 0,
        pendingExpenses: 0,
      });
    }

    const jobsRef = collection(this.firestore, 'jobs');
    const jobsQuery = query(jobsRef, where('driverId', '==', driverId));

    const expensesRef = collection(this.firestore, 'expenses');
    const expensesQuery = query(expensesRef, where('driverId', '==', driverId));

    return from(Promise.all([getDocs(jobsQuery), getDocs(expensesQuery)])).pipe(
      map(([jobsSnapshot, expensesSnapshot]) => {
        const jobs = jobsSnapshot.docs.map((doc) => doc.data() as Job);

        const expenses = expensesSnapshot.docs.map((doc) => doc.data() as Expense);

        const totalJobs = jobs.length;
        const pendingJobs = jobs.filter((job) => job.status === 'allocated' || job.status === 'collected').length;
        const completedJobs = jobs.filter((job) => job.status === 'delivered' || job.status === 'completed').length;
        const pendingExpenses = expenses.filter((expense) => expense.status === 'Pending').length;

        return {
          totalJobs,
          pendingJobs,
          completedJobs,
          pendingExpenses,
        };
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching driver stats for ${driverId}:`, error);
        this.loadingSubject.next(false);
        return of({
          totalJobs: 0,
          pendingJobs: 0,
          completedJobs: 0,
          pendingExpenses: 0,
        });
      })
    );
  }

  getDriverNotes(driverId: string): Observable<DriverNote[]> {
    this.loadingSubject.next(true);

    if (!driverId) {
      this.loadingSubject.next(false);
      return of([]);
    }

    const notesRef = collection(this.firestore, 'driverNotes');
    const q = query(notesRef, where('driverId', '==', driverId), orderBy('date', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const notes = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            driverId: data['driverId'] || '',
            content: data['content'] || '',
            date: this.convertTimestamp(data['date']) || new Date(),
            authorId: data['authorId'] || '',
            authorName: data['authorName'] || 'Unknown User',
          } as DriverNote;
        });
        return notes;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching notes for driver ${driverId}:`, error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  addDriverNote(driverId: string, content: string, authorId: string, authorName: string): Observable<string> {
    this.loadingSubject.next(true);

    if (!driverId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Driver ID is required'));
    }

    if (!content) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Note content is required'));
    }

    const notesRef = collection(this.firestore, 'driverNotes');
    const noteData = {
      driverId,
      content,
      date: serverTimestamp(),
      authorId,
      authorName,
    };

    return from(addDoc(notesRef, noteData).then((docRef) => docRef.id)).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error adding note to driver ${driverId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => new Error(`Failed to add note: ${error.message}`));
      })
    );

    function addDoc(ref: any, data: any): Promise<any> {
      const newDocRef = doc(ref);
      return setDoc(newDocRef, data).then(() => newDocRef);
    }
  }

  updateDriverNote(noteId: string, content: string): Observable<void> {
    this.loadingSubject.next(true);

    if (!noteId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Note ID is required'));
    }

    if (!content) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Note content is required'));
    }

    const noteRef = doc(this.firestore, `driverNotes/${noteId}`);
    const updateData = {
      content,
      updatedAt: serverTimestamp(),
    };

    return from(updateDoc(noteRef, updateData)).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error updating note ${noteId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => new Error(`Failed to update note: ${error.message}`));
      })
    );
  }

  deleteDriverNote(noteId: string): Observable<void> {
    this.loadingSubject.next(true);

    if (!noteId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Note ID is required'));
    }

    const noteRef = doc(this.firestore, `driverNotes/${noteId}`);

    return from(deleteDoc(noteRef)).pipe(
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error deleting note ${noteId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => new Error(`Failed to delete note: ${error.message}`));
      })
    );
  }

  searchDrivers(searchTerm: string): Observable<UserProfile[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return of([]);
    }

    const searchTermLower = searchTerm.toLowerCase().trim();

    return this.getAllDrivers().pipe(
      map((drivers) => {
        return drivers.filter((driver) => {
          const nameMatch = driver.name?.toLowerCase().includes(searchTermLower);
          const emailMatch = driver.email?.toLowerCase().includes(searchTermLower);
          const firstNameMatch = driver.firstName?.toLowerCase().includes(searchTermLower);
          const lastNameMatch = driver.lastName?.toLowerCase().includes(searchTermLower);
          const phoneMatch = driver.phoneNumber?.includes(searchTerm) || driver.phone?.includes(searchTerm);

          return nameMatch || emailMatch || firstNameMatch || lastNameMatch || phoneMatch;
        });
      })
    );
  }

  private convertFirebaseUserToProfile(uid: string, data: any): UserProfile {
    return {
      id: uid,
      email: data.email || '',
      name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      phoneNumber: data.phoneNumber || data.phone || '',
      phone: data.phoneNumber || data.phone || '',
      role: data.role || UserRole.DRIVER,
      status: data.isActive ? 'active' : 'inactive',
      isActive: data.isActive !== false,
      company: data.company || '',
      type: data.type || 'customer',
      lastActivity: this.convertTimestamp(data.lastActivity) || this.convertTimestamp(data.updatedAt),
      createdAt: this.convertTimestamp(data.createdAt),
      updatedAt: this.convertTimestamp(data.updatedAt),
      permissions: data.permissions || {},
      licenseNumber: data.licenseNumber,
      licenseExpiry: this.convertTimestamp(data.licenseExpiry),
      vehicleType: data.vehicleType,
      areaCoverage: data.areaCoverage,
      availability: data.availability,
      notes: '',
    };
  }
}
