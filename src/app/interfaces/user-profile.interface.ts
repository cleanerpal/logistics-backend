// src/app/interfaces/user-profile.interface.ts
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  phone?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'pending' | 'on_leave';
  isActive?: boolean;
  company?: string;
  type?: 'customer' | 'supplier' | 'partner';
  lastActivity?: Date;
  licenseNumber?: string;
  licenseExpiry?: Date;
  vehicleType?: string;
  areaCoverage?: string;
  availability?: string;
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
  notes?: string;
}

// src/app/interfaces/user-profile.interface.ts
export enum UserRole {
  ADMIN = 'Admin',
  DRIVER = 'Driver',
  CONTRACTOR = 'Contractor',
  SYSTEM_USER = 'System User',
}

export type UserPermissionKey =
  | 'canAllocateJobs'
  | 'canApproveExpenses'
  | 'canCreateJobs'
  | 'canEditJobs'
  | 'canManageUsers'
  | 'canViewReports'
  | 'canViewUnallocated'
  | 'isAdmin'
  | 'canViewSystemSettings'
  | 'canManageCompanies'
  | 'canViewAllJobs'
  | 'canViewAssignedJobs'
  | 'canCreateExpenses';

// Define preset permissions for each role
export const ROLE_PERMISSION_PRESETS: Record<UserRole, Record<UserPermissionKey, boolean>> = {
  [UserRole.ADMIN]: {
    canAllocateJobs: true,
    canApproveExpenses: true,
    canCreateJobs: true,
    canEditJobs: true,
    canManageUsers: true,
    canViewReports: true,
    canViewUnallocated: true,
    isAdmin: true,
    canViewSystemSettings: true,
    canManageCompanies: true,
    canViewAllJobs: true,
    canViewAssignedJobs: true,
    canCreateExpenses: true,
  },
  [UserRole.DRIVER]: {
    canAllocateJobs: false,
    canApproveExpenses: false,
    canCreateJobs: false,
    canEditJobs: false,
    canManageUsers: false,
    canViewReports: false,
    canViewUnallocated: false,
    isAdmin: false,
    canViewSystemSettings: false,
    canManageCompanies: false,
    canViewAllJobs: false,
    canViewAssignedJobs: true,
    canCreateExpenses: true,
  },
  [UserRole.CONTRACTOR]: {
    canAllocateJobs: false,
    canApproveExpenses: false,
    canCreateJobs: false,
    canEditJobs: false,
    canManageUsers: false,
    canViewReports: false,
    canViewUnallocated: false,
    isAdmin: false,
    canViewSystemSettings: false,
    canManageCompanies: false,
    canViewAllJobs: false,
    canViewAssignedJobs: true,
    canCreateExpenses: true,
  },
  [UserRole.SYSTEM_USER]: {
    canAllocateJobs: true,
    canApproveExpenses: true,
    canCreateJobs: true,
    canEditJobs: true,
    canManageUsers: true,
    canViewReports: true,
    canViewUnallocated: true,
    isAdmin: false,
    canViewSystemSettings: false,
    canManageCompanies: true,
    canViewAllJobs: true,
    canViewAssignedJobs: true,
    canCreateExpenses: true,
  },
};
