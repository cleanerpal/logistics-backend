import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import {
  MatSlideToggleModule,
  MatSlideToggleChange,
} from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  collection,
  collectionData,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from '@angular/fire/storage';

export interface Expense {
  id: string;
  driverId: string;
  driverName: string;
  type: 'Fuel' | 'Toll' | 'Car Wash' | 'Vacuum' | 'Other';
  amount: number;
  date: Timestamp;
  notes?: string;
  receiptUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  chargeable: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss'],
})
export class ExpensesComponent implements OnInit, OnDestroy {
  // Table data
  expenses: Expense[] = [];
  dataSource = new MatTableDataSource<Expense>();
  displayedColumns: string[] = [
    'id',
    'driverName',
    'type',
    'amount',
    'date',
    'status',
    'chargeable',
    'actions',
  ];

  // Form controls
  searchForm: FormGroup;

  // UI states
  loading = true;

  // Subscriptions for cleanup
  private expensesSubscription?: Subscription;

  // ViewChild references for table pagination and sorting
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Filter options
  expenseTypes = ['Fuel', 'Toll', 'Car Wash', 'Vacuum', 'Other'];

  constructor(
    private firestore: Firestore,
    private storage: Storage,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    // Initialize search form
    this.searchForm = this.formBuilder.group({
      searchText: [''],
      dateRange: this.formBuilder.group({
        start: [null],
        end: [null],
      }),
      expenseType: [''],
    });
  }

  ngOnInit(): void {
    this.loadExpenses();

    // Subscribe to search form changes
    this.searchForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    // Cleanup subscriptions
    if (this.expensesSubscription) {
      this.expensesSubscription.unsubscribe();
    }
  }

  /**
   * Load expenses from Firestore
   */
  loadExpenses(): void {
    this.loading = true;

    try {
      // Create a query for expenses collection
      const expensesCollection = collection(this.firestore, 'Expenses');
      const expensesQuery = query(expensesCollection, orderBy('date', 'desc'));

      // Subscribe to real-time updates
      this.expensesSubscription = collectionData(expensesQuery, {
        idField: 'id',
      }).subscribe({
        next: (expenses: DocumentData[]) => {
          this.expenses = expenses as Expense[];
          this.dataSource.data = this.expenses;

          // Connect table to paginator and sorter after data is loaded
          setTimeout(() => {
            this.dataSource.paginator = this.paginator;
            this.dataSource.sort = this.sort;

            // Set custom filter predicate for search
            this.dataSource.filterPredicate = this.createFilterPredicate();
          });

          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading expenses:', error);
          this.snackBar.open(
            'Error loading expenses. Please try again.',
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
      console.error('Error setting up expenses subscription:', error);
      this.loading = false;
    }
  }

  /**
   * Create a custom filter predicate for the data source
   */
  createFilterPredicate(): (data: Expense, filter: string) => boolean {
    return (data: Expense, filter: string) => {
      const searchFilter = JSON.parse(filter);

      // Apply text search filter
      if (searchFilter.searchText) {
        const searchText = searchFilter.searchText.toLowerCase();
        if (
          !data.driverName.toLowerCase().includes(searchText) &&
          !data.type.toLowerCase().includes(searchText) &&
          !data.id.toString().includes(searchText)
        ) {
          return false;
        }
      }

      // Apply expense type filter
      if (searchFilter.expenseType && data.type !== searchFilter.expenseType) {
        return false;
      }

      // Apply date range filter
      if (searchFilter.dateRange.start && searchFilter.dateRange.end) {
        const start = new Date(searchFilter.dateRange.start);
        const end = new Date(searchFilter.dateRange.end);
        // Set end date to end of day
        end.setHours(23, 59, 59, 999);

        const expenseDate = data.date.toDate();
        if (expenseDate < start || expenseDate > end) {
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
      expenseType: this.searchForm.get('expenseType')?.value,
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
      expenseType: '',
    });
  }

  /**
   * Navigate to expense details
   */
  viewExpenseDetails(id: string): void {
    this.router.navigate(['/expenses', id]);
  }

  /**
   * Navigate to create expense page
   */
  createExpense(): void {
    this.router.navigate(['/expenses/create']);
  }

  /**
   * Delete expense confirmation
   */
  confirmDelete(id: string): void {
    if (confirm('Are you sure you want to delete this expense?')) {
      this.deleteExpense(id);
    }
  }

  /**
   * Delete expense from Firestore
   */
  private async deleteExpense(id: string): Promise<void> {
    try {
      const expenseRef = doc(this.firestore, 'Expenses', id);
      await deleteDoc(expenseRef);

      this.snackBar.open('Expense deleted successfully', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error deleting expense:', error);
      this.snackBar.open('Error deleting expense. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
  }

  /**
   * Quick approve expense
   */
  async approveExpense(id: string, event: Event): Promise<void> {
    event.stopPropagation(); // Prevent row click

    try {
      const expenseRef = doc(this.firestore, 'Expenses', id);
      await updateDoc(expenseRef, {
        status: 'Approved',
        updatedAt: Timestamp.now(),
      });

      this.snackBar.open('Expense approved', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error approving expense:', error);
      this.snackBar.open(
        'Error approving expense. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    }
  }

  /**
   * Quick reject expense
   */
  async rejectExpense(id: string, event: Event): Promise<void> {
    event.stopPropagation(); // Prevent row click

    try {
      const expenseRef = doc(this.firestore, 'Expenses', id);
      await updateDoc(expenseRef, {
        status: 'Rejected',
        updatedAt: Timestamp.now(),
      });

      this.snackBar.open('Expense rejected', 'Close', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Error rejecting expense:', error);
      this.snackBar.open(
        'Error rejecting expense. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    }
  }

  /**
   * Toggle expense chargeable status
   */
  async toggleChargeable(
    expenseId: string,
    currentValue: boolean,
    event: MatSlideToggleChange
  ): Promise<void> {
    // The click event is already stopped by the template's (click)="$event.stopPropagation()"

    try {
      const expenseRef = doc(this.firestore, 'Expenses', expenseId);
      await updateDoc(expenseRef, {
        chargeable: !currentValue,
        updatedAt: Timestamp.now(),
      });

      this.snackBar.open(
        `Expense marked as ${!currentValue ? 'chargeable' : 'non-chargeable'}`,
        'Close',
        {
          duration: 3000,
        }
      );
    } catch (error) {
      console.error('Error toggling chargeable status:', error);
      this.snackBar.open('Error updating status. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    }
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
   * Get status color for badge
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'Approved':
        return '#4CAF50'; // Green
      case 'Rejected':
        return '#F44336'; // Red
      case 'Pending':
        return '#FFC107'; // Amber
      default:
        return '#9E9E9E'; // Grey
    }
  }

  /**
   * Format amount with currency symbol
   */
  formatAmount(amount: number): string {
    return `£${amount.toFixed(2)}`;
  }
}
