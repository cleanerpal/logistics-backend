import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LeaveType } from '../../../interfaces/leave-request.interface';
import { LeaveRequestService } from '../../../services/leave-request.service';
import { NotificationService } from '../../../services/notification.service';
import { finalize } from 'rxjs/operators';

export interface LeaveRequestCreateDialogData {
  driverId: string;
  driverName: string;
}

@Component({
  selector: 'app-leave-request-create-dialog',
  templateUrl: './leave-request-create-dialog.component.html',
  styleUrls: ['./leave-request-create-dialog.component.scss'],
  standalone: false,
})
export class LeaveRequestCreateDialogComponent implements OnInit {
  leaveForm: FormGroup;
  isSubmitting = false;
  minEndDate: Date | null = null;
  today = new Date();

  leaveTypes = Object.values(LeaveType);

  constructor(
    public dialogRef: MatDialogRef<LeaveRequestCreateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LeaveRequestCreateDialogData,
    private fb: FormBuilder,
    private leaveRequestService: LeaveRequestService,
    private notificationService: NotificationService
  ) {
    this.leaveForm = this.fb.group({
      type: [LeaveType.HOLIDAY, Validators.required],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
      notes: [''],
    });
  }

  ngOnInit(): void {
    // Listen for start date changes to update end date min value
    this.leaveForm.get('startDate')?.valueChanges.subscribe((date) => {
      this.minEndDate = date;

      // If end date is now less than start date, reset it
      const endDate = this.leaveForm.get('endDate')?.value;
      if (endDate && new Date(endDate) < new Date(date)) {
        this.leaveForm.get('endDate')?.setValue(date);
      }
    });
  }

  onCancelClick(): void {
    this.dialogRef.close();
  }

  onSubmitClick(): void {
    if (this.leaveForm.invalid) {
      this.markFormGroupTouched(this.leaveForm);
      return;
    }

    this.isSubmitting = true;

    const formValues = this.leaveForm.value;

    // Prepare leave request data
    const leaveRequestData = {
      driverId: this.data.driverId,
      driverName: this.data.driverName,
      type: formValues.type,
      startDate: formValues.startDate,
      endDate: formValues.endDate,
      notes: formValues.notes,
    };

    this.leaveRequestService
      .createLeaveRequest(leaveRequestData)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (requestId) => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Leave Request Submitted',
            message: 'Your leave request has been submitted successfully',
          });
          this.dialogRef.close(true);
        },
        error: (error) => {
          console.error('Error creating leave request:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to submit leave request',
          });
        },
      });
  }

  /**
   * Mark all form controls as touched to show validation errors
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
