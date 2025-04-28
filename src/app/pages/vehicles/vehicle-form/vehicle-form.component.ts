import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  Firestore,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  Timestamp,
} from '@angular/fire/firestore';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    RouterModule,
  ],
  templateUrl: './vehicle-form.component.html',
  styleUrls: ['./vehicle-form.component.scss'],
})
export class VehicleFormComponent implements OnInit {
  vehicleForm: FormGroup;
  isEditMode = false;
  vehicleId: string | null = null;
  loading = true;
  saving = false;

  // Vehicle type options
  vehicleTypes = ['Car', 'Van', 'Truck', 'Motorcycle'];

  // Vehicle status options (for edit mode)
  vehicleStatusOptions = [
    'Available',
    'In Use',
    'Maintenance',
    'Out of Service',
  ];

  constructor(
    private formBuilder: FormBuilder,
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    // Initialize vehicle form
    this.vehicleForm = this.formBuilder.group({
      registration: ['', [Validators.required]],
      make: ['', [Validators.required]],
      model: ['', [Validators.required]],
      type: ['', [Validators.required]],
      year: [
        new Date().getFullYear(),
        [
          Validators.required,
          Validators.min(1900),
          Validators.max(new Date().getFullYear() + 1),
        ],
      ],
      location: [''],
      status: ['Available'],
    });
  }

  ngOnInit(): void {
    // Get vehicle ID from route if editing
    this.route.paramMap.subscribe((params) => {
      this.vehicleId = params.get('id');

      if (this.vehicleId) {
        this.isEditMode = true;
        this.loadVehicleData(this.vehicleId);
      } else {
        this.loading = false;
      }
    });
  }

  /**
   * Load vehicle data when in edit mode
   */
  async loadVehicleData(vehicleId: string): Promise<void> {
    try {
      const vehicleRef = doc(this.firestore, 'Vehicles', vehicleId);
      const vehicleSnap = await getDoc(vehicleRef);

      if (vehicleSnap.exists()) {
        const vehicleData = vehicleSnap.data();

        // Set form values from DB
        this.vehicleForm.patchValue({
          registration: vehicleData['registration'] || '',
          make: vehicleData['make'] || '',
          model: vehicleData['model'] || '',
          type: vehicleData['type'] || '',
          year: vehicleData['year'] || new Date().getFullYear(),
          location: vehicleData['location'] || '',
          status: vehicleData['status'] || 'Available',
        });

        this.loading = false;
      } else {
        this.snackBar.open('Vehicle not found.', 'Close', {
          duration: 5000,
        });
        this.router.navigate(['/vehicles']);
      }
    } catch (error) {
      console.error('Error loading vehicle:', error);
      this.snackBar.open('Error loading vehicle data.', 'Close', {
        duration: 5000,
      });
      this.loading = false;
    }
  }

  /**
   * Form submission handler
   */
  async onSubmit(): Promise<void> {
    if (this.vehicleForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.vehicleForm.controls).forEach((key) => {
        const control = this.vehicleForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.saving = true;

    try {
      const formData = this.vehicleForm.value;

      // Create vehicle data object
      const vehicleData = {
        registration: formData.registration,
        make: formData.make,
        model: formData.model,
        type: formData.type,
        year: formData.year,
        location: formData.location,
        status: formData.status,
        updatedAt: Timestamp.now(),
      };

      // Add createdAt for new vehicles
      if (!this.isEditMode) {
        Object.assign(vehicleData, { createdAt: Timestamp.now() });
      }

      if (this.isEditMode && this.vehicleId) {
        // Update existing vehicle
        const vehicleRef = doc(this.firestore, 'Vehicles', this.vehicleId);
        await updateDoc(vehicleRef, vehicleData);

        this.snackBar.open('Vehicle updated successfully', 'Close', {
          duration: 3000,
        });
      } else {
        // Create new vehicle
        const vehiclesCollection = collection(this.firestore, 'Vehicles');
        const docRef = await addDoc(vehiclesCollection, vehicleData);

        this.snackBar.open('Vehicle created successfully', 'Close', {
          duration: 3000,
        });

        // Navigate to edit page for the new vehicle
        this.router.navigate(['/vehicles/edit', docRef.id]);
      }
    } catch (error) {
      console.error('Error saving vehicle:', error);
      this.snackBar.open('Error saving vehicle. Please try again.', 'Close', {
        duration: 5000,
      });
    } finally {
      this.saving = false;
    }
  }

  /**
   * Cancel and navigate back to vehicles list
   */
  onCancel(): void {
    this.router.navigate(['/vehicles']);
  }
}
