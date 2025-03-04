// job-create.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

interface Customer {
  id: string;
  name: string;
  company: string;
}

interface VehicleModel {
  name: string;
  type: 'Car' | 'Van' | 'Truck' | 'Motorcycle';
}

interface VehicleMake {
  name: string;
  models: VehicleModel[];
}

interface Driver {
  id: string;
  name: string;
  available: boolean;
}

@Component({
  selector: 'app-job-create',
  templateUrl: './job-create.component.html',
  styleUrls: ['./job-create.component.scss'],
})
export class JobCreateComponent implements OnInit {
  jobForm!: FormGroup;

  // Sample data (replace with API calls)
  customers: Customer[] = [
    { id: '1', name: 'John Smith', company: 'Smith Co' },
    { id: '2', name: 'Jane Doe', company: 'Doe Industries' },
  ];

  vehicleMakes: VehicleMake[] = [
    {
      name: 'Toyota',
      models: [
        { name: 'Corolla', type: 'Car' },
        { name: 'Hilux', type: 'Truck' },
        { name: 'HiAce', type: 'Van' },
      ],
    },
    {
      name: 'Ford',
      models: [
        { name: 'Transit', type: 'Van' },
        { name: 'Ranger', type: 'Truck' },
        { name: 'Focus', type: 'Car' },
        { name: 'Fiesta', type: 'Car' },
      ],
    },
  ];

  drivers: Driver[] = [
    { id: '1', name: 'Mike Johnson', available: true },
    { id: '2', name: 'Sarah Williams', available: true },
  ];

  priorities = ['Low', 'Medium', 'High'];
  availableModels: VehicleModel[] = [];
  vehicleTypes = ['Car', 'Van', 'Truck', 'Motorcycle'];

  constructor(private fb: FormBuilder, private router: Router) {
    this.createForm();
  }

  ngOnInit() {
    // Subscribe to make changes to update models
    this.jobForm.get('vehicleMake')?.valueChanges.subscribe((make) => {
      this.updateModels(make);
    });

    // Subscribe to model changes to update type
    this.jobForm.get('vehicleModel')?.valueChanges.subscribe((modelName) => {
      this.updateVehicleType(modelName);
    });
  }

  createForm() {
    this.jobForm = this.fb.group({
      // Customer Information
      customerId: ['', Validators.required],
      driverPerson: ['', Validators.required],
      driverNumber: [
        '',
        [Validators.required, Validators.pattern('^[0-9+\\-\\s]*$')],
      ],

      // Vehicle Information
      vehicleMake: ['', Validators.required],
      vehicleModel: ['', Validators.required],
      vehicleType: ['', Validators.required],
      registration: [
        '',
        Validators.required,
        Validators.pattern(/^[A-Z0-9]+$/),
      ],
      chassisNumber: [
        '',
        Validators.required,
        Validators.pattern(/^[A-Z0-9]+$/),
      ],

      // Location Details
      collectionAddress: ['', Validators.required],
      deliveryAddress: ['', Validators.required],
      collectionDateTime: ['', Validators.required],

      // Assignment
      driverId: [''],
      priority: ['Medium'],
      notes: [''],
    });
  }

  updateModels(makeName: string) {
    const make = this.vehicleMakes.find((m) => m.name === makeName);
    this.availableModels = make ? make.models : [];
    this.jobForm.patchValue({
      vehicleModel: '',
      vehicleType: '',
    });
  }

  updateVehicleType(modelName: string) {
    const selectedMake = this.vehicleMakes.find(
      (m) => m.name === this.jobForm.get('vehicleMake')?.value
    );
    const selectedModel = selectedMake?.models.find(
      (m) => m.name === modelName
    );

    if (selectedModel) {
      this.jobForm.patchValue({ vehicleType: selectedModel.type });
    }
  }

  onSubmit() {
    if (this.jobForm.valid) {
      console.log(this.jobForm.value);
      // Submit form data to backend
      this.router.navigate(['/jobs']);
    } else {
      this.markFormGroupTouched(this.jobForm);
    }
  }

  onCancel() {
    this.router.navigate(['/jobs']);
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  getErrorMessage(controlName: string): string {
    const control = this.jobForm.get(controlName);
    if (!control || !control.errors || !control.touched) return '';

    const errors = control.errors;
    if (errors['required']) return `This field is required`;
    if (errors['pattern'])
      return `${
        controlName === 'registration' ? 'Registration' : 'Chassis'
      } must be uppercase with no spaces`;

    return '';
  }
}
