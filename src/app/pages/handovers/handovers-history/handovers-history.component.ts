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
import { MatNativeDateModule, MatOption } from '@angular/material/core';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { FirebaseService } from '../../../services/firebase.service';
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
}

@Component({
  selector: 'app-handovers-history',
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
    MatSnackBarModule,
    MatOption,
    MatProgressSpinner,
  ],
  templateUrl: './handovers-history.component.html',
  styleUrls: ['./handovers-history.component.scss'],
})
export class HandoversHistoryComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  // MatTable configuration
  displayedColumns: string[] = [
    'timestamp',
    'jobId',
    'vehicleId',
    'fromDriver',
    'toDriver',
    'location',
    'odometer',
    'reason',
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
    driverFilter: new FormControl(''),
    vehicleFilter: new FormControl(''),
  });

  // Subscriptions
  private handoversSubscription: Subscription | null = null;

  // ViewChild references
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Loading state
  loading = true;

  // Aggregated data
  uniqueDrivers: string[] = [];
  uniqueVehicles: string[] = [];

  constructor(
    private firestore: Firestore,
    private firebaseService: FirebaseService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Set default date range to last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    this.filterForm.get('dateRange')?.patchValue({
      start: thirtyDaysAgo,
      end: today,
    });

    this.loadHandoversHistory();

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

  loadHandoversHistory(): void {
    this.loading = true;

    const startDate = this.filterForm.get('dateRange.start')?.value;
    const endDate = this.filterForm.get('dateRange.end')?.value;

    let constraints: any[] = [orderBy('timestamp', 'desc')];

    if (startDate && endDate) {
      // Adjust end date to end of day
      const endDateAdjusted = new Date(endDate);
      endDateAdjusted.setHours(23, 59, 59, 999);

      constraints.push(
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDateAdjusted))
      );
    }

    this.handoversSubscription = this.firebaseService
      .getCollectionWithSnapshot<DriverHandover>('driverHandovers', constraints)
      .subscribe(
        (handovers) => {
          this.dataSource = handovers.map((handover) => ({
            ...handover,
            timestamp:
              handover.timestamp instanceof Timestamp
                ? handover.timestamp.toDate()
                : handover.timestamp,
          }));

          // Extract unique drivers and vehicles for filters
          this.extractFilterOptions();

          this.applyFilters();
          this.loading = false;
        },
        (error) => {
          console.error('Error loading handovers history:', error);
          this.snackBar.open('Error loading handovers history', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading = false;
        }
      );
  }

  extractFilterOptions(): void {
    // Extract unique drivers and vehicles
    const drivers = new Set<string>();
    const vehicles = new Set<string>();

    this.dataSource.forEach((handover) => {
      drivers.add(handover.fromDriver);
      drivers.add(handover.toDriver);
      vehicles.add(handover.vehicleId);
    });

    this.uniqueDrivers = Array.from(drivers).sort();
    this.uniqueVehicles = Array.from(vehicles).sort();
  }

  applyFilters(): void {
    const searchQuery =
      this.filterForm.get('searchQuery')?.value?.toLowerCase() || '';
    const driverFilter = this.filterForm.get('driverFilter')?.value || '';
    const vehicleFilter = this.filterForm.get('vehicleFilter')?.value || '';

    // Apply search and filters
    this.filteredDataSource = this.dataSource.filter((handover) => {
      // Search query filter
      const matchesSearch =
        searchQuery === '' ||
        handover.jobId.toLowerCase().includes(searchQuery) ||
        handover.fromDriver.toLowerCase().includes(searchQuery) ||
        handover.toDriver.toLowerCase().includes(searchQuery) ||
        handover.vehicleId.toLowerCase().includes(searchQuery) ||
        handover.location.toLowerCase().includes(searchQuery) ||
        handover.reason?.toLowerCase().includes(searchQuery);

      // Driver filter
      const matchesDriver =
        driverFilter === '' ||
        handover.fromDriver === driverFilter ||
        handover.toDriver === driverFilter;

      // Vehicle filter
      const matchesVehicle =
        vehicleFilter === '' || handover.vehicleId === vehicleFilter;

      return matchesSearch && matchesDriver && matchesVehicle;
    });
  }

  clearFilters(): void {
    // Preserve date range but clear other filters
    const dateRange = this.filterForm.get('dateRange')?.value;

    this.filterForm.reset({
      dateRange: dateRange,
    });

    this.applyFilters();
  }

  refreshData(): void {
    this.loadHandoversHistory();
  }

  viewHandoverDetails(handoverId: string): void {
    this.router.navigate(['/handovers', handoverId]);
  }

  viewJobDetails(jobId: string): void {
    this.router.navigate(['/jobs/edit', jobId]);
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'N/A';

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    return date.toLocaleString();
  }

  // Export handovers as CSV
  exportToCsv(): void {
    if (this.filteredDataSource.length === 0) {
      this.snackBar.open('No data to export', 'Close', { duration: 3000 });
      return;
    }

    // Prepare CSV header and data
    const headers = [
      'Date',
      'Job ID',
      'Vehicle',
      'From Driver',
      'To Driver',
      'Location',
      'Odometer',
      'Reason',
      'Notes',
    ];

    const csvData = this.filteredDataSource.map((handover) => {
      const date =
        handover.timestamp instanceof Date
          ? handover.timestamp
          : new Date(handover.timestamp);

      return [
        date.toLocaleString(),
        handover.jobId,
        handover.vehicleId,
        handover.fromDriver,
        handover.toDriver,
        handover.location,
        handover.odometer,
        handover.reason || 'N/A',
        handover.notes || 'N/A',
      ];
    });

    // Create CSV content
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += headers.join(',') + '\n';

    csvContent += csvData
      .map((row) =>
        row
          .map((cell) => {
            // Handle strings with commas by wrapping in quotes
            if (typeof cell === 'string' && cell.includes(',')) {
              return `"${cell}"`;
            }
            return cell;
          })
          .join(',')
      )
      .join('\n');

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `handovers-history-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.snackBar.open('Export completed', 'Close', { duration: 3000 });
  }
}
