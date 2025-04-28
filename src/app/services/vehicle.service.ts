import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// Firebase imports
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  where,
} from '@angular/fire/firestore';

export interface VehicleMake {
  id: string;
  name: string;
}

export interface VehicleModel {
  id: string;
  makeId: string;
  name: string;
}

@Injectable({
  providedIn: 'root',
})
export class VehicleService {
  private firestore: Firestore = inject(Firestore);

  /**
   * Get all vehicle makes
   */
  getVehicleMakes(): Observable<VehicleMake[]> {
    const makesRef = collection(this.firestore, 'VehicleMakes');
    const makesQuery = query(makesRef, orderBy('name'));

    return collectionData(makesQuery, { idField: 'id' }).pipe(
      map((makes) => makes as VehicleMake[])
    );
  }

  /**
   * Get vehicle models for a specific make
   */
  getVehicleModels(makeId: string): Observable<VehicleModel[]> {
    const modelsRef = collection(this.firestore, 'VehicleModels');
    const modelsQuery = query(
      modelsRef,
      where('makeId', '==', makeId),
      orderBy('name')
    );

    return collectionData(modelsQuery, { idField: 'id' }).pipe(
      map((models) => models as VehicleModel[])
    );
  }

  /**
   * Get all vehicle models
   */
  getAllVehicleModels(): Observable<VehicleModel[]> {
    const modelsRef = collection(this.firestore, 'VehicleModels');
    const modelsQuery = query(modelsRef, orderBy('name'));

    return collectionData(modelsQuery, { idField: 'id' }).pipe(
      map((models) => models as VehicleModel[])
    );
  }
}
