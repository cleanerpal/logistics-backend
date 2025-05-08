import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
  DocumentReference,
  Timestamp,
  limit,
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, from, of, throwError } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { BaseFirebaseService } from './base-firebase.service';
import { NotificationService } from './notification.service';

export interface VehicleMake {
  id: string;
  name: string;
  displayName: string;
  type: string;
  vehicleTypes: string[];
  icon?: string;
  isActive: boolean;
}

export interface VehicleModel {
  id: string;
  name: string;
  makeId: string;
  type: string;
  isActive: boolean;
}

export interface Vehicle {
  id: string;
  registration: string;
  chassisNumber: string;
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  type: string;
  color: string;
  year: number;
  firstProcessedDate: Date;
  lastProcessedDate: Date;
  mileage: number;
  fuelType?: string;
  transmission?: string;
  engineSize?: string;
  vin?: string;
  photos?: VehiclePhoto[];
  conditionReports?: ConditionReport[];
  jobCount: number;
  jobHistory: string[];
  notes?: string;
}

export interface VehiclePhoto {
  id: string;
  url: string;
  type: string;
  takenBy: string;
  takenAt: Date;
  jobId: string;
  notes?: string;
}

export interface ConditionReport {
  id: string;
  jobId: string;
  createdBy: string;
  createdAt: Date;
  damageNotes?: string;
  mileage: number;
  fuelLevel: string;
  cleanliness: string;
  interiorCondition: string;
  exteriorCondition: string;
  additionalNotes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class VehicleService extends BaseFirebaseService {
  private vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);

  public vehicles$ = this.vehiclesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  constructor(protected override firestore: Firestore, protected override auth: Auth, private notificationService: NotificationService) {
    super(firestore, auth);
  }

  /**
   * Get all vehicles
   */
  getVehicles(): Observable<Vehicle[]> {
    this.loadingSubject.next(true);

    const vehiclesRef = collection(this.firestore, 'vehicles');
    const q = query(vehiclesRef, orderBy('lastProcessedDate', 'desc'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const vehicles = snapshot.docs.map((doc) => {
          return this.convertFirebaseVehicleToModel(doc.id, doc.data());
        });
        this.vehiclesSubject.next(vehicles);
        return vehicles;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error fetching vehicles:', error);
        this.loadingSubject.next(false);
        this.vehiclesSubject.next([]);
        return of([]);
      })
    );
  }

  /**
   * Get vehicle by ID
   */
  getVehicleById(vehicleId: string): Observable<Vehicle | null> {
    this.loadingSubject.next(true);

    if (!vehicleId) {
      this.loadingSubject.next(false);
      return of(null);
    }

    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    return from(getDoc(vehicleRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return this.convertFirebaseVehicleToModel(docSnap.id, docSnap.data());
        } else {
          return null;
        }
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error fetching vehicle ${vehicleId}:`, error);
        this.loadingSubject.next(false);
        return of(null);
      })
    );
  }

  /**
   * Create a new vehicle
   */
  createVehicle(vehicleData: Omit<Vehicle, 'id'>): Observable<string> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    // Prepare vehicle data
    const newVehicleData = {
      ...vehicleData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
      // Keep the existing dates from vehicleData but convert to server timestamp
      // if firstProcessedDate is already provided in vehicleData, use it instead of creating a new one
      firstProcessedDate: serverTimestamp(),
      lastProcessedDate: serverTimestamp(),
      // Note: jobCount, jobHistory, photos, and conditionReports are expected to be
      // provided by the caller now
    };

    // Use registration number as document ID
    const docId = vehicleData.registration?.toUpperCase();
    if (!docId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Registration number is required'));
    }

    const vehicleRef = doc(this.firestore, `vehicles/${docId}`);

    return from(setDoc(vehicleRef, newVehicleData)).pipe(
      map(() => {
        // Refresh the vehicles list
        this.refreshVehiclesList();

        // Add notification
        this.notificationService.addNotification({
          type: 'success',
          title: 'Vehicle Created',
          message: `Vehicle ${vehicleData.registration} has been added to the system`,
          actionUrl: `/vehicles/${docId}`,
        });

        return docId;
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error('Error creating vehicle:', error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update an existing vehicle
   */
  updateVehicle(vehicleId: string, data: Partial<Omit<Vehicle, 'id'>>): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    // Add updater and timestamp
    const vehicleUpdateData = {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      lastProcessedDate: serverTimestamp(),
    };

    return from(updateDoc(vehicleRef, vehicleUpdateData)).pipe(
      tap(() => {
        // Refresh the vehicles list
        this.refreshVehiclesList();

        // Add notification
        this.notificationService.addNotification({
          type: 'info',
          title: 'Vehicle Updated',
          message: `Vehicle ${vehicleId} has been updated`,
          actionUrl: `/vehicles/${vehicleId}`,
        });
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error updating vehicle ${vehicleId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Add a photo to a vehicle
   */
  addVehiclePhoto(vehicleId: string, photoData: Partial<VehiclePhoto>): Observable<string> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    // First get the vehicle document
    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    return from(getDoc(vehicleRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Vehicle ${vehicleId} not found`);
        }

        const vehicle = docSnap.data() as Vehicle;
        const photos = vehicle.photos || [];

        // Create a new photo object
        const photoId = this.generateId();
        const newPhoto: VehiclePhoto = {
          id: photoId,
          url: photoData.url || '',
          type: photoData.type || 'exterior',
          takenBy: userId,
          takenAt: new Date(),
          jobId: photoData.jobId || '',
          notes: photoData.notes || '',
        };

        // Add the new photo to the photos array
        photos.push(newPhoto);

        // Update the vehicle document
        return updateDoc(vehicleRef, {
          photos: photos,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
          lastProcessedDate: serverTimestamp(),
        }).then(() => photoId);
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error adding photo to vehicle ${vehicleId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Add a condition report to a vehicle
   */
  addConditionReport(vehicleId: string, reportData: Partial<ConditionReport>): Observable<string> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    // First get the vehicle document
    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    return from(getDoc(vehicleRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Vehicle ${vehicleId} not found`);
        }

        const vehicle = docSnap.data() as Vehicle;
        const reports = vehicle.conditionReports || [];

        // Create a new report object
        const reportId = this.generateId();
        const newReport: ConditionReport = {
          id: reportId,
          jobId: reportData.jobId || '',
          createdBy: userId,
          createdAt: new Date(),
          damageNotes: reportData.damageNotes || '',
          mileage: reportData.mileage || 0,
          fuelLevel: reportData.fuelLevel || 'Unknown',
          cleanliness: reportData.cleanliness || 'Good',
          interiorCondition: reportData.interiorCondition || 'Good',
          exteriorCondition: reportData.exteriorCondition || 'Good',
          additionalNotes: reportData.additionalNotes || '',
        };

        // Add the new report to the reports array
        reports.push(newReport);

        // Update the vehicle document with the new report and mileage
        return updateDoc(vehicleRef, {
          conditionReports: reports,
          mileage: reportData.mileage || vehicle.mileage,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
          lastProcessedDate: serverTimestamp(),
        }).then(() => reportId);
      }),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error adding condition report to vehicle ${vehicleId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Add a job to vehicle history
   */
  addJobToVehicle(vehicleId: string, jobId: string): Observable<void> {
    this.loadingSubject.next(true);

    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    // First get the vehicle document
    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    return from(getDoc(vehicleRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Vehicle ${vehicleId} not found`);
        }

        const vehicle = docSnap.data() as Vehicle;
        const jobHistory = vehicle.jobHistory || [];

        // Check if job already exists in history
        if (!jobHistory.includes(jobId)) {
          // Add job to history and increment job count
          jobHistory.push(jobId);

          return updateDoc(vehicleRef, {
            jobHistory: jobHistory,
            jobCount: jobHistory.length,
            updatedAt: serverTimestamp(),
            updatedBy: userId,
            lastProcessedDate: serverTimestamp(),
          });
        }

        // Job already in history, no need to update
        return Promise.resolve();
      }),
      map(() => void 0),
      tap(() => this.loadingSubject.next(false)),
      catchError((error) => {
        console.error(`Error adding job to vehicle history for ${vehicleId}:`, error);
        this.loadingSubject.next(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get vehicle makes
   */
  getVehicleMakes(): Observable<VehicleMake[]> {
    const makesRef = collection(this.firestore, 'vehicleMakes');
    const q = query(makesRef, orderBy('displayName'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return {
            id: doc.id,
            ...doc.data(),
          } as VehicleMake;
        });
      }),
      catchError((error) => {
        console.error('Error fetching vehicle makes:', error);
        return of([]);
      })
    );
  }

  /**
   * Create a new vehicle make
   */
  createVehicleMake(makeData: Partial<VehicleMake>): Observable<string> {
    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const makesRef = collection(this.firestore, 'vehicleMakes');

    // Use name as document ID (make it lowercase)
    const docId = makeData.name?.toLowerCase();
    if (!docId) {
      return throwError(() => new Error('Make name is required'));
    }

    const makeRef = doc(this.firestore, `vehicleMakes/${docId}`);

    // Prepare make data
    const newMakeData = {
      ...makeData,
      id: docId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
      vehicleTypes: makeData.vehicleTypes || [],
    };

    return from(setDoc(makeRef, newMakeData)).pipe(
      map(() => docId),
      catchError((error) => {
        console.error('Error creating vehicle make:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update a vehicle make
   */
  updateVehicleMake(makeId: string, data: Partial<VehicleMake>): Observable<void> {
    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const makeRef = doc(this.firestore, `vehicleMakes/${makeId}`);

    // Remove id from update data to avoid overwriting it
    const { id, ...updateData } = data;

    // Add updater and timestamp
    const makeUpdateData = {
      ...updateData,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    return from(updateDoc(makeRef, makeUpdateData)).pipe(
      map(() => void 0),
      catchError((error) => {
        console.error(`Error updating vehicle make ${makeId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get vehicle models
   */
  getVehicleModels(): Observable<VehicleModel[]> {
    const modelsRef = collection(this.firestore, 'vehicleModels');
    const q = query(modelsRef, orderBy('name'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return {
            id: doc.id,
            ...doc.data(),
          } as VehicleModel;
        });
      }),
      catchError((error) => {
        console.error('Error fetching vehicle models:', error);
        return of([]);
      })
    );
  }

  /**
   * Create a new vehicle model
   */
  createVehicleModel(modelData: Partial<VehicleModel>): Observable<string> {
    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const modelsRef = collection(this.firestore, 'vehicleModels');

    // Generate a unique model ID based on make and model
    const makeId = modelData.makeId;
    const modelName = modelData.name;

    if (!makeId || !modelName) {
      return throwError(() => new Error('Make ID and model name are required'));
    }

    // Create a document ID by combining make ID and model name
    const docId = `${makeId}_${modelName.toLowerCase().replace(/\s+/g, '_')}`;
    const modelRef = doc(this.firestore, `vehicleModels/${docId}`);

    // Prepare model data
    const newModelData = {
      ...modelData,
      id: docId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
    };

    return from(setDoc(modelRef, newModelData)).pipe(
      map(() => docId),
      catchError((error) => {
        console.error('Error creating vehicle model:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Update a vehicle model
   */
  updateVehicleModel(modelId: string, data: Partial<VehicleModel>): Observable<void> {
    // Get the current user ID
    const userId = this.currentUserId;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const modelRef = doc(this.firestore, `vehicleModels/${modelId}`);

    // Remove id from update data to avoid overwriting it
    const { id, ...updateData } = data;

    // Add updater and timestamp
    const modelUpdateData = {
      ...updateData,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    return from(updateDoc(modelRef, modelUpdateData)).pipe(
      map(() => void 0),
      catchError((error) => {
        console.error(`Error updating vehicle model ${modelId}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get vehicle models by make
   */
  getVehicleModelsByMake(makeId: string): Observable<VehicleModel[]> {
    if (!makeId) {
      return of([]);
    }

    const modelsRef = collection(this.firestore, 'vehicleModels');
    const q = query(modelsRef, where('makeId', '==', makeId), where('isActive', '==', true), orderBy('name'));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        return snapshot.docs.map((doc) => {
          return {
            id: doc.id,
            ...doc.data(),
          } as VehicleModel;
        });
      }),
      catchError((error) => {
        console.error(`Error fetching vehicle models for make ${makeId}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Search vehicles by registration or chassis number
   */
  searchVehicles(searchTerm: string): Observable<Vehicle[]> {
    if (!searchTerm || searchTerm.length < 2) {
      return of([]);
    }

    const vehiclesRef = collection(this.firestore, 'vehicles');
    // Since Firebase doesn't support regex search, we'll do a client-side filter
    const q = query(vehiclesRef, limit(100)); // Limit to avoid large result sets

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const searchTermLower = searchTerm.toLowerCase();
        return snapshot.docs
          .map((doc) => this.convertFirebaseVehicleToModel(doc.id, doc.data()))
          .filter((vehicle) => {
            return (
              vehicle.registration.toLowerCase().includes(searchTermLower) ||
              (vehicle.chassisNumber && vehicle.chassisNumber.toLowerCase().includes(searchTermLower)) ||
              vehicle.makeName.toLowerCase().includes(searchTermLower) ||
              vehicle.modelName.toLowerCase().includes(searchTermLower)
            );
          });
      }),
      catchError((error) => {
        console.error('Error searching vehicles:', error);
        return of([]);
      })
    );
  }

  /**
   * Refresh the vehicles list
   */
  private refreshVehiclesList(): void {
    // Only refresh if we have vehicles loaded already
    if (this.vehiclesSubject.getValue().length > 0) {
      this.getVehicles().subscribe();
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Convert Firestore data to Vehicle model
   */
  private convertFirebaseVehicleToModel(id: string, data: any): Vehicle {
    const vehicle: Vehicle = {
      id, // Now always required
      registration: data.registration || '',
      chassisNumber: data.chassisNumber || '',
      makeId: data.makeId || '',
      makeName: data.makeName || '',
      modelId: data.modelId || '',
      modelName: data.modelName || '',
      type: data.type || '',
      color: data.color || '',
      year: data.year || 0,
      firstProcessedDate: this.convertTimestamp(data.firstProcessedDate) || new Date(),
      lastProcessedDate: this.convertTimestamp(data.lastProcessedDate) || new Date(),
      mileage: data.mileage || 0,
      jobCount: data.jobCount || 0,
      jobHistory: data.jobHistory || [],
    };

    // Add optional fields if present
    if (data.fuelType) vehicle.fuelType = data.fuelType;
    if (data.transmission) vehicle.transmission = data.transmission;
    if (data.engineSize) vehicle.engineSize = data.engineSize;
    if (data.vin) vehicle.vin = data.vin;
    if (data.notes) vehicle.notes = data.notes;

    // Convert photos array
    if (data.photos && Array.isArray(data.photos)) {
      vehicle.photos = data.photos.map((photo: any) => ({
        ...photo,
        takenAt: this.convertTimestamp(photo.takenAt) || new Date(),
      }));
    }

    // Convert condition reports array
    if (data.conditionReports && Array.isArray(data.conditionReports)) {
      vehicle.conditionReports = data.conditionReports.map((report: any) => ({
        ...report,
        createdAt: this.convertTimestamp(report.createdAt) || new Date(),
      }));
    }

    return vehicle;
  }

  /**
   * Get unique vehicle types
   */
  getVehicleTypes(): Observable<string[]> {
    // First try to get types from the vehicle models
    return this.getVehicleModels().pipe(
      map((models) => {
        const typesSet = new Set<string>();
        models.forEach((model) => {
          if (model.type) {
            typesSet.add(model.type);
          }
        });
        return Array.from(typesSet).sort();
      }),
      catchError(() => {
        // If that fails, return default types
        return of(['Car', 'Van', 'Motorbike', 'Truck', 'Bus', 'Trailer']);
      })
    );
  }
}
