import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  icon?: string; // Optional icon name for the dialog
  confirmColor?: 'primary' | 'accent' | 'warn' | ''; // Optional color for the confirm button
}

@Component({
  selector: 'app-confirmation-dialog',
  template: `
    <div class="confirmation-dialog">
      <div class="dialog-header" [ngClass]="getHeaderClass()">
        <mat-icon *ngIf="data.icon">{{ data.icon }}</mat-icon>
        <h2 mat-dialog-title>{{ data.title }}</h2>
      </div>

      <mat-dialog-content class="dialog-content">
        {{ data.message }}
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button class="cancel-button" (click)="onCancel()">
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button
          mat-flat-button
          [color]="data.confirmColor || 'primary'"
          class="confirm-button"
          (click)="onConfirm()"
        >
          {{ data.confirmText || 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .confirmation-dialog {
        min-width: 320px;
      }

      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 24px 0;
        margin-bottom: 8px;
      }

      .dialog-header.collection {
        color: #ff9800;
      }

      .dialog-header.delivery {
        color: #4caf50;
      }

      .dialog-header.warning {
        color: #f44336;
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
        max-width: 500px;
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

      @media (max-width: 599px) {
        .dialog-actions {
          flex-direction: column-reverse;
        }

        .dialog-actions button {
          width: 100%;
        }
      }
    `,
  ],
  standalone: false,
})
export class ConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmationDialogData
  ) {}

  getHeaderClass(): string {
    if (this.data.title.toLowerCase().includes('collection')) {
      return 'collection';
    } else if (this.data.title.toLowerCase().includes('delivery')) {
      return 'delivery';
    } else if (this.data.confirmColor === 'warn') {
      return 'warning';
    }
    return '';
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
