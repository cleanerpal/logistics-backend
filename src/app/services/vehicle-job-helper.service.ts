import { Injectable } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, serverTimestamp } from '@angular/fire/firestore';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { Auth } from '@angular/fire/auth';
import { Job } from '../interfaces/job.interface';
import { Vehicle } from '../interfaces/vehicle.interface';
import { BaseFirebaseService } from './base-firebase.service';
import { NotificationService } from './notification.service';

@Injectable({
  providedIn: 'root',
})
export class VehicleJobHelperService extends BaseFirebaseService {
  constructor(protected override firestore: Firestore, protected override auth: Auth, private notificationService: NotificationService) {
    super(firestore, auth);
  }

  /**
   * Process vehicle data from a job
   * @param job The job containing vehicle data
   * @param action 'create' or 'update'
   * @returns Observable with the vehicle ID
   */
  processVehicleFromJob(job: Partial<Job>, action: 'create' | 'update'): Observable<string> {
    // Check for required vehicle data
    if (!job.registration) {
      return throwError(() => new Error('Vehicle registration is required'));
    }

    // Format registration for vehicle ID
    const vehicleId = job.registration.toUpperCase().replace(/\s+/g, '');
    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    return from(getDoc(vehicleRef)).pipe(
      switchMap((docSnap) => {
        // Build vehicle data from job information as a Record object
        // to avoid TypeScript issues with Firebase timestamp types
        const vehicleData: Record<string, any> = {
          registration: job.registration.toUpperCase(),
          makeId: job['makeId'] || '',
          makeName: job.make || '',
          modelId: job['modelId'] || '',
          modelName: job.model || '',
          type: job.vehicleType || '',
          color: job.color || '',
          updatedAt: serverTimestamp(),
          updatedBy: this.currentUserId || '',
          lastProcessedDate: serverTimestamp(),
        };

        // Only add these fields if they exist to avoid undefined values
        if (job.chassisNumber) {
          vehicleData['chassisNumber'] = job.chassisNumber.toUpperCase();
        }

        if (job.year !== undefined && job.year !== null) {
          vehicleData['year'] = Number(job.year);
        }

        if (docSnap.exists()) {
          // Update existing vehicle
          const existingData = docSnap.data();

          // Handle job history
          let jobHistory = existingData['jobHistory'] || [];
          if (job.id && !jobHistory.includes(job.id)) {
            jobHistory = [...jobHistory, job.id];
          }

          // Set updated data
          const updateData: Record<string, any> = {
            ...vehicleData,
            jobCount: jobHistory.length,
            jobHistory: jobHistory,
          };

          // Preserve existing fields if present in the original document
          if (existingData['firstProcessedDate']) {
            updateData['firstProcessedDate'] = existingData['firstProcessedDate'];
          }

          if (existingData['mileage'] !== undefined) {
            updateData['mileage'] = existingData['mileage'];
          }

          if (existingData['photos']) {
            updateData['photos'] = existingData['photos'];
          }

          if (existingData['conditionReports']) {
            updateData['conditionReports'] = existingData['conditionReports'];
          }

          return from(updateDoc(vehicleRef, updateData)).pipe(
            map(() => vehicleId),
            tap(() => {
              this.notificationService.addNotification({
                type: 'info',
                title: 'Vehicle Updated',
                message: `Vehicle ${job.registration} has been updated in the system`,
                actionUrl: `/vehicles/${vehicleId}`,
              });
            })
          );
        } else {
          // Create new vehicle
          const newVehicleData: Record<string, any> = {
            ...vehicleData,
            id: vehicleId,
            createdAt: serverTimestamp(),
            firstProcessedDate: serverTimestamp(),
            createdBy: this.currentUserId || '',
            mileage: 0,
            jobCount: job.id ? 1 : 0,
            jobHistory: job.id ? [job.id] : [],
            chassisNumber: job.chassisNumber?.toUpperCase() || '',
            year: job.year ? Number(job.year) : 0,
          };

          return from(setDoc(vehicleRef, newVehicleData)).pipe(
            map(() => vehicleId),
            tap(() => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'New Vehicle Added',
                message: `Vehicle ${job.registration} has been added to the system`,
                actionUrl: `/vehicles/${vehicleId}`,
              });
            })
          );
        }
      }),
      catchError((error) => {
        console.error('Error processing vehicle from job:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update a vehicle's job history
   * @param vehicleId The vehicle ID to update
   * @param jobId The job ID to add to history
   * @returns Observable of void
   */
  updateVehicleJobHistory(vehicleId: string, jobId: string): Observable<void> {
    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    return from(getDoc(vehicleRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          return throwError(() => new Error(`Vehicle ${vehicleId} not found`));
        }

        const vehicleData = docSnap.data() as Vehicle;
        const jobHistory = vehicleData.jobHistory || [];

        // Only update if job ID is not already in history
        if (!jobHistory.includes(jobId)) {
          const updatedHistory = [...jobHistory, jobId];

          return from(
            updateDoc(vehicleRef, {
              jobHistory: updatedHistory,
              jobCount: updatedHistory.length,
              updatedAt: serverTimestamp(),
              lastProcessedDate: serverTimestamp(),
              updatedBy: this.currentUserId,
            })
          );
        }

        // No update needed
        return of(void 0);
      }),
      catchError((error) => {
        console.error('Error updating vehicle job history:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get jobs for a specific vehicle
   * @param vehicleId The vehicle ID
   * @returns Observable with array of jobs
   */
  getJobsForVehicle(vehicleId: string): Observable<Job[]> {
    const jobsRef = collection(this.firestore, 'jobs');
    const q = query(jobsRef, where('vehicleId', '==', vehicleId));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return this.convertFirebaseJobToModel(doc.id, doc.data());
        });
      }),
      catchError((error) => {
        console.error(`Error fetching jobs for vehicle ${vehicleId}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Convert Firestore job data to Job model
   * @param id Document ID
   * @param data Document data
   * @returns Job object
   */
  private convertFirebaseJobToModel(id: string, data: any): Job {
    // Basic job object
    const job: Job = {
      id,
      vehicleId: data.vehicleId || '',
      driverId: data.driverId || null,
      status: data.status || 'unallocated',
      stage: data.stage,
      createdAt: this.convertTimestamp(data.createdAt) || new Date(),
      updatedAt: this.convertTimestamp(data.updatedAt) || new Date(),
    };

    // Add other fields if present
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'id' && !job.hasOwnProperty(key)) {
        (job as any)[key] = value && typeof value === 'object' && 'toDate' in value ? this.convertTimestamp(value) : value;
      }
    });

    return job;
  }
}
