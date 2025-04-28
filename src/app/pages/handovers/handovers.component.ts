import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule, MatTable } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { FirebaseService } from '../../services/firebase.service';
import { AuditLogsService } from '../../services/audit-logs.service';
import { HandoverDialogComponent } from './handover-dialog/handover-dialog.component';

import {
  Firestore,
  collection,
  query,
  orderBy,
  where,
  Timestamp,
} from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

export interface DriverHandover {
  id: string;
  jobId: string;
  vehicleId: string;
  fromDriver: string;
  fromDriverId: string;
  toDriver: string;
  toDriverId: string;
  timestamp: any;
  location: string;
  odometer: number;
  notes: string;
  reason: string;
  fromSignature?: string;
  toSignature?: string;
}

@Component({
  selector: 'app-handovers',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCardModule,
    MatTooltipModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinner,
  ],
  templateUrl: './handovers.component.html',
  styleUrls: ['./handovers.component.scss'],
})
export class HandoversComponent implements OnInit, AfterViewInit, OnDestroy {
  // MatTable configuration
  displayedColumns: string[] = [
    'jobId',
    'vehicleId',
    'fromDriver',
    'toDriver',
    'timestamp',
    'location',
    'odometer',
    'notes',
    'actions',
  ];
  dataSource: DriverHandover[] = [];
  filteredDataSource: DriverHandover[] = [];

  // Search and filter form
  filterForm = new FormGroup({
    searchQuery: new FormControl(''),
    dateRange: new FormGroup({
      start: new FormControl<Date | null>(null),
      end: new FormControl<Date | null>(null),
    }),
  });

  // Subscriptions
  private handoversSubscription: Subscription | null = null;

  // ViewChild references
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Loading state
  loading = true;

  constructor(
    private firestore: Firestore,
    private firebaseService: FirebaseService,
    private auditLogsService: AuditLogsService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadHandovers();

    // Subscribe to filter changes
    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  ngAfterViewInit(): void {
    // Set up paginator and sorting after view is initialized
    if (this.paginator && this.sort) {
      setTimeout(() => {
        this.applyFilters();
      });
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.handoversSubscription) {
      this.handoversSubscription.unsubscribe();
    }
  }

  loadHandovers(): void {
    this.loading = true;

    const handoversCollection = collection(this.firestore, 'driverHandovers');
    const handoversQuery = query(
      handoversCollection,
      orderBy('timestamp', 'desc')
    );

    this.handoversSubscription = this.firebaseService
      .getCollectionWithSnapshot<DriverHandover>('driverHandovers', [
        orderBy('timestamp', 'desc'),
      ])
      .subscribe(
        (handovers) => {
          this.dataSource = handovers.map((handover) => ({
            ...handover,
            timestamp:
              handover.timestamp instanceof Timestamp
                ? handover.timestamp.toDate()
                : handover.timestamp,
          }));
          this.applyFilters();
          this.loading = false;
        },
        (error) => {
          console.error('Error loading handovers:', error);
          this.snackBar.open('Error loading handovers', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading = false;
        }
      );
  }

  applyFilters(): void {
    const searchQuery =
      this.filterForm.get('searchQuery')?.value?.toLowerCase() || '';
    const startDate = this.filterForm.get('dateRange.start')?.value;
    const endDate = this.filterForm.get('dateRange.end')?.value;

    // Apply search and date range filters
    this.filteredDataSource = this.dataSource.filter((handover) => {
      // Search query filter
      const matchesSearch =
        searchQuery === '' ||
        handover.jobId.toLowerCase().includes(searchQuery) ||
        handover.fromDriver.toLowerCase().includes(searchQuery) ||
        handover.toDriver.toLowerCase().includes(searchQuery) ||
        handover.vehicleId.toLowerCase().includes(searchQuery);

      // Date range filter
      const handoverDate =
        handover.timestamp instanceof Date
          ? handover.timestamp
          : new Date(handover.timestamp);

      let withinDateRange = true;
      if (startDate && endDate) {
        // Set end date to end of the day
        const adjustedEndDate = new Date(endDate);
        adjustedEndDate.setHours(23, 59, 59, 999);

        withinDateRange =
          handoverDate >= startDate && handoverDate <= adjustedEndDate;
      }

      return matchesSearch && withinDateRange;
    });
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.applyFilters();
  }

  async openHandoverDialog(): Promise<void> {
    const dialogRef = this.dialog.open(HandoverDialogComponent, {
      width: '650px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        // Log the handover creation in audit logs
        this.auditLogsService
          .createAuditLog({
            action: 'create',
            resource: 'driverHandover',
            resourceId: result.id,
            details: `Handover initiated from ${result.fromDriver} to ${result.toDriver} for job ${result.jobId}`,
            userId:
              (await this.firebaseService.user$.toPromise())?.uid || 'unknown',
            userName:
              (await this.firebaseService.user$.toPromise())?.displayName ||
              'Unknown User',
          })
          .catch((error) => {
            console.error('Error creating audit log:', error);
          });

        // Show success message
        this.snackBar.open('Handover successfully initiated', 'Close', {
          duration: 5000,
        });
      }
    });
  }

  navigateToJob(jobId: string): void {
    this.router.navigate(['/jobs/edit', jobId]);
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'N/A';

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    return date.toLocaleString();
  }
}
