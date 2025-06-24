export interface Job {
  id: string;
  vehicleId: string;
  driverId: string | null;
  status: JobStatus;
  stage?: string;

  // Customer Information
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Vehicle Information
  regNumber?: string;
  make?: string;
  model?: string;
  year?: number | null;
  color?: string;

  // Collection Information
  collectionAddress?: string;
  collectionTown?: string;
  collectionPostcode?: string;
  collectionDate?: Date;
  collectionStartTime?: Date;
  collectionCompleteTime?: Date;

  // Delivery Information
  deliveryAddress?: string;
  deliveryTown?: string;
  deliveryPostcode?: string;
  deliveryDate?: Date;
  deliveryStartTime?: Date;
  deliveryCompleteTime?: Date;

  // Additional Information
  notes?: string;
  specialInstructions?: string;
  priority?: JobPriority;
  estimatedDuration?: number | null;
  actualDuration?: number | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  allocatedAt?: Date;
  statusUpdatedAt?: Date;

  // Tracking
  createdBy?: string;
  updatedBy?: string;

  // Optional extended fields
  [key: string]: any;
}

export type JobStatus = 'unallocated' | 'allocated' | 'collected' | 'in-transit' | 'delivered' | 'completed' | 'cancelled';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

// src/app/interfaces/user-profile.interface.ts - User Profile Interface
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role: string;
  isActive: boolean; // Always boolean, never undefined
  permissions?: UserPermissions;
  createdAt?: Date;
  updatedAt?: Date;

  // Driver-specific fields
  licenseNumber?: string;
  licenseExpiryDate?: Date;
  emergencyContact?: EmergencyContact;
  address?: Address;

  // Additional profile fields
  profilePhotoUrl?: string;
  dateOfBirth?: Date;
  startDate?: Date;

  [key: string]: any;
}

export interface UserPermissions {
  isAdmin?: boolean;
  canAllocateJobs?: boolean;
  canApproveExpenses?: boolean;
  canCreateJobs?: boolean;
  canEditJobs?: boolean;
  canDeleteJobs?: boolean;
  canManageUsers?: boolean;
  canManageVehicles?: boolean;
  canManageCustomers?: boolean;
  canViewReports?: boolean;
  canViewUnallocated?: boolean;
  canViewDrivers?: boolean;

  [key: string]: boolean | undefined;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phoneNumber: string;
  email?: string;
}

export interface Address {
  street: string;
  city: string;
  postcode: string;
  country?: string;
}
