import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Location } from '@angular/common';

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  licenseNumber: string;
  licenseExpiry: Date;
  licenseType: string;
  status: 'active' | 'inactive';
  companyId: string;
  companyName: string;
  joiningDate: Date;
  profileImage?: string;
  notes?: string;
  rating?: number;
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

interface DriverFormModel {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  licenseNumber: string;
  licenseExpiry: Date | string;
  licenseType: string;
  status: 'active' | 'inactive';
  companyId: string;
  companyName: string;
  notes: string;
  rating: number;
}

@Component({
    selector: 'app-driver-details',
    templateUrl: './driver-details.component.html',
    styleUrls: ['./driver-details.component.scss'],
    standalone: false
})
export class DriverDetailsComponent implements OnInit {
  driver: Driver | null = null;
  isLoading = true;
  isEditing = false;
  driverId: string | null = null;
  driverForm!: FormGroup<{
    firstName: FormControl<string>;
    lastName: FormControl<string>;
    email: FormControl<string>;
    phone: FormControl<string>;
    address: FormControl<string>;
    licenseNumber: FormControl<string>;
    licenseExpiry: FormControl<Date | string>;
    licenseType: FormControl<string>;
    status: FormControl<'active' | 'inactive'>;
    companyId: FormControl<string>;
    companyName: FormControl<string>;
    notes: FormControl<string>;
    rating: FormControl<number>;
  }>;
  jobs: Job[] = [];

  // License Types
  licenseTypes = ['Class A', 'Class B', 'Class C', 'Class D', 'CDL'];

  // Status Options
  statusOptions = ['active', 'inactive'];

  // Display columns for jobs table
  displayedColumns: string[] = [
    'id',
    'title',
    'status',
    'startDate',
    'endDate',
    'value',
    'actions',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.driverForm = this.createForm();
  }

  ngOnInit() {
    this.driverId = this.route.snapshot.paramMap.get('id');
    this.loadDriverDetails();
    this.loadDriverJobs();
  }

  isExpiringWithin30Days(date: Date): boolean {
    if (!date) return false;

    const expiryDate = new Date(date);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    return expiryDate <= thirtyDaysFromNow && expiryDate >= today;
  }

  private createForm() {
    return this.fb.group({
      firstName: this.fb.control('', {
        validators: Validators.required,
        nonNullable: true,
      }),
      lastName: this.fb.control('', {
        validators: Validators.required,
        nonNullable: true,
      }),
      email: this.fb.control('', {
        validators: [Validators.required, Validators.email],
        nonNullable: true,
      }),
      phone: this.fb.control('', {
        validators: Validators.required,
        nonNullable: true,
      }),
      address: this.fb.control('', {
        validators: Validators.required,
        nonNullable: true,
      }),
      licenseNumber: this.fb.control('', {
        validators: Validators.required,
        nonNullable: true,
      }),
      licenseExpiry: this.fb.control<Date | string>('', {
        validators: Validators.required,
        nonNullable: true,
      }),
      licenseType: this.fb.control('', {
        validators: Validators.required,
        nonNullable: true,
      }),
      status: this.fb.control<'active' | 'inactive'>('active', {
        validators: Validators.required,
        nonNullable: true,
      }),
      companyId: this.fb.control('', { nonNullable: true }),
      companyName: this.fb.control('', { nonNullable: true }),
      notes: this.fb.control('', { nonNullable: true }),
      rating: this.fb.control(0, { nonNullable: true }),
    });
  }

  loadDriverDetails() {
    // Simulate API call with mock data
    setTimeout(() => {
      this.driver = {
        id: this.driverId || 'DRV001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+44 7700 900123',
        address: '123 Driver Street, Belfast, UK',
        licenseNumber: 'DRVLI123456',
        licenseExpiry: new Date('2025-12-31'),
        licenseType: 'Class B',
        status: 'active',
        companyId: 'COMP001',
        companyName: 'ABC Transport Ltd',
        joiningDate: new Date('2022-03-15'),
        profileImage: 'assets/profile-placeholder.jpg',
        notes: 'Experienced driver with excellent customer feedback.',
        rating: 4.8,
      };

      if (this.driver) {
        this.driverForm.patchValue({
          firstName: this.driver.firstName,
          lastName: this.driver.lastName,
          email: this.driver.email,
          phone: this.driver.phone,
          address: this.driver.address,
          licenseNumber: this.driver.licenseNumber,
          licenseExpiry: this.driver.licenseExpiry,
          licenseType: this.driver.licenseType,
          status: this.driver.status,
          companyId: this.driver.companyId,
          companyName: this.driver.companyName,
          notes: this.driver.notes,
          rating: this.driver.rating,
        });
      }

      this.isLoading = false;
    }, 1000);
  }

  loadDriverJobs() {
    // Simulate API call with mock data
    setTimeout(() => {
      this.jobs = Array(5)
        .fill(null)
        .map((_, index) => ({
          id: `JOB${String(index + 1).padStart(4, '0')}`,
          title: `Job ${index + 1}`,
          type: index % 2 === 0 ? 'Delivery' : 'Collection',
          status: ['Completed', 'In Progress', 'Scheduled'][
            Math.floor(Math.random() * 3)
          ],
          startDate: new Date(2024, 0, index + 1),
          endDate: index < 3 ? new Date(2024, 0, index + 5) : undefined,
          value: Math.floor(Math.random() * 1000) + 500,
          description: `Description for Job ${index + 1}`,
        }));
    }, 1000);
  }

  editDriver() {
    this.isEditing = true;
  }

  saveDriver() {
    if (this.driverForm.valid) {
      this.isLoading = true;

      // Simulate API call
      setTimeout(() => {
        const formValue = this.driverForm.value;

        if (this.driver) {
          this.driver = {
            ...this.driver,
            firstName: formValue.firstName ?? '',
            lastName: formValue.lastName ?? '',
            email: formValue.email ?? '',
            phone: formValue.phone ?? '',
            address: formValue.address ?? '',
            licenseNumber: formValue.licenseNumber ?? '',
            licenseExpiry: new Date(formValue.licenseExpiry ?? new Date()),
            licenseType: formValue.licenseType ?? '',
            status: formValue.status ?? 'active',
            companyId: formValue.companyId ?? '',
            companyName: formValue.companyName ?? '',
            notes: formValue.notes ?? '',
            rating: formValue.rating ?? 0,
          };
        }

        this.isEditing = false;
        this.isLoading = false;
        this.showSuccessMessage('Driver updated successfully');
      }, 1000);
    }
  }

  cancelEdit() {
    this.isEditing = false;
    if (this.driver) {
      this.driverForm.patchValue({
        firstName: this.driver.firstName,
        lastName: this.driver.lastName,
        email: this.driver.email,
        phone: this.driver.phone,
        address: this.driver.address,
        licenseNumber: this.driver.licenseNumber,
        licenseExpiry: this.driver.licenseExpiry,
        licenseType: this.driver.licenseType,
        status: this.driver.status,
        companyId: this.driver.companyId,
        companyName: this.driver.companyName,
        notes: this.driver.notes,
        rating: this.driver.rating,
      });
    }
  }

  getStatusClass(status: string): string {
    return status === 'active' ? 'status-active' : 'status-inactive';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(value);
  }

  viewJobDetails(jobId: string) {
    this.router.navigate(['/jobs', jobId]);
  }

  createNewJob() {
    this.router.navigate(['/jobs/new'], {
      queryParams: {
        driverId: this.driverId,
      },
    });
  }

  goBack() {
    this.location.back();
  }

  private showSuccessMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
