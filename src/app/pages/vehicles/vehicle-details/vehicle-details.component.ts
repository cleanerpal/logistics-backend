import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import {
  Firestore,
  doc,
  getDoc,
  collectionData,
  query,
  collection,
  where,
  limit,
  Timestamp,
} from '@angular/fire/firestore';

interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  type: string;
  year: number;
  location: string;
  status: 'Available' | 'In Use' | 'Maintenance' | 'Out of Service';
  lastServiceDate?: Timestamp;
  nextServiceDue?: Timestamp;
  currentDriverId?: string;
  currentDriverName?: string;
  createdAt?: Timestamp;
  updatedAt: Timestamp;
}

interface Job {
  id: string;
  customerReference: string;
  status: string;
  collectionDate: Timestamp;
  deliveryDate: Timestamp;
}

@Component({
  selector: 'app-vehicle-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './vehicle-details.component.html',
  styleUrls: ['./vehicle-details.component.scss'],
})
export class VehicleDetailsComponent implements OnInit, OnDestroy {
  vehicleId: string | null = null;
  vehicle: Vehicle | null = null;
  recentJobs: Job[] = [];
  loading = true;
  private jobsSubscription?: Subscription;

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
      } else {
        this.snackBar.open('Vehicle ID not provided', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/vehicles']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.jobsSubscription) {
      this.jobsSubscription.unsubscribe();
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
        this.vehicle = {
          id: vehicleSnap.id,
          registration: data['registration'] || '',
          make: data['make'] || '',
          model: data['model'] || '',
          type: data['type'] || '',
          year: data['year'] || 0,
          location: data['location'] || '',
          status: data['status'] || 'Available',
          lastServiceDate: data['lastServiceDate'],
          nextServiceDue: data['nextServiceDue'],
          currentDriverId: data['currentDriverId'],
          currentDriverName: data['currentDriverName'],
          createdAt: data['createdAt'],
          updatedAt: data['updatedAt'],
        };

        // Load recent jobs after vehicle data is loaded
        this.loadRecentJobs();
      } else {
        this.snackBar.open('Vehicle not found', 'Close', { duration: 3000 });
        this.router.navigate(['/vehicles']);
      }
    } catch (error) {
      console.error('Error loading vehicle:', error);
      this.snackBar.open('Error loading vehicle details', 'Close', {
        duration: 3000,
      });
      this.loading = false;
    }
  }

  /**
   * Load recent jobs for this vehicle
   */
  loadRecentJobs(): void {
    if (!this.vehicleId) return;

    try {
      const jobsCollection = collection(this.firestore, 'Jobs');
      const jobsQuery = query(
        jobsCollection,
        where('vehicleId', '==', this.vehicleId),
        limit(5)
      );

      this.jobsSubscription = collectionData(jobsQuery, {
        idField: 'id',
      }).subscribe({
        next: (jobs) => {
          this.recentJobs = jobs as Job[];
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading recent jobs:', error);
          this.loading = false;
        },
      });
    } catch (error) {
      console.error('Error setting up jobs subscription:', error);
      this.loading = false;
    }
  }

  /**
   * Navigate to edit vehicle page
   */
  editVehicle(): void {
    if (this.vehicleId) {
      this.router.navigate(['/vehicles/edit', this.vehicleId]);
    }
  }

  /**
   * Navigate to vehicle jobs list
   */
  viewAllJobs(): void {
    if (this.vehicleId) {
      this.router.navigate(['/vehicles', this.vehicleId, 'jobs']);
    }
  }

  /**
   * Go back to vehicles list
   */
  goBack(): void {
    this.router.navigate(['/vehicles']);
  }

  /**
   * Format date for display
   */
  formatDate(timestamp?: Timestamp): string {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Get status color class
   */
  getStatusColorClass(status: string): string {
    switch (status) {
      case 'Available':
        return 'status-available';
      case 'In Use':
        return 'status-in-use';
      case 'Maintenance':
        return 'status-maintenance';
      case 'Out of Service':
        return 'status-out-of-service';
      default:
        return '';
    }
  }

  /**
   * Check if service is due soon (within 30 days)
   */
  isServiceDueSoon(): boolean {
    if (!this.vehicle?.nextServiceDue) return false;

    const now = new Date();
    const serviceDueDate = this.vehicle.nextServiceDue.toDate();
    const diffTime = serviceDueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays <= 30 && diffDays > 0;
  }

  /**
   * Get job status color class
   */
  getJobStatusColorClass(status: string): string {
    switch (status) {
      case 'Unallocated':
        return 'job-status-unallocated';
      case 'Allocated':
        return 'job-status-allocated';
      case 'Collected':
        return 'job-status-collected';
      case 'Delivered':
        return 'job-status-delivered';
      case 'Cancelled':
        return 'job-status-cancelled';
      default:
        return '';
    }
  }
}
