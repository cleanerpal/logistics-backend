import { Component, Input, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil, forkJoin } from 'rxjs';

import { Job } from '../../interfaces/job.interface';
import { JobBillingItem, JobInvoice } from '../../interfaces/job-billing.interface';
import { JobBillingService } from '../../services/job-billing.service';
import { JobService } from '../../services/job.service';
import { CustomerService } from '../../services/customer.service';
import { ConfirmationDialogComponent } from '../../dialogs/confirmation-dialog.component';

@Component({
  selector: 'app-job-billing',
  templateUrl: './job-billing.component.html',
  styleUrls: ['./job-billing.component.scss'],
  standalone: false,
})
export class JobBillingComponent implements OnInit, OnDestroy {
  @Input() job!: Job;
  @ViewChild('addItemDialog') addItemDialog!: TemplateRef<any>;
  @ViewChild('invoiceDialog') invoiceDialog!: TemplateRef<any>;

  private destroy$ = new Subject<void>();

  billingItems: JobBillingItem[] = [];
  invoices: JobInvoice[] = [];

  billingItemsDataSource = new MatTableDataSource<JobBillingItem>([]);
  invoicesDataSource = new MatTableDataSource<JobInvoice>([]);

  displayedColumns: string[] = ['date', 'type', 'description', 'quantity', 'unitPrice', 'amount', 'isChargeable', 'actions'];
  invoiceColumns: string[] = ['invoiceNumber', 'issueDate', 'dueDate', 'total', 'status', 'actions'];

  addItemForm: FormGroup;
  isLoading = false;
  isAddingItem = false;
  selectedInvoice: JobInvoice | null = null;

  totalBillable = 0;
  totalNonBillable = 0;
  totalOutstanding = 0;
  totalPaid = 0;

  itemTypes = [
    { value: 'expense', label: 'Expense' },
    { value: 'charge', label: 'Service Charge' },
    { value: 'initial_cost', label: 'Initial Cost' },
    { value: 'additional_fee', label: 'Additional Fee' },
  ];

  categories = ['Transport', 'Fuel', 'Tolls', 'Storage', 'Handling', 'Documentation', 'Insurance', 'Customs', 'Other'];

  constructor(
    private fb: FormBuilder,
    private jobBillingService: JobBillingService,
    private jobService: JobService,
    private customerService: CustomerService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.addItemForm = this.createAddItemForm();
  }

  ngOnInit(): void {
    this.loadBillingData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createAddItemForm(): FormGroup {
    return this.fb.group({
      type: ['expense', Validators.required],
      description: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitPrice: [0, [Validators.required, Validators.min(0.01)]],
      category: ['Transport', Validators.required],
      isChargeable: [true],
      date: [new Date(), Validators.required],
      notes: [''],
      receiptUrl: [''],
    });
  }

  private loadBillingData(): void {
    this.isLoading = true;

    forkJoin({
      billingItems: this.jobBillingService.getJobBillingItems(this.job.id),
      invoices: this.jobBillingService.getJobInvoices(this.job.id),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ billingItems, invoices }) => {
          this.billingItems = billingItems;
          this.invoices = invoices;
          this.billingItemsDataSource.data = billingItems;
          this.invoicesDataSource.data = invoices;
          this.calculateTotals();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading billing data:', error);
          this.snackBar.open('Error loading billing data', 'Close', { duration: 3000 });
          this.isLoading = false;
        },
      });
  }

  private calculateTotals(): void {
    this.totalBillable = this.billingItems.filter((item) => item.isChargeable).reduce((sum, item) => sum + item.amount * item.quantity, 0);

    this.totalNonBillable = this.billingItems.filter((item) => !item.isChargeable).reduce((sum, item) => sum + item.amount * item.quantity, 0);

    this.totalOutstanding = this.invoices.filter((inv) => ['sent', 'viewed', 'outstanding', 'overdue'].includes(inv.status)).reduce((sum, inv) => sum + inv.total, 0);

    this.totalPaid = this.invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
  }

  onQuantityChange(): void {
    const quantity = this.addItemForm.get('quantity')?.value || 1;
    const unitPrice = this.addItemForm.get('unitPrice')?.value || 0;
    this.addItemForm.patchValue({ amount: quantity * unitPrice });
  }

  onUnitPriceChange(): void {
    const quantity = this.addItemForm.get('quantity')?.value || 1;
    const unitPrice = this.addItemForm.get('unitPrice')?.value || 0;
    this.addItemForm.patchValue({ amount: quantity * unitPrice });
  }

  onAmountChange(): void {
    const amount = this.addItemForm.get('amount')?.value || 0;
    const quantity = this.addItemForm.get('quantity')?.value || 1;
    this.addItemForm.patchValue({ unitPrice: amount / quantity });
  }

  openAddItemDialog(): void {
    this.addItemForm.reset();
    this.addItemForm.patchValue({
      type: 'expense',
      quantity: 1,
      isChargeable: true,
      date: new Date(),
      category: 'Transport',
    });

    this.dialog.open(this.addItemDialog, {
      width: '600px',
      disableClose: true,
    });
  }

  addBillingItem(): void {
    if (this.addItemForm.invalid) {
      return;
    }

    this.isAddingItem = true;
    const formValue = this.addItemForm.value;

    const newItem: Omit<JobBillingItem, 'id' | 'createdAt' | 'updatedAt'> = {
      jobId: this.job.id,
      type: formValue.type,
      description: formValue.description,
      amount: formValue.amount,
      quantity: formValue.quantity,
      unitPrice: formValue.unitPrice,
      category: formValue.category,
      isChargeable: formValue.isChargeable,
      date: formValue.date,
      notes: formValue.notes,
      receiptUrl: formValue.receiptUrl,
      createdBy: '', // Will be set by service
    };

    this.jobBillingService
      .addBillingItem(newItem)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.dialog.closeAll();
          this.loadBillingData();
          this.snackBar.open('Billing item added successfully', 'Close', { duration: 3000 });
          this.isAddingItem = false;
        },
        error: (error) => {
          console.error('Error adding billing item:', error);
          this.snackBar.open('Error adding billing item', 'Close', { duration: 3000 });
          this.isAddingItem = false;
        },
      });
  }

  editBillingItem(item: JobBillingItem): void {
    this.addItemForm.patchValue({
      type: item.type,
      description: item.description,
      amount: item.amount,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      category: item.category,
      isChargeable: item.isChargeable,
      date: item.date,
      notes: item.notes,
      receiptUrl: item.receiptUrl,
    });

    const dialogRef = this.dialog.open(this.addItemDialog, {
      width: '600px',
      disableClose: true,
    });

    const originalAddMethod = this.addBillingItem;
    this.addBillingItem = () => {
      if (this.addItemForm.invalid) return;

      this.isAddingItem = true;
      const formValue = this.addItemForm.value;

      this.jobBillingService
        .updateBillingItem(item.id, {
          type: formValue.type,
          description: formValue.description,
          amount: formValue.amount,
          quantity: formValue.quantity,
          unitPrice: formValue.unitPrice,
          category: formValue.category,
          isChargeable: formValue.isChargeable,
          date: formValue.date,
          notes: formValue.notes,
          receiptUrl: formValue.receiptUrl,
        })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.dialog.closeAll();
            this.loadBillingData();
            this.snackBar.open('Billing item updated successfully', 'Close', { duration: 3000 });
            this.isAddingItem = false;
            this.addBillingItem = originalAddMethod; // Restore original method
          },
          error: (error) => {
            console.error('Error updating billing item:', error);
            this.snackBar.open('Error updating billing item', 'Close', { duration: 3000 });
            this.isAddingItem = false;
            this.addBillingItem = originalAddMethod; // Restore original method
          },
        });
    };
  }

  deleteBillingItem(item: JobBillingItem): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Billing Item',
        message: `Are you sure you want to delete "${item.description}"?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.jobBillingService
          .deleteBillingItem(item.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.loadBillingData();
              this.snackBar.open('Billing item deleted successfully', 'Close', { duration: 3000 });
            },
            error: (error) => {
              console.error('Error deleting billing item:', error);
              this.snackBar.open('Error deleting billing item', 'Close', { duration: 3000 });
            },
          });
      }
    });
  }

  createInvoice(): void {
    if (!this.job.customerId) {
      this.snackBar.open('Customer information required to create invoice', 'Close', { duration: 3000 });
      return;
    }

    this.customerService
      .getCustomerById(this.job.customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customer) => {
          if (!customer) {
            this.snackBar.open('Customer not found', 'Close', { duration: 3000 });
            return;
          }

          this.jobBillingService
            .createInvoiceFromJob(this.job.id, customer)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (invoiceId) => {
                this.loadBillingData();
                this.snackBar.open('Invoice created successfully', 'Close', { duration: 3000 });
              },
              error: (error) => {
                console.error('Error creating invoice:', error);
                this.snackBar.open('Error creating invoice', 'Close', { duration: 3000 });
              },
            });
        },
        error: (error) => {
          console.error('Error fetching customer:', error);
          this.snackBar.open('Error fetching customer details', 'Close', { duration: 3000 });
        },
      });
  }

  viewInvoice(invoice: JobInvoice): void {
    this.selectedInvoice = invoice;
    this.dialog.open(this.invoiceDialog, {
      width: '90%',
      maxWidth: '1200px',
      height: '90%',
    });
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
          this.loadBillingData();
          this.snackBar.open('Invoice emailed successfully', 'Close', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error emailing invoice:', error);
          this.snackBar.open('Error emailing invoice', 'Close', { duration: 3000 });
        },
      });
  }

  printInvoice(invoice: JobInvoice): void {
    this.selectedInvoice = invoice;

    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const invoiceHtml = this.generateInvoiceHtml(invoice);
        printWindow.document.write(invoiceHtml);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    }, 100);
  }

  markInvoiceAsPaid(invoice: JobInvoice): void {
    this.jobBillingService
      .updateInvoiceStatus(invoice.id, 'paid', {
        paidAmount: invoice.total,
        paymentReference: `Payment-${invoice.invoiceNumber}`,
        paidDate: new Date(),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadBillingData();
          this.snackBar.open('Invoice marked as paid', 'Close', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error updating invoice status:', error);
          this.snackBar.open('Error updating invoice status', 'Close', { duration: 3000 });
        },
      });
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

  private generateInvoiceHtml(invoice: JobInvoice): string {
    return `
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

  closeDialog(): void {
    this.dialog.closeAll();
  }
}
