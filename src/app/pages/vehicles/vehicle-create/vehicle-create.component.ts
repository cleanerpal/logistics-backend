import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { VehicleType } from '../../../shared/models/vehicle-type.enum';

interface Manufacturer {
  id: string;
  name: string;
}

@Component({
  selector: 'app-vehicle-create',
  templateUrl: './vehicle-create.component.html',
  styleUrls: ['./vehicle-create.component.scss'],
})
export class VehicleCreateComponent implements OnInit {
  vehicleForm!: FormGroup;
  currentYear = new Date().getFullYear();
  images: string[] = [];
  isSubmitting = false;
  previousSelections: any[] = [];

  // Mock data - should come from a service
  manufacturers: Manufacturer[] = [
    { id: '1', name: 'Toyota' },
    { id: '2', name: 'Honda' },
    { id: '3', name: 'Ford' },
    { id: '4', name: 'Mercedes' },
    { id: '5', name: 'BMW' },
  ];

  vehicleTypes = Object.values(VehicleType);

  loadingRequirements = [
    'Clear overhead clearance required',
    'Minimum ramp angle required',
    'Special lifting equipment needed',
    'Extra securing points required',
    'Climate-controlled transport required',
  ];

  transportRestrictions = [
    'No stacking',
    'No outdoor storage',
    'Temperature sensitive',
    'Humidity sensitive',
    'Special route requirements',
  ];

  requiredEquipment = [
    'Wheel straps',
    'Soft tie-downs',
    'Wheel chocks',
    'Loading ramps',
    'Lift gate',
    'Enclosed trailer',
  ];

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.initializeForm();
    this.loadPreviousVehicleData();
  }

  ngOnInit(): void {
    // Additional initialization if needed
  }

  private initializeForm(): void {
    this.vehicleForm = this.formBuilder.group({
      manufacturerId: ['', Validators.required],
      name: ['', Validators.required],
      type: [VehicleType.CAR, Validators.required],
      yearStart: [
        this.currentYear,
        [
          Validators.required,
          Validators.min(1990),
          Validators.max(this.currentYear),
        ],
      ],
      yearEnd: [null, [Validators.min(1990), Validators.max(this.currentYear)]],
      // Dimensions
      length: ['', [Validators.required, Validators.min(0)]],
      width: ['', [Validators.required, Validators.min(0)]],
      height: ['', [Validators.required, Validators.min(0)]],
      wheelbase: ['', [Validators.required, Validators.min(0)]],
      // Weight
      emptyWeight: ['', [Validators.required, Validators.min(0)]],
      maxLoad: ['', [Validators.required, Validators.min(0)]],
      // Requirements
      loadingRequirements: [[]],
      transportRestrictions: [[]],
      requiredEquipment: [[]],
    });

    // Add year validation
    this.vehicleForm.get('yearEnd')?.valueChanges.subscribe((endYear) => {
      const startYear = this.vehicleForm.get('yearStart')?.value;
      if (endYear && startYear && endYear < startYear) {
        this.vehicleForm.get('yearEnd')?.setErrors({ invalidRange: true });
      }
    });
  }

  private loadPreviousVehicleData(): void {
    // In a real app, this would be loaded from a service
    // For now, using mock data
    this.previousSelections = [
      {
        manufacturerId: '1',
        name: 'Corolla',
        type: VehicleType.CAR,
        yearStart: 2020,
        length: 185,
        width: 71,
        height: 56,
        wheelbase: 106,
        emptyWeight: 2800,
        maxLoad: 900,
      },
      {
        manufacturerId: '3',
        name: 'Transit',
        type: VehicleType.VAN,
        yearStart: 2019,
        length: 220,
        width: 81,
        height: 82,
        wheelbase: 148,
        emptyWeight: 5200,
        maxLoad: 2200,
      },
    ];
  }

  applyPreviousData(data: any): void {
    // Update form with previously used data
    this.vehicleForm.patchValue(data);
  }

  addImage(): void {
    // In a real application, this would open a file picker or image upload dialog
    // For now, we'll add a mock image URL
    const mockImageUrl = `/assets/images/vehicle-${this.images.length + 1}.jpg`;
    this.images.push(mockImageUrl);
  }

  removeImage(index: number): void {
    this.images.splice(index, 1);
  }

  async save(): Promise<void> {
    if (this.vehicleForm.invalid || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;

    try {
      const formValue = this.vehicleForm.value;
      const vehicleData = {
        ...formValue,
        images: this.images,
        dimensions: {
          length: formValue.length,
          width: formValue.width,
          height: formValue.height,
          wheelbase: formValue.wheelbase,
        },
        weight: {
          empty: formValue.emptyWeight,
          maxLoad: formValue.maxLoad,
        },
      };

      // TODO: Replace with actual API call
      console.log('Saving vehicle:', vehicleData);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this.showSuccessMessage('Vehicle created successfully');
      this.router.navigate(['/vehicles']);
    } catch (error) {
      this.showErrorMessage('Failed to create vehicle. Please try again.');
    } finally {
      this.isSubmitting = false;
    }
  }

  cancel(): void {
    // Show confirmation dialog if form is dirty
    if (this.vehicleForm.dirty || this.images.length > 0) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        width: '400px',
        data: {
          title: 'Discard Changes',
          message: 'Are you sure you want to discard your changes?',
          confirmText: 'Discard',
          cancelText: 'Continue Editing',
        },
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          this.navigateBack();
        }
      });
    } else {
      this.navigateBack();
    }
  }

  private navigateBack(): void {
    this.router.navigate(['/vehicles']);
  }

  // Form Validation Helpers
  hasError(controlName: string, errorName: string): boolean {
    return this.vehicleForm.get(controlName)?.hasError(errorName) ?? false;
  }

  isFieldInvalid(controlName: string): boolean {
    const control = this.vehicleForm.get(controlName);
    return control
      ? control.invalid && (control.dirty || control.touched)
      : false;
  }

  private showSuccessMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['success-snackbar'],
    });
  }

  private showErrorMessage(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['error-snackbar'],
    });
  }
}
