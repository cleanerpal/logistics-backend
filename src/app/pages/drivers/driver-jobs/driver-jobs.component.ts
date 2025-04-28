import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  collectionData,
  Timestamp,
  documentId,
  getDocs,
} from '@angular/fire/firestore';

// Models
interface Job {
  id: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  status: string;
  driverId: string;
  collectionDate: Timestamp;
  deliveryDate: Timestamp;
  completedAt?: Timestamp;
}

@Component({
  selector: 'app-driver-jobs',
  templateUrl: './driver-jobs.component.html',
  styleUrls: ['./driver-jobs.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
})
export class DriverJobsComponent implements OnInit, OnDestroy {
  driverId: string | null = null;
  driverName: string = '';
  jobs: Job[] = [];
  dataSource = new MatTableDataSource<Job>([]);
  displayedColumns: string[] = [
    'id',
    'vehicle',
    'status',
    'deliveryDate',
    'actions',
  ];

  loading = true;
  private subscription?: Subscription;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.driverId = params.get('id');

      if (this.driverId) {
        this.loadDriverDetails(this.driverId);
        this.loadDriverJobs(this.driverId);
      } else {
        this.router.navigate(['/drivers']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Load driver details
   */
  private async loadDriverDetails(driverId: string): Promise<void> {
    try {
      const driverRef = doc(this.firestore, 'Users', driverId);
      const driverSnap = await getDoc(driverRef);

      if (driverSnap.exists()) {
        this.driverName = driverSnap.data()['displayName'] || 'Unknown Driver';
      } else {
        this.snackBar.open('Driver not found.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.router.navigate(['/drivers']);
      }
    } catch (error) {
      console.error('Error loading driver details:', error);
      this.snackBar.open('Error loading driver details.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Load jobs for the driver
   */
  private async loadDriverJobs(driverId: string): Promise<void> {
    this.loading = true;

    try {
      // Create a query for jobs where driver ID matches
      // First get the DriverTimeline collection to get the list of job IDs
      const timelineRef = collection(this.firestore, 'DriverTimeline');
      const timelineQuery = query(
        timelineRef,
        where('driverId', '==', driverId)
      );

      const timelineSnapshot = await getDocs(timelineQuery);

      // Extract job IDs
      const jobIds = timelineSnapshot.docs.map((doc) => doc.data()['jobId']);

      if (jobIds.length === 0) {
        this.jobs = [];
        this.dataSource.data = [];
        this.loading = false;
        return;
      }

      // Query jobs using the collected job IDs
      const jobsRef = collection(this.firestore, 'Jobs');
      const jobsQuery = query(
        jobsRef,
        where(documentId(), 'in', jobIds),
        orderBy('deliveryDate', 'desc')
      );

      this.subscription = collectionData(jobsQuery, {
        idField: 'id',
      }).subscribe({
        next: (data: any[]) => {
          this.jobs = data as Job[];
          this.dataSource.data = this.jobs;

          // Set the paginator and sort after data is loaded
          setTimeout(() => {
            if (this.paginator && this.sort) {
              this.dataSource.paginator = this.paginator;
              this.dataSource.sort = this.sort;
            }
          });

          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading driver jobs:', error);
          this.snackBar.open('Error loading driver jobs.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.loading = false;
        },
      });
    } catch (error) {
      console.error('Error setting up driver jobs subscription:', error);
      this.snackBar.open('Error loading jobs.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      this.loading = false;
    }
  }

  /**
   * Navigate to job details
   */
  viewJobDetails(jobId: string): void {
    this.router.navigate(['/jobs/edit', jobId]);
  }

  /**
   * Go back to the drivers list
   */
  goBack(): void {
    this.router.navigate(['/drivers']);
  }

  /**
   * Format date from Timestamp
   */
  formatDate(timestamp?: Timestamp): string {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get status color based on job status
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'Unallocated':
        return '#F44336'; // Red
      case 'Allocated':
        return '#FFC107'; // Amber
      case 'Collected':
        return '#2196F3'; // Blue
      case 'Delivered':
        return '#4CAF50'; // Green
      case 'Cancelled':
        return '#9E9E9E'; // Grey
      default:
        return '#9E9E9E'; // Grey
    }
  }
}
