import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject, of } from 'rxjs';
import { takeUntil, switchMap, tap } from 'rxjs/operators';
import { Timestamp } from '@angular/fire/firestore';

import { JobNewService } from '../../../services/job-new.service';
import { AuthService } from '../../../services/auth.service';
import { Customer } from '../../../interfaces/customer.interface';
import { MakeModel } from '../../../interfaces/make-model.interface';
import { UserProfile } from '../../../interfaces/user-profile.interface';
import { Job, JobNote } from '../../../interfaces/job-new.interface';

// Billing Interfaces
export interface JobExpense {
  id: string;
  type: 'fuel' | 'tolls' | 'parking' | 'accommodation' | 'meals' | 'other';
  description: string;
  amount: number;
  date: Timestamp;
  receiptUrl?: string;
  addedBy: string;
  addedByName: string;
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
}

export interface PricingItem {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  total: number;
}

export interface JobBilling {
  basePrice: number;
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
}

@Component({
  selector: 'app-job-details',
  templateUrl: './job-details.component.html',
  styleUrls: ['./job-details.component.scss'],
  standalone: false,
})
export class JobDetailsComponent implements OnInit, OnDestroy {
  [x: string]: any;
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
    receiptUrl: '',
  };

  // Add pricing item form data
  newPricingItem = {
    name: '',
    description: '',
    price: 0,
    quantity: 1,
  };

  // Expense types
  expenseTypes = [
    { value: 'fuel', label: 'Fuel', icon: 'local_gas_station' },
    { value: 'tolls', label: 'Tolls', icon: 'toll' },
    { value: 'parking', label: 'Parking', icon: 'local_parking' },
    { value: 'accommodation', label: 'Accommodation', icon: 'hotel' },
    { value: 'meals', label: 'Meals', icon: 'restaurant' },
    { value: 'other', label: 'Other', icon: 'receipt' },
  ];

  // Standard pricing items
  standardPricingItems = [
    { name: 'Collection Service', description: 'Vehicle collection service', price: 50.0 },
    { name: 'Delivery Service', description: 'Vehicle delivery service', price: 50.0 },
    { name: 'Storage (per day)', description: 'Vehicle storage per day', price: 15.0 },
    { name: 'Washing Service', description: 'Vehicle washing service', price: 25.0 },
    { name: 'Express Service', description: 'Same day service premium', price: 75.0 },
    { name: 'Mileage (per mile)', description: 'Additional mileage charge', price: 1.5 },
  ];

  // Status progression
  statusFlow = ['unallocated', 'allocated', 'collection-in-progress', 'collected', 'loaded', 'in-transit', 'delivery-in-progress', 'delivered', 'completed'];

  // Tab selection
  selectedTabIndex = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jobService: JobNewService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.initializePermissions();
    this.loadJob();
    this.loadBillingData();
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
    this.loading = true;
    this.error = null;

    this.route.params
      .pipe(
        switchMap((params) => {
          const jobId = params['id'];
          if (!jobId) {
            throw new Error('Job ID not provided');
          }
          return this.jobService.getJobById(jobId);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (job) => {
          if (job) {
            this.job = job;
          } else {
            this.error = 'Job not found';
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading job:', error);
          this.error = error.message || 'Failed to load job details';
          this.loading = false;
        },
      });
  }

  // Navigation actions
  editJob(): void {
    if (this.job && this.canEditJobs) {
      this.router.navigate(['/jobs', this.job.id, 'edit']);
    }
  }

  goBack(): void {
    this.router.navigate(['/jobs']);
  }

  // Status management
  getStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      unallocated: 'warn',
      allocated: 'accent',
      'collection-in-progress': 'primary',
      collected: 'primary',
      loaded: 'primary',
      'in-transit': 'primary',
      'delivery-in-progress': 'primary',
      delivered: 'primary',
      completed: 'primary',
      cancelled: 'warn',
      aborted: 'warn',
    };
    return statusColors[status] || 'basic';
  }

  getStatusIcon(status: string): string {
    const statusIcons: { [key: string]: string } = {
      unallocated: 'help_outline',
      allocated: 'person',
      'collection-in-progress': 'directions_car',
      collected: 'done',
      loaded: 'inventory',
      'in-transit': 'local_shipping',
      'delivery-in-progress': 'local_shipping',
      delivered: 'done_all',
      completed: 'check_circle',
      cancelled: 'cancel',
      aborted: 'error',
    };
    return statusIcons[status] || 'help_outline';
  }

  getStatusProgress(): number {
    if (!this.job) return 0;

    const currentIndex = this.statusFlow.indexOf(this.job.status);
    if (currentIndex === -1) return 0;

    return ((currentIndex + 1) / this.statusFlow.length) * 100;
  }

  // Address formatting
  getFullAddress(address?: string | null, city?: string | null, postcode?: string | null): string {
    const parts = [address, city, postcode].filter(Boolean);
    return parts.join(', ') || 'Not specified';
  }

  // Contact formatting
  getContactInfo(name?: string | null, phone?: string | null, email?: string | null): string {
    const parts = [];
    if (name) parts.push(name);
    if (phone) parts.push(phone);
    if (email) parts.push(`(${email})`);
    return parts.join(' - ') || 'Not specified';
  }

  // Date formatting
  formatDateTime(timestamp: any): string {
    if (!timestamp) return 'Not scheduled';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'Not set';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  formatTime(timestamp: any): string {
    if (!timestamp) return 'Not set';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Vehicle information
  getVehicleInfo(): string {
    if (!this.job) return '';

    const parts = [];
    if (this.job.vehicleRegistration) parts.push(this.job.vehicleRegistration);
    if (this.job.vehicleMake) parts.push(this.job.vehicleMake);
    if (this.job.vehicleModel) parts.push(this.job.vehicleModel);
    if (this.job.vehicleYear) parts.push(`(${this.job.vehicleYear})`);

    return parts.join(' ') || 'Vehicle details not specified';
  }

  getVehicleSpecs(): { label: string; value: string }[] {
    if (!this.job) return [];

    const specs = [];

    if (this.job.vehicleType) {
      specs.push({ label: 'Type', value: this.job.vehicleType });
    }
    if (this.job.vehicleColor) {
      specs.push({ label: 'Color', value: this.job.vehicleColor });
    }
    if (this.job.vehicleFuelType) {
      specs.push({ label: 'Fuel', value: this.job.vehicleFuelType });
    }
    if (this.job.chassisNumber) {
      specs.push({ label: 'Chassis', value: this.job.chassisNumber });
    }

    return specs;
  }

  // Journey type
  get isStandardJourney(): boolean {
    return !this.job?.isSplitJourney;
  }

  get isSplitJourney(): boolean {
    return this.job?.isSplitJourney || false;
  }

  // Notes handling
  getFormattedNotes(notes: JobNote[] | string | null | undefined): JobNote[] {
    if (!notes) return [];

    if (typeof notes === 'string') {
      return [
        {
          id: `legacy_note_${Date.now()}`,
          authorId: 'system',
          authorName: 'System',
          content: notes,
          createdAt: this.job?.createdAt || Timestamp.now(),
        },
      ];
    }

    if (Array.isArray(notes)) {
      return notes;
    }

    return [];
  }

  // Timeline data
  getJobTimeline(): { status: string; date: any; icon: string; color: string }[] {
    if (!this.job) return [];

    const timeline = [];

    if (this.job.createdAt) {
      timeline.push({
        status: 'Job Created',
        date: this.job.createdAt,
        icon: 'add_task',
        color: 'primary',
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
      // Properly handle Timestamp objects
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

  // Actions
  refreshJob(): void {
    this.loadJob();
  }

  printJob(): void {
    window.print();
  }

  exportJob(): void {
    // TODO: Implement export functionality
    this.showSuccess('Export functionality coming soon');
  }

  // Utility methods
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

  // Tab selection
  onTabChange(index: number): void {
    this.selectedTabIndex = index;

    // Load billing data when billing tab is selected
    if (index === 4 && !this.jobBilling) {
      // Billing is the 5th tab (index 4)
      this.loadBillingData();
    }
  }

  // Billing Data Management
  private loadBillingData(): void {
    if (!this.job) return;

    this.isLoadingBilling = true;

    // TODO: Replace with actual service call to load billing data
    // For now, using mock data
    setTimeout(() => {
      this.jobBilling = {
        basePrice: 100.0,
        additionalItems: [
          {
            id: '1',
            name: 'Collection Service',
            description: 'Vehicle collection from customer location',
            price: 50.0,
            quantity: 1,
            total: 50.0,
          },
        ],
        expenses: [
          {
            id: '1',
            type: 'fuel',
            description: 'Fuel for collection journey',
            amount: 25.5,
            date: Timestamp.now(),
            addedBy: this.currentUser?.id || 'system',
            addedByName: this.currentUser?.name || 'System',
            isApproved: true,
            approvedBy: 'admin',
            approvedAt: Timestamp.now(),
          },
        ],
        subtotal: 150.0,
        vatRate: 0.2,
        vatAmount: 30.0,
        totalAmount: 180.0,
        status: 'draft',
        notes: '',
      };
      this.isLoadingBilling = false;
    }, 1000);
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
      date: Timestamp.now(),
      receiptUrl: this.newExpense.receiptUrl || undefined,
      addedBy: this.currentUser.id,
      addedByName: this.currentUser.name,
      isApproved: false,
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
      receiptUrl: '',
    };

    this.showSuccess('Expense added successfully');
  }

  // Add Pricing Item
  addPricingItem(): void {
    if (!this.job || !this.newPricingItem.name || this.newPricingItem.price <= 0) {
      this.showError('Please fill in all required fields with valid values');
      return;
    }

    const pricingItem: PricingItem = {
      id: `item_${Date.now()}`,
      name: this.newPricingItem.name,
      description: this.newPricingItem.description,
      price: this.newPricingItem.price,
      quantity: this.newPricingItem.quantity || 1,
      total: this.newPricingItem.price * (this.newPricingItem.quantity || 1),
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

    this.showSuccess('Pricing item added successfully');
  }

  // Add Standard Pricing Item
  addStandardPricingItem(standardItem: any): void {
    this.newPricingItem = {
      name: standardItem.name,
      description: standardItem.description,
      price: standardItem.price,
      quantity: 1,
    };
    this.addPricingItem();
  }

  // Remove Expense
  removeExpense(expenseId: string): void {
    if (!this.jobBilling) return;

    this.jobBilling.expenses = this.jobBilling.expenses.filter((exp) => exp.id !== expenseId);
    this.calculateTotals();
    this.saveBillingData();
    this.showSuccess('Expense removed');
  }

  // Remove Pricing Item
  removePricingItem(itemId: string): void {
    if (!this.jobBilling) return;

    this.jobBilling.additionalItems = this.jobBilling.additionalItems.filter((item) => item.id !== itemId);
    this.calculateTotals();
    this.saveBillingData();
    this.showSuccess('Pricing item removed');
  }

  // Update Base Price
  updateBasePrice(): void {
    if (!this.jobBilling) {
      this.initializeDefaultBilling();
    }
    this.calculateTotals();
    this.saveBillingData();
    this.showSuccess('Base price updated');
  }

  // Calculate Totals
  private calculateTotals(): void {
    if (!this.jobBilling) return;

    // Calculate subtotal
    const additionalItemsTotal = this.jobBilling.additionalItems.reduce((sum, item) => sum + item.total, 0);
    this.jobBilling.subtotal = this.jobBilling.basePrice + additionalItemsTotal;

    // Calculate VAT
    this.jobBilling.vatAmount = this.jobBilling.subtotal * this.jobBilling.vatRate;

    // Calculate total
    this.jobBilling.totalAmount = this.jobBilling.subtotal + this.jobBilling.vatAmount;
  }

  // Initialize Default Billing
  private initializeDefaultBilling(): void {
    this.jobBilling = {
      basePrice: 100.0,
      additionalItems: [],
      expenses: [],
      subtotal: 100.0,
      vatRate: 0.2,
      vatAmount: 20.0,
      totalAmount: 120.0,
      status: 'draft',
    };
  }

  // Save Billing Data
  private saveBillingData(): void {
    if (!this.job || !this.jobBilling) return;

    // TODO: Implement actual save to database
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
      this.saveBillingData();
      this.showSuccess('Expense approved');
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
      this.jobBilling.dueDate = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)); // 30 days from now
      this.saveBillingData();
    }

    this.createPDFInvoice();
  }

  // Create PDF Invoice
  private createPDFInvoice(): void {
    // Create invoice HTML content
    const invoiceHTML = this.generateInvoiceHTML();

    // Open in new window for printing/saving
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      printWindow.focus();

      // Auto-trigger print dialog
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
            .billing-section { margin: 30px 0; }
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
            @media print {
                body { margin: 0; }
                .no-print { display: none; }
            }
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
            <div><strong>Service Type:</strong> ${this.job.isSplitJourney ? 'Split Journey' : 'Standard Delivery'}</div>
            <div><strong>Collection:</strong> ${this.job.collectionAddress}, ${this.job.collectionCity}</div>
            <div><strong>Delivery:</strong> ${this.job.deliveryAddress}, ${this.job.deliveryCity}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th class="amount">Unit Price</th>
                    <th class="amount">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Base Service Fee</strong><br><small>Vehicle logistics service</small></td>
                    <td>1</td>
                    <td class="amount">£${this.jobBilling.basePrice.toFixed(2)}</td>
                    <td class="amount">£${this.jobBilling.basePrice.toFixed(2)}</td>
                </tr>
                ${this.jobBilling.additionalItems
                  .map(
                    (item) => `
                <tr>
                    <td><strong>${item.name}</strong><br><small>${item.description}</small></td>
                    <td>${item.quantity}</td>
                    <td class="amount">£${item.price.toFixed(2)}</td>
                    <td class="amount">£${item.total.toFixed(2)}</td>
                </tr>
                `
                  )
                  .join('')}
            </tbody>
        </table>

        ${
          this.jobBilling.expenses.length > 0
            ? `
        <div class="section-title">Expenses:</div>
        <table>
            <thead>
                <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Date</th>
                    <th class="amount">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${this.jobBilling.expenses
                  .filter((exp) => exp.isApproved)
                  .map(
                    (expense) => `
                <tr>
                    <td>${expense.type.charAt(0).toUpperCase() + expense.type.slice(1)}</td>
                    <td>${expense.description}</td>
                    <td>${expense.date.toDate().toLocaleDateString('en-GB')}</td>
                    <td class="amount">£${expense.amount.toFixed(2)}</td>
                </tr>
                `
                  )
                  .join('')}
            </tbody>
        </table>
        `
            : ''
        }

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

  // Get Expense Type Label
  getExpenseTypeLabel(type: string): string {
    const expenseType = this.expenseTypes.find((et) => et.value === type);
    return expenseType?.label || type;
  }

  // Get Expense Type Icon
  getExpenseTypeIcon(type: string): string {
    const expenseType = this.expenseTypes.find((et) => et.value === type);
    return expenseType?.icon || 'receipt';
  }

  // Get Total Approved Expenses
  getTotalApprovedExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => exp.isApproved).reduce((sum, exp) => sum + exp.amount, 0);
  }

  // Get Total Pending Expenses
  getTotalPendingExpenses(): number {
    if (!this.jobBilling) return 0;
    return this.jobBilling.expenses.filter((exp) => !exp.isApproved).reduce((sum, exp) => sum + exp.amount, 0);
  }
}
