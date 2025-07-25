export interface JobBillingItem {
  id: string;
  jobId: string;
  type: 'expense' | 'charge' | 'initial_cost' | 'additional_fee';
  description: string;
  amount: number;
  quantity: number;
  unitPrice: number;
  isChargeable: boolean;
  category: string; // e.g., 'fuel', 'tolls', 'transport', 'storage', 'handling'
  date: Date;
  receiptUrl?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobInvoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  billingAddress?: {
    address: string;
    city: string;
    postcode: string;
    country: string;
  };
  items: JobBillingItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'outstanding' | 'paid' | 'overdue';
  issueDate: Date;
  dueDate: Date;
  sentDate?: Date;
  paidDate?: Date;
  paidAmount?: number;
  paymentReference?: string;
  paymentMethod?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingSettings {
  vatRate: number;
  paymentTermsDays: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  companyDetails: {
    name: string;
    address: string;
    city: string;
    postcode: string;
    country: string;
    companyNumber: string;
    vatNumber?: string;
    email: string;
    phone: string;
    website?: string;
  };
  bankDetails: {
    bankName: string;
    accountName: string;
    sortCode: string;
    accountNumber: string;
  };
  emailTemplates: {
    invoiceSubject: string;
    invoiceBody: string;
    reminderSubject: string;
    reminderBody: string;
  };
}

export interface BillingDashboardStats {
  totalOutstanding: number;
  totalPaid: number;
  overdueCount: number;
  overdueAmount: number;
  thisMonthInvoiced: number;
  thisMonthPaid: number;
  averagePaymentDays: number;
}
