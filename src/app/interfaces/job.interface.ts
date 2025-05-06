export interface Job {
  id: string;
  vehicleId: string;
  driverId: string | null;
  status: 'unallocated' | 'allocated' | 'collected' | 'delivered' | 'completed';
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

  // Notes can be either a string, array of note objects, or an object of note objects
  notes?:
    | string
    | Array<{
        author: string;
        content: string;
        date: Date | string;
        id?: string;
      }>
    | Record<string, any>;

  // Additional fields based on docs
  customerId?: string;
  customerName?: string;
  customerContact?: string;
  customerContactPhone?: string;

  // Primary Collection details
  collectionAddress?: string;
  collectionCity?: string;
  collectionPostcode?: string;
  collectionContactName?: string;
  collectionContactPhone?: string;
  collectionNotes?: string;

  // Final Delivery details
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPostcode?: string;
  deliveryContactName?: string;
  deliveryContactPhone?: string;
  deliveryNotes?: string;

  // Vehicle details
  color?: string;
  year?: number;
  fuelType?: string;
  mileage?: number;
  fuelLevel?: string;
  chassisNumber?: string;
  vehicleType?: string;

  // Split journey
  isSplitJourney?: boolean;

  // Secondary Collection details
  secondaryCollectionAddress?: string;
  secondaryCollectionCity?: string;
  secondaryCollectionPostcode?: string;
  secondaryCollectionContactName?: string;
  secondaryCollectionContactPhone?: string;
  secondaryCollectionNotes?: string;

  // Secondary Delivery details
  secondaryDeliveryAddress?: string;
  secondaryDeliveryCity?: string;
  secondaryDeliveryPostcode?: string;
  secondaryDeliveryContactName?: string;
  secondaryDeliveryContactPhone?: string;
  secondaryDeliveryNotes?: string;

  // Timestamps from job process
  collectionActualDateTime?: Date;
  deliveryActualDateTime?: Date;

  // Photos and documentation
  collectionPhotos?: string[];
  deliveryPhotos?: string[];
  collectionSignature?: string;
  deliverySignature?: string;

  // For supporting any additional fields
  [key: string]: any;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: string;
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

export type UserPermissionKey =
  | 'canAllocateJobs'
  | 'canApproveExpenses'
  | 'canCreateJobs'
  | 'canEditJobs'
  | 'canManageUsers'
  | 'canViewReports'
  | 'canViewUnallocated'
  | 'isAdmin';
