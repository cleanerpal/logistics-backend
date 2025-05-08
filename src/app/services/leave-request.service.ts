import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, doc, getDoc, getDocs, addDoc, deleteDoc, query, where, orderBy, serverTimestamp, updateDoc, limit } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { LeaveRequest, LeaveRequestStatus } from '../interfaces/leave-request.interface';
import { NotificationService } from './notification.service';
import { BaseFirebaseService } from './base-firebase.service';

@Injectable({
  providedIn: 'root',
})
export class LeaveRequestService extends BaseFirebaseService {
  private leaveRequestsSubject = new BehaviorSubject<LeaveRequest[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public leaveRequests$ = this.leaveRequestsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(protected override firestore: Firestore, protected override auth: Auth, private notificationService: NotificationService) {
    super(firestore, auth);
  }

  /**
   * Get all leave requests
   */
  getLeaveRequests(): Observable<LeaveRequest[]> {
    this.loadingSubject.next(true);

    const leaveRequestsRef = collection(this.firestore, 'leaveRequests');
    const q = query(leaveRequestsRef, orderBy('submitted', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const leaveRequests = snapshot.docs.map((doc) => {
          return this.convertFirebaseLeaveRequestToModel(doc.id, doc.data());
        });
        this.leaveRequestsSubject.next(leaveRequests);
        return leaveRequests;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching leave requests:', error);
        this.loadingSubject.next(false);
        this.leaveRequestsSubject.next([]);
        return of([]);
      })
    );
  }

  /**
   * Get pending leave requests
   */
  getPendingLeaveRequests(): Observable<LeaveRequest[]> {
    this.loadingSubject.next(true);

    const leaveRequestsRef = collection(this.firestore, 'leaveRequests');
    const q = query(leaveRequestsRef, where('status', '==', LeaveRequestStatus.PENDING), orderBy('submitted', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const leaveRequests = snapshot.docs.map((doc) => {
          return this.convertFirebaseLeaveRequestToModel(doc.id, doc.data());
        });
        return leaveRequests;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching pending leave requests:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get leave requests for a specific driver
   */
  getDriverLeaveRequests(driverId: string): Observable<LeaveRequest[]> {
    this.loadingSubject.next(true);

    const leaveRequestsRef = collection(this.firestore, 'leaveRequests');
    const q = query(leaveRequestsRef, where('driverId', '==', driverId), orderBy('submitted', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const leaveRequests = snapshot.docs.map((doc) => {
          return this.convertFirebaseLeaveRequestToModel(doc.id, doc.data());
        });
        return leaveRequests;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching leave requests for driver ${driverId}:`, error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get leave request by ID
   */
  getLeaveRequestById(requestId: string): Observable<LeaveRequest | null> {
    this.loadingSubject.next(true);

    const requestRef = doc(this.firestore, `leaveRequests/${requestId}`);

    return from(getDoc(requestRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return this.convertFirebaseLeaveRequestToModel(docSnap.id, docSnap.data());
        } else {
          return null;
        }
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching leave request ${requestId}:`, error);
        this.loadingSubject.next(false);
        return of(null);
      })
    );
  }

  /**
   * Create a new leave request
   */
  createLeaveRequest(leaveRequestData: Omit<LeaveRequest, 'id' | 'status' | 'submitted'>): Observable<string> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    // Prepare leave request data
    const newLeaveRequest = {
      ...leaveRequestData,
      status: LeaveRequestStatus.PENDING,
      submitted: serverTimestamp(),
    };

    const requestsRef = collection(this.firestore, 'leaveRequests');

    return from(addDoc(requestsRef, newLeaveRequest)).pipe(
      map((docRef) => {
        // Add notification about new leave request
        this.notificationService.addNotification({
          type: 'info',
          title: 'Leave Request Submitted',
          message: `A new leave request has been submitted by ${leaveRequestData.driverName}`,
          actionUrl: `/leave-requests`,
        });

        return docRef.id;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error creating leave request:', error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Approve a leave request
   */
  approveLeaveRequest(requestId: string, responseNotes?: string): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const requestRef = doc(this.firestore, `leaveRequests/${requestId}`);

    // First get the current leave request to get driver details
    return from(getDoc(requestRef)).pipe(
      map((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Leave request ${requestId} not found`);
        }
        return this.convertFirebaseLeaveRequestToModel(docSnap.id, docSnap.data());
      }),
      switchMap((leaveRequest) => {
        // Update leave request with approval
        const updateData = {
          status: LeaveRequestStatus.APPROVED,
          processedBy: userId,
          processedDate: serverTimestamp(),
          responseNotes: responseNotes || '',
        };

        return from(updateDoc(requestRef, updateData)).pipe(
          tap(() => {
            // Send notification to the driver
            this.notificationService.addNotification({
              type: 'success',
              title: 'Leave Request Approved',
              message: `Your leave request from ${this.formatDate(leaveRequest.startDate)} to ${this.formatDate(leaveRequest.endDate)} has been approved`,
              actionUrl: `/profile`,
            });
          })
        );
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error approving leave request ${requestId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Deny a leave request
   */
  denyLeaveRequest(requestId: string, responseNotes?: string): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const requestRef = doc(this.firestore, `leaveRequests/${requestId}`);

    // First get the current leave request to get driver details
    return from(getDoc(requestRef)).pipe(
      map((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Leave request ${requestId} not found`);
        }
        return this.convertFirebaseLeaveRequestToModel(docSnap.id, docSnap.data());
      }),
      switchMap((leaveRequest) => {
        // Update leave request with denial
        const updateData = {
          status: LeaveRequestStatus.DENIED,
          processedBy: userId,
          processedDate: serverTimestamp(),
          responseNotes: responseNotes || '',
        };

        return from(updateDoc(requestRef, updateData)).pipe(
          tap(() => {
            // Send notification to the driver
            this.notificationService.addNotification({
              type: 'warning',
              title: 'Leave Request Denied',
              message: `Your leave request from ${this.formatDate(leaveRequest.startDate)} to ${this.formatDate(leaveRequest.endDate)} has been denied`,
              actionUrl: `/profile`,
            });
          })
        );
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error denying leave request ${requestId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Convert Firestore data to LeaveRequest model
   */
  private convertFirebaseLeaveRequestToModel(id: string, data: any): LeaveRequest {
    return {
      id,
      driverId: data.driverId || '',
      driverName: data.driverName || '',
      type: data.type || '',
      startDate: this.convertTimestamp(data.startDate) || new Date(),
      endDate: this.convertTimestamp(data.endDate) || new Date(),
      notes: data.notes || '',
      status: data.status || LeaveRequestStatus.PENDING,
      submitted: this.convertTimestamp(data.submitted) || new Date(),
      processedBy: data.processedBy || undefined,
      processedDate: this.convertTimestamp(data.processedDate) || undefined,
      responseNotes: data.responseNotes || '',
    };
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
