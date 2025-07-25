export enum ExpenseStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum ExpenseType {
  FUEL = 'fuel',
  TOLL = 'toll',
  CAR_WASH = 'car_wash',
  VACUUM = 'vacuum',
  MAINTENANCE = 'maintenance',
  OTHER = 'other',
}

export interface Expense {
  id: string;
  jobId?: string;
  driverId: string;
  driverName: string;
  description: string;
  amount: number;
  date: Date;
  type: ExpenseType;
  receiptUrl?: string;
  status: ExpenseStatus;
  approvedBy?: string;
  approvedDate?: Date;
  isChargeable: boolean;
  notes?: string;

  isPaid?: boolean;
  paidDate?: Date;
  paidBy?: string;
  paymentReference?: string;
}
