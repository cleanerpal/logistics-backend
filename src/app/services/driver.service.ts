import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Auth, deleteUser } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  Timestamp,
  DocumentReference,
  CollectionReference,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface Driver {
  id: string;
  email: string;
  driverId: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: 'active' | 'inactive';
  role: 'driver';
  address?: string;
  licenseNumber?: string;
  licenseExpiry?: Timestamp;
  licenseType?: string;
  companyId?: string;
  companyName?: string;
  notes?: string;
  isOnline?: boolean;
  forcePasswordChange?: boolean;
  profileImage?: string;
  lastLogin?: Timestamp;
  lastActive?: Timestamp;
  deviceTokens?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

@Injectable({
  providedIn: 'root',
})
export class DriverService {
  private driversSubject = new BehaviorSubject<Driver[]>([]);
  public drivers$ = this.driversSubject.asObservable();

  private driversCollection: CollectionReference;
  private isLoading = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoading.asObservable();

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private functions: Functions,
    private snackBar: MatSnackBar
  ) {
    this.driversCollection = collection(this.firestore, 'users');
  }

  /**
   * Get a list of all drivers
   */
  getAllDrivers(): Observable<Driver[]> {
    this.isLoading.next(true);

    const driversQuery = query(
      this.driversCollection,
      where('role', '==', 'driver'),
      orderBy('createdAt', 'desc')
    );

    return from(getDocs(driversQuery)).pipe(
      map((querySnapshot) => {
        const drivers = querySnapshot.docs.map((doc) => {
          return { id: doc.id, ...doc.data() } as Driver;
        });
        this.driversSubject.next(drivers);
        return drivers;
      }),
      tap(() => this.isLoading.next(false)),
      catchError((error) => {
        console.error('Error fetching drivers:', error);
        this.isLoading.next(false);
        this.showSnackBar('Failed to load drivers', 'error');
        return of([]);
      })
    );
  }

  /**
   * Get a specific driver by ID
   */
  getDriverById(driverId: string): Observable<Driver> {
    this.isLoading.next(true);

    const driverRef = doc(this.firestore, 'users', driverId);

    return from(getDoc(driverRef)).pipe(
      map((driverDoc) => {
        if (!driverDoc.exists()) {
          throw new Error('Driver not found');
        }
        return { id: driverDoc.id, ...driverDoc.data() } as Driver;
      }),
      tap(() => this.isLoading.next(false)),
      catchError((error) => {
        console.error('Error fetching driver:', error);
        this.isLoading.next(false);
        this.showSnackBar('Failed to load driver', 'error');
        throw error;
      })
    );
  }

  /**
   * Create a new driver with Firebase Auth and Firestore
   */
  createDriver(driverData: Partial<Driver>): Observable<Driver> {
    this.isLoading.next(true);

    // Generate a temporary password
    const tempPassword = this.generateTempPassword();

    // Use Cloud Functions to create the user to handle admin privileges
    const createUserFunction = httpsCallable(
      this.functions,
      'createUserAccount'
    );

    return from(
      createUserFunction({
        email: driverData.email,
        password: tempPassword,
        role: 'driver',
      })
    ).pipe(
      switchMap((result) => {
        const userId = result.data.uid;

        // Generate a driver ID if not provided
        const driverId =
          driverData.driverId || `DRV-${Date.now().toString().slice(-6)}`;

        // Prepare driver data
        const newDriver: Partial<Driver> = {
          ...driverData,
          id: userId,
          driverId,
          role: 'driver',
          status: driverData.status || 'active',
          forcePasswordChange: true,
          isOnline: false,
          createdAt: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp,
        };

        // Store in Firestore
        const userRef = doc(this.firestore, 'users', userId);

        return from(
          setDoc(userRef, {
            ...newDriver,
            id: undefined, // Remove ID as it's part of the document path
          })
        ).pipe(
          switchMap(() => {
            // Send password reset email
            const sendResetFunction = httpsCallable(
              this.functions,
              'sendPasswordResetEmail'
            );
            return from(sendResetFunction({ email: driverData.email }));
          }),
          map(() => {
            const createdDriver = { id: userId, ...newDriver } as Driver;
            this.showSnackBar(
              'Driver created successfully, password reset email sent',
              'success'
            );
            // Refresh the drivers list
            this.getAllDrivers().subscribe();
            return createdDriver;
          })
        );
      }),
      tap(() => this.isLoading.next(false)),
      catchError((error) => {
        console.error('Error creating driver:', error);
        this.isLoading.next(false);
        this.showSnackBar(`Failed to create driver: ${error.message}`, 'error');
        throw error;
      })
    );
  }

  /**
   * Update an existing driver's details in Firestore
   */
  updateDriver(id: string, driverData: Partial<Driver>): Observable<Driver> {
    this.isLoading.next(true);

    const driverRef = doc(this.firestore, 'users', id);

    return from(getDoc(driverRef)).pipe(
      switchMap((driverDoc) => {
        if (!driverDoc.exists()) {
          throw new Error('Driver not found');
        }

        const updatedData = {
          ...driverData,
          updatedAt: serverTimestamp(),
        };

        // If email is being updated, update it in Auth as well
        const currentEmail = driverDoc.data().email;
        if (driverData.email && driverData.email !== currentEmail) {
          // Use Cloud Functions to update the email (requires admin privileges)
          const updateEmailFunction = httpsCallable(
            this.functions,
            'updateUserEmail'
          );
          return from(
            updateEmailFunction({
              uid: id,
              newEmail: driverData.email,
            })
          ).pipe(
            switchMap(() => from(updateDoc(driverRef, updatedData))),
            map(() => {
              const updatedDriver = {
                id,
                ...driverDoc.data(),
                ...driverData,
              } as Driver;
              this.getAllDrivers().subscribe(); // Refresh the list
              return updatedDriver;
            })
          );
        } else {
          return from(updateDoc(driverRef, updatedData)).pipe(
            map(() => {
              const updatedDriver = {
                id,
                ...driverDoc.data(),
                ...driverData,
              } as Driver;
              this.getAllDrivers().subscribe(); // Refresh the list
              return updatedDriver;
            })
          );
        }
      }),
      tap(() => {
        this.isLoading.next(false);
        this.showSnackBar('Driver updated successfully', 'success');
      }),
      catchError((error) => {
        console.error('Error updating driver:', error);
        this.isLoading.next(false);
        this.showSnackBar(`Failed to update driver: ${error.message}`, 'error');
        throw error;
      })
    );
  }

  /**
   * Delete a driver (both Auth and Firestore)
   */
  deleteDriver(id: string): Observable<void> {
    this.isLoading.next(true);

    // Use Cloud Functions to delete the user (requires admin privileges)
    const deleteUserFunction = httpsCallable(
      this.functions,
      'deleteUserAccount'
    );

    return from(deleteUserFunction({ uid: id })).pipe(
      switchMap(() => {
        // Delete from Firestore
        const driverRef = doc(this.firestore, 'users', id);
        return from(deleteDoc(driverRef));
      }),
      tap(() => {
        this.isLoading.next(false);
        this.showSnackBar('Driver deleted successfully', 'success');
        // Refresh the list
        this.getAllDrivers().subscribe();
      }),
      catchError((error) => {
        console.error('Error deleting driver:', error);
        this.isLoading.next(false);
        this.showSnackBar(`Failed to delete driver: ${error.message}`, 'error');
        throw error;
      })
    );
  }

  /**
   * Enable or disable a driver account
   */
  updateDriverStatus(
    id: string,
    status: 'active' | 'inactive'
  ): Observable<void> {
    this.isLoading.next(true);

    const driverRef = doc(this.firestore, 'users', id);

    // Use Cloud Functions to disable/enable the user (requires admin privileges)
    const updateUserStatusFunction = httpsCallable(
      this.functions,
      'updateUserStatus'
    );

    return from(
      updateUserStatusFunction({
        uid: id,
        disabled: status === 'inactive',
      })
    ).pipe(
      switchMap(() => {
        // Update status in Firestore
        return from(
          updateDoc(driverRef, {
            status,
            updatedAt: serverTimestamp(),
          })
        );
      }),
      tap(() => {
        this.isLoading.next(false);
        this.showSnackBar(
          `Driver ${
            status === 'active' ? 'activated' : 'deactivated'
          } successfully`,
          'success'
        );
        // Refresh the list
        this.getAllDrivers().subscribe();
      }),
      catchError((error) => {
        console.error('Error updating driver status:', error);
        this.isLoading.next(false);
        this.showSnackBar(
          `Failed to update driver status: ${error.message}`,
          'error'
        );
        throw error;
      })
    );
  }

  /**
   * Reset a driver's password
   */
  resetDriverPassword(email: string): Observable<void> {
    this.isLoading.next(true);

    // Use Cloud Functions to send the password reset email
    const sendPasswordResetFunction = httpsCallable(
      this.functions,
      'sendPasswordResetEmail'
    );

    return from(sendPasswordResetFunction({ email })).pipe(
      switchMap(() => {
        // Also set forcePasswordChange flag
        const driversQuery = query(
          this.driversCollection,
          where('email', '==', email)
        );

        return from(getDocs(driversQuery)).pipe(
          switchMap((querySnapshot) => {
            if (!querySnapshot.empty) {
              const driverDoc = querySnapshot.docs[0];
              const driverRef = doc(this.firestore, 'users', driverDoc.id);

              return from(
                updateDoc(driverRef, {
                  forcePasswordChange: true,
                  updatedAt: serverTimestamp(),
                })
              );
            }
            return of(undefined);
          })
        );
      }),
      tap(() => {
        this.isLoading.next(false);
        this.showSnackBar(`Password reset email sent to ${email}`, 'success');
      }),
      catchError((error) => {
        console.error('Error resetting driver password:', error);
        this.isLoading.next(false);
        this.showSnackBar(
          `Failed to send password reset email: ${error.message}`,
          'error'
        );
        throw error;
      })
    );
  }

  /**
   * Generate a temporary random password for new drivers
   */
  private generateTempPassword(length: number = 12): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';

    // Ensure we have at least one of each required character type
    password += 'Aa1@'; // Ensures uppercase, lowercase, number, and special character

    // Fill the rest with random characters
    for (let i = 0; i < length - 4; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    // Shuffle the password characters
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Show snackbar message
   */
  private showSnackBar(
    message: string,
    type: 'success' | 'error' | 'info'
  ): void {
    const className = {
      success: 'success-snackbar',
      error: 'error-snackbar',
      info: 'info-snackbar',
    }[type];

    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [className],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
