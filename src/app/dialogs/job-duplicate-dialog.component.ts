// src/app/dialogs/job-duplicate-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface JobDuplicateDialogData {
  jobId: string;
  jobTitle?: string;
}

@Component({
  selector: 'app-job-duplicate-dialog',
  template: `
    <div class="job-duplicate-dialog">
      <div class="dialog-header duplicate">
        <mat-icon>content_copy</mat-icon>
        <h2 mat-dialog-title>Duplicate Job</h2>
      </div>

      <mat-dialog-content class="dialog-content">
        <p>Are you sure you want to duplicate this job?</p>
        <p class="job-info" *ngIf="data.jobTitle"><strong>Job:</strong> {{ data.jobTitle }}</p>
        <p class="warning-text">
          <mat-icon>info</mat-icon>
          This will create a new job with the same details but with 'unallocated' status.
        </p>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button class="cancel-button" (click)="onCancel()">Cancel</button>
        <button mat-flat-button color="primary" class="confirm-button" (click)="onConfirm()">
          <mat-icon>content_copy</mat-icon>
          Duplicate Job
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .job-duplicate-dialog {
        .dialog-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px 0;
          margin-bottom: 8px;

          &.duplicate {
            color: #1976d2;
          }

          mat-icon {
            font-size: 28px;
            height: 28px;
            width: 28px;
          }

          h2 {
            margin: 0;
            font-size: 20px;
            font-weight: 500;
          }
        }

        .dialog-content {
          padding: 0 24px;
          margin: 0;
          min-width: 350px;

          p {
            margin: 12px 0;
            color: rgba(0, 0, 0, 0.87);
          }

          .job-info {
            background-color: #f5f5f5;
            padding: 12px;
            border-radius: 4px;
            border-left: 4px solid #1976d2;
          }

          .warning-text {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            color: rgba(0, 0, 0, 0.6);
            font-size: 14px;

            mat-icon {
              font-size: 18px;
              height: 18px;
              width: 18px;
              color: #ff9800;
            }
          }
        }

        .dialog-actions {
          padding: 16px 24px 24px;
          margin: 0;
          gap: 8px;

          .cancel-button {
            color: rgba(0, 0, 0, 0.6);
          }

          .confirm-button {
            mat-icon {
              font-size: 18px;
              height: 18px;
              width: 18px;
              margin-right: 8px;
            }
          }
        }
      }
    `,
  ],
  standalone: false,
})
export class JobDuplicateDialogComponent {
  constructor(public dialogRef: MatDialogRef<JobDuplicateDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: JobDuplicateDialogData) {}

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
