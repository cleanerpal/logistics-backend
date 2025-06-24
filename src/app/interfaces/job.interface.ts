// src/app/interfaces/job.interface.ts
// Updated interface to handle notes properly

export interface NoteData {
  author: string;
  content: string;
  date: Date | string;
  id?: string;
}

export interface Job {
  id: string;
  vehicleId: string;
  driverId: string | null;
  status: 'unallocated' | 'allocated' | 'collected' | 'delivered' | 'completed' | 'loaded';
  stage?: 'collection-complete' | 'in-transit' | 'ready-for-delivery' | 'awaiting-confirmation';
  collectionStartTime?: Date;
  collectionCompleteTime?: Date;
  deliveryStartTime?: Date;
  deliveryCompleteTime?: Date;
  allocatedAt?: Date;
  unallocatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string | null;
  make?: string;
  model?: string;
  registration?: string;

  // Fixed notes type to handle both string and array formats
  notes?: string | NoteData[] | Record<string, any>;

  customerId?: string;
  customerName?: string;
  customerContact?: string;
  customerContactPhone?: string;

  collectionAddress?: string;
  collectionCity?: string;
  collectionPostcode?: string;
  collectionContactName?: string;
  collectionContactPhone?: string;
  collectionNotes?: string;

  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPostcode?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliveryNotes?: string;

  color?: string;
  year?: number;
  fuelType?: string;
  mileage?: number;
  fuelLevel?: string;
  chassisNumber?: string;
  vehicleType?: string;

  isSplitJourney?: boolean;

  secondaryCollectionAddress?: string;
  secondaryCollectionCity?: string;
  secondaryCollectionPostcode?: string;
  secondaryCollectionContactName?: string;
  secondaryCollectionContactPhone?: string;
  secondaryCollectionNotes?: string;

  firstDeliveryAddress?: string;
  firstDeliveryCity?: string;
  firstDeliveryPostcode?: string;
  firstDeliveryContactName?: string;
  firstDeliveryContactPhone?: string;
  firstDeliveryNotes?: string;

  collectionActualDateTime?: Date;
  deliveryActualDateTime?: Date;

  collectionPhotos?: string[];
  deliveryPhotos?: string[];
  collectionSignature?: string;
  deliverySignature?: string;

  [key: string]: any;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role: string; // Made required to fix type compatibility
  isActive?: boolean;
  permissions?: {
    canAllocateJobs?: boolean;
    canApproveExpenses?: boolean;
    canCreateJobs?: boolean;
    canEditJobs?: boolean;
    canManageUsers?: boolean;
    canViewReports?: boolean;
    canViewUnallocated?: boolean;
    isAdmin?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface JobEntry {
  vehicleId: string;
  status: string;
  driverId: null | undefined;

  make?: string | null;
  model?: string | null;
  registration?: string | null;
  chassisNumber?: string | null;
  type?: string | null;
  color?: string | null;
  year?: number | null;

  collectionAddress?: string | null;
  collectionCity?: string | null;
  collectionContactName?: string | null;
  collectionContactPhone?: string | null;
  collectionEmail?: string | null;
  collectionDate?: string | null;
  collectionNotes?: string | null;

  deliveryAddress?: string | null;
  deliveryCity?: string | null;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  deliveryEmail?: string | null;
  deliveryDate?: string | null;
  deliveryNotes?: string | null;

  isSplitJourney?: boolean;
  secondaryCollectionAddress?: string | null;
  secondaryCollectionCity?: string | null;
  secondaryCollectionContactName?: string | null;
  secondaryCollectionContactPhone?: string | null;
  secondaryCollectionEmail?: string | null;
  secondaryCollectionDate?: string | null;
  secondaryCollectionNotes?: string | null;
  firstDeliveryAddress?: string | null;
  firstDeliveryCity?: string | null;
  firstDeliveryContactName?: string | null;
  firstDeliveryContactPhone?: string | null;
  firstDeliveryEmail?: string | null;
  firstDeliveryDate?: string | null;
  firstDeliveryNotes?: string | null;

  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;

  customerId?: string | null;
  customerName?: string | null;
  customerJobNumber?: string | null;
  shippingReference?: string | null;
}
