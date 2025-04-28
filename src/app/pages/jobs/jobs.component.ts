import { SelectionModel } from '@angular/cdk/collections';
import { NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  Timestamp,
  collection,
  collectionData,
  doc,
  limit,
  orderBy,
  query,
  writeBatch,
} from '@angular/fire/firestore';

// Components
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { BulkUploadDialogComponent } from './bulk-upload-dialog/bulk-upload-dialog.component';

// Interface for Job data
export interface Job {
  id: string;
  jobType: 'Standard' | 'Split Journey';
  customerReference: string;
  shippingReference: string;
  priority: boolean;
  vehicleType: 'Car' | 'Van' | 'Truck' | 'Bus' | 'Motorcycle';
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  vehicleYear: number;
  vehicleLocation: string;
  collectionBuilding: string;
  collectionStreet: string;
  collectionCity: string;
  collectionPostcode: string;
  collectionCountry: string;
  collectionContactName: string;
  collectionContactPhone: string;
  collectionContactEmail: string;
  collectionInstructions: string;
  deliveryBuilding: string;
  deliveryStreet: string;
  deliveryCity: string;
  deliveryPostcode: string;
  deliveryCountry: string;
  deliveryContactName: string;
  deliveryContactPhone: string;
  deliveryContactEmail: string;
  deliveryInstructions: string;
  secondaryPoints?: {
    building: string;
    street: string;
    city: string;
    postcode: string;
    country: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    instructions: string;
  }[];
  team: string;
  currentDriver?: string;
  status: 'Unallocated' | 'Allocated' | 'Collected' | 'Delivered' | 'Cancelled';
  collectionDate: Timestamp;
  deliveryDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Component({
  selector: 'app-jobs',
  templateUrl: './jobs.component.html',
  styleUrls: ['./jobs.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatDialogModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatCard,
    MatCardContent,
    MatProgressSpinner,
  ],
})
export class JobsComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private dialog: MatDialog = inject(MatDialog);
  private snackBar: MatSnackBar = inject(MatSnackBar);
  private formBuilder: FormBuilder = inject(FormBuilder);
  private router: Router = inject(Router);

  // View children
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Component properties
  dataSource = new MatTableDataSource<Job>();
  displayedColumns: string[] = [
    'select',
    'id',
    'vehicle',
    'registration',
    'status',
    'currentDriver',
    'team',
    'collectionDate',
    'deliveryDate',
    'actions',
  ];
  selection = new SelectionModel<Job>(true, []);
  isMultiSelectActive = false;

  searchForm: FormGroup;
  updateForm: FormGroup;

  loading = true;
  subscription?: Subscription;

  // Teams fetched from Firestore
  teams: string[] = [];

  constructor() {
    // Initialize search form
    this.searchForm = this.formBuilder.group({
      searchText: [''],
      dateRange: this.formBuilder.group({
        start: [null],
        end: [null],
      }),
      dateType: ['collection'], // collection or delivery
    });

    // Initialize update form for multi-select updates
    this.updateForm = this.formBuilder.group({
      status: [''],
      team: [''],
    });
  }

  ngOnInit(): void {
    this.loadJobs();
    this.loadTeams();

    // Subscribe to search form changes
    this.searchForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Load jobs from Firestore
   */
  loadJobs(): void {
    this.loading = true;

    try {
      // Create a query for jobs collection
      const jobsCollection = collection(this.firestore, 'Jobs');
      const jobsQuery = query(
        jobsCollection,
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      // Subscribe to the query
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

            // Set custom filter predicate
            this.dataSource.filterPredicate = this.createFilterPredicate();
          });
        },
        error: (error) => {
          console.error('Error loading jobs:', error);
          this.snackBar.open('Error loading jobs. Please try again.', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.loading = false;
        },
      });
    } catch (error) {
      console.error('Error setting up jobs subscription:', error);
      this.snackBar.open(
        'Error setting up jobs subscription. Please try again.',
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
   * Load teams from Firestore
   */
  loadTeams(): void {
    try {
      const teamsCollection = collection(this.firestore, 'Teams');
      const teamsQuery = query(teamsCollection, orderBy('name'));

      collectionData(teamsQuery, { idField: 'id' }).subscribe({
        next: (teams) => {
          this.teams = teams.map((team) => team['name']);
        },
        error: (error) => {
          console.error('Error loading teams:', error);
        },
      });
    } catch (error) {
      console.error('Error setting up teams subscription:', error);
    }
  }

  /**
   * Create a custom filter predicate for the data source
   */
  createFilterPredicate(): (data: Job, filter: string) => boolean {
    return (data: Job, filter: string) => {
      const searchFilter = JSON.parse(filter);

      // Apply text search filter
      if (searchFilter.searchText) {
        const searchText = searchFilter.searchText.toLowerCase();
        if (
          !data.id.toLowerCase().includes(searchText) &&
          !data.vehicleRegistration.toLowerCase().includes(searchText) &&
          !data.status.toLowerCase().includes(searchText) &&
          !data.customerReference.toLowerCase().includes(searchText) &&
          !data.shippingReference.toLowerCase().includes(searchText) &&
          !(data.currentDriver?.toLowerCase().includes(searchText) || false) &&
          !data.team.toLowerCase().includes(searchText)
        ) {
          return false;
        }
      }

      // Apply date range filter
      if (searchFilter.dateRange.start && searchFilter.dateRange.end) {
        const start = new Date(searchFilter.dateRange.start);
        const end = new Date(searchFilter.dateRange.end);
        // Set end date to end of day
        end.setHours(23, 59, 59, 999);

        let dateToCheck: Date;
        if (searchFilter.dateType === 'collection') {
          dateToCheck = data.collectionDate.toDate();
        } else {
          dateToCheck = data.deliveryDate.toDate();
        }

        if (dateToCheck < start || dateToCheck > end) {
          return false;
        }
      }

      return true;
    };
  }

  /**
   * Apply filters to the data source
   */
  applyFilters(): void {
    const searchFilter = {
      searchText: this.searchForm.get('searchText')?.value,
      dateRange: this.searchForm.get('dateRange')?.value,
      dateType: this.searchForm.get('dateType')?.value,
    };

    this.dataSource.filter = JSON.stringify(searchFilter);

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Reset all filters
   */
  resetFilters(): void {
    this.searchForm.reset({
      searchText: '',
      dateRange: {
        start: null,
        end: null,
      },
      dateType: 'collection',
    });

    this.applyFilters();
  }

  /**
   * Open the bulk upload dialog
   */
  openBulkUploadDialog(): void {
    const dialogRef = this.dialog.open(BulkUploadDialogComponent, {
      width: '600px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.success) {
        this.snackBar.open(
          `Successfully uploaded ${result.successCount} jobs`,
          'Close',
          {
            duration: 5000,
          }
        );
      }
    });
  }

  /**
   * Toggle multi-select mode
   */
  toggleMultiSelect(): void {
    this.isMultiSelectActive = !this.isMultiSelectActive;

    if (!this.isMultiSelectActive) {
      this.selection.clear();
      this.updateForm.reset();
    }
  }

  /**
   * Whether the number of selected elements matches the total number of rows
   */
  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  /**
   * Selects all rows if they are not all selected; otherwise clear selection
   */
  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }

    this.selection.select(...this.dataSource.data);
  }

  /**
   * The label for the checkbox on the passed row
   */
  checkboxLabel(row?: Job): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${
      row.id
    }`;
  }

  /**
   * Update selected jobs with new status and/or team
   */
  async updateSelectedJobs(): Promise<void> {
    if (this.selection.selected.length === 0) {
      this.snackBar.open('No jobs selected', 'Close', {
        duration: 3000,
      });
      return;
    }

    const status = this.updateForm.get('status')?.value;
    const team = this.updateForm.get('team')?.value;

    if (!status && !team) {
      this.snackBar.open('No update values provided', 'Close', {
        duration: 3000,
      });
      return;
    }

    try {
      const batch = writeBatch(this.firestore);
      const updatedCount = {
        status: 0,
        team: 0,
      };

      // Update each selected job
      this.selection.selected.forEach((job) => {
        const jobRef = doc(this.firestore, 'Jobs', job.id);
        const updateData: any = {
          updatedAt: Timestamp.now(),
        };

        if (status) {
          updateData.status = status;
          updatedCount.status++;
        }

        if (team) {
          updateData.team = team;
          updatedCount.team++;
        }

        batch.update(jobRef, updateData);
      });

      // Commit the batch
      await batch.commit();

      // Show success message
      let message = 'Updated:';
      if (updatedCount.status > 0) {
        message += ` ${updatedCount.status} job statuses`;
      }
      if (updatedCount.team > 0) {
        message += `${updatedCount.status > 0 ? ',' : ''} ${
          updatedCount.team
        } team assignments`;
      }

      this.snackBar.open(message, 'Close', {
        duration: 5000,
      });

      // Reset selection and form
      this.selection.clear();
      this.updateForm.reset();
      this.isMultiSelectActive = false;
    } catch (error) {
      console.error('Error updating jobs:', error);
      this.snackBar.open('Error updating jobs. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Navigate to job details
   */
  viewJob(jobId: string): void {
    this.router.navigate(['/jobs/edit', jobId]);
  }

  /**
   * Get status color for badge
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
   * Format date from Timestamp
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
}
