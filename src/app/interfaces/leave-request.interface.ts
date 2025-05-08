export enum LeaveRequestStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  DENIED = 'Denied',
  CANCELLED = 'Cancelled',
}

export enum LeaveType {
  HOLIDAY = 'Holiday',
  SICK = 'Sick Leave',
  PERSONAL = 'Personal Leave',
  BEREAVEMENT = 'Bereavement',
  OTHER = 'Other',
}

export interface LeaveRequest {
  id: string;
  driverId: string;
  driverName: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  notes?: string;
  status: LeaveRequestStatus;
  submitted: Date;
  processedBy?: string;
  processedDate?: Date;
  responseNotes?: string;
}
