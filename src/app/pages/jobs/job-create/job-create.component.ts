import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, Subscription, forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { JobService } from '../../../services/job.service';
import { AuthService } from '../../../services/auth.service';
import { VehicleService, VehicleMake, VehicleModel } from '../../../services/vehicle.service';
import { CustomerService } from '../../../services/customer.service';
import { Customer } from '../../../interfaces/customer.interface';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';

@Component({
  selector: 'app-job-create',
  templateUrl: './job-create.component.html',
  styleUrls: ['./job-create.component.scss'],
  standalone: false,
})
export class JobCreateComponent implements OnInit, OnDestroy {
  jobForm!: FormGroup;
  isSubmitting = false;
  isLoading = true;

  // Reference data
  customers: Customer[] = [];
  vehicleMakes: VehicleMake[] = [];
  availableModels: VehicleModel[] = [];
  allModels: VehicleModel[] = [];
  vehicleTypes: string[] = [];

  // Previous selections for easy re-use
  previousSelections: any[] = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private jobService: JobService,
    private authService: AuthService,
    private vehicleService: VehicleService,
    private customerService: CustomerService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.createForm();
  }

  ngOnInit() {
    // Load reference data
    this.loadReferenceData();

    // Set up form listeners
    this.setupFormListeners();

    // Check for access permissions
    this.checkPermissions();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  createForm() {
    this.jobForm = this.fb.group({
      // Customer Information
      customerId: ['', Validators.required],

      // Vehicle Information
      vehicleMake: ['', Validators.required],
      vehicleModel: ['', Validators.required],
      vehicleType: ['', Validators.required],
      registration: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]+$/)]],
      chassisNumber: ['', Validators.pattern(/^[A-Z0-9]+$/)],
      color: [''],
      year: [''],

      // Primary Collection Details
      collectionAddress: ['', Validators.required],
      collectionCity: [''],
      collectionPostcode: [''],
      collectionContactName: [''],
      collectionContactPhone: [''],
      collectionNotes: [''],

      // Final Delivery Details
      deliveryAddress: ['', Validators.required],
      deliveryCity: [''],
      deliveryPostcode: [''],
      deliveryContactName: [''],
      deliveryContactPhone: [''],
      deliveryNotes: [''],

      // Job Settings
      isSplitJourney: [false],

      // Secondary Collection Details
      secondaryCollectionAddress: [''],
      secondaryCollectionCity: [''],
      secondaryCollectionPostcode: [''],
      secondaryCollectionContactName: [''],
      secondaryCollectionContactPhone: [''],
      secondaryCollectionNotes: [''],

      // Secondary Delivery Details
      secondaryDeliveryAddress: [''],
      secondaryDeliveryCity: [''],
      secondaryDeliveryPostcode: [''],
      secondaryDeliveryContactName: [''],
      secondaryDeliveryContactPhone: [''],
      secondaryDeliveryNotes: [''],

      // General notes
      notes: [''],
    });
  }

  private loadReferenceData() {
    this.isLoading = true;

    // Load all reference data in parallel
    const referenceDataSub = forkJoin({
      customers: this.customerService.getCustomers(),
      makes: this.vehicleService.getVehicleMakes(),
      models: this.vehicleService.getVehicleModels(),
      types: this.vehicleService.getVehicleTypes(),
    }).subscribe({
      next: (data) => {
        this.customers = data.customers;
        this.vehicleMakes = data.makes;
        this.allModels = data.models;
        this.vehicleTypes = data.types;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading reference data:', error);
        this.showSnackbar('Error loading data. Please try again.');
        this.isLoading = false;
      },
    });

    this.subscriptions.push(referenceDataSub);

    // Load previous vehicle selections
    this.loadPreviousVehicleSelections();
  }

  private checkPermissions() {
    const permissionSub = this.authService.hasPermission('canCreateJobs').subscribe((hasPermission) => {
      if (!hasPermission) {
        this.showSnackbar('You do not have permission to create jobs');
        this.router.navigate(['/jobs']);
      }
    });

    this.subscriptions.push(permissionSub);
  }

  private setupFormListeners() {
    // Listen to make changes to update models
    const makeSub = this.jobForm.get('vehicleMake')?.valueChanges.subscribe((makeId) => {
      this.updateAvailableModels(makeId);
    });

    if (makeSub) this.subscriptions.push(makeSub);

    // Listen to model changes to update vehicle type
    const modelSub = this.jobForm.get('vehicleModel')?.valueChanges.subscribe((modelId) => {
      this.updateVehicleType(modelId);
    });

    if (modelSub) this.subscriptions.push(modelSub);

    // Listen to split journey toggle to update validation
    const splitJourneySub = this.jobForm.get('isSplitJourney')?.valueChanges.subscribe((isSplit) => {
      this.updateSplitJourneyValidation(isSplit);
    });

    if (splitJourneySub) this.subscriptions.push(splitJourneySub);
  }

  private updateSplitJourneyValidation(isSplit: boolean) {
    // Get the form controls for secondary addresses
    const secondaryCollectionAddress = this.jobForm.get('secondaryCollectionAddress');
    const secondaryDeliveryAddress = this.jobForm.get('secondaryDeliveryAddress');

    if (isSplit) {
      // If it's a split journey, make secondary addresses required
      secondaryCollectionAddress?.setValidators([Validators.required]);
      secondaryDeliveryAddress?.setValidators([Validators.required]);
    } else {
      // Otherwise, remove validators
      secondaryCollectionAddress?.clearValidators();
      secondaryDeliveryAddress?.clearValidators();

      // Reset secondary address values
      secondaryCollectionAddress?.setValue('');
      secondaryDeliveryAddress?.setValue('');
      this.jobForm.get('secondaryCollectionCity')?.setValue('');
      this.jobForm.get('secondaryCollectionPostcode')?.setValue('');
      this.jobForm.get('secondaryCollectionContactName')?.setValue('');
      this.jobForm.get('secondaryCollectionContactPhone')?.setValue('');
      this.jobForm.get('secondaryCollectionNotes')?.setValue('');
      this.jobForm.get('secondaryDeliveryCity')?.setValue('');
      this.jobForm.get('secondaryDeliveryPostcode')?.setValue('');
      this.jobForm.get('secondaryDeliveryContactName')?.setValue('');
      this.jobForm.get('secondaryDeliveryContactPhone')?.setValue('');
      this.jobForm.get('secondaryDeliveryNotes')?.setValue('');
    }

    // Update validation status
    secondaryCollectionAddress?.updateValueAndValidity();
    secondaryDeliveryAddress?.updateValueAndValidity();
  }

  private updateAvailableModels(makeId: string) {
    if (!makeId) {
      this.availableModels = [];
      return;
    }

    // If we already loaded all models, filter them locally for faster performance
    this.availableModels = this.allModels.filter((model) => model.makeId === makeId && model.isActive);

    // Reset model selection
    this.jobForm.get('vehicleModel')?.setValue('');
    this.jobForm.get('vehicleType')?.setValue('');
  }

  private updateVehicleType(modelId: string) {
    if (!modelId) {
      return;
    }

    const selectedModel = this.allModels.find((model) => model.id === modelId);

    if (selectedModel) {
      this.jobForm.get('vehicleType')?.setValue(selectedModel.type);
    }
  }

  private loadPreviousVehicleSelections() {
    // Retrieve previous selections from localStorage
    const savedSelections = localStorage.getItem('previousVehicleSelections');

    if (savedSelections) {
      try {
        this.previousSelections = JSON.parse(savedSelections);
      } catch (e) {
        console.error('Error parsing saved vehicle selections:', e);
        this.previousSelections = [];
      }
    }
  }

  getMakeDisplayName(makeId: string): string {
    const make = this.vehicleMakes.find((m) => m.id === makeId);
    return make ? make.displayName : '';
  }

  /**
   * Auto-populate customer address information when a customer is selected
   */
  onCustomerSelected(event: Event) {
    const select = event.target as HTMLSelectElement;
    const customerId = select?.value;

    if (!customerId) return;

    const selectedCustomer = this.customers.find((c) => c.id === customerId);

    if (selectedCustomer && selectedCustomer.address) {
      // Auto-populate the collection address with customer info
      this.jobForm.patchValue({
        collectionAddress: selectedCustomer.address || '',
        collectionCity: selectedCustomer.city || '',
        collectionPostcode: selectedCustomer.postcode || '',
        collectionContactName: selectedCustomer.name || '',
        collectionContactPhone: selectedCustomer.phone || '',
      });
    }
  }

  /**
   * Apply previously used vehicle details
   */
  applyPreviousSelection(selection: any) {
    this.jobForm.patchValue({
      vehicleMake: selection.makeId,
      vehicleModel: selection.modelId,
      registration: selection.registration,
      chassisNumber: selection.chassisNumber || '',
      color: selection.color || '',
      year: selection.year || '',
    });

    // Make sure models list is updated
    this.updateAvailableModels(selection.makeId);

    // Delay setting the model to ensure the models list is populated
    setTimeout(() => {
      this.jobForm.patchValue({
        vehicleModel: selection.modelId,
      });
    }, 100);
  }

  /**
   * Toggle split journey mode
   */
  toggleSplitJourney() {
    const currentValue = this.jobForm.get('isSplitJourney')?.value;
    this.jobForm.get('isSplitJourney')?.setValue(!currentValue);

    // If turning on split journey, show a dialog with information
    if (!currentValue) {
      this.showSplitJourneyInfo();
    }
  }

  /**
   * Show information dialog about split journey
   */
  showSplitJourneyInfo() {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Split Journey',
        message: 'You have enabled split journey mode. This allows you to specify additional collection and delivery points. Please fill in all required address fields.',
        confirmText: 'Got it',
        cancelText: 'Disable Split Journey',
        icon: 'call_split',
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result === false) {
        this.jobForm.get('isSplitJourney')?.setValue(false);
      }
    });
  }

  onCancel() {
    this.router.navigate(['/jobs']);
  }

  /**
   * Submit method for JobCreateComponent
   * This ensures vehicle details are properly saved when creating a job
   */
  onSubmit() {
    if (this.jobForm.invalid) {
      this.markFormGroupTouched(this.jobForm);
      this.showSnackbar('Please complete all required fields');
      return;
    }

    this.isSubmitting = true;

    const formValue = this.jobForm.value;

    // Get make and model details
    const selectedMake = this.vehicleMakes.find((m) => m.id === formValue.vehicleMake);
    const selectedModel = this.availableModels.find((m) => m.id === formValue.vehicleModel);

    // Customer info
    const selectedCustomer = this.customers.find((c) => c.id === formValue.customerId);

    // Prepare job data matching the Job interface
    const jobData = {
      // Vehicle information with IDs
      makeId: formValue.vehicleMake,
      modelId: formValue.vehicleModel,
      make: selectedMake?.displayName || '',
      model: selectedModel?.name || '',
      registration: formValue.registration.toUpperCase().replace(/\s+/g, ''),

      // Customer info
      customerId: formValue.customerId,
      customerName: selectedCustomer?.name || '',
      customerContact: selectedCustomer?.name || '',
      customerContactPhone: selectedCustomer?.phone || '',

      // Primary Collection
      collectionAddress: formValue.collectionAddress,
      collectionCity: formValue.collectionCity,
      collectionPostcode: formValue.collectionPostcode,
      collectionContactName: formValue.collectionContactName,
      collectionContactPhone: formValue.collectionContactPhone,
      collectionNotes: formValue.collectionNotes,

      // Final Delivery
      deliveryAddress: formValue.deliveryAddress,
      deliveryCity: formValue.deliveryCity,
      deliveryPostcode: formValue.deliveryPostcode,
      deliveryContactName: formValue.deliveryContactName,
      deliveryContactPhone: formValue.deliveryContactPhone,
      deliveryNotes: formValue.deliveryNotes,

      // Vehicle details
      color: formValue.color,
      year: formValue.year,
      chassisNumber: formValue.chassisNumber ? formValue.chassisNumber.toUpperCase() : '',
      vehicleType: formValue.vehicleType,

      // Split journey flag
      isSplitJourney: formValue.isSplitJourney,

      // Only include secondary addresses if this is a split journey
      ...(formValue.isSplitJourney && {
        // Secondary Collection
        secondaryCollectionAddress: formValue.secondaryCollectionAddress,
        secondaryCollectionCity: formValue.secondaryCollectionCity,
        secondaryCollectionPostcode: formValue.secondaryCollectionPostcode,
        secondaryCollectionContactName: formValue.secondaryCollectionContactName,
        secondaryCollectionContactPhone: formValue.secondaryCollectionContactPhone,
        secondaryCollectionNotes: formValue.secondaryCollectionNotes,

        // Secondary Delivery
        secondaryDeliveryAddress: formValue.secondaryDeliveryAddress,
        secondaryDeliveryCity: formValue.secondaryDeliveryCity,
        secondaryDeliveryPostcode: formValue.secondaryDeliveryPostcode,
        secondaryDeliveryContactName: formValue.secondaryDeliveryContactName,
        secondaryDeliveryContactPhone: formValue.secondaryDeliveryContactPhone,
        secondaryDeliveryNotes: formValue.secondaryDeliveryNotes,
      }),

      // Notes
      notes: formValue.notes,
    };

    // Save the vehicle selection for future use
    this.saveToRecentSelections();

    // Create the job which will also save vehicle data
    this.jobService
      .createJob(jobData)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: (jobId) => {
          this.showSnackbar('Job created successfully');
          this.router.navigate(['/jobs', jobId]);
        },
        error: (error) => {
          console.error('Error creating job:', error);
          this.showSnackbar(`Error creating job: ${error.message}`);
        },
      });
  }

  /**
   * Save current vehicle information to previous selections
   */
  saveToRecentSelections() {
    const formValue = this.jobForm.value;

    // Only save if we have the minimum required information
    if (!formValue.vehicleMake || !formValue.vehicleModel || !formValue.registration) {
      return;
    }

    const selectedMake = this.vehicleMakes.find((m) => m.id === formValue.vehicleMake);
    const selectedModel = this.availableModels.find((m) => m.id === formValue.vehicleModel);

    if (!selectedMake || !selectedModel) {
      return;
    }

    const vehicleSelection = {
      makeId: formValue.vehicleMake,
      makeName: selectedMake.displayName,
      modelId: formValue.vehicleModel,
      modelName: selectedModel.name,
      registration: formValue.registration,
      chassisNumber: formValue.chassisNumber || '',
      color: formValue.color || '',
      year: formValue.year || '',
      timestamp: new Date().toISOString(),
    };

    // Get existing selections
    let selections = [];
    try {
      const savedData = localStorage.getItem('previousVehicleSelections');
      selections = savedData ? JSON.parse(savedData) : [];
    } catch (e) {
      console.error('Error retrieving previous vehicle selections:', e);
      selections = [];
    }

    // Check if this registration already exists
    const existingIndex = selections.findIndex((s: { registration: string }) => s.registration.toLowerCase() === vehicleSelection.registration.toLowerCase());

    if (existingIndex >= 0) {
      // Update existing entry
      selections[existingIndex] = vehicleSelection;
    } else {
      // Add new entry
      selections.unshift(vehicleSelection);

      // Keep max 10 entries
      if (selections.length > 10) {
        selections = selections.slice(0, 10);
      }
    }

    // Save back to localStorage
    localStorage.setItem('previousVehicleSelections', JSON.stringify(selections));

    // Update the component state
    this.previousSelections = selections;
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

    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return 'This field is required';
    }

    if (control.errors['pattern']) {
      if (controlName === 'registration' || controlName === 'chassisNumber') {
        return 'Must be uppercase with no spaces';
      }
      return 'Invalid format';
    }

    return 'Invalid value';
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
