import { Timestamp } from '@angular/fire/firestore';

export interface SavedChecklistItem {
  control: string;
  name: string;
  isChecked: boolean;
  category: string;
  notes?: string | null;
}

export interface JobProcessStepData {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPosition?: string | null;
  contactNumber?: string | null;
  signatureUrl?: string | null;
  photoUrls?: string[] | null;
  notes?: string | null;
  mileage?: number | null;
  fuelLevel?: number | null;
  energyType?: 'fuel' | 'electric' | string | null;
  damageReportedThisStep?: boolean;
  completedAt?: Timestamp | null;
  checklistItems?: SavedChecklistItem[] | null;
  damageDiagramImageUrl?: string | null;
}

export interface JobNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Timestamp;
}

export interface Job {
  id: string;

  vehicleRegistration: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  chassisNumber?: string | null;
  vehicleType?: string | null;
  vehicleColor?: string | null;
  vehicleYear?: number | null;
  vehicleFuelType?: string | null;

  status:
    | 'unallocated'
    | 'allocated'
    | 'collection-in-progress'
    | 'collected'
    | 'loaded'
    | 'secondary-collection-in-progress'
    | 'secondary-collection-complete'
    | 'in-transit'
    | 'first-delivery-in-progress'
    | 'first-delivery-complete'
    | 'delivery-in-progress'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'aborted';
  stage?: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  statusUpdatedAt: Timestamp;

  allocatedAt?: Timestamp | null;
  unallocatedAt?: Timestamp | null;
  collectionScheduledTime?: Timestamp | null;
  collectionActualStartTime?: Timestamp | null;
  collectionActualCompleteTime?: Timestamp | null;
  deliveryScheduledTime?: Timestamp | null;
  deliveryActualStartTime?: Timestamp | null;
  deliveryActualCompleteTime?: Timestamp | null;
  abortedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;

  driverId?: string | null;

  customerId?: string | null;
  customerName?: string | null;
  customerJobNumber?: string | null;
  shippingReference?: string | null;

  createdBy: string;
  updatedBy?: string | null;
  abortedBy?: string | null;
  cancelledBy?: string | null;

  collectionAddress?: string | null;
  collectionCity?: string | null;
  collectionPostcode?: string | null;
  collectionContactName?: string | null;
  collectionContactPhone?: string | null;
  collectionContactEmail?: string | null;
  collectionNotes?: string | null;
  collectionData?: JobProcessStepData | null;

  deliveryAddress?: string | null;
  deliveryCity?: string | null;
  deliveryPostcode?: string | null;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  deliveryContactEmail?: string | null;
  deliveryNotes?: string | null;
  deliveryData?: JobProcessStepData | null;

  isSplitJourney: boolean;
  secondaryCollectionAddress?: string | null;
  secondaryCollectionCity?: string | null;
  secondaryCollectionPostcode?: string | null;
  secondaryCollectionContactName?: string | null;
  secondaryCollectionContactPhone?: string | null;
  secondaryCollectionContactEmail?: string | null;
  secondaryCollectionNotes?: string | null;
  secondaryCollectionData?: JobProcessStepData | null;
  secondaryCollectionScheduledTime?: Timestamp | null;
  secondaryCollectionActualStartTime?: Timestamp | null;
  secondaryCollectionActualCompleteTime?: Timestamp | null;

  firstDeliveryAddress?: string | null;
  firstDeliveryCity?: string | null;
  firstDeliveryPostcode?: string | null;
  firstDeliveryContactName?: string | null;
  firstDeliveryContactPhone?: string | null;
  firstDeliveryContactEmail?: string | null;
  firstDeliveryNotes?: string | null;
  firstDeliveryData?: JobProcessStepData | null;
  firstDeliveryScheduledTime?: Timestamp | null;
  firstDeliveryActualStartTime?: Timestamp | null;
  firstDeliveryActualCompleteTime?: Timestamp | null;

  jobType?: string | null;
  generalNotes?: JobNote[] | null;
  hasDamageCommitted: boolean;
  abortReason?: string | null;

  collectionReportSentTo?: string[] | null;
  collectionReportDateSent?: Timestamp | null;
  deliveryReportSentTo?: string[] | null;
  deliveryReportDateSent?: Timestamp | null;

  multiJobBatchId?: string | null;

  [key: string]: any;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role: string;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
  statusUpdatedAt: Timestamp;

  vehicleRegistration: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  chassisNumber?: string | null;
  vehicleType?: string | null;
  vehicleColor?: string | null;
  vehicleYear?: number | null;
  vehicleFuelType?: string | null;

  status:
    | 'unallocated'
    | 'allocated'
    | 'collection-in-progress'
    | 'collected'
    | 'loaded'
    | 'secondary-collection-in-progress'
    | 'secondary-collection-complete'
    | 'in-transit'
    | 'first-delivery-in-progress'
    | 'first-delivery-complete'
    | 'delivery-in-progress'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'aborted';
  stage?: string | null;

  allocatedAt?: Timestamp | null;
  unallocatedAt?: Timestamp | null;
  collectionScheduledTime?: Timestamp | null;
  collectionActualStartTime?: Timestamp | null;
  collectionActualCompleteTime?: Timestamp | null;
  deliveryScheduledTime?: Timestamp | null;
  deliveryActualStartTime?: Timestamp | null;
  deliveryActualCompleteTime?: Timestamp | null;
  abortedAt?: Timestamp | null;
  cancelledAt?: Timestamp | null;

  driverId?: string | null;

  customerId?: string | null;
  customerName?: string | null;
  customerJobNumber?: string | null;
  shippingReference?: string | null;

  createdBy: string;
  updatedBy?: string | null;
  abortedBy?: string | null;
  cancelledBy?: string | null;

  collectionAddress?: string | null;
  collectionCity?: string | null;
  collectionPostcode?: string | null;
  collectionContactName?: string | null;
  collectionContactPhone?: string | null;
  collectionContactEmail?: string | null;
  collectionNotes?: string | null;
  collectionData?: JobProcessStepData | null;

  deliveryAddress?: string | null;
  deliveryCity?: string | null;
  deliveryPostcode?: string | null;
  deliveryContactName?: string | null;
  deliveryContactPhone?: string | null;
  deliveryContactEmail?: string | null;
  deliveryNotes?: string | null;
  deliveryData?: JobProcessStepData | null;

  isSplitJourney: boolean;
  secondaryCollectionAddress?: string | null;
  secondaryCollectionCity?: string | null;
  secondaryCollectionPostcode?: string | null;
  secondaryCollectionContactName?: string | null;
  secondaryCollectionContactPhone?: string | null;
  secondaryCollectionContactEmail?: string | null;
  secondaryCollectionNotes?: string | null;
  secondaryCollectionData?: JobProcessStepData | null;
  secondaryCollectionScheduledTime?: Timestamp | null;
  secondaryCollectionActualStartTime?: Timestamp | null;
  secondaryCollectionActualCompleteTime?: Timestamp | null;

  firstDeliveryAddress?: string | null;
  firstDeliveryCity?: string | null;
  firstDeliveryPostcode?: string | null;
  firstDeliveryContactName?: string | null;
  firstDeliveryContactPhone?: string | null;
  firstDeliveryContactEmail?: string | null;
  firstDeliveryNotes?: string | null;
  firstDeliveryData?: JobProcessStepData | null;
  firstDeliveryScheduledTime?: Timestamp | null;
  firstDeliveryActualStartTime?: Timestamp | null;
  firstDeliveryActualCompleteTime?: Timestamp | null;

  jobType?: string | null;
  generalNotes?: JobNote[] | null;
  hasDamageCommitted: boolean;
  abortReason?: string | null;

  collectionReportSentTo?: string[] | null;
  collectionReportDateSent?: Timestamp | null;
  deliveryReportSentTo?: string[] | null;
  deliveryReportDateSent?: Timestamp | null;

  multiJobBatchId?: string | null;
}
