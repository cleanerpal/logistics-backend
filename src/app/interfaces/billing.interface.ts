import { Timestamp } from '@angular/fire/firestore';

export interface JobBilling {
  id?: string;
  jobId: string;
  basePrice: number;
  currency: string;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  totalAmount: number;

  // Additional costs
  additionalCosts: BillingCost[];

  // Invoice details
  invoiceNumber?: string;
  invoiceDate?: Timestamp;
  invoiceStatus: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

export interface BillingCost {
  id: string;
  description: string;
  amount: number;
  category: 'fuel' | 'toll' | 'parking' | 'accommodation' | 'meal' | 'maintenance' | 'other';
  isExpense: boolean; // true if it's a driver expense, false if it's additional cost
  expenseId?: string; // reference to expense if applicable
  addedBy: string;
  addedAt: Timestamp;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: Date;
  jobId: string;
  customerName: string;
  customerEmail?: string;
  jobDescription: string;
  basePrice: number;
  additionalCosts: BillingCost[];
  expenses: BillingCost[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
}
