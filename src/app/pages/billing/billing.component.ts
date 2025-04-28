// billing.component.ts
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  collectionData,
  Timestamp,
  getDocs,
} from '@angular/fire/firestore';

// Models
export interface Job {
  id: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  customerName: string;
  customerCompany: string;
  amount?: number;
  expenses?: number;
  status: string;
  deliveryDate: Timestamp;
  completedAt: Timestamp;
  invoiceId?: string;
}

export interface Invoice {
  id: string;
  customerName: string;
  customerCompany: string;
  totalAmount: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  createdAt: Timestamp;
  dueDate: Timestamp;
  jobIds: string[];
  paidAt?: Timestamp;
  sentAt?: Timestamp;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatCardModule,
  ],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss'],
})
export class BillingComponent implements OnInit, OnDestroy {
  // Jobs ready to invoice
  jobsDataSource = new MatTableDataSource<Job>([]);
  jobsColumns: string[] = [
    'select',
    'id',
    'vehicle',
    'customer',
    'amount',
    'actions',
  ];
  jobsSelection = new SelectionModel<Job>(true, []);

  // Invoices
  invoicesDataSource = new MatTableDataSource<Invoice>([]);
  invoicesColumns: string[] = [
    'id',
    'customer',
    'amount',
    'status',
    'date',
    'actions',
  ];

  // Pagination and sorting
  @ViewChild('jobsPaginator') jobsPaginator!: MatPaginator;
  @ViewChild('invoicesPaginator') invoicesPaginator!: MatPaginator;
  @ViewChild('jobsSort') jobsSort!: MatSort;
  @ViewChild('invoicesSort') invoicesSort!: MatSort;

  // Status
  loading = true;
  tabIndex = 0;
  searchControl = new FormControl('');

  // Subscriptions
  private jobsSubscription?: Subscription;
  private invoicesSubscription?: Subscription;
  private searchSubscription?: Subscription;

  constructor(
    private firestore: Firestore,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadJobs();
    this.loadInvoices();

    // Setup search filter
    this.searchSubscription = this.searchControl.valueChanges.subscribe(
      (value) => {
        if (this.tabIndex === 0) {
          this.jobsDataSource.filter = value || '';
          if (this.jobsDataSource.paginator) {
            this.jobsDataSource.paginator.firstPage();
          }
        } else {
          this.invoicesDataSource.filter = value || '';
          if (this.invoicesDataSource.paginator) {
            this.invoicesDataSource.paginator.firstPage();
          }
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.jobsSubscription) {
      this.jobsSubscription.unsubscribe();
    }
    if (this.invoicesSubscription) {
      this.invoicesSubscription.unsubscribe();
    }
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onTabChange(event: any): void {
    this.tabIndex = event.index;
    this.searchControl.setValue('');
  }

  /** Load jobs ready to be invoiced */
  private loadJobs(): void {
    this.loading = true;

    try {
      // Query for completed jobs with no invoiceId
      const jobsCollection = collection(this.firestore, 'Jobs');
      const jobsQuery = query(
        jobsCollection,
        where('status', '==', 'Delivered'),
        where('invoiceId', '==', null),
        orderBy('completedAt', 'desc'),
        limit(50)
      );

      this.jobsSubscription = collectionData(jobsQuery, {
        idField: 'id',
      }).subscribe({
        next: (jobs: any[]) => {
          this.jobsDataSource.data = jobs as Job[];

          // Setup paginator and sorting after data loads
          setTimeout(() => {
            if (this.jobsPaginator && this.jobsSort) {
              this.jobsDataSource.paginator = this.jobsPaginator;
              this.jobsDataSource.sort = this.jobsSort;
            }

            // Setup filter predicate for jobs
            this.jobsDataSource.filterPredicate = (
              data: Job,
              filter: string
            ) => {
              const searchText = filter.toLowerCase();
              return (
                data.id.toLowerCase().includes(searchText) ||
                data.customerName.toLowerCase().includes(searchText) ||
                data.customerCompany.toLowerCase().includes(searchText) ||
                `${data.vehicleMake} ${data.vehicleModel}`
                  .toLowerCase()
                  .includes(searchText) ||
                data.vehicleRegistration.toLowerCase().includes(searchText)
              );
            };
          });

          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading jobs:', error);
          this.snackBar.open('Error loading jobs. Please try again.', 'Close', {
            duration: 5000,
          });
          this.loading = false;
        },
      });
    } catch (error) {
      console.error('Error setting up jobs subscription:', error);
      this.loading = false;
    }
  }

  /** Load all invoices */
  private loadInvoices(): void {
    try {
      const invoicesCollection = collection(this.firestore, 'Invoices');
      const invoicesQuery = query(
        invoicesCollection,
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      this.invoicesSubscription = collectionData(invoicesQuery, {
        idField: 'id',
      }).subscribe({
        next: (invoices: any[]) => {
          this.invoicesDataSource.data = invoices as Invoice[];

          // Setup paginator and sorting
          setTimeout(() => {
            if (this.invoicesPaginator && this.invoicesSort) {
              this.invoicesDataSource.paginator = this.invoicesPaginator;
              this.invoicesDataSource.sort = this.invoicesSort;
            }

            // Setup filter predicate for invoices
            this.invoicesDataSource.filterPredicate = (
              data: Invoice,
              filter: string
            ) => {
              const searchText = filter.toLowerCase();
              return (
                data.id.toLowerCase().includes(searchText) ||
                data.customerName.toLowerCase().includes(searchText) ||
                data.customerCompany.toLowerCase().includes(searchText) ||
                data.status.toLowerCase().includes(searchText)
              );
            };
          });
        },
        error: (error) => {
          console.error('Error loading invoices:', error);
          this.snackBar.open(
            'Error loading invoices. Please try again.',
            'Close',
            {
              duration: 5000,
            }
          );
        },
      });
    } catch (error) {
      console.error('Error setting up invoices subscription:', error);
    }
  }

  /** Navigate to job edit page to update amount */
  editJobAmount(jobId: string, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/jobs/edit', jobId]);
  }

  /** Navigate to invoice details page */
  viewInvoice(invoiceId: string): void {
    this.router.navigate(['/billing/invoice', invoiceId]);
  }

  /** Generate a new invoice for selected jobs */
  generateInvoice(): void {
    const selectedJobs = this.jobsSelection.selected;
    if (selectedJobs.length === 0) {
      this.snackBar.open(
        'Please select at least one job to invoice.',
        'Close',
        {
          duration: 3000,
        }
      );
      return;
    }

    // Check if all selected jobs have amounts
    const invalidJobs = selectedJobs.filter(
      (job) => !job.amount || job.amount <= 0
    );
    if (invalidJobs.length > 0) {
      this.snackBar.open(
        'All selected jobs must have valid amounts.',
        'Close',
        {
          duration: 3000,
        }
      );
      return;
    }

    // Navigate to generate invoice page with selected job IDs
    const jobIds = selectedJobs.map((job) => job.id);
    this.router.navigate(['/billing/generate-invoice'], {
      queryParams: { jobs: jobIds.join(',') },
    });
  }

  /** Create a manual invoice with no jobs attached */
  createManualInvoice(): void {
    this.router.navigate(['/billing/generate-invoice']);
  }

  /** Check if we have valid jobs to generate invoice */
  canGenerateInvoice(): boolean {
    return (
      this.jobsSelection.selected.length > 0 &&
      !this.jobsSelection.selected.some((job) => !job.amount || job.amount <= 0)
    );
  }

  /** Format date for display */
  formatDate(timestamp: Timestamp): string {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /** Get status color class for invoice badges */
  getStatusClass(status: string): string {
    switch (status) {
      case 'Draft':
        return 'status-draft';
      case 'Sent':
        return 'status-sent';
      case 'Paid':
        return 'status-paid';
      case 'Overdue':
        return 'status-overdue';
      default:
        return '';
    }
  }

  /** Whether the number of selected elements matches the total number of rows */
  isAllSelected(): boolean {
    const numSelected = this.jobsSelection.selected.length;
    const numRows = this.jobsDataSource.data.length;
    return numSelected === numRows;
  }

  /** Selects all rows if they are not all selected; otherwise clear selection */
  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.jobsSelection.clear();
      return;
    }

    this.jobsSelection.select(...this.jobsDataSource.data);
  }

  /** The label for the checkbox on the passed row */
  checkboxLabel(row?: Job): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.jobsSelection.isSelected(row) ? 'deselect' : 'select'} row ${
      row.id
    }`;
  }
}
