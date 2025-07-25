export interface Invoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;

  items: InvoiceItem[];

  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;

  status: InvoiceStatus;
  paymentStatus: PaymentStatus;

  invoiceDate: Date;
  dueDate: Date;
  paidDate?: Date;

  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;

  notes?: string;
  paymentReference?: string;
  customerReference?: string;

  emailedTo?: string[];
  emailedAt?: Date;

  printedAt?: Date;
  printedBy?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category: InvoiceItemCategory;
  expenseId?: string; // Link to expense if applicable
  notes?: string;
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  SENT = 'sent',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  OUTSTANDING = 'outstanding',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum InvoiceItemCategory {
  TRANSPORT = 'transport',
  FUEL = 'fuel',
  TOLLS = 'tolls',
  MAINTENANCE = 'maintenance',
  PARKING = 'parking',
  STORAGE = 'storage',
  ADDITIONAL_SERVICES = 'additional_services',
  OTHER = 'other',
}

export interface JobBilling {
  jobId: string;
  hasInvoice: boolean;
  invoiceId?: string;
  totalExpenses: number;
  totalChargeableExpenses: number;
  billingStatus: 'not_billed' | 'pending' | 'invoiced' | 'paid';
  lastBilledDate?: Date;
}
