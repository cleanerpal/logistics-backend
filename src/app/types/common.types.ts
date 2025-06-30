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

export function isJob(obj: any): obj is Job {
  return obj && typeof obj === 'object' && typeof obj.id === 'string';
}

export function isJobArray(obj: any): obj is Job[] {
  return Array.isArray(obj) && obj.every(isJob);
}

export interface ComponentError {
  message: string;
  code?: string;
  timestamp: Date;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface Job {
  id: string;
  vehicleId: string;
  driverId: string | null;
  status: JobStatus;
  stage?: string;

  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerId?: string;

  regNumber?: string;
  make?: string;
  model?: string;
  year?: number | null;
  color?: string;

  collectionAddress?: string;
  collectionTown?: string;
  collectionPostcode?: string;
  collectionDate?: Date;
  collectionStartTime?: Date;
  collectionCompleteTime?: Date;

  deliveryAddress?: string;
  deliveryTown?: string;
  deliveryPostcode?: string;
  deliveryDate?: Date;
  deliveryStartTime?: Date;
  deliveryCompleteTime?: Date;

  notes?: string;
  specialInstructions?: string;
  priority?: JobPriority;
  estimatedDuration?: number | null;
  actualDuration?: number | null;

  createdAt: Date;
  updatedAt: Date;
  allocatedAt?: Date;
  statusUpdatedAt?: Date;

  createdBy?: string;
  updatedBy?: string;

  [key: string]: any;
}

export type JobStatus = 'unallocated' | 'allocated' | 'collected' | 'in-transit' | 'delivered' | 'completed' | 'cancelled';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CustomerJobsResponse {
  jobs: Job[];
  total: number;
  hasMore: boolean;
}

export interface DriverJobsResponse {
  jobs: Job[];
  completedJobs: Job[];
}

export interface JobActionResponse {
  success: boolean;
  message: string;
  jobId?: string;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  hasMore: boolean;
}

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

export type JobSuccessCallback = (jobs: Job[]) => void;
export type JobErrorCallback = (error: ErrorResponse) => void;
export type JobActionCallback = (result: JobActionResponse) => void;

export interface JobServiceObserver<T = any> {
  next: (value: T) => void;
  error: (error: ErrorResponse) => void;
  complete?: () => void;
}

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
