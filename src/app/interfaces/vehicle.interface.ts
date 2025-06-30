export interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number;
  color: string;
  vin?: string;
  status: VehicleStatus;

  currentJobId?: string;
  assignedDriverId?: string;

  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
    address?: string;
  };

  fuelType?: FuelType;
  transmission?: TransmissionType;
  engineSize?: string;
  doors?: number;
  seats?: number;

  lastServiceDate?: Date;
  nextServiceDate?: Date;
  motExpiryDate?: Date;
  insuranceExpiryDate?: Date;
  taxExpiryDate?: Date;

  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;

  [key: string]: any;
}

export type VehicleStatus = 'available' | 'allocated' | 'in-transit' | 'maintenance' | 'out-of-service';

export type FuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'other';
export type TransmissionType = 'manual' | 'automatic' | 'semi-automatic';

export interface SimpleVehicle {
  id: string;
  registration?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  status?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  [key: string]: any;
}

export function isVehicle(obj: any): obj is Vehicle {
  return obj && typeof obj === 'object' && typeof obj.id === 'string' && typeof obj.make === 'string' && typeof obj.model === 'string' && typeof obj.status === 'string';
}

export function toVehicle(obj: any): Vehicle {
  return {
    id: obj.id || '',
    registration: obj.registration || '',
    make: obj.make || '',
    model: obj.model || '',
    year: obj.year || new Date().getFullYear(),
    color: obj.color || '',
    vin: obj.vin,
    status: obj.status || 'available',
    currentJobId: obj.currentJobId,
    assignedDriverId: obj.assignedDriverId,
    lastKnownLocation: obj.lastKnownLocation,
    fuelType: obj.fuelType,
    transmission: obj.transmission,
    engineSize: obj.engineSize,
    doors: obj.doors,
    seats: obj.seats,
    lastServiceDate: obj.lastServiceDate ? new Date(obj.lastServiceDate) : undefined,
    nextServiceDate: obj.nextServiceDate ? new Date(obj.nextServiceDate) : undefined,
    motExpiryDate: obj.motExpiryDate ? new Date(obj.motExpiryDate) : undefined,
    insuranceExpiryDate: obj.insuranceExpiryDate ? new Date(obj.insuranceExpiryDate) : undefined,
    taxExpiryDate: obj.taxExpiryDate ? new Date(obj.taxExpiryDate) : undefined,
    createdAt: obj.createdAt ? new Date(obj.createdAt) : new Date(),
    updatedAt: obj.updatedAt ? new Date(obj.updatedAt) : new Date(),
    createdBy: obj.createdBy,
    updatedBy: obj.updatedBy,
    ...obj, // spread any additional properties
  };
}
