import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LeaveRequest } from '../../../interfaces/leave-request.interface';

export interface LeaveRequestProcessDialogData {
  request: LeaveRequest;
  isApproval: boolean;
}

@Component({
  selector: 'app-leave-request-process-dialog',
  templateUrl: './leave-request-process-dialog.component.html',
  styleUrls: ['./leave-request-process-dialog.component.scss'],
  standalone: false,
})
export class LeaveRequestProcessDialogComponent {
  processForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<LeaveRequestProcessDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LeaveRequestProcessDialogData,
    private fb: FormBuilder
  ) {
    this.processForm = this.fb.group({
      notes: [''],
    });
  }

  onCancelClick(): void {
    this.dialogRef.close();
  }

  onSubmitClick(): void {
    this.dialogRef.close({
      notes: this.processForm.get('notes')?.value,
    });
  }

  getDaysBetween(): number {
    const startDate = new Date(this.data.request.startDate);
    const endDate = new Date(this.data.request.endDate);

    // Calculate the difference in milliseconds
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());

    // Convert to days and add 1 to include both start and end dates
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return diffDays;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
