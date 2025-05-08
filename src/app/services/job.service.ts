import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  DocumentReference,
  Timestamp,
  limit,
  collectionData,
  FieldValue,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, BehaviorSubject, from, of, throwError, catchError, map, tap, switchMap, combineLatest } from 'rxjs';
import { Job } from '../interfaces/job.interface';
import { BaseFirebaseService } from './base-firebase.service';
import { NotificationService } from './notification.service';
import { JobStatus } from '../shared/models/job-status.enum';
import { VehicleService } from './vehicle.service';
import { Vehicle } from '../interfaces/vehicle.interface';

@Injectable({
  providedIn: 'root',
})
export class JobService extends BaseFirebaseService {
  private jobsSubject = new BehaviorSubject<Job[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public jobs$ = this.jobsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    protected override firestore: Firestore,
    protected override auth: Auth,
    private notificationService: NotificationService,
    private vehicleService: VehicleService
  ) {
    super(firestore, auth);
  }

  /**
   * Get all jobs for the current user
   */
  getDriverJobs(): Observable<Job[]> {
    this.loadingSubject.next(true);

    // Get the current user's ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    // For testing purposes, we'll load all jobs instead of just for this driver
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
        this.jobsSubject.next(jobs);
        return jobs;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching driver jobs:', error);
        this.loadingSubject.next(false);
        this.jobsSubject.next([]);
        return of([]);
      })
    );
  }

  /**
   * Get all unallocated jobs
   */
  getUnallocatedJobs(): Observable<Job[]> {
    this.loadingSubject.next(true);

    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('status', '==', 'unallocated'), orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
        return jobs;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching unallocated jobs:', error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get jobs for a specific customer
   */
  getCustomerJobs(customerId: string): Observable<Job[]> {
    this.loadingSubject.next(true);

    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('customerId', '==', customerId), orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
        return jobs;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching jobs for customer ${customerId}:`, error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get jobs for a specific driver
   */
  getJobsByDriver(driverId: string): Observable<Job[]> {
    this.loadingSubject.next(true);

    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('driverId', '==', driverId), orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
        return jobs;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching jobs for driver ${driverId}:`, error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: string): Observable<Job[]> {
    this.loadingSubject.next(true);

    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('status', '==', status), orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
        return jobs;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching jobs with status ${status}:`, error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get jobs by vehicle ID
   */
  getJobsByVehicle(vehicleId: string): Observable<Job[]> {
    this.loadingSubject.next(true);

    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('vehicleId', '==', vehicleId), orderBy('createdAt', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
        return jobs;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching jobs for vehicle ${vehicleId}:`, error);
        this.loadingSubject.next(false);
        return of([]);
      })
    );
  }

  /**
   * Get recent jobs (last 7 days)
   */
  getRecentJobs(count: number = 10): Observable<Job[]> {
    this.loadingSubject.next(true);

    const jobsRef = collection(this.firestore, 'jobs');
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Using timestamp comparison for date range
    const q = query(jobsRef, where('createdAt', '>=', oneWeekAgo), orderBy('createdAt', 'desc'), limit(count));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const jobs = snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
        return jobs;
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
   * Get a specific job by ID
   */
  getJobById(jobId: string): Observable<Job | null> {
    this.loadingSubject.next(true);

    if (!jobId) {
      this.loadingSubject.next(false);
      return of(null);
    }

    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    return from(getDoc(jobRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return this.convertFirebaseJobToModel(docSnap.id, docSnap.data());
        } else {
          return null;
        }
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching job ${jobId}:`, error);
        this.loadingSubject.next(false);
        return of(null);
      })
    );
  }

  /**
   * Create a new job and save vehicle data
   */
  createJob(jobData: Partial<Job>): Observable<string> {
    this.loadingSubject.next(true);

    // Get the current user ID to mark as creator
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    // First save the vehicle data and get the vehicle ID
    return this.vehicleService.createOrUpdateVehicleFromJob(jobData).pipe(
      switchMap((vehicleId) => {
        // Prepare job data with timestamps, user info, and vehicle ID
        const newJobData = {
          ...jobData,
          vehicleId: vehicleId, // Set the vehicle ID from the saved vehicle
          status: jobData.status || 'unallocated',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userId,
          updatedBy: userId,
        };

        const jobsRef = collection(this.firestore, 'jobs');

        return from(addDoc(jobsRef, newJobData)).pipe(
          map((docRef) => {
            // After job is created, update the vehicle with the job ID if needed
            this.updateVehicleWithJobId(vehicleId, docRef.id);

            // Refresh the jobs list
            this.refreshJobsList();

            // Add notification about new job
            this.notificationService.addNotification({
              type: 'info',
              title: 'New Job Created',
              message: `Job for ${jobData.make || ''} ${jobData.model || ''} ${jobData.registration ? '(' + jobData.registration + ')' : ''} has been created`,
              actionUrl: `/jobs/${docRef.id}`,
            });

            return docRef.id;
          }),
          catchError((error) => {
            console.error('Error creating job:', error);
            this.loadingSubject.next(false);
            return throwError(() => error);
          })
        );
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error in job creation process:', error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update job details
   */
  updateJob(jobId: string, data: Partial<Job>): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID to mark as updater
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    // Remove id from update data to avoid overwriting it
    const { id, ...updateData } = data;

    // Add updater and timestamp
    const jobData: Record<string, any> = {
      ...updateData,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    // If status is changing, add status update timestamp
    if (updateData.status) {
      jobData['statusUpdatedAt'] = serverTimestamp();
    }

    return from(updateDoc(jobRef, jobData)).pipe(
      tap(() => {
        // Refresh the jobs list
        this.refreshJobsList();

        // Add notification about job update if status was changed
        if (updateData.status) {
          this.notificationService.addNotification({
            type: 'info',
            title: 'Job Status Updated',
            message: `Job ${jobId} status updated to ${updateData.status}`,
            actionUrl: `/jobs/${jobId}`,
          });
        }
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error updating job ${jobId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Allocate a job to the current user
   */
  allocateJob(jobId: string): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    // Prepare job data
    const jobData = {
      status: 'allocated',
      driverId: userId,
      allocatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      statusUpdatedAt: serverTimestamp(),
    };

    return from(updateDoc(jobRef, jobData)).pipe(
      tap(() => {
        // Refresh the jobs list
        this.refreshJobsList();

        // Add notification
        this.notificationService.addNotification({
          type: 'success',
          title: 'Job Allocated',
          message: `Job ${jobId} has been allocated to you`,
          actionUrl: `/jobs/${jobId}`,
        });
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error allocating job ${jobId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Unallocate a job (remove driver assignment)
   */
  unallocateJob(jobId: string): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    // Prepare job data
    const jobData = {
      status: 'unallocated',
      driverId: null,
      unallocatedAt: serverTimestamp(),
      allocatedAt: null, // Clear allocation timestamp
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      statusUpdatedAt: serverTimestamp(),
    };

    return from(updateDoc(jobRef, jobData)).pipe(
      tap(() => {
        // Refresh the jobs list
        this.refreshJobsList();

        // Add notification
        this.notificationService.addNotification({
          type: 'info',
          title: 'Job Unallocated',
          message: `Job ${jobId} has been unallocated`,
          actionUrl: `/jobs/${jobId}`,
        });
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error unallocating job ${jobId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Start the collection process for a job
   */
  startCollection(jobId: string): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    // First, get the current job to ensure it can be updated
    return from(getDoc(jobRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Job ${jobId} not found`);
        }

        const job = docSnap.data() as Job;
        if (job.driverId !== userId && !job.driverId) {
          throw new Error('You are not authorized to update this job');
        }

        // Prepare job update data
        const jobData = {
          status: 'collected',
          collectionStartTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: userId,
          statusUpdatedAt: serverTimestamp(),
        };

        return updateDoc(jobRef, jobData);
      }),
      tap(() => {
        // Refresh the jobs list
        this.refreshJobsList();

        // Add notification
        this.notificationService.addNotification({
          type: 'info',
          title: 'Collection Started',
          message: `Collection process has started for job ${jobId}`,
          actionUrl: `/jobs/${jobId}/collection`,
        });
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error starting collection for job ${jobId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Mark a job collection as complete
   */
  completeCollection(
    jobId: string,
    collectionData: {
      mileage?: number;
      fuelLevel?: string;
      collectionNotes?: string;
      collectionPhotos?: string[];
      collectionSignature?: string;
    }
  ): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    // First, get the current job to ensure it can be updated
    return from(getDoc(jobRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Job ${jobId} not found`);
        }

        const job = this.convertFirebaseJobToModel(docSnap.id, docSnap.data());
        if (job.driverId !== userId) {
          throw new Error('You are not authorized to update this job');
        }

        // Prepare job update data
        const jobData = {
          collectionCompleteTime: serverTimestamp(),
          stage: 'in-transit',
          updatedAt: serverTimestamp(),
          updatedBy: userId,
          statusUpdatedAt: serverTimestamp(),
          ...collectionData,
        };

        // Update in Firebase only
        return updateDoc(jobRef, jobData);
      }),
      tap(() => {
        // Refresh the jobs list
        this.refreshJobsList();

        // Add notification
        this.notificationService.addNotification({
          type: 'success',
          title: 'Collection Completed',
          message: `Collection has been completed for job ${jobId}`,
          actionUrl: `/jobs/${jobId}`,
        });
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error completing collection for job ${jobId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Start the delivery process for a job
   */
  startDelivery(jobId: string): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    // First, get the current job to ensure it can be updated
    return from(getDoc(jobRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Job ${jobId} not found`);
        }

        const job = docSnap.data() as Job;
        if (job.driverId !== userId) {
          throw new Error('You are not authorized to update this job');
        }

        // Prepare job update data
        const jobData = {
          status: 'delivered',
          stage: 'ready-for-delivery',
          deliveryStartTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: userId,
          statusUpdatedAt: serverTimestamp(),
        };

        return updateDoc(jobRef, jobData);
      }),
      tap(() => {
        // Refresh the jobs list
        this.refreshJobsList();

        // Add notification
        this.notificationService.addNotification({
          type: 'info',
          title: 'Delivery Started',
          message: `Delivery process has started for job ${jobId}`,
          actionUrl: `/jobs/${jobId}/delivery`,
        });
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error starting delivery for job ${jobId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Mark a job delivery as complete
   */
  completeDelivery(
    jobId: string,
    deliveryData: {
      mileage?: number;
      fuelLevel?: string;
      deliveryNotes?: string;
      deliveryPhotos?: string[];
      deliverySignature?: string;
    }
  ): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const jobRef = doc(this.firestore, `jobs/${jobId}`);

    // First, get the current job to ensure it can be updated
    return from(getDoc(jobRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Job ${jobId} not found`);
        }

        const job = this.convertFirebaseJobToModel(docSnap.id, docSnap.data());
        if (job.driverId !== userId) {
          throw new Error('You are not authorized to update this job');
        }

        // Prepare job update data
        const jobData = {
          status: 'completed',
          stage: 'awaiting-confirmation',
          deliveryCompleteTime: serverTimestamp(),
          deliveryActualDateTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: userId,
          statusUpdatedAt: serverTimestamp(),
          ...deliveryData,
        };

        // Update in Firebase only
        return updateDoc(jobRef, jobData);
      }),
      tap(() => {
        // Refresh the jobs list
        this.refreshJobsList();

        // Add notification
        this.notificationService.addNotification({
          type: 'success',
          title: 'Delivery Completed',
          message: `Delivery has been completed for job ${jobId}`,
          actionUrl: `/jobs/${jobId}`,
        });
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error completing delivery for job ${jobId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get dashboard statistics
   */
  getDashboardStats(): Observable<any> {
    this.loadingSubject.next(true);

    const jobsRef = collection(this.firestore, 'jobs');

    // Get counts for each status
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
        return {
          unallocated,
          allocated,
          collected,
          delivered,
          completed,
          total: unallocated + allocated + collected + delivered + completed,
          active: unallocated + allocated + collected + delivered,
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
   * Refresh the jobs list by re-fetching data
   */
  private refreshJobsList(): void {
    // Only refresh if we have jobs loaded already
    if (this.jobsSubject.getValue().length > 0) {
      this.getDriverJobs().subscribe();
    }
  }

  /**
   * Convert Firestore data to Job model
   */
  private convertFirebaseJobToModel(id: string, data: any): Job {
    // Create the job object with required fields
    const job: Job = {
      id,
      vehicleId: data.vehicleId || '',
      driverId: data.driverId || null,
      status: data.status || 'unallocated',
      stage: data.stage,
      createdAt: this.convertTimestamp(data.createdAt) || new Date(),
      updatedAt: this.convertTimestamp(data.updatedAt) || new Date(),
    };

    // Add optional fields if present
    if (data.collectionStartTime) {
      job.collectionStartTime = this.convertTimestamp(data.collectionStartTime);
    }

    if (data.collectionCompleteTime) {
      job.collectionCompleteTime = this.convertTimestamp(data.collectionCompleteTime);
    }

    if (data.deliveryStartTime) {
      job.deliveryStartTime = this.convertTimestamp(data.deliveryStartTime);
    }

    if (data.deliveryCompleteTime) {
      job.deliveryCompleteTime = this.convertTimestamp(data.deliveryCompleteTime);
    }

    if (data.allocatedAt) {
      job.allocatedAt = this.convertTimestamp(data.allocatedAt);
    }

    if (data.unallocatedAt) {
      job.unallocatedAt = this.convertTimestamp(data.unallocatedAt);
    }

    if (data.statusUpdatedAt) {
      job['statusUpdatedAt'] = this.convertTimestamp(data.statusUpdatedAt);
    }

    if (data.createdBy) {
      job.createdBy = data.createdBy;
    }

    if (data.updatedBy) {
      job.updatedBy = data.updatedBy;
    }

    // Vehicle details
    if (data.make) job.make = data.make;
    if (data.model) job.model = data.model;
    if (data.registration) job.registration = data.registration;
    if (data.color) job.color = data.color;
    if (data.year) job.year = data.year;
    if (data.fuelType) job.fuelType = data.fuelType;
    if (data.mileage !== undefined) job.mileage = data.mileage;
    if (data.fuelLevel) job.fuelLevel = data.fuelLevel;
    if (data.chassisNumber) job.chassisNumber = data.chassisNumber;
    if (data.vehicleType) job.vehicleType = data.vehicleType;

    // Customer details
    if (data.customerId) job.customerId = data.customerId;
    if (data.customerName) job.customerName = data.customerName;
    if (data.customerContact) job.customerContact = data.customerContact;
    if (data.customerContactPhone) job.customerContactPhone = data.customerContactPhone;

    // Collection details
    if (data.collectionAddress) job.collectionAddress = data.collectionAddress;
    if (data.collectionCity) job.collectionCity = data.collectionCity;
    if (data.collectionPostcode) job.collectionPostcode = data.collectionPostcode;
    if (data.collectionContactName) job.collectionContactName = data.collectionContactName;
    if (data.collectionContactPhone) job.collectionContactPhone = data.collectionContactPhone;
    if (data.collectionNotes) job.collectionNotes = data.collectionNotes;
    if (data.collectionActualDateTime) job.collectionActualDateTime = this.convertTimestamp(data.collectionActualDateTime);

    // Delivery details
    if (data.deliveryAddress) job.deliveryAddress = data.deliveryAddress;
    if (data.deliveryCity) job.deliveryCity = data.deliveryCity;
    if (data.deliveryPostcode) job.deliveryPostcode = data.deliveryPostcode;
    if (data.deliveryContactName) job.deliveryContactName = data.deliveryContactName;
    if (data.deliveryContactPhone) job.deliveryContactPhone = data.deliveryContactPhone;
    if (data.deliveryNotes) job.deliveryNotes = data.deliveryNotes;
    if (data.deliveryActualDateTime) job.deliveryActualDateTime = this.convertTimestamp(data.deliveryActualDateTime);

    // Documentation
    if (data.collectionPhotos) job.collectionPhotos = data.collectionPhotos;
    if (data.deliveryPhotos) job.deliveryPhotos = data.deliveryPhotos;
    if (data.collectionSignature) job.collectionSignature = data.collectionSignature;
    if (data.deliverySignature) job.deliverySignature = data.deliverySignature;

    // Split journey
    if (data.isSplitJourney !== undefined) job.isSplitJourney = data.isSplitJourney;
    if (data.secondaryCollectionAddress) job.secondaryCollectionAddress = data.secondaryCollectionAddress;
    if (data.secondaryDeliveryAddress) job.secondaryDeliveryAddress = data.secondaryDeliveryAddress;

    // Notes
    if (data.notes) job.notes = data.notes;

    return job;
  }

  /**
   * Add this method to your JobService class
   *
   * Duplicate an existing job
   * @param jobId The ID of the job to duplicate
   * @returns Observable with the ID of the new job
   */
  duplicateJob(jobId: string): Observable<string> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    // First get the existing job
    return this.getJobById(jobId).pipe(
      switchMap((originalJob) => {
        if (!originalJob) {
          throw new Error(`Job ${jobId} not found`);
        }

        // Create a new job data object, explicitly omitting workflow-specific fields
        const newJobData: Partial<Job> = {
          // Vehicle information
          vehicleId: originalJob.vehicleId,
          make: originalJob.make,
          model: originalJob.model,
          registration: originalJob.registration,
          color: originalJob.color,
          year: originalJob.year,
          fuelType: originalJob.fuelType,
          chassisNumber: originalJob.chassisNumber,
          vehicleType: originalJob.vehicleType,

          // Customer information
          customerId: originalJob.customerId,
          customerName: originalJob.customerName,
          customerContact: originalJob.customerContact,
          customerContactPhone: originalJob.customerContactPhone,

          // Primary Collection
          collectionAddress: originalJob.collectionAddress,
          collectionCity: originalJob.collectionCity,
          collectionPostcode: originalJob.collectionPostcode,
          collectionContactName: originalJob.collectionContactName,
          collectionContactPhone: originalJob.collectionContactPhone,
          collectionNotes: originalJob.collectionNotes,

          // Final Delivery
          deliveryAddress: originalJob.deliveryAddress,
          deliveryCity: originalJob.deliveryCity,
          deliveryPostcode: originalJob.deliveryPostcode,
          deliveryContactName: originalJob.deliveryContactName,
          deliveryContactPhone: originalJob.deliveryContactPhone,
          deliveryNotes: originalJob.deliveryNotes,

          // Split journey
          isSplitJourney: originalJob.isSplitJourney,
          secondaryCollectionAddress: originalJob.secondaryCollectionAddress,
          secondaryCollectionCity: originalJob.secondaryCollectionCity,
          secondaryCollectionPostcode: originalJob.secondaryCollectionPostcode,
          secondaryCollectionContactName: originalJob.secondaryCollectionContactName,
          secondaryCollectionContactPhone: originalJob.secondaryCollectionContactPhone,
          secondaryCollectionNotes: originalJob.secondaryCollectionNotes,
          secondaryDeliveryAddress: originalJob.secondaryDeliveryAddress,
          secondaryDeliveryCity: originalJob.secondaryDeliveryCity,
          secondaryDeliveryPostcode: originalJob.secondaryDeliveryPostcode,
          secondaryDeliveryContactName: originalJob.secondaryDeliveryContactName,
          secondaryDeliveryContactPhone: originalJob.secondaryDeliveryContactPhone,
          secondaryDeliveryNotes: originalJob.secondaryDeliveryNotes,

          // Job status (reset)
          status: 'unallocated',
          driverId: null,

          // Notes and reference info
          notes: `Duplicated from job ${jobId} on ${new Date().toLocaleDateString()}${originalJob.notes ? `\n\nOriginal notes: ${originalJob.notes}` : ''}`,
        };

        // Create the new job
        return this.createJob(newJobData);
      }),
      tap((newJobId) => {
        // Add notification about job duplication
        this.notificationService.addNotification({
          type: 'success',
          title: 'Job Duplicated',
          message: `Job ${jobId} has been duplicated successfully. New job ID: ${newJobId}`,
          actionUrl: `/jobs/${newJobId}`,
        });

        // Refresh the jobs list to show the new job
        this.refreshJobsList();
      }),
      catchError((error) => {
        console.error(`Error duplicating job ${jobId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update vehicle with job ID if it's not already in the job history
   * Private helper method for createJob
   */
  private updateVehicleWithJobId(vehicleId: string, jobId: string): void {
    // Get reference to vehicle document
    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    // Get current vehicle data
    getDoc(vehicleRef)
      .then((docSnap) => {
        if (docSnap.exists()) {
          const vehicleData = docSnap.data() as Vehicle;
          const jobHistory = vehicleData.jobHistory || [];

          // Only update if job ID is not already in history
          if (!jobHistory.includes(jobId)) {
            // Add job ID to history and increment count
            updateDoc(vehicleRef, {
              jobHistory: [...jobHistory, jobId],
              jobCount: (vehicleData.jobCount || 0) + 1,
              updatedAt: serverTimestamp(),
              lastProcessedDate: serverTimestamp(),
            }).catch((error) => {
              console.error(`Error updating vehicle ${vehicleId} with job ID:`, error);
            });
          }
        }
      })
      .catch((error) => {
        console.error(`Error getting vehicle ${vehicleId}:`, error);
      });
  }
}
