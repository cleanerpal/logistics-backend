import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { UserProfile } from '../interfaces/user-profile.interface';
import { AuthService } from '../services/auth.service';

export interface DriverSelectionDialogData {
  jobId: string;
  jobTitle?: string;
}

@Component({
  selector: 'app-driver-selection-dialog',
  template: `
    <div class="driver-selection-dialog">
      <div class="dialog-header allocation">
        <mat-icon>assignment_ind</mat-icon>
        <h2 mat-dialog-title>Select Driver</h2>
      </div>

      <mat-dialog-content class="dialog-content">
        <div *ngIf="loading" class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Loading drivers...</span>
        </div>

        <div *ngIf="!loading && drivers.length === 0" class="empty-state">
          <mat-icon>person_off</mat-icon>
          <p>No drivers available</p>
        </div>

        <ul class="driver-list" *ngIf="!loading && drivers.length > 0">
          <li
            *ngFor="let driver of drivers"
            class="driver-item"
            (click)="selectDriver(driver)"
          >
            <div class="driver-avatar">
              {{ getInitials(driver) }}
            </div>
            <div class="driver-info">
              <div class="driver-name">{{ driver.name }}</div>
              <div class="driver-details">{{ driver.role || 'Driver' }}</div>
            </div>
            <div class="driver-actions">
              <mat-icon>chevron_right</mat-icon>
            </div>
          </li>
        </ul>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button class="cancel-button" (click)="onCancel()">
          Cancel
        </button>
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

      .dialog-header.allocation {
        color: #0288d1;
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
        max-height: 350px;
        overflow-y: auto;
      }

      .dialog-actions {
        padding: 16px 24px 24px;
        margin: 0;
      }

      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 0;
        gap: 16px;
      }

      .loading-container span {
        color: rgba(0, 0, 0, 0.6);
        font-size: 14px;
      }

      .empty-state {
        text-align: center;
        padding: 32px 0;
      }

      .empty-state mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        color: #9e9e9e;
      }

      .empty-state p {
        color: #757575;
        margin: 0;
      }
    `,
  ],
  standalone: false,
})
export class DriverSelectionDialogComponent implements OnInit {
  drivers: UserProfile[] = [];
  loading = true;

  constructor(
    public dialogRef: MatDialogRef<DriverSelectionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DriverSelectionDialogData,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadDrivers();
  }

  private loadDrivers(): void {
    this.loading = true;
    this.authService.getUsersByRole('driver').subscribe({
      next: (drivers) => {
        this.drivers = drivers.filter((driver) => driver.isActive);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
        this.loading = false;
      },
    });
  }

  getInitials(driver: UserProfile): string {
    if (!driver.name) return '?';

    const nameParts = driver.name.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    }

    return (
      nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)
    ).toUpperCase();
  }

  selectDriver(driver: UserProfile): void {
    this.dialogRef.close(driver);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
