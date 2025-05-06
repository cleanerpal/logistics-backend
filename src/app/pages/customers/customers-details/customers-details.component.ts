import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { CompanyService } from '../../../services/company.service';
import { JobService } from '../../../services/job.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Company, CompanyStatus, CompanyContact } from '../../../interfaces/company.interface';

@Component({
  selector: 'app-company-details',
  templateUrl: './company-details.component.html',
  styleUrls: ['./company-details.component.scss'],
  standalone: false,
})
export class CompanyDetailsComponent implements OnInit, OnDestroy {
  companyId: string = '';
  company: Company | null = null;
  isLoading = true;
  hasEditPermission = false;
  activeTab: 'details' | 'jobs' | 'notes' = 'details';

  // Jobs table
  jobsDataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = ['id', 'title', 'type', 'status', 'startDate', 'endDate', 'value', 'actions'];
  isJobsLoading = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private companyService: CompanyService,
    private jobService: JobService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Get company ID from route
    const routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.companyId = id;
        this.loadCompanyDetails();
      } else {
        this.router.navigate(['/companies']);
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
   * Load company details
   */
  loadCompanyDetails(): void {
    this.isLoading = true;

    const companySub = this.companyService.getCompanyById(this.companyId).subscribe({
      next: (company) => {
        this.company = company;
        this.isLoading = false;

        // Load company jobs
        if (company) {
          this.loadCompanyJobs();
        }
      },
      error: (error) => {
        console.error('Error loading company details:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load company details',
        });
        this.isLoading = false;
        this.router.navigate(['/companies']);
      },
    });

    this.subscriptions.push(companySub);
  }

  /**
   * Load jobs associated with this company
   */
  loadCompanyJobs(): void {
    this.isJobsLoading = true;

    // TODO: Replace with actual job service call when implemented
    // Using mock data for now
    setTimeout(() => {
      const mockJobs = Array(5)
        .fill(null)
        .map((_, index) => ({
          id: `JOB${String(index + 1).padStart(4, '0')}`,
          title: `Job ${index + 1}`,
          type: this.getRandomJobType(),
          status: this.getRandomJobStatus(),
          startDate: new Date(2024, 0, index + 1),
          endDate: Math.random() > 0.3 ? new Date(2024, 1, index + 15) : undefined,
          value: Math.floor(Math.random() * 50000) + 10000,
        }));

      this.jobsDataSource.data = mockJobs;
      this.isJobsLoading = false;
    }, 1000);
  }

  /**
   * Get CSS class for status
   */
  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      [CompanyStatus.ACTIVE]: 'status-active',
      [CompanyStatus.INACTIVE]: 'status-inactive',
      [CompanyStatus.PENDING]: 'status-pending',
      completed: 'status-success',
      'in-progress': 'status-warning',
      scheduled: 'status-info',
      cancelled: 'status-error',
    };
    return statusMap[status] || 'status-default';
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
  getPrimaryContact(): CompanyContact | null {
    if (!this.company?.contacts || this.company.contacts.length === 0) {
      return null;
    }

    const primaryContact = this.company.contacts.find((contact) => contact.isPrimary);
    return primaryContact || this.company.contacts[0];
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
   * Navigate to edit company page
   */
  editCompany(): void {
    this.router.navigate(['/companies', this.companyId, 'edit']);
  }

  /**
   * Delete company with confirmation
   */
  deleteCompany(): void {
    if (!this.company) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Company',
        message: `Are you sure you want to delete ${this.company.name}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && this.company) {
        this.isLoading = true;

        const deleteSub = this.companyService.deleteCompany(this.companyId).subscribe({
          next: () => {
            this.notificationService.addNotification({
              type: 'success',
              title: 'Company Deleted',
              message: `${this.company?.name} has been deleted successfully`,
            });
            this.router.navigate(['/companies']);
          },
          error: (error) => {
            console.error('Error deleting company:', error);
            this.notificationService.addNotification({
              type: 'error',
              title: 'Error',
              message: `Failed to delete company: ${error.message}`,
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

  /**
   * Helper methods for mock data
   */
  private getRandomJobType(): string {
    const types = ['Installation', 'Maintenance', 'Repair', 'Consultation'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private getRandomJobStatus(): string {
    const statuses = ['completed', 'in-progress', 'scheduled', 'cancelled'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }
}
