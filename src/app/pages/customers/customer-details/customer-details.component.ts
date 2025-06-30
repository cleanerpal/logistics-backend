import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription } from 'rxjs';
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

    const permissionSub = this.authService.hasPermission('canManageUsers').subscribe((hasPermission) => {
      this.hasEditPermission = hasPermission;
    });
    this.subscriptions.push(permissionSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  loadCustomerDetails(): void {
    this.isLoading = true;

    const customerSub = this.customerService.getCustomerById(this.customerId).subscribe({
      next: (customer) => {
        this.customer = customer;
        this.isLoading = false;

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

  getStatusClass(status: string | undefined): string {
    if (!status) return 'status-gray';

    switch (status.toLowerCase()) {
      case 'active':
        return 'status-active';
      case 'pending':
        return 'status-pending';
      case 'inactive':
      default:
        return 'status-inactive';
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  getPrimaryContact(): CustomerContact | null {
    if (!this.customer?.contacts || this.customer.contacts.length === 0) {
      return null;
    }

    const primaryContact = this.customer.contacts.find((contact) => contact.isPrimary);
    return primaryContact || this.customer.contacts[0];
  }

  setActiveTab(tab: 'details' | 'jobs' | 'notes'): void {
    this.activeTab = tab;
  }

  viewJobDetails(jobId: string): void {
    this.router.navigate(['/jobs', jobId]);
  }

  editCustomer(): void {
    this.router.navigate(['/customers', this.customerId, 'edit']);
  }

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

  goBack(): void {
    this.location.back();
  }

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
