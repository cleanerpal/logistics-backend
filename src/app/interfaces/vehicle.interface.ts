// src/app/interfaces/vehicle.interface.ts

// Define a type that can handle Firestore timestamps
export type FirestoreDate = Date | any; // 'any' allows for Firestore Timestamp objects

export interface VehiclePhoto {
  id: string;
  url: string;
  type: string;
  takenBy: string;
  takenAt: FirestoreDate;
  jobId: string;
  notes?: string;
}

export interface ConditionReport {
  id: string;
  jobId: string;
  createdBy: string;
  createdAt: FirestoreDate;
  damageNotes?: string;
  mileage: number;
  fuelLevel: string;
  cleanliness: string;
  interiorCondition: string;
  exteriorCondition: string;
  additionalNotes?: string;
}

export interface Vehicle {
  id: string;
  registration: string;
  chassisNumber?: string;
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  type: string;
  color?: string;
  year?: number;
  firstProcessedDate: FirestoreDate;
  lastProcessedDate: FirestoreDate;
  mileage?: number;
  fuelType?: string;
  transmission?: string;
  engineSize?: string;
  vin?: string;
  photos?: VehiclePhoto[];
  conditionReports?: ConditionReport[];
  jobCount: number;
  jobHistory: string[];
  notes?: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
  createdBy: string;
  updatedBy: string;
}
