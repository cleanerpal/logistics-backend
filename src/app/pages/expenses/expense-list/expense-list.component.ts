import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  TemplateRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { Expense, ExpenseStatus } from '../../../shared/models/expense.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService } from '../../../services/expense.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';

interface ExpenseFilters {
  status: string;
  driver: string;
  chargeable: boolean | 'All';
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

interface Driver {
  id: string;
  name: string;
}

@Component({
  selector: 'app-expense-list',
  templateUrl: './expense-list.component.html',
  styleUrls: ['./expense-list.component.scss'],
})
export class ExpenseListComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('expenseDetailDialog') expenseDetailDialog!: TemplateRef<any>;
  @ViewChild('rejectDialog') rejectDialog!: TemplateRef<any>;

  displayedColumns: string[] = [
    'id',
    'description',
    'amount',
    'date',
    'jobId',
    'driver',
    'status',
    'chargeable',
    'actions',
  ];

  dataSource = new MatTableDataSource<Expense>([]);
  filteredExpenses: Expense[] = [];
  allExpenses: Expense[] = [];
  isLoading = false;
  isManager = true; // In a real app, this would be determined by user role

  statusOptions = Object.values(ExpenseStatus);
  selectedExpense: Expense | null = null;

  // For rejection comment
  rejectionForm: FormGroup;
  expenseToReject: Expense | null = null;

  filters: ExpenseFilters = {
    status: 'All',
    driver: 'All',
    chargeable: 'All',
    dateRange: {
      start: null,
      end: null,
    },
  };

  drivers: Driver[] = [
    { id: 'DRIVER1', name: 'Mike Johnson' },
    { id: 'DRIVER2', name: 'Sarah Williams' },
    { id: 'DRIVER3', name: 'David Brown' },
  ];

  constructor(
    private router: Router,
    private expenseService: ExpenseService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private formBuilder: FormBuilder
  ) {
    this.rejectionForm = this.formBuilder.group({
      reason: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadExpenses();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Expense, filter: string) => {
      const searchStr = filter.toLowerCase();

      // Check if the expense matches the search text
      const matchesSearch =
        data.description.toLowerCase().includes(searchStr) ||
        data.driverName.toLowerCase().includes(searchStr) ||
        data.jobId?.toLowerCase().includes(searchStr) ||
        false ||
        data.id.toLowerCase().includes(searchStr);

      return matchesSearch;
    };
  }

  loadExpenses(): void {
    this.isLoading = true;

    this.expenseService.getExpenses().subscribe((expenses: Expense[]) => {
      this.allExpenses = expenses;
      this.applyFilters();
      this.isLoading = false;
    });
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }

    this.updateFilteredExpenses();
  }

  applyFilters(): void {
    // Get all expenses
    let filtered = [...this.allExpenses];

    // Apply status filter
    if (this.filters.status !== 'All') {
      filtered = filtered.filter(
        (expense) => expense.status === this.filters.status
      );
    }

    // Apply driver filter
    if (this.filters.driver !== 'All') {
      filtered = filtered.filter(
        (expense) => expense.driverId === this.filters.driver
      );
    }

    // Apply chargeable filter
    if (this.filters.chargeable !== 'All') {
      filtered = filtered.filter(
        (expense) => expense.isChargeable === this.filters.chargeable
      );
    }

    // Apply date range filter
    if (this.filters.dateRange.start && this.filters.dateRange.end) {
      const startDate = new Date(this.filters.dateRange.start);
      const endDate = new Date(this.filters.dateRange.end);
      endDate.setHours(23, 59, 59); // Include the entire end day

      filtered = filtered.filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    }

    // Update the data source
    this.dataSource.data = filtered;
    this.updateFilteredExpenses();
  }

  private updateFilteredExpenses(): void {
    this.filteredExpenses = this.dataSource.filteredData;
  }

  getStatusClass(status: ExpenseStatus): string {
    const statusMap: Record<string, string> = {
      [ExpenseStatus.PENDING]: 'status-pending',
      [ExpenseStatus.APPROVED]: 'status-approved',
      [ExpenseStatus.REJECTED]: 'status-rejected',
    };
    return statusMap[status] || 'status-default';
  }

  createNewExpense(): void {
    this.router.navigate(['/expenses/new']);
  }

  viewExpenseDetails(expense: Expense): void {
    this.selectedExpense = expense;
    this.dialog.open(this.expenseDetailDialog, {
      width: '600px',
    });
  }

  closeDialog(): void {
    this.dialog.closeAll();
  }

  approveExpense(expense: Expense): void {
    // Confirm with the manager
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Approve Expense',
        message: `Are you sure you want to approve this expense of ${this.formatCurrency(
          expense.amount
        )}?`,
        confirmText: 'Approve',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.expenseService
          .updateExpenseStatus(
            expense.id,
            ExpenseStatus.APPROVED,
            { approvedBy: 'Admin User' } // In a real app, this would be the current user
          )
          .subscribe({
            next: (updatedExpense: Expense) => {
              // Update the expense in the list
              const index = this.allExpenses.findIndex(
                (e) => e.id === updatedExpense.id
              );
              if (index !== -1) {
                this.allExpenses[index] = updatedExpense;
                this.applyFilters();
              }

              this.showSuccessMessage('Expense approved successfully');
              this.dialog.closeAll();
            },
            error: (error: any) => {
              this.showErrorMessage('Failed to approve expense');
              console.error('Error approving expense:', error);
            },
          });
      }
    });
  }

  openRejectDialog(expense: Expense): void {
    this.expenseToReject = expense;
    this.rejectionForm.reset({
      reason: '',
    });
    this.dialog.open(this.rejectDialog, {
      width: '400px',
    });
  }

  confirmReject(): void {
    if (!this.expenseToReject || this.rejectionForm.invalid) {
      return;
    }

    const reason = this.rejectionForm.get('reason')?.value;

    this.expenseService
      .updateExpenseStatus(
        this.expenseToReject.id,
        ExpenseStatus.REJECTED,
        { approvedBy: 'Admin User' } // In a real app, this would be the current user
      )
      .subscribe({
        next: (updatedExpense: Expense) => {
          // Update the expense in the list
          const index = this.allExpenses.findIndex(
            (e) => e.id === updatedExpense.id
          );
          if (index !== -1) {
            // Update with rejection reason
            updatedExpense.notes =
              (updatedExpense.notes || '') + `\nRejection reason: ${reason}`;
            this.allExpenses[index] = updatedExpense;
            this.applyFilters();
          }

          this.showSuccessMessage('Expense rejected');
          this.dialog.closeAll();
          this.expenseToReject = null;
        },
        error: (error: any) => {
          this.showErrorMessage('Failed to reject expense');
          console.error('Error rejecting expense:', error);
        },
      });
  }

  rejectExpense(expense: Expense): void {
    this.openRejectDialog(expense);
  }

  updateChargeable(expense: Expense, event: MatCheckboxChange): void {
    if (expense.status !== ExpenseStatus.APPROVED) {
      this.showErrorMessage(
        'Only approved expenses can be marked as chargeable'
      );
      return;
    }

    this.expenseService
      .updateExpenseChargeableStatus(expense.id, event.checked)
      .subscribe({
        next: (updatedExpense: Expense) => {
          // Update the expense in the list
          const index = this.allExpenses.findIndex(
            (e) => e.id === updatedExpense.id
          );
          if (index !== -1) {
            this.allExpenses[index] = updatedExpense;
            this.applyFilters();
          }

          this.showSuccessMessage(
            event.checked
              ? 'Expense marked as chargeable'
              : 'Expense marked as non-chargeable'
          );
        },
        error: (error: any) => {
          this.showErrorMessage('Failed to update expense');
          console.error('Error updating expense:', error);
        },
      });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  }

  getBulkApprovalCount(): number {
    return this.filteredExpenses.filter(
      (expense) => expense.status === ExpenseStatus.PENDING
    ).length;
  }

  bulkApproveExpenses(): void {
    const pendingExpenses = this.filteredExpenses.filter(
      (expense) => expense.status === ExpenseStatus.PENDING
    );

    if (pendingExpenses.length === 0) {
      this.showErrorMessage('No pending expenses to approve');
      return;
    }

    // Confirm with the manager
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Bulk Approve Expenses',
        message: `Are you sure you want to approve all ${pendingExpenses.length} pending expenses?`,
        confirmText: 'Approve All',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        let approvedCount = 0;
        let errorCount = 0;

        // Process each expense one by one
        pendingExpenses.forEach((expense) => {
          this.expenseService
            .updateExpenseStatus(expense.id, ExpenseStatus.APPROVED, {
              approvedBy: 'Admin User',
            })
            .subscribe({
              next: (updatedExpense: Expense) => {
                // Update the expense in the list
                const index = this.allExpenses.findIndex(
                  (e) => e.id === updatedExpense.id
                );
                if (index !== -1) {
                  this.allExpenses[index] = updatedExpense;
                }

                approvedCount++;

                // When all done, refresh the view
                if (approvedCount + errorCount === pendingExpenses.length) {
                  this.applyFilters();
                  if (errorCount === 0) {
                    this.showSuccessMessage(
                      `Successfully approved ${approvedCount} expenses`
                    );
                  } else {
                    this.showErrorMessage(
                      `Approved ${approvedCount} expenses, but failed to approve ${errorCount} expenses`
                    );
                  }
                }
              },
              error: () => {
                errorCount++;

                // When all done, refresh the view
                if (approvedCount + errorCount === pendingExpenses.length) {
                  this.applyFilters();
                  if (errorCount === 0) {
                    this.showSuccessMessage(
                      `Successfully approved ${approvedCount} expenses`
                    );
                  } else {
                    this.showErrorMessage(
                      `Approved ${approvedCount} expenses, but failed to approve ${errorCount} expenses`
                    );
                  }
                }
              },
            });
        });
      }
    });
  }

  private showSuccessMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['success-snackbar'],
    });
  }

  private showErrorMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['error-snackbar'],
    });
  }
}
