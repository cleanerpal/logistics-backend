import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Router, RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  limit,
} from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';

// Vehicle interface
export interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  type: 'Car' | 'Van' | 'Truck' | 'Bus' | 'Motorcycle';
  year: number;
  location: string;
  currentDriverId?: string;
  currentDriverName?: string;
  status?: 'Available' | 'In Use' | 'Maintenance' | 'Out of Service';
  lastServiceDate?: Date;
  nextServiceDue?: Date;
}

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterModule,
  ],
  templateUrl: './vehicles.component.html',
  styleUrls: ['./vehicles.component.scss'],
})
export class VehiclesComponent implements OnInit, OnDestroy {
  // MatTable data source
  dataSource = new MatTableDataSource<Vehicle>();

  // Displayed columns in table
  displayedColumns: string[] = [
    'registration',
    'make',
    'model',
    'type',
    'year',
    'location',
    'actions',
  ];

  // Search form
  searchForm: FormGroup;

  // Loading state
  loading = true;

  // Firestore subscription
  private subscription?: Subscription;

  // ViewChild references
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private firestore: Firestore,
    private formBuilder: FormBuilder,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    // Initialize search form
    this.searchForm = this.formBuilder.group({
      searchTerm: [''],
    });
  }

  ngOnInit(): void {
    this.loadVehicles();

    // Subscribe to search form changes
    this.searchForm.get('searchTerm')?.valueChanges.subscribe((value) => {
      this.applyFilter(value);
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe when component is destroyed
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Load vehicles from Firestore
   */
  loadVehicles(): void {
    this.loading = true;

    try {
      // Create a query for vehicles collection
      const vehiclesCollection = collection(this.firestore, 'Vehicles');
      const vehiclesQuery = query(
        vehiclesCollection,
        orderBy('make', 'asc'),
        limit(50)
      );

      // Subscribe to the query
      this.subscription = collectionData(vehiclesQuery, {
        idField: 'id',
      }).subscribe({
        next: (vehicles) => {
          this.dataSource.data = vehicles as Vehicle[];
          this.loading = false;

          // Set the paginator and sort after data is loaded
          setTimeout(() => {
            this.dataSource.paginator = this.paginator;
            this.dataSource.sort = this.sort;

            // Set up filter predicate for custom filtering
            this.dataSource.filterPredicate = (
              data: Vehicle,
              filter: string
            ) => {
              const searchText = filter.toLowerCase();
              return (
                data.registration.toLowerCase().includes(searchText) ||
                data.make.toLowerCase().includes(searchText) ||
                data.model.toLowerCase().includes(searchText) ||
                data.type.toLowerCase().includes(searchText)
              );
            };
          });
        },
        error: (error) => {
          console.error('Error loading vehicles:', error);
          this.snackBar.open(
            'Error loading vehicles. Please try again.',
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
      console.error('Error setting up vehicles subscription:', error);
      this.snackBar.open(
        'Error setting up subscription. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
      this.loading = false;
    }
  }

  /**
   * Apply filter to the data source
   */
  applyFilter(filterValue: string): void {
    filterValue = filterValue.trim().toLowerCase();
    this.dataSource.filter = filterValue;

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Navigate to vehicle edit page
   */
  editVehicle(id: string): void {
    this.router.navigate(['/vehicles/edit', id]);
  }

  /**
   * Navigate to vehicles's jobs page
   */
  viewVehicleJobs(id: string): void {
    this.router.navigate(['/vehicles', id, 'jobs']);
  }

  /**
   * Navigate to create vehicle page
   */
  createVehicle(): void {
    this.router.navigate(['/vehicles/create']);
  }

  /**
   * Reset search filter
   */
  resetFilter(): void {
    this.searchForm.get('searchTerm')?.setValue('');
  }

  /**
   * Get status color based on vehicle status
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'Available':
        return '#4CAF50'; // Green
      case 'In Use':
        return '#2196F3'; // Blue
      case 'Maintenance':
        return '#FFC107'; // Amber
      case 'Out of Service':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Grey
    }
  }
}
