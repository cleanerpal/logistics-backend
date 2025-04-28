import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Firebase imports
import {
  Firestore,
  collection,
  query,
  where,
  collectionData,
  Timestamp,
  orderBy,
  limit,
} from '@angular/fire/firestore';

// Models
export interface Driver {
  id: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  team: string;
  role: string;
  currentJobId?: string;
  currentJobVehicle?: string;
  lastActive?: Timestamp;
  createdAt: Timestamp;
}

@Component({
  selector: 'app-drivers',
  templateUrl: './drivers.component.html',
  styleUrls: ['./drivers.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
})
export class DriversComponent implements OnInit, OnDestroy {
  drivers: Driver[] = [];
  dataSource = new MatTableDataSource<Driver>([]);
  displayedColumns: string[] = [
    'id',
    'displayName',
    'email',
    'team',
    'currentJob',
    'lastActive',
    'actions',
  ];

  searchControl = new FormControl('');
  loading = true;

  private subscription?: Subscription;
  private searchSubscription?: Subscription;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDrivers();
    this.initSearchSubscription();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  private loadDrivers(): void {
    this.loading = true;

    // Create a query for drivers (users with role 'Driver')
    const usersCollection = collection(this.firestore, 'Users');
    const driversQuery = query(
      usersCollection,
      where('role', '==', 'Driver'),
      orderBy('displayName'),
      limit(50)
    );

    // Subscribe to the query with real-time updates
    this.subscription = collectionData(driversQuery, {
      idField: 'id',
    }).subscribe({
      next: (data: any[]) => {
        this.drivers = data as Driver[];
        this.dataSource.data = this.drivers;

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
        console.error('Error loading drivers:', error);
        this.snackBar.open(
          'Error loading drivers. Please try again.',
          'Close',
          {
            duration: 5000,
            panelClass: ['error-snackbar'],
          }
        );
        this.loading = false;
      },
    });
  }

  private initSearchSubscription(): void {
    this.searchSubscription = this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => {
        this.applyFilter(value || '');
      });
  }

  applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  navigateToCreate(): void {
    this.router.navigate(['/drivers/create']);
  }

  editDriver(driverId: string): void {
    this.router.navigate(['/drivers/edit', driverId]);
  }

  viewDriverJobs(driverId: string): void {
    this.router.navigate(['/drivers', driverId, 'jobs']);
  }

  formatDate(timestamp?: Timestamp): string {
    if (!timestamp) return 'Never';

    const now = new Date();
    const date = timestamp.toDate();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffMins < 1440) {
      // Less than 24 hours
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  }
}
