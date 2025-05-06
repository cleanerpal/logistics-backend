import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CustomerService } from '../../../services/customer.service';
import { JobService } from '../../../services/job.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Customer, CustomerStatus, CustomerContact } from '../../../interfaces/customer.interface';
import { Job } from '../../../interfaces/job.interface';

@Component({
  selector: 'app-customer-details',
  templateUrl: './customer-details.component.html',
  styleUrls: ['./customer-details.component.scss'],
  standalone: false,
})
export class CustomerDetailsComponent implements OnInit, OnDestroy {
  customerId: string = '';
  customer: Customer | null = null;
  isLoading = true;
  hasEditPermission = false;
  activeTab: 'details' | 'jobs' | 'notes' = 'details';

  // Jobs table
  jobsDataSource = new MatTableDataSource<Job>([]);
  displayedColumns: string[] = ['id', 'status', 'vehicleType', 'registration', 'collection', 'delivery', 'actions'];
  isJobsLoading = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private customerService: CustomerService,
    private jobService: JobService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Get customer ID from route
    const routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.customerId = id;
        this.loadCustomerDetails();
      } else {
        this.router.navigate(['/customers']);
      }
    });
    this.subscriptions.push(routeSub);

    // Check permissions
    const permissionSub = this.authService.hasPermission('canManageUsers').subscribe((hasPermission) => {
      this.hasEditPermission = hasPermission;
    });
    this.subscriptions.push(permissionSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Load customer details
   */
  loadCustomerDetails(): void {
    this.isLoading = true;

    const customerSub = this.customerService.getCustomerById(this.customerId).subscribe({
      next: (customer) => {
        this.customer = customer;
        this.isLoading = false;

        // Load customer jobs
        if (customer) {
          this.loadCustomerJobs();
        }
      },
      error: (error) => {
        console.error('Error loading customer details:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load customer details',
        });
        this.isLoading = false;
        this.router.navigate(['/customers']);
      },
    });

    this.subscriptions.push(customerSub);
  }

  /**
   * Load jobs associated with this customer
   */
  loadCustomerJobs(): void {
    this.isJobsLoading = true;

    const jobsSub = this.jobService.getCustomerJobs(this.customerId).subscribe({
      next: (jobs) => {
        this.jobsDataSource.data = jobs;
        this.isJobsLoading = false;
      },
      error: (error) => {
        console.error(`Error fetching jobs for customer ${this.customerId}:`, error);
        this.isJobsLoading = false;
        this.jobsDataSource.data = [];
      },
    });

    this.subscriptions.push(jobsSub);
  }

  // Add this code to your DriverDetailsComponent class (src/app/pages/drivers/driver-details/driver-details.component.ts)

  /**
   * Get status class for CSS styling
   * This accepts a string status value and returns the appropriate CSS class name
   */
  getStatusClass(status: string | undefined): string {
    if (!status) return 'status-gray';

    switch (status.toLowerCase()) {
      case 'active':
        return 'status-green';
      case 'pending':
        return 'status-orange';
      case 'inactive':
      default:
        return 'status-gray';
    }
  }

  /**
   * Get type class for CSS styling
   * This accepts a string type value and returns the appropriate CSS class name
   */
  getTypeClass(type: string | undefined): string {
    if (!type) return 'type-blue';

    switch (type.toLowerCase()) {
      case 'customer':
        return 'type-blue';
      case 'supplier':
        return 'type-purple';
      case 'partner':
        return 'type-orange';
      default:
        return 'type-blue';
    }
  }

  /**
   * Get role class for CSS styling
   * This accepts a string role value and returns the appropriate CSS class name
   */
  getRoleClass(role: string | undefined): string {
    if (!role) return 'role-driver';

    switch (role.toLowerCase()) {
      case 'admin':
        return 'role-admin';
      case 'manager':
        return 'role-manager';
      case 'dispatcher':
        return 'role-dispatcher';
      case 'driver':
        return 'role-driver';
      case 'user':
      default:
        return 'role-user';
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  /**
   * Get primary contact from contacts array
   */
  getPrimaryContact(): CustomerContact | null {
    if (!this.customer?.contacts || this.customer.contacts.length === 0) {
      return null;
    }

    const primaryContact = this.customer.contacts.find((contact) => contact.isPrimary);
    return primaryContact || this.customer.contacts[0];
  }

  /**
   * Set active tab
   */
  setActiveTab(tab: 'details' | 'jobs' | 'notes'): void {
    this.activeTab = tab;
  }

  /**
   * Navigate to job details
   */
  viewJobDetails(jobId: string): void {
    this.router.navigate(['/jobs', jobId]);
  }

  /**
   * Navigate to edit customer page
   */
  editCustomer(): void {
    this.router.navigate(['/customers', this.customerId, 'edit']);
  }

  /**
   * Delete customer with confirmation
   */
  deleteCustomer(): void {
    if (!this.customer) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Customer',
        message: `Are you sure you want to delete ${this.customer.name}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && this.customer) {
        this.isLoading = true;

        const deleteSub = this.customerService.deleteCustomer(this.customerId).subscribe({
          next: () => {
            this.notificationService.addNotification({
              type: 'success',
              title: 'Customer Deleted',
              message: `${this.customer?.name} has been deleted successfully`,
            });
            this.router.navigate(['/customers']);
          },
          error: (error) => {
            console.error('Error deleting customer:', error);
            this.notificationService.addNotification({
              type: 'error',
              title: 'Error',
              message: `Failed to delete customer: ${error.message}`,
            });
            this.isLoading = false;
          },
        });

        this.subscriptions.push(deleteSub);
      }
    });
  }

  /**
   * Navigate back
   */
  goBack(): void {
    this.location.back();
  }

  /**
   * Get industry icon
   */
  getIndustryIcon(industry: string): string {
    const iconMap: Record<string, string> = {
      Technology: 'computer',
      Manufacturing: 'precision_manufacturing',
      Healthcare: 'medical_services',
      Finance: 'account_balance',
      Retail: 'shopping_cart',
      Education: 'school',
      Construction: 'construction',
      Transportation: 'directions_bus',
      Energy: 'bolt',
      Telecommunications: 'phone_in_talk',
      Agriculture: 'grass',
      Entertainment: 'movie',
      Hospitality: 'hotel',
      Media: 'ondemand_video',
      'Professional Services': 'business_center',
      'Real Estate': 'apartment',
    };

    return iconMap[industry] || 'business';
  }
}
