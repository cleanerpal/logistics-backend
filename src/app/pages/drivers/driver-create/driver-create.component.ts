import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DriverService, Driver } from '../../../services/driver.service';
import { Subscription } from 'rxjs';
import { CompanyService } from '../../../services/company.service';

interface Company {
  id: string;
  name: string;
}

@Component({
    selector: 'app-driver-create',
    templateUrl: './driver-create.component.html',
    styleUrls: ['./driver-create.component.scss'],
    standalone: false
})
export class DriverCreateComponent implements OnInit, OnDestroy {
  driverForm: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  driverId: string | null = null;
  driver: Driver | null = null;
  companies: Company[] = [];

  // Dropdown options
  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  licenseTypes = ['Class A', 'Class B', 'Class C', 'Class D', 'CDL'];

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private snackBar: MatSnackBar,
    private driverService: DriverService,
    private companyService: CompanyService // Inject company service
  ) {
    this.driverForm = this.createForm();
  }

  ngOnInit(): void {
    this.driverId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.driverId;

    // Load companies from the service (no hardcoded data)
    this.loadCompanies();

    if (this.isEditMode) {
      this.loadDriverData();
    }

    // Subscribe to loading state
    this.subscriptions.push(
      this.driverService.isLoading$.subscribe((loading) => {
        this.isSubmitting = loading;
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private createForm(): FormGroup {
    return this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      driverId: [''],
      company: [''],
      companyName: [''],
      status: ['active', [Validators.required]],
      licenseNumber: [''],
      licenseExpiry: [null],
      licenseType: [''],
      address: [''],
      notes: [''],
    });
  }

  private loadCompanies(): void {
    // Replace with actual service call to fetch companies from Firebase
    this.subscriptions.push(
      this.companyService.getAllCompanies().subscribe({
        next: (companies) => {
          this.companies = companies;
        },
        error: (error) => {
          console.error('Error loading companies:', error);
          this.showSnackBar('Failed to load companies', 'error');
        },
      })
    );
  }

  private loadDriverData(): void {
    if (!this.driverId) return;

    this.subscriptions.push(
      this.driverService.getDriverById(this.driverId).subscribe({
        next: (driver) => {
          this.driver = driver;

          if (this.driver) {
            // Format date if it exists
            let licenseExpiry = null;
            if (this.driver.licenseExpiry) {
              licenseExpiry = this.driver.licenseExpiry.toDate();
            }

            this.driverForm.patchValue({
              firstName: this.driver.firstName,
              lastName: this.driver.lastName,
              email: this.driver.email,
              phone: this.driver.phone,
              driverId: this.driver.driverId,
              company: this.driver.companyId,
              companyName: this.driver.companyName,
              status: this.driver.status,
              licenseNumber: this.driver.licenseNumber,
              licenseExpiry: licenseExpiry,
              licenseType: this.driver.licenseType,
              address: this.driver.address,
              notes: this.driver.notes,
            });

            // Disable email field in edit mode, as changing it requires special Firebase Auth operations
            this.driverForm.get('email')?.disable();
          }
        },
        error: (error) => {
          console.error('Error loading driver:', error);
          this.showSnackBar('Failed to load driver data', 'error');
        },
      })
    );
  }

  onSubmit(): void {
    if (this.driverForm.invalid) {
      this.markFormGroupTouched(this.driverForm);
      return;
    }

    const formData = this.driverForm.getRawValue(); // Get values including disabled fields

    // Prepare driver data
    const driverData: Partial<Driver> = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      driverId: formData.driverId || `DRV-${Date.now().toString().slice(-6)}`,
      companyId: formData.company,
      companyName:
        formData.companyName ||
        this.companies.find((c) => c.id === formData.company)?.name,
      status: formData.status,
      licenseNumber: formData.licenseNumber,
      licenseType: formData.licenseType,
      address: formData.address,
      notes: formData.notes,
      role: 'driver',
    };

    // Add license expiry if provided
    if (formData.licenseExpiry) {
      driverData.licenseExpiry = formData.licenseExpiry;
    }

    if (this.isEditMode && this.driverId) {
      // Update existing driver
      this.subscriptions.push(
        this.driverService.updateDriver(this.driverId, driverData).subscribe({
          next: () => {
            this.showSnackBar('Driver updated successfully', 'success');
            this.router.navigate(['/drivers']);
          },
          error: (error) => {
            console.error('Error updating driver:', error);
            this.showSnackBar('Failed to update driver', 'error');
          },
        })
      );
    } else {
      // Create new driver
      this.subscriptions.push(
        this.driverService.createDriver(driverData).subscribe({
          next: () => {
            this.showSnackBar('Driver created successfully', 'success');
            this.router.navigate(['/drivers']);
          },
          error: (error) => {
            console.error('Error creating driver:', error);
            this.showSnackBar('Failed to create driver', 'error');
          },
        })
      );
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if ((control as any).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }

  private showSnackBar(
    message: string,
    type: 'success' | 'error' | 'info'
  ): void {
    const className = {
      success: 'success-snackbar',
      error: 'error-snackbar',
      info: 'info-snackbar',
    }[type];

    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [className],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  goBack(): void {
    this.location.back();
  }
}
