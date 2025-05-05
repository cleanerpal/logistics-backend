export enum ExpenseStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export interface Expense {
  id: string;
  jobId?: string;
  driverId: string;
  driverName: string;
  description: string;
  amount: number;
  date: Date;
  receiptUrl?: string;
  status: ExpenseStatus;
  approvedBy?: string;
  approvedDate?: Date;
  isChargeable: boolean;
  notes?: string;
}
