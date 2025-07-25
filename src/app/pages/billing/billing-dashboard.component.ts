import { Component, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil, forkJoin } from 'rxjs';

import { JobInvoice, BillingDashboardStats } from '../../interfaces/job-billing.interface';
import { JobBillingService } from '../../services/job-billing.service';
import { JobService } from '../../services/job.service';
import { ConfirmationDialogComponent } from '../../dialogs/confirmation-dialog.component';

@Component({
  selector: 'app-billing-dashboard',
  templateUrl: './billing-dashboard.component.html',
  styleUrls: ['./billing-dashboard.component.scss'],
  standalone: false,
})
export class BillingDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private destroy$ = new Subject<void>();

  dataSource = new MatTableDataSource<JobInvoice>([]);
  displayedColumns: string[] = ['invoiceNumber', 'jobId', 'customerName', 'issueDate', 'dueDate', 'total', 'status', 'actions'];

  isLoading = false;
  dashboardStats: BillingDashboardStats = {
    totalOutstanding: 0,
    totalPaid: 0,
    overdueCount: 0,
    overdueAmount: 0,
    thisMonthInvoiced: 0,
    thisMonthPaid: 0,
    averagePaymentDays: 0,
  };

  statusFilter = 'all';
  dateFilter = 'all';
  searchTerm = '';
  jobIdFilter: string = '';
  customerNameFilter: string = '';

  statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'viewed', label: 'Viewed' },
    { value: 'outstanding', label: 'Outstanding' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
  ];

  dateOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
  ];

  allInvoices: JobInvoice[] = [];

  constructor(
    private jobBillingService: JobBillingService,
    private jobService: JobService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    this.isLoading = true;

    this.jobBillingService
      .getAllInvoices()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (invoices) => {
          this.allInvoices = invoices;
          this.applyFilters();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading invoices:', error);
          this.snackBar.open('Error loading invoices', 'Close', { duration: 3000 });
          this.isLoading = false;
        },
      });
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (invoice: JobInvoice, filter: string) => {
      const searchData = [invoice.invoiceNumber, invoice.jobId, invoice.customerName, invoice.status].join(' ').toLowerCase();

      return searchData.includes(filter);
    };
  }

  applyFilters(): void {
    let filteredInvoices = [...this.allInvoices];

    if (this.jobIdFilter && this.jobIdFilter.trim() !== '') {
      filteredInvoices = filteredInvoices.filter((invoice) => invoice.jobId && invoice.jobId.toLowerCase().includes(this.jobIdFilter.trim().toLowerCase()));
    }

    if (this.customerNameFilter && this.customerNameFilter.trim() !== '') {
      filteredInvoices = filteredInvoices.filter(
        (invoice) => invoice.customerName && invoice.customerName.toLowerCase().includes(this.customerNameFilter.trim().toLowerCase())
      );
    }

    if (this.statusFilter !== 'all') {
      if (this.statusFilter === 'overdue') {
        const now = new Date();
        filteredInvoices = filteredInvoices.filter((invoice) => ['sent', 'viewed', 'outstanding'].includes(invoice.status) && invoice.dueDate < now);
      } else {
        filteredInvoices = filteredInvoices.filter((invoice) => invoice.status === this.statusFilter);
      }
    }

    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const search = this.searchTerm.trim().toLowerCase();
      filteredInvoices = filteredInvoices.filter((invoice) =>
        [invoice.invoiceNumber, invoice.jobId, invoice.customerName, invoice.status].join(' ').toLowerCase().includes(search)
      );
    }

    this.dataSource.data = filteredInvoices;
  }

  onSearchChange(): void {
    this.dataSource.filter = this.searchTerm.trim().toLowerCase();
  }

  onStatusFilterChange(): void {
    this.applyFilters();
  }

  onDateFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.jobIdFilter = '';
    this.customerNameFilter = '';
    this.statusFilter = 'all';
    this.searchTerm = '';
    this.applyFilters();
  }

  viewJob(jobId: string): void {
    this.router.navigate(['/jobs', jobId]);
  }

  viewInvoice(invoice: JobInvoice): void {
    this.router.navigate(['/billing/invoice', invoice.id]);
  }

  printInvoice(invoice: JobInvoice): void {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const invoiceHtml = this.generateInvoiceHtml(invoice);
      printWindow.document.write(invoiceHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }

  emailInvoice(invoice: JobInvoice): void {
    if (!invoice.customerEmail) {
      this.snackBar.open('Customer email required', 'Close', { duration: 3000 });
      return;
    }

    this.jobBillingService
      .emailInvoice(invoice.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadDashboardData();
          this.snackBar.open('Invoice emailed successfully', 'Close', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error emailing invoice:', error);
          this.snackBar.open('Error emailing invoice', 'Close', { duration: 3000 });
        },
      });
  }

  markInvoiceAsPaid(invoice: JobInvoice): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Mark Invoice as Paid',
        message: `Mark invoice ${invoice.invoiceNumber} for ${this.formatCurrency(invoice.total)} as paid?`,
        confirmText: 'Mark as Paid',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.jobBillingService
          .updateInvoiceStatus(invoice.id, 'paid', {
            paidAmount: invoice.total,
            paymentReference: `Payment-${invoice.invoiceNumber}`,
            paidDate: new Date(),
          })
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadDashboardData();
              this.snackBar.open('Invoice marked as paid', 'Close', { duration: 3000 });
            },
            error: (error) => {
              console.error('Error updating invoice status:', error);
              this.snackBar.open('Error updating invoice status', 'Close', { duration: 3000 });
            },
          });
      }
    });
  }

  markInvoiceAsOutstanding(invoice: JobInvoice): void {
    this.jobBillingService
      .updateInvoiceStatus(invoice.id, 'outstanding')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadDashboardData();
          this.snackBar.open('Invoice marked as outstanding', 'Close', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error updating invoice status:', error);
          this.snackBar.open('Error updating invoice status', 'Close', { duration: 3000 });
        },
      });
  }

  exportInvoices(): void {
    const csvData = this.prepareCsvData();
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private prepareCsvData(): string {
    const headers = ['Invoice Number', 'Job ID', 'Customer Name', 'Issue Date', 'Due Date', 'Total', 'Status', 'Sent Date', 'Paid Date'];

    const rows = this.dataSource.filteredData.map((invoice) => [
      invoice.invoiceNumber,
      invoice.jobId,
      invoice.customerName,
      invoice.issueDate.toLocaleDateString(),
      invoice.dueDate.toLocaleDateString(),
      invoice.total.toString(),
      invoice.status,
      invoice.sentDate?.toLocaleDateString() || '',
      invoice.paidDate?.toLocaleDateString() || '',
    ]);

    return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  }

  refreshData(): void {
    this.loadDashboardData();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  }

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      draft: 'gray',
      sent: 'blue',
      viewed: 'orange',
      outstanding: 'orange',
      paid: 'green',
      overdue: 'red',
    };
    return colors[status] || 'gray';
  }

  isOverdue(invoice: JobInvoice): boolean {
    const now = new Date();
    return ['sent', 'viewed', 'outstanding'].includes(invoice.status) && invoice.dueDate < now;
  }

  getDaysOverdue(invoice: JobInvoice): number {
    if (!this.isOverdue(invoice)) return 0;
    const now = new Date();
    return Math.ceil((now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private generateInvoiceHtml(invoice: JobInvoice): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              color: #333;
            }
            .invoice-header { 
              text-align: center; 
              margin-bottom: 40px; 
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .invoice-header h1 {
              font-size: 2.5rem;
              margin: 0;
              color: #333;
            }
            .company-info {
              text-align: right;
              margin-bottom: 30px;
            }
            .customer-info {
              margin-bottom: 30px;
            }
            .invoice-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 30px;
            }
            .invoice-table th, 
            .invoice-table td { 
              padding: 12px; 
              border: 1px solid #ddd; 
              text-align: left;
            }
            .invoice-table th {
              background-color: #f5f5f5;
              font-weight: bold;
            }
            .invoice-table tfoot td {
              font-weight: bold;
              background-color: #f9f9f9;
            }
            .total-row td {
              font-size: 1.2rem;
              background-color: #333 !important;
              color: white !important;
            }
            .payment-info {
              margin-top: 40px;
              padding: 20px;
              background-color: #f8f9fa;
              border-radius: 4px;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="company-info">
            <h2>NI VEHICLE LOGISTICS LTD</h2>
            <p>55-59 Adelaide Street<br>
               Belfast, BT2 8FE<br>
               Northern Ireland<br>
               Company No: NI684159</p>
          </div>
          
          <div class="invoice-header">
            <h1>INVOICE ${invoice.invoiceNumber}</h1>
            <p><strong>Issue Date:</strong> ${invoice.issueDate.toLocaleDateString()}</p>
            <p><strong>Due Date:</strong> ${invoice.dueDate.toLocaleDateString()}</p>
          </div>

          <div class="customer-info">
            <h3>Bill To:</h3>
            <p><strong>${invoice.customerName}</strong></p>
            ${
              invoice.billingAddress
                ? `
              <p>${invoice.billingAddress.address}<br>
                 ${invoice.billingAddress.city} ${invoice.billingAddress.postcode}<br>
                 ${invoice.billingAddress.country}</p>
            `
                : ''
            }
          </div>

          <table class="invoice-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items
                .map(
                  (item) => `
                <tr>
                  <td>
                    <div><strong>${item.description}</strong></div>
                    <div style="font-size: 0.9rem; color: #666;">${item.category}</div>
                  </td>
                  <td>${item.quantity}</td>
                  <td>${this.formatCurrency(item.unitPrice)}</td>
                  <td>${this.formatCurrency(item.amount * item.quantity)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3">Subtotal</td>
                <td>${this.formatCurrency(invoice.subtotal)}</td>
              </tr>
              <tr>
                <td colspan="3">VAT (${invoice.vatRate}%)</td>
                <td>${this.formatCurrency(invoice.vatAmount)}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3">TOTAL</td>
                <td>${this.formatCurrency(invoice.total)}</td>
              </tr>
            </tfoot>
          </table>

          <div class="payment-info">
            <h3>Payment Information</h3>
            <p><strong>Bank:</strong> Example Bank<br>
               <strong>Account Name:</strong> NI VEHICLE LOGISTICS LTD<br>
               <strong>Sort Code:</strong> 00-00-00<br>
               <strong>Account Number:</strong> 12345678<br>
               <strong>Reference:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Payment Terms:</strong> Payment due within 30 days of invoice date.</p>
          </div>

          <div style="text-align: center; margin-top: 40px; color: #666;">
            <p>Thank you for your business!</p>
          </div>
        </body>
      </html>
    `;
  }
}
