import { Component, OnInit, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
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
import { AuthService } from '../../../services/auth.service';
import { finalize } from 'rxjs/operators';

interface ExpenseFilters {
  status: string;
  driver: string;
  chargeable: boolean | 'All';
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  paidStatus: 'All' | 'Paid' | 'Unpaid';
}

interface Driver {
  id: string;
  name: string;
}

@Component({
  selector: 'app-expense-list',
  templateUrl: './expense-list.component.html',
  styleUrls: ['./expense-list.component.scss'],
  standalone: false,
})
export class ExpenseListComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('expenseDetailDialog') expenseDetailDialog!: TemplateRef<any>;
  @ViewChild('rejectDialog') rejectDialog!: TemplateRef<any>;
  @ViewChild('printInvoiceDialog') printInvoiceDialog!: TemplateRef<any>;

  displayedColumns: string[] = ['id', 'description', 'amount', 'date', 'jobId', 'driver', 'status', 'paidStatus', 'chargeable', 'actions'];

  dataSource = new MatTableDataSource<Expense>([]);
  filteredExpenses: Expense[] = [];
  allExpenses: Expense[] = [];
  isLoading = false;
  isManager = false;
  isPrintingInvoice = false;

  statusOptions = Object.values(ExpenseStatus);
  selectedExpense: Expense | null = null;

  // For rejection comment
  rejectionForm: FormGroup;
  expenseToReject: Expense | null = null;

  // For print invoice
  companyDetails = {
    name: 'NI VEHICLE LOGISTICS LTD',
    address: '55-59 Adelaide Street',
    city: 'Belfast',
    postcode: 'BT2 8FE',
    country: 'Northern Ireland',
    companyNumber: 'NI684159',
  };

  filters: ExpenseFilters = {
    status: 'All',
    driver: 'All',
    chargeable: 'All',
    dateRange: {
      start: null,
      end: null,
    },
    paidStatus: 'All',
  };

  drivers: Driver[] = [];

  constructor(
    private router: Router,
    private expenseService: ExpenseService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private formBuilder: FormBuilder,
    private authService: AuthService
  ) {
    this.rejectionForm = this.formBuilder.group({
      reason: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.loadExpenses();
    this.loadDrivers();
    this.checkPermissions();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  private checkPermissions(): void {
    this.authService.hasPermission('canApproveExpenses').subscribe((hasPermission) => {
      this.isManager = hasPermission;
    });
  }

  private loadDrivers(): void {
    this.authService.getUsersByRole('driver').subscribe({
      next: (drivers) => {
        this.drivers = drivers.map((driver) => ({
          id: driver.id,
          name: driver.name,
        }));
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
      },
    });
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Expense, filter: string) => {
      const searchStr = filter.toLowerCase();

      // Check if the expense matches the search text
      const matchesSearch =
        data.description.toLowerCase().includes(searchStr) ||
        data.driverName.toLowerCase().includes(searchStr) ||
        data.jobId?.toLowerCase().includes(searchStr) ||
        data.id.toLowerCase().includes(searchStr);

      return matchesSearch;
    };
  }

  loadExpenses(): void {
    this.isLoading = true;

    this.expenseService.getExpenses().subscribe({
      next: (expenses: Expense[]) => {
        // Extend expenses with paid status if not present
        this.allExpenses = expenses.map((expense) => ({
          ...expense,
          isPaid: expense.isPaid !== undefined ? expense.isPaid : false,
        }));
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading expenses:', error);
        this.showErrorMessage('Failed to load expenses. Please try again.');
        this.isLoading = false;
      },
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
      filtered = filtered.filter((expense) => expense.status === this.filters.status);
    }

    // Apply driver filter
    if (this.filters.driver !== 'All') {
      filtered = filtered.filter((expense) => expense.driverId === this.filters.driver);
    }

    // Apply chargeable filter
    if (this.filters.chargeable !== 'All') {
      filtered = filtered.filter((expense) => expense.isChargeable === this.filters.chargeable);
    }

    // Apply paid status filter
    if (this.filters.paidStatus !== 'All') {
      const isPaid = this.filters.paidStatus === 'Paid';
      filtered = filtered.filter((expense) => expense.isPaid === isPaid);
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

  getPaidStatusClass(isPaid: boolean): string {
    return isPaid ? 'status-approved' : 'status-pending';
  }

  getPaidStatusText(isPaid: boolean): string {
    return isPaid ? 'Paid' : 'Unpaid';
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
        title: 'Approve Invoice',
        message: `Are you sure you want to approve this invoice of ${this.formatCurrency(expense.amount)}?`,
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
              const index = this.allExpenses.findIndex((e) => e.id === updatedExpense.id);
              if (index !== -1) {
                this.allExpenses[index] = updatedExpense;
                this.applyFilters();
              }

              this.showSuccessMessage('Invoice approved successfully');
              this.dialog.closeAll();
            },
            error: (error: any) => {
              this.showErrorMessage('Failed to approve invoice');
              console.error('Error approving invoice:', error);
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
          const index = this.allExpenses.findIndex((e) => e.id === updatedExpense.id);
          if (index !== -1) {
            // Update with rejection reason
            updatedExpense.notes = (updatedExpense.notes || '') + `\nRejection reason: ${reason}`;
            this.allExpenses[index] = updatedExpense;
            this.applyFilters();
          }

          this.showSuccessMessage('Invoice rejected');
          this.dialog.closeAll();
          this.expenseToReject = null;
        },
        error: (error: any) => {
          this.showErrorMessage('Failed to reject invoice');
          console.error('Error rejecting invoice:', error);
        },
      });
  }

  rejectExpense(expense: Expense): void {
    this.openRejectDialog(expense);
  }

  updateChargeable(expense: Expense, event: MatCheckboxChange): void {
    if (expense.status !== ExpenseStatus.APPROVED) {
      this.showErrorMessage('Only approved invoices can be marked as chargeable');
      return;
    }

    this.expenseService.updateExpenseChargeableStatus(expense.id, event.checked).subscribe({
      next: (updatedExpense: Expense) => {
        // Update the expense in the list
        const index = this.allExpenses.findIndex((e) => e.id === updatedExpense.id);
        if (index !== -1) {
          this.allExpenses[index] = updatedExpense;
          this.applyFilters();
        }

        this.showSuccessMessage(event.checked ? 'Invoice marked as chargeable' : 'Invoice marked as non-chargeable');
      },
      error: (error: any) => {
        this.showErrorMessage('Failed to update invoice');
        console.error('Error updating invoice:', error);
      },
    });
  }

  updatePaidStatus(expense: Expense, isPaid: boolean): void {
    // Only allow updating paid status for approved invoices
    if (expense.status !== ExpenseStatus.APPROVED) {
      this.showErrorMessage('Only approved invoices can be marked as paid');
      return;
    }

    this.expenseService.updateExpensePaidStatus(expense.id, isPaid).subscribe({
      next: (updatedExpense: Expense) => {
        // Update the expense in the list
        const index = this.allExpenses.findIndex((e) => e.id === updatedExpense.id);
        if (index !== -1) {
          this.allExpenses[index] = {
            ...this.allExpenses[index],
            isPaid: isPaid,
          };
          this.applyFilters();
        }

        this.showSuccessMessage(isPaid ? 'Invoice marked as paid' : 'Invoice marked as unpaid');
      },
      error: (error) => {
        this.showErrorMessage('Failed to update invoice payment status');
        console.error('Error updating invoice payment status:', error);
      },
    });
  }

  printInvoice(expense: Expense): void {
    this.selectedExpense = expense;
    const dialogRef = this.dialog.open(this.printInvoiceDialog, {
      width: '800px',
      panelClass: 'print-dialog',
    });

    dialogRef.afterOpened().subscribe(() => {
      // Give time for the dialog content to render
      setTimeout(() => {
        this.performPrint();
      }, 500);
    });
  }

  performPrint(): void {
    this.isPrintingInvoice = true;

    setTimeout(() => {
      const printContent = document.getElementById('printableInvoice');
      const originalContents = document.body.innerHTML;

      if (printContent) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(`
            <html>
              <head>
                <title>Invoice ${this.selectedExpense?.id}</title>
                <style>
                  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                  .invoice-container { max-width: 800px; margin: 0 auto; }
                  .invoice-header { display: flex; justify-content: space-between; margin-bottom: 40px; }
                  .logo { max-width: 200px; }
                  .company-details { text-align: right; }
                  .invoice-title { font-size: 24px; font-weight: bold; margin: 40px 0 20px; }
                  .invoice-meta { margin-bottom: 30px; }
                  .invoice-meta-item { margin-bottom: 5px; }
                  .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                  .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                  .invoice-table th { background-color: #f5f5f5; }
                  .total-row { font-weight: bold; }
                  .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; }
                </style>
              </head>
              <body>
                ${printContent.innerHTML}
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();

          // Print after a small delay to ensure content is fully loaded
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
            this.isPrintingInvoice = false;
          }, 500);
        } else {
          this.showErrorMessage('Failed to open print window. Please check your browser settings.');
          this.isPrintingInvoice = false;
        }
      }
    }, 300);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  }

  getBulkApprovalCount(): number {
    return this.filteredExpenses.filter((expense) => expense.status === ExpenseStatus.PENDING).length;
  }

  bulkApproveExpenses(): void {
    const pendingExpenses = this.filteredExpenses.filter((expense) => expense.status === ExpenseStatus.PENDING);

    if (pendingExpenses.length === 0) {
      this.showErrorMessage('No pending invoices to approve');
      return;
    }

    // Confirm with the manager
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Bulk Approve Invoices',
        message: `Are you sure you want to approve all ${pendingExpenses.length} pending invoices?`,
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
                const index = this.allExpenses.findIndex((e) => e.id === updatedExpense.id);
                if (index !== -1) {
                  this.allExpenses[index] = updatedExpense;
                }

                approvedCount++;

                // When all done, refresh the view
                if (approvedCount + errorCount === pendingExpenses.length) {
                  this.applyFilters();
                  if (errorCount === 0) {
                    this.showSuccessMessage(`Successfully approved ${approvedCount} invoices`);
                  } else {
                    this.showErrorMessage(`Approved ${approvedCount} invoices, but failed to approve ${errorCount} invoices`);
                  }
                }
              },
              error: () => {
                errorCount++;

                // When all done, refresh the view
                if (approvedCount + errorCount === pendingExpenses.length) {
                  this.applyFilters();
                  if (errorCount === 0) {
                    this.showSuccessMessage(`Successfully approved ${approvedCount} invoices`);
                  } else {
                    this.showErrorMessage(`Approved ${approvedCount} invoices, but failed to approve ${errorCount} invoices`);
                  }
                }
              },
            });
        });
      }
    });
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-GB');
  }

  getInvoiceNumber(expense: Expense): string {
    return `INV-${expense.id.replace('EXP', '')}`;
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
