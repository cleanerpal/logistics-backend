import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import {
  FormBuilder,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { Location } from '@angular/common';

interface Company {
  id: string;
  name: string;
  address: string;
  industry: string;
  size: string;
  status: string;
  driverName: string;
  driverEmail: string;
  driverNumber: string;
  createdAt: Date;
  lastDriver: Date;
}

interface Job {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: Date;
  endDate?: Date;
  value: number;
  description: string;
}

interface CompanyForm {
  name: FormControl<string>;
  industry: FormControl<string>;
  size: FormControl<string>;
  status: FormControl<string>;
  address: FormControl<string>;
  driverName: FormControl<string>;
  driverEmail: FormControl<string>;
  driverNumber: FormControl<string>;
}

@Component({
    selector: 'app-company-details',
    templateUrl: './company-details.component.html',
    styleUrls: ['./company-details.component.scss'],
    standalone: false
})
export class CompanyDetailsComponent implements OnInit {
  companyId: string | null = null;
  company: Company | null = null;
  isLoading = true;
  isEditing = false;
  companyForm: FormGroup<CompanyForm>;

  // Jobs table configuration
  jobsDataSource = new MatTableDataSource<Job>([]);
  displayedColumns: string[] = [
    'id',
    'title',
    'type',
    'status',
    'startDate',
    'endDate',
    'value',
    'actions',
  ];

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // Dropdown options
  industries = [
    'Technology',
    'Manufacturing',
    'Retail',
    'Healthcare',
    'Finance',
    'Education',
    'Construction',
    'Transportation',
    'Energy',
    'Other',
  ];

  companySizes = [
    'Small (1-50)',
    'Medium (51-250)',
    'Large (251-1000)',
    'Enterprise (1000+)',
  ];

  statusOptions = ['Active', 'Inactive', 'Pending'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private fb: FormBuilder
  ) {
    this.companyForm = this.createForm();
  }

  ngOnInit(): void {
    this.companyId = this.route.snapshot.paramMap.get('id');
    if (this.companyId) {
      this.loadCompanyDetails();
      this.loadCompanyJobs();
    }
  }

  ngAfterViewInit(): void {
    this.jobsDataSource.sort = this.sort;
    this.jobsDataSource.paginator = this.paginator;
  }

  private createForm(): FormGroup<CompanyForm> {
    return this.fb.group<CompanyForm>({
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      industry: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      size: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      status: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      address: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      driverName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      driverEmail: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      driverNumber: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.pattern(/^\(\d{3}\)\s\d{3}-\d{4}$/),
        ],
      }),
    });
  }

  private loadCompanyDetails(): void {
    this.isLoading = true;
    // Simulate API call with mock data
    setTimeout(() => {
      this.company = {
        id: this.companyId!,
        name: 'Acme Corporation',
        address: '123 Business Ave, Suite 100\nTech City, TC 12345',
        industry: 'Technology',
        size: 'Enterprise',
        status: 'active',
        driverName: 'John Smith',
        driverEmail: 'john.smith@acme.com',
        driverNumber: '(555) 123-4567',
        createdAt: new Date(2023, 5, 15),
        lastDriver: new Date(2024, 0, 10),
      };
      this.isLoading = false;
    }, 1000);
  }

  private loadCompanyJobs(): void {
    // Simulate API call with mock data
    setTimeout(() => {
      const mockJobs: Job[] = Array(10)
        .fill(null)
        .map((_, index) => ({
          id: `JOB${String(index + 1).padStart(4, '0')}`,
          title: `Project ${index + 1}`,
          type: this.getRandomJobType(),
          status: this.getRandomJobStatus(),
          startDate: new Date(2024, 0, index + 1),
          endDate:
            Math.random() > 0.3 ? new Date(2024, 1, index + 15) : undefined,
          value: Math.floor(Math.random() * 50000) + 10000,
          description: `Description for Project ${index + 1}`,
        }));

      this.jobsDataSource.data = mockJobs;
    }, 1000);
  }

  private getRandomJobType(): string {
    const types = ['Maintenance', 'Installation', 'Repair', 'Consultation'];
    return types[Math.floor(Math.random() * types.length)];
  }

  private getRandomJobStatus(): string {
    const statuses = ['completed', 'in-progress', 'scheduled', 'cancelled'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  editCompany(): void {
    this.isEditing = true;
    if (this.company) {
      this.companyForm.patchValue({
        name: this.company.name,
        industry: this.company.industry,
        size: this.company.size,
        status: this.company.status,
        address: this.company.address,
        driverName: this.company.driverName,
        driverEmail: this.company.driverEmail,
        driverNumber: this.company.driverNumber,
      });
    }
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.companyForm.reset();
  }

  saveCompany(): void {
    if (this.companyForm.valid && this.company) {
      this.isLoading = true;
      // Simulate API call
      setTimeout(() => {
        const formValue = this.companyForm.getRawValue();
        this.company = {
          ...this.company, // This spreads the existing values including id, createdAt, and lastDriver
          name: formValue.name,
          industry: formValue.industry,
          size: formValue.size,
          status: formValue.status,
          address: formValue.address,
          driverName: formValue.driverName,
          driverEmail: formValue.driverEmail,
          driverNumber: formValue.driverNumber,
        } as Company; // Assert the type as Company since we know all required fields are present
        this.isEditing = false;
        this.isLoading = false;
      }, 1000);
    }
  }

  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      completed: 'status-success',
      'in-progress': 'status-warning',
      scheduled: 'status-info',
      cancelled: 'status-error',
      active: 'status-success',
      inactive: 'status-error',
      pending: 'status-warning',
    };
    return statusClasses[status.toLowerCase()] || '';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  goBack(): void {
    this.location.back();
  }

  viewJobDetails(jobId: string): void {
    this.router.navigate(['/jobs', jobId]);
  }
}
