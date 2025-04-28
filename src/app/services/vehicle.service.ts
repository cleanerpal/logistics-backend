// vehicle.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

// Firebase imports
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  query,
  orderBy,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
} from '@angular/fire/firestore';

export interface VehicleMake {
  id: string;
  name: string;
  country?: string;
  logoUrl?: string;
}

export interface VehicleModel {
  id: string;
  makeId: string;
  name: string;
  startYear?: number;
  endYear?: number;
  type?: string;
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
      map((makes) => makes as VehicleMake[]),
      catchError((error) => {
        console.error('Error fetching vehicle makes:', error);
        return of([]);
      })
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
      map((models) => models as VehicleModel[]),
      catchError((error) => {
        console.error(`Error fetching models for make ${makeId}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get a specific make by ID
   */
  getVehicleMakeById(makeId: string): Observable<VehicleMake | null> {
    const makeRef = doc(this.firestore, 'VehicleMakes', makeId);
    return from(getDoc(makeRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as VehicleMake;
        } else {
          return null;
        }
      }),
      catchError((error) => {
        console.error(`Error fetching make ${makeId}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Get a specific model by ID
   */
  getVehicleModelById(modelId: string): Observable<VehicleModel | null> {
    const modelRef = doc(this.firestore, 'VehicleModels', modelId);
    return from(getDoc(modelRef)).pipe(
      map((docSnap) => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as VehicleModel;
        } else {
          return null;
        }
      }),
      catchError((error) => {
        console.error(`Error fetching model ${modelId}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Add a new vehicle make
   */
  async addVehicleMake(make: Omit<VehicleMake, 'id'>): Promise<string> {
    try {
      const makesRef = collection(this.firestore, 'VehicleMakes');
      const docRef = await addDoc(makesRef, make);
      return docRef.id;
    } catch (error) {
      console.error('Error adding vehicle make:', error);
      throw error;
    }
  }

  /**
   * Add a new vehicle model
   */
  async addVehicleModel(model: Omit<VehicleModel, 'id'>): Promise<string> {
    try {
      const modelsRef = collection(this.firestore, 'VehicleModels');
      const docRef = await addDoc(modelsRef, model);
      return docRef.id;
    } catch (error) {
      console.error('Error adding vehicle model:', error);
      throw error;
    }
  }

  /**
   * Update a vehicle make
   */
  async updateVehicleMake(
    id: string,
    make: Partial<VehicleMake>
  ): Promise<void> {
    try {
      const makeRef = doc(this.firestore, 'VehicleMakes', id);
      await updateDoc(makeRef, make);
    } catch (error) {
      console.error(`Error updating make ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update a vehicle model
   */
  async updateVehicleModel(
    id: string,
    model: Partial<VehicleModel>
  ): Promise<void> {
    try {
      const modelRef = doc(this.firestore, 'VehicleModels', id);
      await updateDoc(modelRef, model);
    } catch (error) {
      console.error(`Error updating model ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a vehicle make and all its models
   */
  async deleteVehicleMakeWithModels(makeId: string): Promise<void> {
    try {
      await runTransaction(this.firestore, async (transaction) => {
        // Get all models for this make
        const modelsRef = collection(this.firestore, 'VehicleModels');
        const modelsQuery = query(modelsRef, where('makeId', '==', makeId));
        const modelsSnapshot = await getDocs(modelsQuery);

        // Delete all models
        modelsSnapshot.docs.forEach((doc) => {
          transaction.delete(doc.ref);
        });

        // Delete the make
        const makeRef = doc(this.firestore, 'VehicleMakes', makeId);
        transaction.delete(makeRef);
      });
    } catch (error) {
      console.error(`Error deleting make ${makeId} with models:`, error);
      throw error;
    }
  }
}
