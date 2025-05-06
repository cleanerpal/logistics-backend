// src/app/shared/models/customer.model.ts

export enum CustomerSize {
  SMALL = 'Small (1-50)',
  MEDIUM = 'Medium (51-250)',
  LARGE = 'Large (251-1000)',
  ENTERPRISE = 'Enterprise (1000+)',
}

export enum CustomerStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  PENDING = 'Pending',
}

export interface CustomerContact {
  id: string;
  name: string;
  position?: string;
  email: string;
  phone?: string;
  isPrimary: boolean;
}

export interface Customer {
  id: string;
  name: string;
  industry?: string;
  category?: string;
  size?: CustomerSize;
  status: CustomerStatus;
  address?: string;
  city?: string;
  postcode?: string;
  country?: string;
  website?: string;
  description?: string;
  contacts: CustomerContact[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  lastContact?: Date;
  notes?: string;
  isActive: boolean;
}
