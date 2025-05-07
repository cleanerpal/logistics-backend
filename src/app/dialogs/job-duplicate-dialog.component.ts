import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface JobDuplicateDialogData {
  jobId: string;
  registrationNumber?: string;
  makeModel?: string;
}

@Component({
  selector: 'app-job-duplicate-dialog',
  template: `
    <div class="duplicate-dialog">
      <div class="dialog-header duplication">
        <mat-icon>content_copy</mat-icon>
        <h2 mat-dialog-title>Duplicate Job</h2>
      </div>

      <mat-dialog-content class="dialog-content">
        <p>
          You are about to duplicate job
          <strong>{{ data.jobId }}</strong>
          {{ data.makeModel ? ' for ' + data.makeModel : '' }}
          {{ data.registrationNumber ? ' (' + data.registrationNumber + ')' : '' }}.
        </p>
        <p>This will create a new job with all the same details but with a new ID and unallocated status. Do you want to continue?</p>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button class="cancel-button" (click)="onCancel()">Cancel</button>
        <button mat-flat-button color="primary" class="confirm-button" (click)="onConfirm()">Duplicate Job</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 24px 0;
        margin-bottom: 8px;
      }

      .dialog-header.duplication {
        color: #3f51b5;
      }

      .dialog-header mat-icon {
        font-size: 28px;
        height: 28px;
        width: 28px;
      }

      .dialog-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 500;
      }

      .dialog-content {
        padding: 0 24px;
        margin: 0;
        color: rgba(0, 0, 0, 0.7);
        font-size: 16px;
        line-height: 1.5;
      }

      .dialog-actions {
        padding: 16px 24px 24px;
        margin: 0;
        gap: 8px;
      }

      .cancel-button {
        font-weight: 400;
      }

      .confirm-button {
        font-weight: 500;
      }
    `,
  ],
  standalone: false,
})
export class JobDuplicateDialogComponent {
  constructor(public dialogRef: MatDialogRef<JobDuplicateDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: JobDuplicateDialogData) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
