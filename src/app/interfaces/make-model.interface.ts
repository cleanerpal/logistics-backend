import { Timestamp } from 'firebase/firestore';

export interface MakeModel {
  id: string;
  name: string;
  displayName?: string;
  type: 'make' | 'model';
  vehicleType?: string; // Car, Van, Truck, Motorbike, Bus, Other
  makeId?: string; // For models, reference to the make
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy?: string;

  logoUrl?: string; // For makes
  popularity?: number; // For sorting
  aliases?: string[]; // Alternative names

  [key: string]: any;
}

export interface Make extends MakeModel {
  type: 'make';
  logoUrl?: string;
  models?: Model[]; // Populated in certain queries
}

export interface Model extends MakeModel {
  type: 'model';
  makeId: string;
  makeName?: string; // Populated in certain queries
}

export interface CreateMakeModelRequest {
  name: string;
  displayName?: string;
  vehicleType?: string;
  makeId?: string; // Required for models
  logoUrl?: string;
  aliases?: string[];
}

export interface UpdateMakeModelRequest {
  name?: string;
  displayName?: string;
  vehicleType?: string;
  logoUrl?: string;
  aliases?: string[];
  isActive?: boolean;
}

export interface MakeModelQueryOptions {
  vehicleType?: string;
  makeId?: string;
  isActive?: boolean;
  includeInactive?: boolean;
  orderBy?: 'name' | 'displayName' | 'popularity' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
  limit?: number;
}

export interface BulkMakeModelOperation {
  action: 'create' | 'update' | 'delete';
  items: (CreateMakeModelRequest | (UpdateMakeModelRequest & { id: string }))[];
}

export interface MakeModelSearchResult {
  makes: Make[];
  models: Model[];
  total: number;
}
