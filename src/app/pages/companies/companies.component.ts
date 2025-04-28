import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  collection,
  collectionData,
  query,
  orderBy,
  limit,
  DocumentData,
} from '@angular/fire/firestore';

// Company interface
export interface Company {
  id: string;
  name: string;
  companyName: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postcode: string;
  phone: string;
  email: string;
  createdAt: any;
  updatedAt: any;
}

@Component({
  selector: 'app-companies',
  templateUrl: './companies.component.html',
  styleUrls: ['./companies.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterModule,
    ReactiveFormsModule,
  ],
})
export class CompaniesComponent implements OnInit, AfterViewInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private router: Router = inject(Router);
  private snackBar: MatSnackBar = inject(MatSnackBar);

  // Table data
  displayedColumns: string[] = [
    'companyName',
    'name',
    'address',
    'phone',
    'email',
    'actions',
  ];
  dataSource = new MatTableDataSource<Company>();
  searchControl = new FormControl('');

  // Loading indicator
  loading = true;

  // Subscriptions
  private companiesSubscription?: Subscription;
  private searchSubscription?: Subscription;

  // View children for table pagination and sorting
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.loadCompanies();

    // Setup search filter
    this.searchSubscription = this.searchControl.valueChanges.subscribe(
      (value) => {
        this.applyFilter(value || '');
      }
    );
  }

  ngAfterViewInit(): void {
    // Connect table to paginator and sorter
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    // Setup custom filter predicate for search
    this.dataSource.filterPredicate = (data: Company, filter: string) => {
      const searchValue = filter.toLowerCase();
      return (
        data.name.toLowerCase().includes(searchValue) ||
        data.companyName.toLowerCase().includes(searchValue)
      );
    };
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.companiesSubscription) {
      this.companiesSubscription.unsubscribe();
    }
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  /**
   * Load companies from Firestore
   */
  loadCompanies(): void {
    this.loading = true;

    try {
      // Create query for companies collection
      const companiesCollection = collection(this.firestore, 'Companies');
      const companiesQuery = query(
        companiesCollection,
        orderBy('companyName'),
        limit(50)
      );

      // Subscribe to real-time updates
      this.companiesSubscription = collectionData(companiesQuery, {
        idField: 'id',
      }).subscribe({
        next: (companies: DocumentData[]) => {
          this.dataSource.data = companies as Company[];
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading companies:', error);
          this.snackBar.open(
            'Error loading companies. Please try again.',
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
      console.error('Error setting up companies subscription:', error);
      this.snackBar.open(
        'Error loading companies. Please try again.',
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
   * Apply filter to table data
   */
  applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Format address for display
   */
  formatAddress(company: Company): string {
    const addressParts = [
      company.street,
      company.city,
      company.state,
      company.postcode,
      company.country,
    ].filter(Boolean);

    return addressParts.join(', ');
  }

  /**
   * Navigate to company edit page
   */
  editCompany(id: string): void {
    this.router.navigate(['/companies/edit', id]);
  }

  /**
   * Navigate to company addresses page
   */
  manageAddresses(id: string, event: Event): void {
    event.stopPropagation(); // Prevent row click
    this.router.navigate(['/companies', id, 'addresses']);
  }

  /**
   * Navigate to create company page
   */
  createCompany(): void {
    this.router.navigate(['/companies/create']);
  }
}
