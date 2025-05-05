import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  BehaviorSubject,
  Observable,
  forkJoin,
  from,
  of,
  throwError,
} from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Job } from '../interfaces/job.interface';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class JobService {
  private jobsSubject = new BehaviorSubject<Job[]>([]);
  public jobs$ = this.jobsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private authService: AuthService
  ) {
    // Initialize job listener when authentication state changes
    this.authService.user$.subscribe((user) => {
      if (!user) {
        this.jobsSubject.next([]);
        return;
      }

      this.setupJobListener(user.uid);
    });
  }

  /**
   * Set up real-time listener for jobs based on user permissions
   */
  private setupJobListener(userId: string): void {
    this.loadingSubject.next(true);

    this.authService.getUserProfile().subscribe((profile) => {
      if (!profile) {
        this.jobsSubject.next([]);
        this.loadingSubject.next(false);
        return;
      }

      const isAdmin = profile.permissions?.isAdmin || false;
      const canViewUnallocated =
        profile.permissions?.canViewUnallocated || false;

      if (isAdmin) {
        this.listenToAllJobs();
      } else if (canViewUnallocated) {
        this.listenToDriverAndUnallocatedJobs(userId);
      } else {
        this.listenToDriverJobs(userId);
      }
    });
  }

  /**
   * Listen to all jobs (for admin users)
   */
  private listenToAllJobs(): void {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
        this.jobsSubject.next(jobs);
        this.loadingSubject.next(false);
      },
      (error) => {
        console.error('Error fetching all jobs:', error);
        this.loadingSubject.next(false);
      }
    );
  }

  /**
   * Listen to driver's jobs and unallocated jobs
   */
  private listenToDriverAndUnallocatedJobs(userId: string): void {
    const assignedJobsRef = collection(this.firestore, 'jobs');
    const assignedQuery = query(
      assignedJobsRef,
      where('driverId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unallocatedJobsRef = collection(this.firestore, 'jobs');
    const unallocatedQuery = query(
      unallocatedJobsRef,
      where('status', '==', 'unallocated'),
      orderBy('createdAt', 'desc')
    );

    const assignedUnsubscribe = onSnapshot(
      assignedQuery,
      (assignedSnapshot) => {
        const assignedJobs = assignedSnapshot.docs.map((doc) =>
          this.convertFirebaseJobToModel(doc.id, doc.data())
        );

        const unallocatedUnsubscribe = onSnapshot(
          unallocatedQuery,
          (unallocatedSnapshot) => {
            const unallocatedJobs = unallocatedSnapshot.docs.map((doc) =>
              this.convertFirebaseJobToModel(doc.id, doc.data())
            );

            const allJobsMap = new Map<string, Job>();
            [...assignedJobs, ...unallocatedJobs].forEach((job) => {
              allJobsMap.set(job.id, job);
            });

            const allJobs = Array.from(allJobsMap.values());
            this.jobsSubject.next(allJobs);
            this.loadingSubject.next(false);
          },
          (error) => {
            console.error('Error fetching unallocated jobs:', error);

            this.jobsSubject.next(assignedJobs);
            this.loadingSubject.next(false);
          }
        );
      },
      (error) => {
        console.error('Error fetching assigned jobs:', error);
        this.loadingSubject.next(false);

        this.jobsSubject.next([]);
      }
    );
  }

  /**
   * Listen to driver's jobs only
   */
  private listenToDriverJobs(userId: string): void {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(
      jobsRef,
      where('driverId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
        this.jobsSubject.next(jobs);
        this.loadingSubject.next(false);
      },
      (error) => {
        console.error('Error fetching driver jobs:', error);
        this.loadingSubject.next(false);
      }
    );
  }

  /**
   * Get jobs available for the current driver
   */
  getDriverJobs(): Observable<Job[]> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      return of([]);
    }

    this.loadingSubject.next(true);

    return forkJoin([
      this.authService.hasPermission('canViewUnallocated'),
      this.authService.hasPermission('isAdmin'),
    ]).pipe(
      switchMap(([canViewUnallocated, isAdmin]) => {
        if (isAdmin) {
          return this.getAllJobs();
        } else if (canViewUnallocated) {
          return this.getDriverAndUnallocatedJobs(currentUser.uid);
        } else {
          return this.getAssignedDriverJobs(currentUser.uid);
        }
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching jobs:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get all jobs (for admin users)
   */
  private getAllJobs(): Observable<Job[]> {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });

        this.jobsSubject.next(jobs);

        return jobs;
      })
    );
  }

  /**
   * Get jobs assigned to a driver and unallocated jobs
   */
  private getDriverAndUnallocatedJobs(userId: string): Observable<Job[]> {
    const assignedJobsRef = collection(this.firestore, 'jobs');
    const assignedQuery = query(
      assignedJobsRef,
      where('driverId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unallocatedJobsRef = collection(this.firestore, 'jobs');
    const unallocatedQuery = query(
      unallocatedJobsRef,
      where('status', '==', 'unallocated'),
      orderBy('createdAt', 'desc')
    );

    return forkJoin([
      from(getDocs(assignedQuery)),
      from(getDocs(unallocatedQuery)),
    ]).pipe(
      map(([assignedSnapshot, unallocatedSnapshot]) => {
        const assignedJobs = assignedSnapshot.docs.map((doc) =>
          this.convertFirebaseJobToModel(doc.id, doc.data())
        );

        const unallocatedJobs = unallocatedSnapshot.docs.map((doc) =>
          this.convertFirebaseJobToModel(doc.id, doc.data())
        );

        const allJobsMap = new Map<string, Job>();
        [...assignedJobs, ...unallocatedJobs].forEach((job) => {
          allJobsMap.set(job.id, job);
        });

        const allJobs = Array.from(allJobsMap.values());

        this.jobsSubject.next(allJobs);

        return allJobs;
      })
    );
  }

  /**
   * Get jobs assigned to a specific driver
   */
  private getAssignedDriverJobs(userId: string): Observable<Job[]> {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(
      jobsRef,
      where('driverId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });

        this.jobsSubject.next(jobs);

        return jobs;
      })
    );
  }

  /**
   * Get unallocated jobs
   */
  getUnallocatedJobs(): Observable<Job[]> {
    return this.authService.hasPermission('canViewUnallocated').pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(
            () =>
              new Error('You do not have permission to view unallocated jobs')
          );
        }

        const jobsRef = collection(this.firestore, 'jobs');
        const q = query(
          jobsRef,
          where('status', '==', 'unallocated'),
          orderBy('createdAt', 'desc')
        );

        return from(getDocs(q)).pipe(
          map((snapshot) => {
            return snapshot.docs.map((doc) => {
              return this.convertFirebaseJobToModel(doc.id, doc.data());
            });
          })
        );
      }),
      catchError((error) => {
        console.error('Error fetching unallocated jobs:', error);
        return of([]);
      })
    );
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: string): Observable<Job[]> {
    if (!this.auth.currentUser) {
      return of([]);
    }

    return this.authService.hasPermission('isAdmin').pipe(
      switchMap((isAdmin) => {
        let jobsQuery;
        const jobsRef = collection(this.firestore, 'jobs');

        if (isAdmin) {
          jobsQuery = query(
            jobsRef,
            where('status', '==', status),
            orderBy('createdAt', 'desc')
          );
        } else {
          jobsQuery = query(
            jobsRef,
            where('driverId', '==', this.auth.currentUser!.uid),
            where('status', '==', status),
            orderBy('createdAt', 'desc')
          );
        }

        return from(getDocs(jobsQuery)).pipe(
          map((snapshot) => {
            return snapshot.docs.map((doc) => {
              return this.convertFirebaseJobToModel(doc.id, doc.data());
            });
          })
        );
      }),
      catchError((error) => {
        console.error(`Error fetching jobs with status ${status}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get a specific job by ID
   */
  getJobById(id: string): Observable<Job | null> {
    if (!id) {
      return of(null);
    }

    const jobRef = doc(this.firestore, `jobs/${id}`);
    return from(getDoc(jobRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return this.convertFirebaseJobToModel(docSnap.id, docSnap.data());
        } else {
          return null;
        }
      }),
      catchError((error) => {
        console.error(`Error fetching job ${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Create a new job
   */
  createJob(jobData: Partial<Job>): Observable<string> {
    if (!this.auth.currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    return this.authService.hasPermission('canCreateJobs').pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(
            () => new Error('You do not have permission to create jobs')
          );
        }

        if (!jobData.vehicleId) {
          return throwError(() => new Error('Vehicle ID is required'));
        }

        const jobsRef = collection(this.firestore, 'jobs');

        // Add timestamps and user information
        const newJobData = {
          ...jobData,
          status: 'unallocated' as 'unallocated',
          driverId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: this.auth.currentUser!.uid,
          updatedBy: null,
        };

        return from(addDoc(jobsRef, newJobData)).pipe(
          map((docRef) => docRef.id),
          catchError((error) => {
            console.error('Error creating job:', error);
            return throwError(
              () => new Error(`Failed to create job: ${error.message}`)
            );
          })
        );
      })
    );
  }

  /**
   * Update an existing job
   */
  updateJob(id: string, data: Partial<Job>): Observable<void> {
    if (!this.auth.currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    if (!id) {
      return throwError(() => new Error('Job ID is required'));
    }

    return this.authService.hasPermission('canEditJobs').pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(
            () => new Error('You do not have permission to edit jobs')
          );
        }

        const jobRef = doc(this.firestore, `jobs/${id}`);

        // Add updated timestamp and user info
        const updateData = {
          ...data,
          updatedAt: serverTimestamp(),
          updatedBy: this.auth.currentUser!.uid,
        };

        return from(updateDoc(jobRef, updateData)).pipe(
          catchError((error) => {
            console.error(`Error updating job ${id}:`, error);
            return throwError(
              () => new Error(`Failed to update job: ${error.message}`)
            );
          })
        );
      })
    );
  }

  /**
   * Start the collection process for a job
   */
  startCollection(jobId: string): Observable<void> {
    if (!this.auth.currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    if (!jobId) {
      return throwError(() => new Error('Job ID is required'));
    }

    return this.getJobById(jobId).pipe(
      switchMap((job) => {
        if (!job) {
          return throwError(() => new Error('Job not found'));
        }

        return forkJoin([
          of(job.driverId === this.auth.currentUser!.uid),
          this.authService.hasPermission('isAdmin'),
        ]).pipe(
          switchMap(([isAssignedToUser, isAdmin]) => {
            if (!isAssignedToUser && !isAdmin) {
              return throwError(
                () =>
                  new Error(
                    'You do not have permission to start collection for this job'
                  )
              );
            }

            const jobRef = doc(this.firestore, `jobs/${jobId}`);
            const updateData: Partial<Job> = {
              status: 'collected' as 'collected',
              collectionStartTime: new Date(),
              updatedAt: new Date(),
              updatedBy: this.auth.currentUser!.uid,
            };

            return from(updateDoc(jobRef, updateData));
          })
        );
      }),
      catchError((error) => {
        console.error(`Error starting collection for job ${jobId}:`, error);
        return throwError(
          () => new Error(`Failed to start collection: ${error.message}`)
        );
      })
    );
  }

  /**
   * Start the delivery process for a job
   */
  startDelivery(jobId: string): Observable<void> {
    if (!this.auth.currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    if (!jobId) {
      return throwError(() => new Error('Job ID is required'));
    }

    return this.getJobById(jobId).pipe(
      switchMap((job) => {
        if (!job) {
          return throwError(() => new Error('Job not found'));
        }

        return forkJoin([
          of(job.driverId === this.auth.currentUser!.uid),
          this.authService.hasPermission('isAdmin'),
        ]).pipe(
          switchMap(([isAssignedToUser, isAdmin]) => {
            if (!isAssignedToUser && !isAdmin) {
              return throwError(
                () =>
                  new Error(
                    'You do not have permission to start delivery for this job'
                  )
              );
            }

            const jobRef = doc(this.firestore, `jobs/${jobId}`);
            const updateData: Partial<Job> = {
              stage: 'in-transit' as 'in-transit',
              deliveryStartTime: new Date(),
              updatedAt: new Date(),
              updatedBy: this.auth.currentUser!.uid,
            };

            return from(updateDoc(jobRef, updateData));
          })
        );
      }),
      catchError((error) => {
        console.error(`Error starting delivery for job ${jobId}:`, error);
        return throwError(
          () => new Error(`Failed to start delivery: ${error.message}`)
        );
      })
    );
  }

  /**
   * Allocate a job to the current driver
   */
  allocateJob(jobId: string): Observable<void> {
    if (!this.auth.currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    if (!jobId) {
      return throwError(() => new Error('Job ID is required'));
    }

    return this.authService.hasPermission('canAllocateJobs').pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(
            () => new Error('You do not have permission to allocate jobs')
          );
        }

        const jobRef = doc(this.firestore, `jobs/${jobId}`);
        const updateData: Partial<Job> = {
          driverId: this.auth.currentUser!.uid,
          status: 'allocated' as 'allocated',
          allocatedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: this.auth.currentUser!.uid,
        };

        return from(updateDoc(jobRef, updateData));
      }),
      catchError((error) => {
        console.error(`Error allocating job ${jobId}:`, error);
        return throwError(
          () => new Error(`Failed to allocate job: ${error.message}`)
        );
      })
    );
  }

  /**
   * Unallocate a job (return it to the pool)
   */
  unallocateJob(jobId: string): Observable<void> {
    if (!this.auth.currentUser) {
      return throwError(() => new Error('User not authenticated'));
    }

    if (!jobId) {
      return throwError(() => new Error('Job ID is required'));
    }

    return this.authService.hasAnyPermission(['canEditJobs', 'isAdmin']).pipe(
      switchMap((hasPermission) => {
        if (!hasPermission) {
          return throwError(
            () => new Error('You do not have permission to unallocate jobs')
          );
        }

        const jobRef = doc(this.firestore, `jobs/${jobId}`);
        const updateData = {
          driverId: null,
          status: 'unallocated' as 'unallocated',
          unallocatedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: this.auth.currentUser!.uid,
        };

        return from(updateDoc(jobRef, updateData));
      }),
      catchError((error) => {
        console.error(`Error unallocating job ${jobId}:`, error);
        return throwError(
          () => new Error(`Failed to unallocate job: ${error.message}`)
        );
      })
    );
  }

  /**
   * Convert Firestore document data to Job model
   */
  private convertFirebaseJobToModel(id: string, data: any): Job {
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
      id,
      vehicleId: data.vehicleId || '',
      driverId: data.driverId,
      status: data.status || 'unallocated',
      stage: data.stage,
      collectionStartTime: convertTimestamp(data.collectionStartTime),
      collectionCompleteTime: convertTimestamp(data.collectionCompleteTime),
      deliveryStartTime: convertTimestamp(data.deliveryStartTime),
      deliveryCompleteTime: convertTimestamp(data.deliveryCompleteTime),
      allocatedAt: convertTimestamp(data.allocatedAt),
      unallocatedAt: convertTimestamp(data.unallocatedAt),
      createdAt: convertTimestamp(data.createdAt) || new Date(),
      updatedAt: convertTimestamp(data.updatedAt) || new Date(),
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      make: data.make,
      model: data.model,
      registration: data.registration,

      // Include all other properties
      ...Object.entries(data)
        .filter(
          ([key]) =>
            ![
              'id',
              'vehicleId',
              'driverId',
              'status',
              'stage',
              'collectionStartTime',
              'collectionCompleteTime',
              'deliveryStartTime',
              'deliveryCompleteTime',
              'allocatedAt',
              'unallocatedAt',
              'createdAt',
              'updatedAt',
              'createdBy',
              'updatedBy',
              'make',
              'model',
              'registration',
            ].includes(key)
        )
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
    };
  }
}
