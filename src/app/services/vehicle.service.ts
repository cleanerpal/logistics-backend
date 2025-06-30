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
    super();
  }

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

  createVehicle(vehicleData: Omit<Vehicle, 'id'>): Observable<string> {
    this.loadingSubject.next(true);

    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const newVehicleData = {
      ...vehicleData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,

      firstProcessedDate: serverTimestamp(),
      lastProcessedDate: serverTimestamp(),
    };

    const docId = vehicleData.registration?.toUpperCase();
    if (!docId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('Registration number is required'));
    }

    const vehicleRef = doc(this.firestore, `vehicles/${docId}`);

    return from(setDoc(vehicleRef, newVehicleData)).pipe(
      map(() => {
        this.refreshVehiclesList();

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

  updateVehicle(vehicleId: string, data: Partial<Omit<Vehicle, 'id'>>): Observable<void> {
    this.loadingSubject.next(true);

    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    const vehicleUpdateData = {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      lastProcessedDate: serverTimestamp(),
    };

    return from(updateDoc(vehicleRef, vehicleUpdateData)).pipe(
      tap(() => {
        this.refreshVehiclesList();

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

  addVehiclePhoto(vehicleId: string, photoData: Partial<VehiclePhoto>): Observable<string> {
    this.loadingSubject.next(true);

    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    return from(getDoc(vehicleRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Vehicle ${vehicleId} not found`);
        }

        const vehicle = docSnap.data() as Vehicle;
        const photos = vehicle.photos || [];

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

        photos.push(newPhoto);

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

  addConditionReport(vehicleId: string, reportData: Partial<ConditionReport>): Observable<string> {
    this.loadingSubject.next(true);

    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    return from(getDoc(vehicleRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Vehicle ${vehicleId} not found`);
        }

        const vehicle = docSnap.data() as Vehicle;
        const reports = vehicle.conditionReports || [];

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

        reports.push(newReport);

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

  addJobToVehicle(vehicleId: string, jobId: string): Observable<void> {
    this.loadingSubject.next(true);

    const userId = this.currentUserId;
    if (!userId) {
      this.loadingSubject.next(false);
      return throwError(() => new Error('User not authenticated'));
    }

    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);

    return from(getDoc(vehicleRef)).pipe(
      switchMap((docSnap) => {
        if (!docSnap.exists()) {
          throw new Error(`Vehicle ${vehicleId} not found`);
        }

        const vehicle = docSnap.data() as Vehicle;
        const jobHistory = vehicle.jobHistory || [];

        if (!jobHistory.includes(jobId)) {
          jobHistory.push(jobId);

          return updateDoc(vehicleRef, {
            jobHistory: jobHistory,
            jobCount: jobHistory.length,
            updatedAt: serverTimestamp(),
            updatedBy: userId,
            lastProcessedDate: serverTimestamp(),
          });
        }

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

  createVehicleMake(makeData: Partial<VehicleMake>): Observable<string> {
    const userId = this.currentUserId;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const makesRef = collection(this.firestore, 'vehicleMakes');

    const docId = makeData.name?.toLowerCase();
    if (!docId) {
      return throwError(() => new Error('Make name is required'));
    }

    const makeRef = doc(this.firestore, `vehicleMakes/${docId}`);

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

  updateVehicleMake(makeId: string, data: Partial<VehicleMake>): Observable<void> {
    const userId = this.currentUserId;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const makeRef = doc(this.firestore, `vehicleMakes/${makeId}`);

    const { id, ...updateData } = data;

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

  createVehicleModel(modelData: Partial<VehicleModel>): Observable<string> {
    const userId = this.currentUserId;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const modelsRef = collection(this.firestore, 'vehicleModels');

    const makeId = modelData.makeId;
    const modelName = modelData.name;

    if (!makeId || !modelName) {
      return throwError(() => new Error('Make ID and model name are required'));
    }

    const docId = `${makeId}_${modelName.toLowerCase().replace(/\s+/g, '_')}`;
    const modelRef = doc(this.firestore, `vehicleModels/${docId}`);

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

  updateVehicleModel(modelId: string, data: Partial<VehicleModel>): Observable<void> {
    const userId = this.currentUserId;
    if (!userId) {
      return throwError(() => new Error('User not authenticated'));
    }

    const modelRef = doc(this.firestore, `vehicleModels/${modelId}`);

    const { id, ...updateData } = data;

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

  searchVehicles(searchTerm: string): Observable<Vehicle[]> {
    if (!searchTerm || searchTerm.length < 2) {
      return of([]);
    }

    const vehiclesRef = collection(this.firestore, 'vehicles');

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

  private refreshVehiclesList(): void {
    if (this.vehiclesSubject.getValue().length > 0) {
      this.getVehicles().subscribe();
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

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

    if (data.fuelType) vehicle.fuelType = data.fuelType;
    if (data.transmission) vehicle.transmission = data.transmission;
    if (data.engineSize) vehicle.engineSize = data.engineSize;
    if (data.vin) vehicle.vin = data.vin;
    if (data.notes) vehicle.notes = data.notes;

    if (data.photos && Array.isArray(data.photos)) {
      vehicle.photos = data.photos.map((photo: any) => ({
        ...photo,
        takenAt: this.convertTimestamp(photo.takenAt) || new Date(),
      }));
    }

    if (data.conditionReports && Array.isArray(data.conditionReports)) {
      vehicle.conditionReports = data.conditionReports.map((report: any) => ({
        ...report,
        createdAt: this.convertTimestamp(report.createdAt) || new Date(),
      }));
    }

    return vehicle;
  }

  getVehicleTypes(): Observable<string[]> {
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
        return of(['Car', 'Van', 'Motorbike', 'Truck', 'Bus', 'Trailer']);
      })
    );
  }
}
