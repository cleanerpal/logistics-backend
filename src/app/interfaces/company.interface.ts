export enum CompanySize {
  SMALL = 'Small (1-50)',
  MEDIUM = 'Medium (51-250)',
  LARGE = 'Large (251-1000)',
  ENTERPRISE = 'Enterprise (1000+)',
}

export enum CompanyStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  PENDING = 'Pending',
}

export interface CompanyContact {
  id: string;
  name: string;
  position?: string;
  email: string;
  phone?: string;
  isPrimary: boolean;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  size: CompanySize;
  status: CompanyStatus;
  address: string;
  city?: string;
  postcode?: string;
  country?: string;
  website?: string;
  description?: string;
  contacts: CompanyContact[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  lastContact?: Date;
  notes?: string;
  logoUrl?: string;
}
