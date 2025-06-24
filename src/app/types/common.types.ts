export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface ErrorResponse {
  message: string;
  code?: string;
  details?: any;
}

// Type guards for better type safety
export function isJob(obj: any): obj is Job {
  return obj && typeof obj === 'object' && typeof obj.id === 'string';
}

export function isJobArray(obj: any): obj is Job[] {
  return Array.isArray(obj) && obj.every(isJob);
}

// Utility types for component props
export interface ComponentError {
  message: string;
  code?: string;
  timestamp: Date;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

// Update the Job interface to be more strict
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
  customerId?: string;

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

// Component-specific interfaces with proper typing

// For customer-details component
export interface CustomerJobsResponse {
  jobs: Job[];
  total: number;
  hasMore: boolean;
}

// For expense-create component
export interface DriverJobsResponse {
  jobs: Job[];
  completedJobs: Job[];
}

// For job-details component
export interface JobActionResponse {
  success: boolean;
  message: string;
  jobId?: string;
}

// For job-list component
export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  hasMore: boolean;
}

// Service method return types
export interface JobDuplicationResult {
  newJobId: string;
  originalJobId: string;
  success: boolean;
}

export interface JobAllocationResult {
  jobId: string;
  driverId: string;
  success: boolean;
  message: string;
}

// Component callback types
export type JobSuccessCallback = (jobs: Job[]) => void;
export type JobErrorCallback = (error: ErrorResponse) => void;
export type JobActionCallback = (result: JobActionResponse) => void;

// Service observer types
export interface JobServiceObserver<T = any> {
  next: (value: T) => void;
  error: (error: ErrorResponse) => void;
  complete?: () => void;
}

// Import this in components to avoid 'any' types
export interface TypedJobObserver {
  next: (jobs: Job[]) => void;
  error: (error: ErrorResponse) => void;
  complete?: () => void;
}

export interface TypedJobActionObserver {
  next: (result: JobActionResponse) => void;
  error: (error: ErrorResponse) => void;
  complete?: () => void;
}
