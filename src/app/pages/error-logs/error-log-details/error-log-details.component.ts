import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

// Firebase imports
import {
  Firestore,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
} from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

// Interface for API Error
export interface ApiError {
  id: string;
  jobId?: string;
  timestamp: Timestamp;
  message: string;
  stackTrace?: string;
  endpoint?: string;
  method?: string;
  status: number;
  retryCount: number;
  resolved: boolean;
  resolvedAt?: Timestamp;
  requestBody?: string;
  responseBody?: string;
  headers?: Record<string, string>;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
}

@Component({
  selector: 'app-error-log-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  templateUrl: './error-log-details.component.html',
  styleUrls: ['./error-log-details.component.scss'],
})
export class ErrorLogDetailsComponent implements OnInit, OnDestroy {
  errorId: string = '';
  error?: ApiError;
  loading = true;
  resolvingError = false;

  private routeSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private firestore: Firestore,
    private router: Router,
    private snackBar: MatSnackBar,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.errorId = id;
        this.loadErrorDetails();
      } else {
        this.router.navigate(['/error-logs']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  /**
   * Load error details from Firestore
   */
  async loadErrorDetails(): Promise<void> {
    this.loading = true;

    try {
      const errorRef = doc(this.firestore, 'ApiErrors', this.errorId);
      const errorSnap = await getDoc(errorRef);

      if (errorSnap.exists()) {
        this.error = {
          id: errorSnap.id,
          ...errorSnap.data(),
        } as ApiError;
        this.loading = false;
      } else {
        this.snackBar.open('Error log not found.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.router.navigate(['/error-logs']);
      }
    } catch (error) {
      console.error('Error loading error details:', error);
      this.snackBar.open('Error loading details. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      this.loading = false;
    }
  }

  /**
   * Mark error as resolved
   */
  async markAsResolved(): Promise<void> {
    if (!this.error || this.error.resolved) return;

    this.resolvingError = true;

    try {
      const errorRef = doc(this.firestore, 'ApiErrors', this.errorId);
      await updateDoc(errorRef, {
        resolved: true,
        resolvedAt: Timestamp.now(),
      });

      // Update local state
      this.error = {
        ...this.error,
        resolved: true,
        resolvedAt: Timestamp.now(),
      };

      this.snackBar.open('Error marked as resolved.', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error marking as resolved:', error);
      this.snackBar.open('Error updating status. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.resolvingError = false;
    }
  }

  /**
   * Navigate to job details if jobId exists
   */
  viewJob(): void {
    if (this.error?.jobId) {
      this.router.navigate(['/jobs', this.error.jobId]);
    }
  }

  /**
   * Go back to error logs list
   */
  goBack(): void {
    this.location.back();
  }

  /**
   * Get status text based on status code
   */
  getStatusText(status: number): string {
    if (status >= 500) return 'Server Error';
    if (status >= 400) return 'Client Error';
    if (status >= 300) return 'Redirect';
    if (status >= 200) return 'Success';
    if (status >= 100) return 'Informational';
    return 'Unknown';
  }

  /**
   * Get status color based on status code
   */
  getStatusColor(status: number): string {
    if (status >= 500) return 'error-color';
    if (status >= 400) return 'warning-color';
    if (status >= 300) return 'info-color';
    if (status >= 200) return 'success-color';
    return '';
  }

  /**
   * Format date from Timestamp
   */
  formatDate(timestamp?: Timestamp): string {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleString();
  }

  /**
   * Copy text to clipboard
   */
  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.snackBar.open('Copied to clipboard', 'Close', {
        duration: 2000,
      });
    });
  }

  /**
   * Format JSON for display
   */
  formatJson(data: any): string {
    return JSON.stringify(data, null, 2);
  }
}
