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

  notes?:
    | string
    | Array<{
        author: string;
        content: string;
        date: Date | string;
        id?: string;
      }>
    | Record<string, any>;

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

  secondaryDeliveryAddress?: string;
  secondaryDeliveryCity?: string;
  secondaryDeliveryPostcode?: string;
  secondaryDeliveryContactName?: string;
  secondaryDeliveryContactPhone?: string;
  secondaryDeliveryNotes?: string;

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
