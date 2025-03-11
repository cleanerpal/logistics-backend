import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';

// You would have a proper driver service in your application
// import { DriverService } from '../../../services/driver.service';

interface Company {
  id: string;
  name: string;
}

@Component({
  selector: 'app-driver-create',
  templateUrl: './driver-create.component.html',
  styleUrls: ['./driver-create.component.scss'],
})
export class DriverCreateComponent implements OnInit {
  driverForm: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  driverId: string | null = null;

  // Dropdown options
  driverTypes = [
    { value: 'customer', label: 'Customer' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'partner', label: 'Partner' },
  ];

  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  vehicleTypes = [
    { value: 'Car', label: 'Car' },
    { value: 'Van', label: 'Van' },
    { value: 'Truck', label: 'Truck' },
    { value: 'Lorry', label: 'Lorry' },
    { value: 'Motorbike', label: 'Motorbike' },
  ];

  // Mock companies data - replace with actual service call in real app
  companies: Company[] = [
    { id: '1', name: 'Acme Corporation' },
    { id: '2', name: 'Globex Industries' },
    { id: '3', name: 'Wayne Enterprises' },
    { id: '4', name: 'Stark Industries' },
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private snackBar: MatSnackBar // private driverService: DriverService
  ) {
    this.driverForm = this.createForm();
  }

  ngOnInit(): void {
    this.driverId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.driverId;

    if (this.isEditMode) {
      this.loadDriverData();
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: [
        '',
        [Validators.required, Validators.pattern(/^\(\d{3}\)\s\d{3}-\d{4}$/)],
      ],
      company: ['', [Validators.required]],
      type: ['customer', [Validators.required]],
      status: ['active', [Validators.required]],
      licenseNumber: ['', [Validators.required]],
      licenseExpiry: [null, [Validators.required]],
      notes: [''],
      vehiclePreferences: [[]],
    });
  }

  private loadDriverData(): void {
    // In a real app, this would be an API call
    // this.driverService.getDriver(this.driverId).subscribe(driver => {
    //   this.driverForm.patchValue(driver);
    // });

    // Simulate API call with mock data
    setTimeout(() => {
      const mockDriver = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '(555) 123-4567',
        company: '1',
        type: 'customer',
        status: 'active',
        licenseNumber: 'DL12345678',
        licenseExpiry: new Date('2025-12-31'),
        notes: 'Experienced driver with clean record',
        vehiclePreferences: ['Car', 'Van'],
      };

      this.driverForm.patchValue(mockDriver);
    }, 1000);
  }

  onSubmit(): void {
    if (this.driverForm.invalid) {
      return;
    }

    this.isSubmitting = true;
    const formData = this.driverForm.value;

    if (this.isEditMode) {
      // Update existing driver
      // this.driverService.updateDriver(this.driverId, formData).subscribe(
      //   () => this.handleSuccess('Driver updated successfully'),
      //   error => this.handleError(error)
      // );

      // Simulate API call
      setTimeout(() => {
        console.log('Updating driver:', formData);
        this.handleSuccess('Driver updated successfully');
      }, 1500);
    } else {
      // Create new driver
      // this.driverService.createDriver(formData).subscribe(
      //   () => this.handleSuccess('Driver created successfully'),
      //   error => this.handleError(error)
      // );

      // Simulate API call
      setTimeout(() => {
        console.log('Creating driver:', formData);
        this.handleSuccess('Driver created successfully');
      }, 1500);
    }
  }

  private handleSuccess(message: string): void {
    this.isSubmitting = false;
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['success-snackbar'],
    });
    this.router.navigate(['/drivers']);
  }

  private handleError(error: any): void {
    this.isSubmitting = false;
    console.error('Error saving driver:', error);
    this.snackBar.open('Failed to save driver. Please try again.', 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['error-snackbar'],
    });
  }

  goBack(): void {
    this.location.back();
  }
}
