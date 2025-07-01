// job-details.component.ts

import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Timestamp } from 'firebase/firestore';

import { Job, JobNote } from '../../../interfaces/job-new.interface';
import { UserProfile } from '../../../interfaces/user-profile.interface';
import { JobNewService } from '../../../services/job-new.service';
import { AuthService } from '../../../services/auth.service';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';

// Enhanced expense interface matching mobile app
export interface JobExpense {
  id: string;
  type: 'fuel' | 'tolls' | 'parking' | 'car_wash' | 'other';
  description: string;
  amount: number;
  liters?: number; // For fuel expenses
  date: Timestamp;
  receiptUrl?: string;
  addedBy: string;
  addedByName: string;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
  isChargeable: boolean; // Whether to charge to customer
  notes?: string;
}

export interface PricingItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  total: number;
  isCustom: boolean; // Whether it's a custom item or standard service
}

export interface JobBilling {
  basePrice: number; // Initial job cost
  additionalItems: PricingItem[];
  expenses: JobExpense[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  invoiceNumber?: string;
  invoiceDate?: Timestamp;
  dueDate?: Timestamp;
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue';
  notes?: string;
  customerChargeableTotal?: number; // Total amount to charge customer (excluding internal costs)
}

@Component({
  selector: 'app-job-details',
  templateUrl: './job-details.component.html',
  styleUrls: ['./job-details.component.scss'],
  standalone: false,
})
export class JobDetailsComponent implements OnInit, OnDestroy {
  job: Job | null = null;
  loading = true;
  error: string | null = null;

  currentUser: UserProfile | null = null;
  canEditJobs = false;
  canManageJobs = false;
  canManageBilling = false;

  // Billing data
  jobBilling: JobBilling | null = null;
  isLoadingBilling = false;

  // Add expense form data
  newExpense = {
    type: 'fuel' as const,
    description: '',
    amount: 0,
    liters: 0,
    receiptUrl: '',
    isChargeable: true,
    notes: '',
  };

  // Add pricing item form data
  newPricingItem = {
    name: '',
    description: '',
    price: 0,
    quantity: 1,
  };

  // Enhanced expense types matching mobile app
  expenseTypes = [
    { value: 'fuel', label: 'Fuel', icon: 'local_gas_station', requiresLiters: true },
    { value: 'tolls', label: 'Tolls', icon: 'toll', requiresLiters: false },
    { value: 'parking', label: 'Parking', icon: 'local_parking', requiresLiters: false },
    { value: 'accommodation', label: 'Accommodation', icon: 'hotel', requiresLiters: false },
    { value: 'meals', label: 'Meals', icon: 'restaurant', requiresLiters: false },
    { value: 'car_wash', label: 'Car Wash', icon: 'local_car_wash', requiresLiters: false },
    { value: 'vacuum', label: 'Vacuum', icon: 'cleaning_services', requiresLiters: false },
    { value: 'repairs', label: 'Repairs', icon: 'build', requiresLiters: false },
    { value: 'other', label: 'Other', icon: 'receipt', requiresLiters: false },
  ];

  // Standard pricing items for quick addition
  standardPricingItems = [
    { name: 'Collection Service', description: 'Vehicle collection service', price: 50.0 },
    { name: 'Delivery Service', description: 'Vehicle delivery service', price: 50.0 },
    { name: 'Storage (per day)', description: 'Vehicle storage per day', price: 15.0 },
    { name: 'Washing Service', description: 'Vehicle washing service', price: 25.0 },
    { name: 'Express Service', description: 'Same day service premium', price: 75.0 },
    { name: 'Mileage (per mile)', description: 'Additional mileage charge', price: 1.5 },
    { name: 'Cleaning Service', description: 'Interior/exterior cleaning', price: 35.0 },
    { name: 'Inspection Service', description: 'Vehicle condition inspection', price: 20.0 },
  ];

  selectedTabIndex = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jobService: JobNewService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializePermissions();
    this.loadJob();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializePermissions(): void {
    this.authService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this.canEditJobs = user?.permissions?.canEditJobs || user?.permissions?.isAdmin || false;
        this.canManageJobs = user?.permissions?.canManageUsers || user?.permissions?.isAdmin || false;
        this.canManageBilling = user?.permissions?.['canManageBilling'] || user?.permissions?.isAdmin || false;
      });
  }

  private loadJob(): void {
    const jobId = this.route.snapshot.paramMap.get('id');
    if (!jobId) {
      this.error = 'Invalid job ID';
      this.loading = false;
      return;
    }

    this.jobService
      .getJobById(jobId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (job) => {
          this.job = job;
          this.loading = false;
          this.loadBillingData();
        },
        error: (error) => {
          this.error = 'Failed to load job details';
          this.loading = false;
          console.error('Error loading job:', error);
        },
      });
  }

  // Tab selection
  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    if (index === 5 && !this.jobBilling) {
      // Billing tab index (adjust if needed)
      this.loadBillingData();
    }
  }

  // Notes methods
  getFormattedNotes(notes?: JobNote[] | string | null | undefined): Array<{ content: string; authorName: string; createdAt: Date }> {
    if (!notes) return [];

    // Handle string notes (legacy format)
    if (typeof notes === 'string') {
      return [
        {
          content: notes,
          authorName: this.job?.createdBy || 'System',
          createdAt: Timestamp.now().toDate(),
        },
      ];
    }

    // Handle JobNote array format
    if (Array.isArray(notes)) {
      return notes.map((note) => ({
        content: note.content || note.text || '', // Handle different property names
        authorName: note.authorName || note.createdBy || 'System',
        createdAt: note.createdAt instanceof Timestamp ? note.createdAt.toDate() : note.createdAt instanceof Date ? note.createdAt : new Date(),
      }));
    }

    return [];
  }

  // Billing Data Management
  private loadBillingData(): void {
    if (!this.job) return;

    this.isLoadingBilling = true;

    // TODO: Replace with actual Firebase service call
    setTimeout(() => {
      this.jobBilling = {
        basePrice: 150.0, // Initial job cost
        additionalItems: [],
        expenses: [],
        subtotal: 150.0,
        vatRate: 0.2,
        vatAmount: 30.0,
        totalAmount: 180.0,
        status: 'draft',
        notes: '',
        customerChargeableTotal: 150.0,
      };
      this.isLoadingBilling = false;
      this.cdr.detectChanges();
    }, 1000);
  }

  // Update base price
  updateBasePrice(): void {
    if (!this.jobBilling) return;
    this.calculateTotals();
    this.saveBillingData();
    this.showSuccess('Base price updated');
  }

  // Add Expense
  addExpense(): void {
    if (!this.job || !this.currentUser || !this.newExpense.description || this.newExpense.amount <= 0) {
      this.showError('Please fill in all required fields with valid values');
      return;
    }

    const expense: JobExpense = {
      id: `exp_${Date.now()}`,
      type: this.newExpense.type,
      description: this.newExpense.description,
      amount: this.newExpense.amount,
      liters: this.newExpense.type === 'fuel' ? this.newExpense.liters : undefined,
      date: Timestamp.now(),
      receiptUrl: this.newExpense.receiptUrl || undefined,
      addedBy: this.currentUser.id,
      addedByName: this.currentUser.name,
      isApproved: false,
      isChargeable: this.newExpense.isChargeable,
      notes: this.newExpense.notes || undefined,
    };

    if (!this.jobBilling) {
      this.initializeDefaultBilling();
    }

    this.jobBilling!.expenses.push(expense);
    this.calculateTotals();
    this.saveBillingData();

    // Reset form
    this.newExpense = {
      type: 'fuel',
      description: '',
      amount: 0,
      liters: 0,
      receiptUrl: '',
      isChargeable: true,
      notes: '',
    };

    this.showSuccess('Expense added successfully');
  }

  // Remove Expense
  removeExpense(expenseId: string): void {
    if (!this.jobBilling) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Remove Expense',
        message: 'Are you sure you want to remove this expense?',
        confirmText: 'Remove',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && this.jobBilling) {
        this.jobBilling.expenses = this.jobBilling.expenses.filter((exp) => exp.id !== expenseId);
        this.calculateTotals();
        this.saveBillingData();
        this.showSuccess('Expense removed');
      }
    });
  }

  // Add Standard Pricing Item
  addStandardPricingItem(item: any): void {
    const pricingItem: PricingItem = {
      id: `item_${Date.now()}`,
      name: item.name,
      description: item.description,
      price: item.price,
      quantity: 1,
      total: item.price,
      isCustom: false,
    };

    if (!this.jobBilling) {
      this.initializeDefaultBilling();
    }

    this.jobBilling!.additionalItems.push(pricingItem);
    this.calculateTotals();
    this.saveBillingData();
    this.showSuccess(`${item.name} added to billing`);
  }

  // Add Pricing Item (matches existing method name)
  addPricingItem(): void {
    if (!this.newPricingItem.name || this.newPricingItem.price <= 0 || this.newPricingItem.quantity <= 0) {
      this.showError('Please fill in all required fields with valid values');
      return;
    }

    const pricingItem: PricingItem = {
      id: `item_${Date.now()}`,
      name: this.newPricingItem.name,
      description: this.newPricingItem.description,
      price: this.newPricingItem.price,
      quantity: this.newPricingItem.quantity,
      total: this.newPricingItem.price * this.newPricingItem.quantity,
      isCustom: true,
    };

    if (!this.jobBilling) {
      this.initializeDefaultBilling();
    }

    this.jobBilling!.additionalItems.push(pricingItem);
    this.calculateTotals();
    this.saveBillingData();

    // Reset form
    this.newPricingItem = {
      name: '',
      description: '',
      price: 0,
      quantity: 1,
    };

    this.showSuccess('Custom item added to billing');
  }

  // Remove Pricing Item
  removePricingItem(itemId: string): void {
    if (!this.jobBilling) return;

    this.jobBilling.additionalItems = this.jobBilling.additionalItems.filter((item) => item.id !== itemId);
    this.calculateTotals();
    this.saveBillingData();
    this.showSuccess('Item removed from billing');
  }

  // Calculate Totals
  private calculateTotals(): void {
    if (!this.jobBilling) return;

    // Calculate subtotal from base price and additional items
    const additionalItemsTotal = this.jobBilling.additionalItems.reduce((sum, item) => sum + item.total, 0);
    const chargeableExpensesTotal = this.jobBilling.expenses.filter((exp) => exp.isApproved && exp.isChargeable).reduce((sum, exp) => sum + exp.amount, 0);

    this.jobBilling.subtotal = this.jobBilling.basePrice + additionalItemsTotal + chargeableExpensesTotal;

    // Calculate customer chargeable total (excluding non-chargeable expenses)
    this.jobBilling.customerChargeableTotal = this.jobBilling.basePrice + additionalItemsTotal + chargeableExpensesTotal;

    // Calculate VAT
    this.jobBilling.vatAmount = this.jobBilling.subtotal * this.jobBilling.vatRate;

    // Calculate total
    this.jobBilling.totalAmount = this.jobBilling.subtotal + this.jobBilling.vatAmount;
  }

  // Initialize Default Billing
  private initializeDefaultBilling(): void {
    this.jobBilling = {
      basePrice: 150.0,
      additionalItems: [],
      expenses: [],
      subtotal: 150.0,
      vatRate: 0.2,
      vatAmount: 30.0,
      totalAmount: 180.0,
      status: 'draft',
      customerChargeableTotal: 150.0,
    };
  }

  // Save Billing Data
  private saveBillingData(): void {
    if (!this.job || !this.jobBilling) return;

    // TODO: Implement actual save to Firebase
    console.log('Saving billing data:', this.jobBilling);
  }

  // Approve Expense
  approveExpense(expenseId: string): void {
    if (!this.jobBilling || !this.currentUser || !this.canManageBilling) return;

    const expense = this.jobBilling.expenses.find((exp) => exp.id === expenseId);
    if (expense) {
      expense.isApproved = true;
      expense.approvedBy = this.currentUser.id;
      expense.approvedAt = Timestamp.now();
      this.calculateTotals();
      this.saveBillingData();
      this.showSuccess('Expense approved');
    }
  }

  // Open receipt URL in new window
  openReceipt(receiptUrl: string): void {
    if (receiptUrl) {
      window.open(receiptUrl, '_blank');
    }
  }

  // Generate PDF Invoice
  generatePDFInvoice(): void {
    if (!this.job || !this.jobBilling) {
      this.showError('No billing data available to generate invoice');
      return;
    }

    // Generate invoice number if not exists
    if (!this.jobBilling.invoiceNumber) {
      this.jobBilling.invoiceNumber = `INV-${this.job.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
      this.jobBilling.invoiceDate = Timestamp.now();
      this.jobBilling.dueDate = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      this.saveBillingData();
    }

    this.createPDFInvoice();
  }

  // Create PDF Invoice
  private createPDFInvoice(): void {
    const invoiceHTML = this.generateInvoiceHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 1000);
    }
  }

  // Generate Invoice HTML
  private generateInvoiceHTML(): string {
    if (!this.job || !this.jobBilling) return '';

    const currentDate = new Date().toLocaleDateString('en-GB');
    const invoiceDate = this.jobBilling.invoiceDate?.toDate().toLocaleDateString('en-GB') || currentDate;
    const dueDate = this.jobBilling.dueDate?.toDate().toLocaleDateString('en-GB') || 'Net 30';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Invoice ${this.jobBilling.invoiceNumber}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
            .company-info { font-size: 14px; }
            .company-name { font-size: 24px; font-weight: bold; color: #3b82f6; margin-bottom: 10px; }
            .invoice-details { text-align: right; }
            .invoice-title { font-size: 32px; font-weight: bold; color: #1e293b; margin-bottom: 10px; }
            .invoice-meta { font-size: 14px; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1e293b; }
            .customer-info { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .job-info { background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f8fafc; font-weight: bold; color: #374151; }
            .amount { text-align: right; }
            .totals { margin-top: 30px; }
            .totals table { width: 50%; margin-left: auto; }
            .totals th, .totals td { border: none; padding: 8px 12px; }
            .total-row { font-weight: bold; font-size: 18px; background: #dbeafe; }
            .notes { margin-top: 30px; font-size: 14px; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-info">
                <div class="company-name">CleanerPal Logistics</div>
                <div>123 Business Street</div>
                <div>Belfast, BT1 1AA</div>
                <div>Northern Ireland</div>
                <div>Phone: 028 9xxx xxxx</div>
                <div>Email: billing@cleanerpal.com</div>
            </div>
            <div class="invoice-details">
                <div class="invoice-title">INVOICE</div>
                <div class="invoice-meta">
                    <div><strong>Invoice #:</strong> ${this.jobBilling.invoiceNumber}</div>
                    <div><strong>Date:</strong> ${invoiceDate}</div>
                    <div><strong>Due Date:</strong> ${dueDate}</div>
                    <div><strong>Job ID:</strong> ${this.job.id.substring(0, 8)}...</div>
                </div>
            </div>
        </div>

        <div class="customer-info">
            <div class="section-title">Bill To:</div>
            <div><strong>${this.job.customerName || 'Customer'}</strong></div>
            <div>${this.job.collectionAddress || ''}</div>
            <div>${this.job.collectionCity || ''} ${this.job.collectionPostcode || ''}</div>
        </div>

        <div class="job-info">
            <div class="section-title">Job Details:</div>
            <div><strong>Vehicle:</strong> ${this.job.vehicleRegistration} - ${this.job.vehicleMake || ''} ${this.job.vehicleModel || ''}</div>
            <div><strong>Service Type:</strong> ${this.job.isSplitJourney ? 'Split Journey' : 'Standard Collection & Delivery'}</div>
            <div><strong>Collection:</strong> ${this.job.collectionAddress}</div>
            <div><strong>Delivery:</strong> ${this.job.deliveryAddress}</div>
        </div>

        <div class="section-title">Services & Items:</div>
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th class="amount">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Base Service</td>
                    <td>1</td>
                    <td>£${this.jobBilling.basePrice.toFixed(2)}</td>
                    <td class="amount">£${this.jobBilling.basePrice.toFixed(2)}</td>
                </tr>
                ${this.jobBilling.additionalItems
                  .map(
                    (item) => `
                <tr>
                    <td>${item.name}<br><small>${item.description}</small></td>
                    <td>${item.quantity}</td>
                    <td>£${item.price.toFixed(2)}</td>
                    <td class="amount">£${item.total.toFixed(2)}</td>
                </tr>
                `
                  )
                  .join('')}
                ${this.jobBilling.expenses
                  .filter((exp) => exp.isApproved && exp.isChargeable)
                  .map(
                    (expense) => `
                <tr>
                    <td>${expense.description} (${expense.type})</td>
                    <td>1</td>
                    <td>£${expense.amount.toFixed(2)}</td>
                    <td class="amount">£${expense.amount.toFixed(2)}</td>
                </tr>
                `
                  )
                  .join('')}
            </tbody>
        </table>

        <div class="totals">
            <table>
                <tr>
                    <th>Subtotal:</th>
                    <td class="amount">£${this.jobBilling.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                    <th>VAT (${(this.jobBilling.vatRate * 100).toFixed(0)}%):</th>
                    <td class="amount">£${this.jobBilling.vatAmount.toFixed(2)}</td>
                </tr>
                <tr class="total-row">
                    <th>TOTAL:</th>
                    <td class="amount">£${this.jobBilling.totalAmount.toFixed(2)}</td>
                </tr>
            </table>
        </div>

        ${
          this.jobBilling.notes
            ? `
        <div class="notes">
            <div class="section-title">Notes:</div>
            <p>${this.jobBilling.notes}</p>
        </div>
        `
            : ''
        }

        <div class="footer">
            <p>Thank you for your business!</p>
            <p>Payment terms: Net 30 days | All prices include VAT where applicable</p>
        </div>
    </body>
    </html>
    `;
  }

  // Utility methods
  getExpenseTypeLabel(type: string): string {
    const expenseType = this.expenseTypes.find((et) => et.value === type);
    return expenseType?.label || type;
  }

  getExpenseTypeIcon(type: string): string {
    const expenseType = this.expenseTypes.find((et) => et.value === type);
    return expenseType?.icon || 'receipt';
  }

  getExpenseTypeRequiresLiters(type: string): boolean {
    const expenseType = this.expenseTypes.find((et) => et.value === type);
    return expenseType?.requiresLiters || false;
  }

  getTotalApprovedExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => exp.isApproved).reduce((sum, exp) => sum + exp.amount, 0);
  }

  getTotalPendingExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => !exp.isApproved).reduce((sum, exp) => sum + exp.amount, 0);
  }

  getTotalChargeableExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => exp.isApproved && exp.isChargeable).reduce((sum, exp) => sum + exp.amount, 0);
  }

  getTotalInternalExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => exp.isApproved && !exp.isChargeable).reduce((sum, exp) => sum + exp.amount, 0);
  }

  formatDate(date: Date | Timestamp | undefined): string {
    if (!date) return 'N/A';

    if (date instanceof Timestamp) {
      return date.toDate().toLocaleDateString('en-GB');
    }

    if (date instanceof Date) {
      return date.toLocaleDateString('en-GB');
    }

    return new Date(date).toLocaleDateString('en-GB');
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  ///////////
  // Add these utility methods to your JobDetailsComponent class:

  getFullAddress(address?: string | null, city?: string | null, postcode?: string | null): string {
    const parts = [address, city, postcode].filter((part) => part && part.trim());
    return parts.length > 0 ? parts.join(', ') : 'Not specified';
  }

  getContactInfo(name?: string | null, phone?: string | null, email?: string | null): string {
    const parts = [];
    if (name) parts.push(name);
    if (phone) parts.push(phone);
    if (email) parts.push(email);
    return parts.length > 0 ? parts.join(' • ') : 'Not specified';
  }

  getVehicleInfo(): string {
    if (!this.job) return '';

    const parts = [];
    if (this.job.vehicleRegistration) parts.push(this.job.vehicleRegistration);
    if (this.job.vehicleMake) parts.push(this.job.vehicleMake);
    if (this.job.vehicleModel) parts.push(this.job.vehicleModel);

    return parts.length > 0 ? parts.join(' ') : 'Vehicle Details';
  }

  getVehicleSpecs(): Array<{ label: string; value: string }> {
    if (!this.job) return [];

    const specs = [];
    if (this.job.vehicleMake) specs.push({ label: 'Make', value: this.job.vehicleMake });
    if (this.job.vehicleModel) specs.push({ label: 'Model', value: this.job.vehicleModel });
    if (this.job.vehicleYear) specs.push({ label: 'Year', value: this.job.vehicleYear.toString() });
    if (this.job.vehicleColor) specs.push({ label: 'Color', value: this.job.vehicleColor });

    return specs;
  }

  formatDateTime(date: Date | Timestamp | undefined): string {
    if (!date) return 'N/A';

    if (date instanceof Timestamp) {
      return date.toDate().toLocaleString('en-GB');
    }

    if (date instanceof Date) {
      return date.toLocaleString('en-GB');
    }

    return new Date(date).toLocaleString('en-GB');
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'unallocated':
        return 'warn';
      case 'allocated':
        return 'accent';
      case 'collected':
        return 'primary';
      case 'in-transit':
        return 'primary';
      case 'delivered':
        return 'primary';
      case 'completed':
        return 'primary';
      default:
        return 'accent';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'unallocated':
        return 'schedule';
      case 'allocated':
        return 'person';
      case 'collected':
        return 'local_shipping';
      case 'in-transit':
        return 'directions_car';
      case 'delivered':
        return 'flag';
      case 'completed':
        return 'check_circle';
      default:
        return 'info';
    }
  }

  getStatusProgress(): number {
    if (!this.job) return 0;

    switch (this.job.status) {
      case 'unallocated':
        return 10;
      case 'allocated':
        return 25;
      case 'collected':
        return 50;
      case 'in-transit':
        return 75;
      case 'delivered':
        return 90;
      case 'completed':
        return 100;
      default:
        return 0;
    }
  }

  get isStandardJourney(): boolean {
    return !this.job?.isSplitJourney;
  }

  get isSplitJourney(): boolean {
    return this.job?.isSplitJourney || false;
  }

  getJobTimeline(): Array<{ status: string; date: Date | Timestamp; icon: string; color: string }> {
    if (!this.job) return [];

    const timeline = [];

    if (this.job.createdAt) {
      timeline.push({
        status: 'Job Created',
        date: this.job.createdAt,
        icon: 'add_circle',
        color: 'accent',
      });
    }

    if (this.job.allocatedAt) {
      timeline.push({
        status: 'Job Allocated',
        date: this.job.allocatedAt,
        icon: 'person_add',
        color: 'accent',
      });
    }

    if (this.job.collectionActualStartTime) {
      timeline.push({
        status: 'Collection Started',
        date: this.job.collectionActualStartTime,
        icon: 'start',
        color: 'primary',
      });
    }

    if (this.job.collectionActualCompleteTime) {
      timeline.push({
        status: 'Collection Completed',
        date: this.job.collectionActualCompleteTime,
        icon: 'done',
        color: 'primary',
      });
    }

    if (this.job.deliveryActualStartTime) {
      timeline.push({
        status: 'Delivery Started',
        date: this.job.deliveryActualStartTime,
        icon: 'local_shipping',
        color: 'primary',
      });
    }

    if (this.job.deliveryActualCompleteTime) {
      timeline.push({
        status: 'Delivery Completed',
        date: this.job.deliveryActualCompleteTime,
        icon: 'done_all',
        color: 'primary',
      });
    }

    return timeline.sort((a, b) => {
      const getTimestamp = (timestamp: any): number => {
        if (timestamp && typeof timestamp.toMillis === 'function') {
          return timestamp.toMillis();
        }
        if (timestamp && typeof timestamp.toDate === 'function') {
          return timestamp.toDate().getTime();
        }
        if (timestamp instanceof Date) {
          return timestamp.getTime();
        }
        return new Date(timestamp).getTime();
      };

      const dateA = getTimestamp(a.date);
      const dateB = getTimestamp(b.date);
      return dateA - dateB;
    });
  }

  goBack(): void {
    this.router.navigate(['/jobs']);
  }

  editJob(): void {
    if (this.job) {
      this.router.navigate(['/jobs', this.job.id, 'edit']);
    }
  }

  refreshJob(): void {
    this.loadJob();
  }

  printJob(): void {
    window.print();
  }
}
