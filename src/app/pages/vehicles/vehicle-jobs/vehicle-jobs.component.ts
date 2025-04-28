import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Firestore,
  Timestamp,
  collection,
  query,
  where,
  collectionData,
  doc,
  getDoc,
} from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

interface Job {
  id: string;
  vehicleRegistration: string;
  vehicleMake: string;
  vehicleModel: string;
  status: string;
  deliveryDate: Timestamp;
}

interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  type: string;
}

@Component({
  selector: 'app-vehicle-jobs',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterModule,
  ],
  templateUrl: './vehicle-jobs.component.html',
  styleUrls: ['./vehicle-jobs.component.scss'],
})
export class VehicleJobsComponent implements OnInit, OnDestroy {
  vehicleId: string | null = null;
  vehicleData: Vehicle | null = null;
  loading = true;
  dataSource = new MatTableDataSource<Job>();
  displayedColumns: string[] = [
    'id',
    'vehicle',
    'status',
    'deliveryDate',
    'actions',
  ];
  private subscription?: Subscription;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.vehicleId = params.get('id');
      if (this.vehicleId) {
        this.loadVehicleData();
        this.loadVehicleJobs();
      } else {
        this.snackBar.open('Vehicle ID not provided', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/vehicles']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Load vehicle data
   */
  async loadVehicleData(): Promise<void> {
    if (!this.vehicleId) return;

    try {
      const vehicleRef = doc(this.firestore, 'Vehicles', this.vehicleId);
      const vehicleSnap = await getDoc(vehicleRef);

      if (vehicleSnap.exists()) {
        const data = vehicleSnap.data();
        this.vehicleData = {
          id: vehicleSnap.id,
          registration: data['registration'] || 'Unknown',
          make: data['make'] || 'Unknown',
          model: data['model'] || 'Unknown',
          type: data['type'] || 'Unknown',
        };
      } else {
        this.snackBar.open('Vehicle not found', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/vehicles']);
      }
    } catch (error) {
      console.error('Error loading vehicle data:', error);
      this.snackBar.open('Error loading vehicle information', 'Close', {
        duration: 3000,
      });
    }
  }

  /**
   * Load jobs associated with this vehicle
   */
  loadVehicleJobs(): void {
    if (!this.vehicleId) return;

    try {
      const jobsCollection = collection(this.firestore, 'Jobs');
      const jobsQuery = query(
        jobsCollection,
        where('vehicleId', '==', this.vehicleId)
      );

      this.subscription = collectionData(jobsQuery, {
        idField: 'id',
      }).subscribe({
        next: (jobs) => {
          this.dataSource.data = jobs as Job[];
          this.loading = false;

          // Set the paginator and sort after data is loaded
          setTimeout(() => {
            this.dataSource.paginator = this.paginator;
            this.dataSource.sort = this.sort;
          });
        },
        error: (error) => {
          console.error('Error loading vehicle jobs:', error);
          this.snackBar.open('Error loading jobs. Please try again.', 'Close', {
            duration: 5000,
          });
          this.loading = false;
        },
      });
    } catch (error) {
      console.error('Error setting up jobs subscription:', error);
      this.snackBar.open(
        'Error setting up subscription. Please try again.',
        'Close',
        {
          duration: 5000,
        }
      );
      this.loading = false;
    }
  }

  /**
   * Navigate to job edit page
   */
  editJob(jobId: string): void {
    this.router.navigate(['/jobs/edit', jobId]);
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: Timestamp): string {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
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

  /**
   * Go back to vehicles list
   */
  goBack(): void {
    this.router.navigate(['/vehicles']);
  }
}
