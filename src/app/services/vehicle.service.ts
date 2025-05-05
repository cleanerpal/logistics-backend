import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  getDocs,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

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

@Injectable({
  providedIn: 'root',
})
export class VehicleService {
  constructor(private firestore: Firestore) {}

  /**
   * Get all vehicle makes
   */
  getVehicleMakes(): Observable<VehicleMake[]> {
    const makesRef = collection(this.firestore, 'vehicleMakes');
    const q = query(makesRef, where('isActive', '==', true));

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
   * Get vehicle makes by type
   */
  getVehicleMakesByType(type: string): Observable<VehicleMake[]> {
    const makesRef = collection(this.firestore, 'vehicleMakes');
    const q = query(
      makesRef,
      where('vehicleTypes', 'array-contains', type),
      where('isActive', '==', true)
    );

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
        console.error(`Error fetching vehicle makes of type ${type}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get all vehicle models
   */
  getVehicleModels(): Observable<VehicleModel[]> {
    const modelsRef = collection(this.firestore, 'vehicleModels');
    const q = query(modelsRef, where('isActive', '==', true));

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
   * Get vehicle models for a specific make
   */
  getVehicleModelsByMake(makeId: string): Observable<VehicleModel[]> {
    if (!makeId) {
      return of([]);
    }

    const modelsRef = collection(this.firestore, 'vehicleModels');
    const q = query(
      modelsRef,
      where('makeId', '==', makeId),
      where('isActive', '==', true)
    );

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
        console.error(
          `Error fetching vehicle models for make ${makeId}:`,
          error
        );
        return of([]);
      })
    );
  }

  /**
   * Get vehicle models by type
   */
  getVehicleModelsByType(type: string): Observable<VehicleModel[]> {
    if (!type) {
      return of([]);
    }

    const modelsRef = collection(this.firestore, 'vehicleModels');
    const q = query(
      modelsRef,
      where('type', '==', type),
      where('isActive', '==', true)
    );

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
        console.error(`Error fetching vehicle models of type ${type}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get vehicle types (unique list from all makes)
   */
  getVehicleTypes(): Observable<string[]> {
    const makesRef = collection(this.firestore, 'vehicleMakes');
    const q = query(makesRef, where('isActive', '==', true));

    return from(getDocs(q)).pipe(
      map((snapshot) => {
        const typesSet = new Set<string>();

        snapshot.docs.forEach((doc) => {
          const make = doc.data() as VehicleMake;

          if (make.vehicleTypes && Array.isArray(make.vehicleTypes)) {
            make.vehicleTypes.forEach((type) => typesSet.add(type));
          }
        });

        return Array.from(typesSet).sort();
      }),
      catchError((error) => {
        console.error('Error fetching vehicle types:', error);
        return of(['Car', 'Van', 'Truck', 'Motorbike']); // Fallback default types
      })
    );
  }
}
