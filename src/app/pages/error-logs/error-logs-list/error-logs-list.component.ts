import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';

// Firebase imports
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  collectionData,
  doc,
  updateDoc,
  QueryConstraint,
} from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

// Error log interface
export interface ApiError {
  id: string;
  jobId?: string;
  timestamp: Timestamp;
  message: string;
  stackTrace?: string;
  status: number;
  endpoint?: string;
  method?: string;
  retryCount: number;
  resolved: boolean;
}

@Component({
  selector: 'app-error-logs-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatChipsModule,
    MatDividerModule,
    MatBadgeModule,
  ],
  templateUrl: './error-logs-list.component.html',
  styleUrls: ['./error-logs-list.component.scss'],
})
export class ErrorLogsListComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  // Data source and table configuration
  dataSource = new MatTableDataSource<ApiError>();
  displayedColumns: string[] = [
    'jobId',
    'status',
    'message',
    'timestamp',
    'retryCount',
    'actions',
  ];

  // ViewChild references
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Form for filtering
  filterForm: FormGroup;

  // Component state
  loading = true;
  totalErrors = 0;
  resolvedErrors = 0;
  openErrors = 0;

  // Subscriptions
  private errorSubscription?: Subscription;

  constructor(
    private firestore: Firestore,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    // Initialize filter form
    this.filterForm = this.formBuilder.group({
      jobId: [''],
      dateRange: this.formBuilder.group({
        start: [null],
        end: [null],
      }),
      showResolved: [false],
    });
  }

  ngOnInit(): void {
    this.loadErrorLogs();

    // Subscribe to form changes for filtering
    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  ngAfterViewInit(): void {
    // Set the paginator and sort after the view init
    setTimeout(() => {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
      this.dataSource.sortingDataAccessor = (item, property) => {
        switch (property) {
          case 'timestamp':
            return item.timestamp.toMillis();
          default:
            return (item as any)[property];
        }
      };
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe from Firestore subscription
    if (this.errorSubscription) {
      this.errorSubscription.unsubscribe();
    }
  }

  /**
   * Load error logs from Firestore with real-time updates
   */
  loadErrorLogs(): void {
    this.loading = true;

    try {
      // Create a query for the errors collection
      const errorsCollection = collection(this.firestore, 'ApiErrors');

      // Set up query constraints
      let queryConstraints: Array<QueryConstraint> = [];

      // Add the where constraint first if needed
      const showResolved = this.filterForm.get('showResolved')?.value;
      if (!showResolved) {
        queryConstraints.push(where('resolved', '==', false));
      }

      // Then add ordering and limit
      queryConstraints.push(orderBy('timestamp', 'desc'));
      queryConstraints.push(limit(500)); // Limit to 500 records initially

      const errorsQuery = query(errorsCollection, ...queryConstraints);

      // Subscribe to the collection with real-time updates
      this.errorSubscription = collectionData(errorsQuery, {
        idField: 'id',
      }).subscribe({
        next: (errors) => {
          this.dataSource.data = errors as ApiError[];
          this.loading = false;

          // Update error counts
          this.totalErrors = errors.length;
          this.resolvedErrors = errors.filter(
            (error) => (error as ApiError).resolved
          ).length;
          this.openErrors = this.totalErrors - this.resolvedErrors;

          // Apply any existing filters
          this.applyFilters();
        },
        error: (error) => {
          console.error('Error loading error logs:', error);
          this.snackBar.open(
            'Error loading error logs. Please try again.',
            'Close',
            {
              duration: 5000,
              panelClass: ['error-snackbar'],
            }
          );
          this.loading = false;
        },
      });
    } catch (error) {
      console.error('Error setting up error logs subscription:', error);
      this.loading = false;
    }
  }

  /**
   * Apply filters to the data source
   */
  applyFilters(): void {
    const jobId = this.filterForm.get('jobId')?.value?.trim().toLowerCase();
    const dateRange = this.filterForm.get('dateRange')?.value;

    this.dataSource.filterPredicate = (
      data: ApiError,
      filter: string
    ): boolean => {
      // Job ID filter
      const jobIdMatch =
        !jobId || (data.jobId && data.jobId.toLowerCase().includes(jobId));

      // Date range filter
      let dateMatch = true;
      if (dateRange.start && dateRange.end) {
        const errorDate = data.timestamp.toDate();
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59); // Include the entire end day

        dateMatch = errorDate >= startDate && errorDate <= endDate;
      }

      return Boolean(jobIdMatch) && dateMatch;
    };

    // Apply the filter
    this.dataSource.filter = 'custom-filter'; // Any non-empty string will trigger the filterPredicate

    // Reset to first page
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Reset all filters
   */
  resetFilters(): void {
    this.filterForm.patchValue({
      jobId: '',
      dateRange: {
        start: null,
        end: null,
      },
    });

    this.applyFilters();
  }

  /**
   * Toggle showing resolved errors
   */
  toggleShowResolved(): void {
    const currentValue = this.filterForm.get('showResolved')?.value;
    this.filterForm.get('showResolved')?.setValue(!currentValue);
    this.loadErrorLogs(); // Reload with new filter
  }

  /**
   * Mark an error as resolved
   */
  async markAsResolved(error: ApiError): Promise<void> {
    try {
      // Update the document in Firestore
      const errorRef = doc(this.firestore, 'ApiErrors', error.id);
      await updateDoc(errorRef, {
        resolved: true,
        resolvedAt: Timestamp.now(),
      });

      this.snackBar.open('Error marked as resolved.', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error marking as resolved:', error);
      this.snackBar.open('Error updating status. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Navigate to job details if jobId exists
   */
  viewJob(jobId: string | undefined): void {
    if (jobId) {
      this.router.navigate(['/jobs', jobId]);
    }
  }

  /**
   * Navigate to error details
   */
  viewErrorDetails(errorId: string): void {
    this.router.navigate(['/error-logs', errorId]);
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
  formatDate(timestamp: Timestamp): string {
    return timestamp.toDate().toLocaleString();
  }

  /**
   * Format message to limit length
   */
  formatMessage(message: string): string {
    return message.length > 80 ? message.substring(0, 80) + '...' : message;
  }
}
