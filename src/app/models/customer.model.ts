import { Timestamp } from '@angular/fire/firestore';

export interface Customer {
  id: string;
  name: string;
  reference?: string;
  email?: string;
  phone?: string;
  primaryAddress: Address;
  addresses: Address[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Address {
  id: string;
  name: string;
  building: string;
  street: string;
  city: string;
  postcode: string;
  country: string;
  phone?: string;
  email?: string;
  notes?: string;
  isDefault?: boolean;
}
