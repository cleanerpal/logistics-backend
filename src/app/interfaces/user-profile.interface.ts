export interface UserProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  DISPATCHER = 'dispatcher',
  DRIVER = 'driver',
  USER = 'user',
}
