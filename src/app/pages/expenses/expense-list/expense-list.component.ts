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
  company: string;
  chargeable: boolean | 'All';
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  paidStatus: 'All' | 'Paid' | 'Unpaid';
  jobId: string;
}

interface Driver {
  id: string;
  name: string;
}

interface ExtendedExpense extends Expense {
  isPaid?: boolean;
  paidDate?: Date;
  paidBy?: string;
  paymentReference?: string;
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

  dataSource = new MatTableDataSource<ExtendedExpense>([]);
  filteredExpenses: ExtendedExpense[] = [];
  allExpenses: ExtendedExpense[] = [];
  isLoading = false;
  isManager = false;
  isPrintingInvoice = false;

  statusOptions = Object.values(ExpenseStatus);
  selectedExpense: ExtendedExpense | null = null;

  rejectionForm: FormGroup;
  expenseToReject: ExtendedExpense | null = null;

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
    company: 'All',
    chargeable: 'All',
    dateRange: {
      start: null,
      end: null,
    },
    paidStatus: 'All',
    jobId: '',
  };

  searchTerm: string = '';

  companies: string[] = [];

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

  private loadCompanies(expenses: ExtendedExpense[]): void {
    const companySet = new Set<string>();
    expenses.forEach((exp) => {
      const e: any = exp;
      if (e.customerName) companySet.add(e.customerName);
    });
    this.companies = Array.from(companySet);
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: ExtendedExpense, filter: string) => {
      const searchStr = filter.toLowerCase();

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
        this.allExpenses = expenses.map((expense) => ({
          ...expense,
          isPaid: (expense as ExtendedExpense).isPaid !== undefined ? (expense as ExtendedExpense).isPaid : false,
        })) as ExtendedExpense[];

        this.loadCompanies(this.allExpenses);
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
    let filtered = [...this.allExpenses];

    if (this.filters.jobId && this.filters.jobId.trim() !== '') {
      filtered = filtered.filter((expense) => expense.jobId && expense.jobId.toLowerCase().includes(this.filters.jobId.trim().toLowerCase()));
    }

    if (this.filters.company !== 'All') {
      filtered = filtered.filter((expense) => {
        const e: any = expense;
        return e.customerName && e.customerName === this.filters.company;
      });
    }

    if (this.filters.status !== 'All') {
      filtered = filtered.filter((expense) => expense.status === this.filters.status);
    }

    if (this.filters.chargeable !== 'All') {
      filtered = filtered.filter((expense) => expense.isChargeable === this.filters.chargeable);
    }

    if (this.filters.paidStatus !== 'All') {
      const isPaid = this.filters.paidStatus === 'Paid';
      filtered = filtered.filter((expense) => expense.isPaid === isPaid);
    }

    if (this.filters.dateRange.start && this.filters.dateRange.end) {
      const startDate = new Date(this.filters.dateRange.start);
      const endDate = new Date(this.filters.dateRange.end);
      endDate.setHours(23, 59, 59);
      filtered = filtered.filter((expense) => {
        const expenseDate = new Date(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      });
    }

    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const search = this.searchTerm.trim().toLowerCase();
      filtered = filtered.filter((expense) =>
        [expense.id, expense.description, expense.driverName, expense.jobId, expense.status].join(' ').toLowerCase().includes(search)
      );
    }

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

  getPaidStatusClass(isPaid: boolean | undefined): string {
    return isPaid ? 'status-approved' : 'status-pending';
  }

  getPaidStatusText(isPaid: boolean | undefined): string {
    return isPaid ? 'Paid' : 'Unpaid';
  }

  createNewExpense(): void {
    this.router.navigate(['/expenses/new']);
  }

  viewExpenseDetails(expense: ExtendedExpense): void {
    this.selectedExpense = expense;
    this.dialog.open(this.expenseDetailDialog, {
      width: '600px',
    });
  }

  closeDialog(): void {
    this.dialog.closeAll();
  }

  approveExpense(expense: ExtendedExpense): void {
    this.showErrorMessage('Approving expenses is now managed via the job details page or invoice system.');
  }

  openRejectDialog(expense: ExtendedExpense): void {
    this.showErrorMessage('Rejecting expenses is now managed via the job details page or invoice system.');
  }

  confirmReject(): void {
    this.showErrorMessage('Rejecting expenses is now managed via the job details page or invoice system.');
  }

  rejectExpense(expense: ExtendedExpense): void {
    this.showErrorMessage('Rejecting expenses is now managed via the job details page or invoice system.');
  }

  updateChargeable(expense: ExtendedExpense, event: MatCheckboxChange): void {
    this.showErrorMessage('Chargeable status is now managed via the job details page or invoice system.');
  }

  updatePaidStatus(expense: ExtendedExpense, isPaid: boolean): void {
    this.showErrorMessage('Paid status is now managed via the job details page or invoice system.');
  }

  printInvoice(expense: ExtendedExpense): void {
    this.selectedExpense = expense;
    const dialogRef = this.dialog.open(this.printInvoiceDialog, {
      width: '800px',
      panelClass: 'print-dialog',
    });

    dialogRef.afterOpened().subscribe(() => {
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
    this.showErrorMessage('Bulk approval is now managed via the job details page or invoice system.');
  }

  getCurrentDate(): string {
    return new Date().toLocaleDateString('en-GB');
  }

  getInvoiceNumber(expense: ExtendedExpense): string {
    return `INV-${expense.id.replace('EXP', '')}`;
  }

  clearFilters(): void {
    this.filters = {
      status: 'All',
      company: 'All',
      chargeable: 'All',
      dateRange: { start: null, end: null },
      paidStatus: 'All',
      jobId: '',
    };
    this.searchTerm = '';
    this.applyFilters();
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
