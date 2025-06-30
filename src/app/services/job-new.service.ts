import { Injectable, OnDestroy, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
  Unsubscribe,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, combineLatest, forkJoin, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { Job } from '../interfaces/job-new.interface';
import { UserPermissionKey } from '../interfaces/user-profile.interface';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class JobNewService implements OnDestroy {
  // Use inject() for proper injection context
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  private jobsSubject = new BehaviorSubject<Job[]>([]);
  public jobs$ = this.jobsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private activeListeners: Unsubscribe[] = [];
  private lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null;

  // Current user observable
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Listen to auth state changes
    this.auth.onAuthStateChanged((user) => {
      this.currentUserSubject.next(user);
    });

    this.initJobListener();
  }

  /**
   * Get current user ID
   */
  get currentUserId(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  ngOnDestroy(): void {
    this.cleanupListeners();
  }

  public cleanupListeners(): void {
    this.activeListeners.forEach((unsub) => unsub());
    this.activeListeners = [];
  }

  private initJobListener(): void {
    this.cleanupListeners();

    const authSubscription = this.currentUser$.subscribe((user) => {
      if (!user) {
        this.jobsSubject.next([]);
        return;
      }

      this.loadingSubject.next(true);

      this.authService.getUserProfile().subscribe({
        next: (profile) => {
          const canViewAll = profile?.permissions?.isAdmin || false;
          const canViewUnallocated = profile?.permissions?.canViewUnallocated || false;

          this.cleanupListeners();

          if (canViewAll) {
            this.listenToAllJobs();
          } else if (canViewUnallocated) {
            this.listenToDriverAndUnallocatedJobs(user.uid);
          } else {
            this.listenToDriverJobs(user.uid);
          }
        },
        error: (error) => {
          console.error('Error fetching user profile for job listener:', error);
          this.loadingSubject.next(false);
        },
      });
    });

    this.activeListeners.push(() => authSubscription.unsubscribe());
  }

  private listenToAllJobs(): void {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, orderBy('updatedAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const jobs = snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()));

        this.lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        this.jobsSubject.next(jobs);
        this.loadingSubject.next(false);
      },
      (error) => {
        console.error('Error listening to all jobs:', error);
        this.loadingSubject.next(false);
      }
    );

    this.activeListeners.push(unsubscribe);
  }

  private listenToDriverJobs(driverId: string): void {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('driverId', '==', driverId), orderBy('updatedAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const jobs = snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()));

        this.jobsSubject.next(jobs);
        this.loadingSubject.next(false);
      },
      (error) => {
        console.error('Error listening to driver jobs:', error);
        this.loadingSubject.next(false);
      }
    );

    this.activeListeners.push(unsubscribe);
  }

  private listenToDriverAndUnallocatedJobs(driverId: string): void {
    const jobsRef = collection(this.firestore, 'jobs');

    // Query for driver's jobs
    const driverJobsQuery = query(jobsRef, where('driverId', '==', driverId), orderBy('updatedAt', 'desc'), limit(25));

    // Query for unallocated jobs
    const unallocatedJobsQuery = query(jobsRef, where('status', '==', 'unallocated'), orderBy('updatedAt', 'desc'), limit(25));

    const driverJobsUnsubscribe = onSnapshot(driverJobsQuery, (snapshot) => {
      const driverJobs = snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()));
      this.updateCombinedJobs(driverJobs, 'driver');
    });

    const unallocatedJobsUnsubscribe = onSnapshot(unallocatedJobsQuery, (snapshot) => {
      const unallocatedJobs = snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()));
      this.updateCombinedJobs(unallocatedJobs, 'unallocated');
    });

    this.activeListeners.push(driverJobsUnsubscribe, unallocatedJobsUnsubscribe);
  }

  private combinedJobs: { driver: Job[]; unallocated: Job[] } = { driver: [], unallocated: [] };

  private updateCombinedJobs(jobs: Job[], type: 'driver' | 'unallocated'): void {
    this.combinedJobs[type] = jobs;

    // Combine and deduplicate jobs
    const allJobs = [...this.combinedJobs.driver, ...this.combinedJobs.unallocated];
    const uniqueJobs = allJobs.filter((job, index, self) => index === self.findIndex((j) => j.id === job.id));

    // Sort by updated date
    const convertTimestamp = (timestamp: any): Date | undefined => {
      if (!timestamp) return undefined;
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
        return timestamp.toDate();
      }
      if (timestamp) {
        return new Date(timestamp);
      }
      return undefined;
    };
    uniqueJobs.sort((a, b) => {
      const dateA = convertTimestamp(a.updatedAt) || convertTimestamp(a.createdAt) || new Date(0);
      const dateB = convertTimestamp(b.updatedAt) || convertTimestamp(b.createdAt) || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });

    this.jobsSubject.next(uniqueJobs);
    this.loadingSubject.next(false);
  }

  /**
   * Get recent jobs with pagination
   */
  getRecentJobs(limitCount: number = 25): Observable<Job[]> {
    this.loadingSubject.next(true);

    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, orderBy('updatedAt', 'desc'), limit(limitCount));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        this.lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        console.log(this.lastVisibleDoc);
        return snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()));
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching recent jobs:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: string): Observable<Job[]> {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('status', '==', status), orderBy('updatedAt', 'desc'), limit(100));

    return from(getDocs(q)).pipe(
      map((snapshot) => snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()))),
      catchError((error) => {
        console.error(`Error fetching jobs with status ${status}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get jobs by driver ID
   */
  getJobsByDriver(driverId: string): Observable<Job[]> {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('driverId', '==', driverId), orderBy('updatedAt', 'desc'), limit(50));

    return from(getDocs(q)).pipe(
      map((snapshot) => snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()))),
      catchError((error) => {
        console.error(`Error fetching jobs for driver ${driverId}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get jobs by vehicle ID
   */
  getJobsByVehicle(vehicleId: string): Observable<Job[]> {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('vehicleId', '==', vehicleId), orderBy('updatedAt', 'desc'), limit(50));

    return from(getDocs(q)).pipe(
      map((snapshot) => snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()))),
      catchError((error) => {
        console.error(`Error fetching jobs for vehicle ${vehicleId}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get jobs by customer ID or customer name
   */
  getJobsByCustomer(customerId?: string, customerName?: string): Observable<Job[]> {
    const jobsRef = collection(this.firestore, 'jobs');

    let q;
    if (customerId) {
      q = query(jobsRef, where('customerId', '==', customerId), orderBy('updatedAt', 'desc'), limit(50));
    } else if (customerName) {
      q = query(jobsRef, where('customerName', '==', customerName), orderBy('updatedAt', 'desc'), limit(50));
    } else {
      return of([]);
    }

    return from(getDocs(q)).pipe(
      map((snapshot) => snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()))),
      catchError((error) => {
        console.error(`Error fetching jobs for customer:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get customer jobs (alias for getJobsByCustomer)
   */
  getCustomerJobs(customerId: string): Observable<Job[]> {
    return this.getJobsByCustomer(customerId);
  }

  /**
   * Get driver jobs (current user's jobs or all driver jobs for admin)
   */
  getDriverJobs(driverId?: string): Observable<Job[]> {
    const targetDriverId = driverId || this.currentUserId;

    if (!targetDriverId) {
      return of([]);
    }

    return this.getJobsByDriver(targetDriverId);
  }

  /**
   * Get jobs by date range
   */
  getJobsByDateRange(startDate: Date, endDate: Date, status?: string): Observable<Job[]> {
    const jobsRef = collection(this.firestore, 'jobs');

    let q;
    if (status) {
      q = query(
        jobsRef,
        where('status', '==', status),
        where('collectionDate', '>=', startDate),
        where('collectionDate', '<=', endDate),
        orderBy('collectionDate', 'asc'),
        limit(100)
      );
    } else {
      q = query(jobsRef, where('collectionDate', '>=', startDate), where('collectionDate', '<=', endDate), orderBy('collectionDate', 'asc'), limit(100));
    }

    return from(getDocs(q)).pipe(
      map((snapshot) => snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()))),
      catchError((error) => {
        console.error(`Error fetching jobs by date range:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get jobs by multiple statuses
   */
  getJobsByStatuses(statuses: string[]): Observable<Job[]> {
    if (statuses.length === 0) {
      return of([]);
    }

    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('status', 'in', statuses), orderBy('updatedAt', 'desc'), limit(100));

    return from(getDocs(q)).pipe(
      map((snapshot) => snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()))),
      catchError((error) => {
        console.error(`Error fetching jobs by statuses:`, error);
        return of([]);
      })
    );
  }

  /**
   * Search jobs by text (registration, customer name, etc.)
   */
  searchJobs(searchTerm: string, limit: number = 25): Observable<Job[]> {
    if (!searchTerm.trim()) {
      return this.getRecentJobs(limit);
    }

    const jobsRef = collection(this.firestore, 'jobs');

    // Since Firestore doesn't support full-text search, we'll get recent jobs
    // and filter them client-side. For production, consider using Algolia or similar.
    return this.getRecentJobs(100).pipe(
      map((jobs) => {
        const searchLower = searchTerm.toLowerCase();
        return jobs
          .filter(
            (job) =>
              job.id.toLowerCase().includes(searchLower) ||
              job['regNumber']?.toLowerCase().includes(searchLower) ||
              job.customerName?.toLowerCase().includes(searchLower) ||
              job['make']?.toLowerCase().includes(searchLower) ||
              job['model']?.toLowerCase().includes(searchLower) ||
              job['collectionTown']?.toLowerCase().includes(searchLower) ||
              job['deliveryTown']?.toLowerCase().includes(searchLower)
          )
          .slice(0, limit);
      })
    );
  }

  /**
   * Get active jobs (non-completed statuses)
   */
  getActiveJobs(): Observable<Job[]> {
    const activeStatuses = ['unallocated', 'allocated', 'collected', 'in-transit'];
    return this.getJobsByStatuses(activeStatuses);
  }

  /**
   * Get completed jobs
   */
  getCompletedJobs(): Observable<Job[]> {
    const completedStatuses = ['delivered', 'completed'];
    return this.getJobsByStatuses(completedStatuses);
  }

  /**
   * Get jobs requiring attention (overdue, high priority, etc.)
   */
  getJobsRequiringAttention(): Observable<Job[]> {
    const jobsRef = collection(this.firestore, 'jobs');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get jobs that are overdue or high priority
    const overdueQuery = query(
      jobsRef,
      where('collectionDate', '<', today),
      where('status', 'in', ['unallocated', 'allocated']),
      orderBy('collectionDate', 'asc'),
      limit(50)
    );

    const highPriorityQuery = query(
      jobsRef,
      where('priority', '==', 'urgent'),
      where('status', 'in', ['unallocated', 'allocated', 'collected']),
      orderBy('updatedAt', 'desc'),
      limit(25)
    );

    return combineLatest([
      from(getDocs(overdueQuery)).pipe(
        map((snapshot) => snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()))),
        catchError(() => of([]))
      ),
      from(getDocs(highPriorityQuery)).pipe(
        map((snapshot) => snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()))),
        catchError(() => of([]))
      ),
    ]).pipe(
      map(([overdueJobs, highPriorityJobs]) => {
        // Combine and deduplicate
        const allJobs = [...overdueJobs, ...highPriorityJobs];
        const uniqueJobs = allJobs.filter((job, index, self) => index === self.findIndex((j) => j.id === job.id));

        // Sort by priority and date
        return uniqueJobs.sort((a, b) => {
          if (a['priority'] === 'urgent' && b['priority'] !== 'urgent') return -1;
          if (b['priority'] === 'urgent' && a['priority'] !== 'urgent') return 1;

          const dateA = new Date(a['collectionDate'] || a.createdAt).getTime();
          const dateB = new Date(b['collectionDate'] || b.createdAt).getTime();
          return dateA - dateB;
        });
      })
    );
  }

  /**
   * Get job statistics for a specific period
   */
  getJobStatisticsForPeriod(startDate: Date, endDate: Date): Observable<any> {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('createdAt', '>=', startDate), where('createdAt', '<=', endDate), orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()));

        // Calculate statistics
        const stats = {
          total: jobs.length,
          byStatus: {} as Record<string, number>,
          byPriority: {} as Record<string, number>,
          averageDuration: 0,
          completionRate: 0,
          onTimeDeliveries: 0,
        };

        jobs.forEach((job) => {
          // Count by status
          stats.byStatus[job.status] = (stats.byStatus[job.status] || 0) + 1;

          // Count by priority
          const priority = job['priority'] || 'normal';
          stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
        });

        // Calculate completion rate
        const completedJobs = jobs.filter((job) => ['delivered', 'completed'].includes(job.status));
        stats.completionRate = jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0;

        // Calculate on-time deliveries
        const onTimeJobs = completedJobs.filter((job) => {
          if (!job['deliveryDate'] || !job['deliveryCompleteTime']) return false;

          const scheduledDate = new Date(job['deliveryDate']);
          const actualDate = new Date(job['deliveryCompleteTime']);

          // Consider on-time if delivered on or before scheduled date
          return actualDate <= scheduledDate;
        });
        stats.onTimeDeliveries = completedJobs.length > 0 ? (onTimeJobs.length / completedJobs.length) * 100 : 0;

        // Calculate average duration for completed jobs
        const durationsInHours = completedJobs.filter((job) => job['actualDuration']).map((job) => job['actualDuration']!);

        stats.averageDuration = durationsInHours.length > 0 ? durationsInHours.reduce((sum, duration) => sum + duration, 0) / durationsInHours.length : 0;

        return stats;
      }),
      catchError((error) => {
        console.error('Error fetching job statistics:', error);
        return of({
          total: 0,
          byStatus: {},
          byPriority: {},
          averageDuration: 0,
          completionRate: 0,
          onTimeDeliveries: 0,
        });
      })
    );
  }
  getDashboardStats(): Observable<any> {
    this.loadingSubject.next(true);

    const jobsRef = collection(this.firestore, 'jobs');

    // Create queries for each status
    const unallocatedQuery = query(jobsRef, where('status', '==', 'unallocated'));
    const allocatedQuery = query(jobsRef, where('status', '==', 'allocated'));
    const collectedQuery = query(jobsRef, where('status', '==', 'collected'));
    const deliveredQuery = query(jobsRef, where('status', '==', 'delivered'));
    const completedQuery = query(jobsRef, where('status', '==', 'completed'));

    return combineLatest([
      from(getDocs(unallocatedQuery)).pipe(map((snap) => snap.size)),
      from(getDocs(allocatedQuery)).pipe(map((snap) => snap.size)),
      from(getDocs(collectedQuery)).pipe(map((snap) => snap.size)),
      from(getDocs(deliveredQuery)).pipe(map((snap) => snap.size)),
      from(getDocs(completedQuery)).pipe(map((snap) => snap.size)),
    ]).pipe(
      map(([unallocated, allocated, collected, delivered, completed]) => {
        const total = unallocated + allocated + collected + delivered + completed;
        const active = unallocated + allocated + collected;

        return {
          unallocated,
          allocated,
          collected,
          delivered,
          completed,
          total,
          active,
        };
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching dashboard stats:', error);
        this.loadingSubject.next(false);
        return of({
          unallocated: 0,
          allocated: 0,
          collected: 0,
          delivered: 0,
          completed: 0,
          total: 0,
          active: 0,
        });
      })
    );
  }

  /**
   * Get job by ID
   */
  getJobById(jobId: string): Observable<Job | null> {
    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    return from(getDoc(jobRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return this.convertFirebaseJobToModel(docSnap.id, docSnap.data());
        }
        return null;
      }),
      catchError((error) => {
        console.error(`Error fetching job ${jobId}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Create a new job
   */
  createJob(jobData: Partial<Job>): Observable<string> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const jobsRef = collection(this.firestore, 'jobs');

    const newJobData = {
      ...jobData,
      status: jobData.status || 'unallocated',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: this.currentUserId,
      updatedBy: this.currentUserId,
    };

    return from(addDoc(jobsRef, newJobData)).pipe(
      map((docRef) => docRef.id),
      tap((jobId) => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Job Created',
          message: `Job ${jobId} has been created successfully.`,
          actionUrl: `/jobs/${jobId}`,
        });
      }),
      catchError((error) => {
        console.error('Error creating job:', error);
        return throwError(() => new Error(`Failed to create job: ${error.message}`));
      })
    );
  }

  /**
   * Update job
   */
  updateJob(jobId: string, updateData: Partial<Job>): Observable<void> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    const updatedData = {
      ...updateData,
      updatedAt: serverTimestamp(),
      updatedBy: this.currentUserId,
    };

    return from(updateDoc(jobRef, updatedData)).pipe(
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Job Updated',
          message: `Job ${jobId} has been updated successfully.`,
        });
      }),
      catchError((error) => {
        console.error(`Error updating job ${jobId}:`, error);
        return throwError(() => new Error(`Failed to update job: ${error.message}`));
      })
    );
  }

  /**
   * Delete job
   */
  deleteJob(jobId: string): Observable<void> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.authService.hasPermission('canDeleteJobs' as UserPermissionKey).pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(() => new Error('You do not have permission to delete jobs'));
        }

        const jobRef = doc(this.firestore, `jobs/${jobId}`);
        return from(deleteDoc(jobRef));
      }),
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Job Deleted',
          message: `Job ${jobId} has been deleted successfully.`,
        });
      }),
      catchError((error) => {
        console.error(`Error deleting job ${jobId}:`, error);
        return throwError(() => new Error(`Failed to delete job: ${error.message}`));
      })
    );
  }

  /**
   * Allocate job to driver
   */
  allocateJobToDriver(jobId: string, driverId: string): Observable<void> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.authService.hasPermission('canAllocateJobs' as UserPermissionKey).pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(() => new Error('You do not have permission to allocate jobs'));
        }

        const jobRef = doc(this.firestore, `jobs/${jobId}`);
        const updateData = {
          driverId,
          status: 'allocated',
          allocatedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: this.currentUserId,
          statusUpdatedAt: serverTimestamp(),
        };

        return from(updateDoc(jobRef, updateData));
      }),
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Job Allocated',
          message: `Job ${jobId} has been allocated to driver successfully.`,
        });
      }),
      catchError((error) => {
        console.error(`Error allocating job ${jobId}:`, error);
        return throwError(() => new Error(`Failed to allocate job: ${error.message}`));
      })
    );
  }

  /**
   * Allocate job (simplified version - auto-detects driver or uses dialog)
   */
  allocateJob(jobId: string, driverId?: string): Observable<void> {
    if (driverId) {
      return this.allocateJobToDriver(jobId, driverId);
    }

    // If no driverId provided, allocate to current user (if they're a driver)
    if (this.currentUserId) {
      return this.authService.getUserProfile().pipe(
        switchMap((profile) => {
          if (profile?.role === 'driver') {
            return this.allocateJobToDriver(jobId, this.currentUserId!);
          } else {
            return throwError(() => new Error('Please specify a driver ID for job allocation'));
          }
        })
      );
    }

    return throwError(() => new Error('User not authenticated'));
  }

  /**
   * Unallocate job (remove driver assignment)
   */
  unallocateJob(jobId: string): Observable<void> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.authService.hasPermission('canAllocateJobs' as UserPermissionKey).pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(() => new Error('You do not have permission to unallocate jobs'));
        }

        const jobRef = doc(this.firestore, `jobs/${jobId}`);
        const updateData = {
          driverId: null,
          status: 'unallocated',
          allocatedAt: null,
          updatedAt: serverTimestamp(),
          updatedBy: this.currentUserId,
          statusUpdatedAt: serverTimestamp(),
        };

        return from(updateDoc(jobRef, updateData));
      }),
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Job Unallocated',
          message: `Job ${jobId} has been unallocated successfully.`,
        });
      }),
      catchError((error) => {
        console.error(`Error unallocating job ${jobId}:`, error);
        return throwError(() => new Error(`Failed to unallocate job: ${error.message}`));
      })
    );
  }

  /**
   * Start collection for job
   */
  startCollection(jobId: string, collectionData: any = {}): Observable<void> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.getJobById(jobId).pipe(
      switchMap((job) => {
        if (!job) {
          return throwError(() => new Error('Job not found'));
        }

        return forkJoin([of(job.driverId === this.currentUserId), this.authService.hasPermission('isAdmin' as UserPermissionKey)]).pipe(
          switchMap(([isAssignedToUser, isAdmin]) => {
            if (!isAssignedToUser && !isAdmin) {
              return throwError(() => new Error('You are not authorized to start collection for this job'));
            }

            const jobRef = doc(this.firestore, `jobs/${jobId}`);
            const updateData = {
              ...collectionData,
              status: 'collected',
              stage: 'awaiting-delivery',
              collectionStartTime: serverTimestamp(),
              updatedAt: serverTimestamp(),
              updatedBy: this.currentUserId,
              statusUpdatedAt: serverTimestamp(),
            };

            return from(updateDoc(jobRef, updateData));
          })
        );
      }),
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Collection Started',
          message: `Collection has been started for job ${jobId}`,
        });
      }),
      catchError((error) => {
        console.error(`Error starting collection for job ${jobId}:`, error);
        return throwError(() => new Error(`Failed to start collection: ${error.message}`));
      })
    );
  }

  /**
   * Start delivery for job
   */
  startDelivery(jobId: string, deliveryData: any = {}): Observable<void> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.getJobById(jobId).pipe(
      switchMap((job) => {
        if (!job) {
          return throwError(() => new Error('Job not found'));
        }

        return forkJoin([of(job.driverId === this.currentUserId), this.authService.hasPermission('isAdmin' as UserPermissionKey)]).pipe(
          switchMap(([isAssignedToUser, isAdmin]) => {
            if (!isAssignedToUser && !isAdmin) {
              return throwError(() => new Error('You are not authorized to start delivery for this job'));
            }

            const jobRef = doc(this.firestore, `jobs/${jobId}`);
            const updateData = {
              ...deliveryData,
              status: 'in-transit',
              stage: 'delivering',
              deliveryStartTime: serverTimestamp(),
              updatedAt: serverTimestamp(),
              updatedBy: this.currentUserId,
              statusUpdatedAt: serverTimestamp(),
            };

            return from(updateDoc(jobRef, updateData));
          })
        );
      }),
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Delivery Started',
          message: `Delivery has been started for job ${jobId}`,
        });
      }),
      catchError((error) => {
        console.error(`Error starting delivery for job ${jobId}:`, error);
        return throwError(() => new Error(`Failed to start delivery: ${error.message}`));
      })
    );
  }

  /**
   * Complete delivery for job
   */
  completeDelivery(jobId: string, deliveryData: any): Observable<void> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.getJobById(jobId).pipe(
      switchMap((job) => {
        if (!job) {
          return throwError(() => new Error('Job not found'));
        }

        return forkJoin([of(job.driverId === this.currentUserId), this.authService.hasPermission('isAdmin' as UserPermissionKey)]).pipe(
          switchMap(([isAssignedToUser, isAdmin]) => {
            if (!isAssignedToUser && !isAdmin) {
              return throwError(() => new Error('You are not authorized to complete delivery for this job'));
            }

            const jobRef = doc(this.firestore, `jobs/${jobId}`);
            const updateData = {
              ...deliveryData,
              status: 'delivered',
              stage: 'completed',
              deliveryCompleteTime: serverTimestamp(),
              updatedAt: serverTimestamp(),
              updatedBy: this.currentUserId,
              statusUpdatedAt: serverTimestamp(),
            };

            return from(updateDoc(jobRef, updateData));
          })
        );
      }),
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Delivery Completed',
          message: `Delivery has been completed for job ${jobId}`,
        });
      }),
      catchError((error) => {
        console.error(`Error completing delivery for job ${jobId}:`, error);
        return throwError(() => new Error(`Failed to complete delivery: ${error.message}`));
      })
    );
  }

  /**
   * Bulk update jobs
   */
  bulkUpdateJobs(jobIds: string[], updateData: Partial<Job>): Observable<void> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    if (jobIds.length === 0) {
      return of(undefined);
    }

    return this.authService.hasPermission('canEditJobs' as UserPermissionKey).pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(() => new Error('You do not have permission to edit jobs'));
        }

        const batch = writeBatch(this.firestore);

        jobIds.forEach((jobId) => {
          const jobRef = doc(this.firestore, `jobs/${jobId}`);
          const batchUpdateData = {
            ...updateData,
            updatedAt: serverTimestamp(),
            updatedBy: this.currentUserId,
          };
          batch.update(jobRef, batchUpdateData);
        });

        return from(batch.commit());
      }),
      tap(() => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Jobs Updated',
          message: `${jobIds.length} jobs have been updated successfully.`,
        });
      }),
      catchError((error) => {
        console.error('Error bulk updating jobs:', error);
        return throwError(() => new Error(`Failed to update jobs: ${error.message}`));
      })
    );
  }

  /**
   * Duplicate job
   */
  duplicateJob(jobId: string): Observable<string> {
    if (!this.currentUserId) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.authService.hasPermission('canCreateJobs' as UserPermissionKey).pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(() => new Error('You do not have permission to create jobs'));
        }

        return this.getJobById(jobId);
      }),
      switchMap((originalJob) => {
        if (!originalJob) {
          return throwError(() => new Error('Original job not found'));
        }

        // Create new job data based on original, but reset certain fields
        const newJobData = {
          ...originalJob,
          // Remove fields that shouldn't be duplicated
          id: undefined,
          driverId: null,
          status: 'unallocated',
          stage: '',

          // Reset timestamps
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: this.currentUserId,
          updatedBy: this.currentUserId,

          // Clear progress-related fields
          allocatedAt: undefined,
          collectionStartTime: undefined,
          collectionCompleteTime: undefined,
          deliveryStartTime: undefined,
          deliveryCompleteTime: undefined,
          statusUpdatedAt: serverTimestamp(),

          // Reset optional process fields
          actualDuration: undefined,
        };

        // Remove undefined values to avoid Firestore issues
        Object.keys(newJobData).forEach((key) => {
          if (newJobData[key as keyof typeof newJobData] === undefined) {
            delete newJobData[key as keyof typeof newJobData];
          }
        });

        const jobsRef = collection(this.firestore, 'jobs');
        return from(addDoc(jobsRef, newJobData)).pipe(map((docRef) => docRef.id));
      }),
      tap((newJobId) => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Job Duplicated',
          message: `Job has been duplicated successfully. New job ID: ${newJobId}`,
          actionUrl: `/jobs/${newJobId}`,
        });
      }),
      catchError((error) => {
        console.error(`Error duplicating job ${jobId}:`, error);
        return throwError(() => new Error(`Failed to duplicate job: ${error.message}`));
      })
    );
  }

  /**
   * Get jobs with pagination
   */
  getJobsWithPagination(
    limitCount: number = 25,
    startAfterDoc?: QueryDocumentSnapshot<DocumentData>
  ): Observable<{ jobs: Job[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
    const jobsRef = collection(this.firestore, 'jobs');

    let q = query(jobsRef, orderBy('updatedAt', 'desc'), limit(limitCount));

    if (startAfterDoc) {
      q = query(jobsRef, orderBy('updatedAt', 'desc'), startAfter(startAfterDoc), limit(limitCount));
    }

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => this.convertFirebaseJobToModel(doc.id, doc.data()));
        const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

        return { jobs, lastDoc };
      }),
      catchError((error) => {
        console.error('Error fetching jobs with pagination:', error);
        return of({ jobs: [], lastDoc: null });
      })
    );
  }

  /**
   * Convert Firebase document to Job model
   */
  private convertFirebaseJobToModel(id: string, data: any): Job {
    const convertTimestamp = (timestamp: any): Date | undefined => {
      if (!timestamp) return undefined;

      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
        return timestamp.toDate();
      }

      if (timestamp) {
        return new Date(timestamp);
      }

      return undefined;
    };

    return {
      id,
      vehicleId: data.vehicleId || '',
      driverId: data.driverId || null,
      status: data.status || 'unallocated',
      stage: data.stage || '',

      // Customer and vehicle information
      customerName: data.customerName || '',
      customerEmail: data.customerEmail || '',
      customerPhone: data.customerPhone || '',
      regNumber: data.regNumber || '',
      make: data.make || '',
      model: data.model || '',
      year: data.year || null,
      color: data.color || '',

      // Location information
      collectionAddress: data.collectionAddress || '',
      collectionTown: data.collectionTown || '',
      collectionPostcode: data.collectionPostcode || '',
      deliveryAddress: data.deliveryAddress || '',
      deliveryTown: data.deliveryTown || '',
      deliveryPostcode: data.deliveryPostcode || '',

      // Dates
      collectionDate: convertTimestamp(data.collectionDate),
      deliveryDate: convertTimestamp(data.deliveryDate),
      createdAt: convertTimestamp(data.createdAt) || new Date(),
      updatedAt: convertTimestamp(data.updatedAt) || new Date(),

      // Timestamps for various stages
      allocatedAt: convertTimestamp(data.allocatedAt),
      collectionStartTime: convertTimestamp(data.collectionStartTime),
      collectionCompleteTime: convertTimestamp(data.collectionCompleteTime),
      deliveryStartTime: convertTimestamp(data.deliveryStartTime),
      deliveryCompleteTime: convertTimestamp(data.deliveryCompleteTime),
      statusUpdatedAt: convertTimestamp(data.statusUpdatedAt),

      // Additional fields
      notes: data.notes || '',
      specialInstructions: data.specialInstructions || '',
      priority: data.priority || 'normal',
      estimatedDuration: data.estimatedDuration || null,
      actualDuration: data.actualDuration || null,

      // Tracking fields
      createdBy: data.createdBy || '',
      updatedBy: data.updatedBy || '',

      // Optional fields that might be present
      ...Object.keys(data).reduce((acc: any, key) => {
        if (
          ![
            'id',
            'vehicleId',
            'driverId',
            'status',
            'stage',
            'customerName',
            'customerEmail',
            'customerPhone',
            'regNumber',
            'make',
            'model',
            'year',
            'color',
            'collectionAddress',
            'collectionTown',
            'collectionPostcode',
            'deliveryAddress',
            'deliveryTown',
            'deliveryPostcode',
            'collectionDate',
            'deliveryDate',
            'createdAt',
            'updatedAt',
            'allocatedAt',
            'collectionStartTime',
            'collectionCompleteTime',
            'deliveryStartTime',
            'deliveryCompleteTime',
            'statusUpdatedAt',
            'notes',
            'specialInstructions',
            'priority',
            'estimatedDuration',
            'actualDuration',
            'createdBy',
            'updatedBy',
          ].includes(key)
        ) {
          acc[key] = data[key];
        }
        return acc;
      }, {}),
    };
  }
}
