import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { finalize, map, switchMap } from 'rxjs/operators';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Customer } from '../../../interfaces/customer.interface';
import { Job } from '../../../interfaces/job-new.interface';
import { AuthService } from '../../../services/auth.service';
import { CustomerService } from '../../../services/customer.service';
import { JobNewService } from '../../../services/job-new.service';
import { VehicleMake, VehicleModel, VehicleService } from '../../../services/vehicle.service';

@Component({
  selector: 'app-job-edit',
  templateUrl: './job-edit.component.html',
  styleUrls: ['./job-edit.component.scss'],
  standalone: false,
})
export class JobEditComponent implements OnInit, OnDestroy {
  jobForm!: FormGroup;
  jobId: string = '';
  job: Job | null = null;
  isSubmitting = false;
  isLoading = true;

  customers: Customer[] = [];
  vehicleMakes: VehicleMake[] = [];
  availableModels: VehicleModel[] = [];
  allModels: VehicleModel[] = [];
  vehicleTypes: string[] = [];

  previousSelections: any[] = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private jobService: JobNewService,
    private authService: AuthService,
    private vehicleService: VehicleService,
    private customerService: CustomerService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.createForm();
  }

  ngOnInit() {
    const routeSub = this.route.params.subscribe((params) => {
      this.jobId = params['id'];
      this.loadJobDetails();
    });
    this.subscriptions.push(routeSub);

    this.checkPermissions();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadJobDetails() {
    this.isLoading = true;

    const dataSub = this.jobService
      .getJobById(this.jobId)
      .pipe(
        switchMap((job) => {
          if (!job) {
            return of({ job: null, refData: null });
          }

          this.job = job;

          return forkJoin({
            customers: this.customerService.getCustomers(),
            makes: this.vehicleService.getVehicleMakes(),
            models: this.vehicleService.getVehicleModels(),
            types: this.vehicleService.getVehicleTypes(),
          }).pipe(
            map((refData) => {
              return { job, refData };
            })
          );
        })
      )
      .subscribe({
        next: (result) => {
          if (!result.job) {
            this.showSnackbar('Job not found');
            this.router.navigate(['/jobs']);
            return;
          }

          if (result.refData) {
            this.customers = result.refData.customers;
            this.vehicleMakes = result.refData.makes;
            this.allModels = result.refData.models;
            this.vehicleTypes = result.refData.types;

            this.populateFormWithJobData(result.job);
          }

          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading job details:', error);
          this.showSnackbar('Error loading job details');
          this.isLoading = false;
          this.router.navigate(['/jobs']);
        },
      });

    this.subscriptions.push(dataSub);
    this.loadPreviousVehicleSelections();
  }

  private createForm() {
    this.jobForm = this.fb.group({
      customerId: ['', Validators.required],

      vehicleMake: ['', Validators.required],
      vehicleModel: ['', Validators.required],
      vehicleType: ['', Validators.required],
      registration: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]+$/)]],
      chassisNumber: ['', Validators.pattern(/^[A-Z0-9]+$/)],
      color: [''],
      year: [''],

      collectionAddress: ['', Validators.required],
      collectionCity: [''],
      collectionPostcode: [''],
      collectionContactName: [''],
      collectionContactPhone: [''],
      collectionNotes: [''],

      deliveryAddress: ['', Validators.required],
      deliveryCity: [''],
      deliveryPostcode: [''],
      deliveryContactName: [''],
      deliveryContactPhone: [''],
      deliveryNotes: [''],

      isSplitJourney: [false],

      secondaryCollectionAddress: [''],
      secondaryCollectionCity: [''],
      secondaryCollectionPostcode: [''],
      secondaryCollectionContactName: [''],
      secondaryCollectionContactPhone: [''],
      secondaryCollectionNotes: [''],

      secondaryDeliveryAddress: [''],
      secondaryDeliveryCity: [''],
      secondaryDeliveryPostcode: [''],
      secondaryDeliveryContactName: [''],
      secondaryDeliveryContactPhone: [''],
      secondaryDeliveryNotes: [''],

      notes: [''],
    });

    this.setupFormListeners();
  }

  private setupFormListeners() {
    const makeSub = this.jobForm.get('vehicleMake')?.valueChanges.subscribe((makeId) => {
      this.updateAvailableModels(makeId);
    });

    if (makeSub) this.subscriptions.push(makeSub);

    const modelSub = this.jobForm.get('vehicleModel')?.valueChanges.subscribe((modelId) => {
      this.updateVehicleType(modelId);
    });

    if (modelSub) this.subscriptions.push(modelSub);

    const splitJourneySub = this.jobForm.get('isSplitJourney')?.valueChanges.subscribe((isSplit) => {
      this.updateSplitJourneyValidation(isSplit);
    });

    if (splitJourneySub) this.subscriptions.push(splitJourneySub);
  }

  private updateSplitJourneyValidation(isSplit: boolean) {
    const secondaryCollectionAddress = this.jobForm.get('secondaryCollectionAddress');
    const secondaryDeliveryAddress = this.jobForm.get('secondaryDeliveryAddress');

    if (isSplit) {
      secondaryCollectionAddress?.setValidators([Validators.required]);
      secondaryDeliveryAddress?.setValidators([Validators.required]);
    } else {
      secondaryCollectionAddress?.clearValidators();
      secondaryDeliveryAddress?.clearValidators();

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

    secondaryCollectionAddress?.updateValueAndValidity();
    secondaryDeliveryAddress?.updateValueAndValidity();
  }

  private updateAvailableModels(makeId: string) {
    if (!makeId) {
      this.availableModels = [];
      return;
    }

    this.availableModels = this.allModels.filter((model) => model.makeId === makeId && model.isActive);
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

  private populateFormWithJobData(job: Job) {
    if (!job) return;

    let makeId = '';
    if (job.vehicleMake) {
      const make = this.vehicleMakes.find((m) => m.displayName === job.vehicleMake);
      if (make) {
        makeId = make.id;
      }
    }

    if (makeId) {
      this.updateAvailableModels(makeId);
    }

    let modelId = '';
    if (job.vehicleModel && makeId) {
      setTimeout(() => {
        const model = this.availableModels.find((m) => m.name === job.vehicleModel);
        if (model) {
          modelId = model.id;
        }

        const isSplitJourney = job['isSplitJourney'] || false;

        this.jobForm.patchValue({
          customerId: job['customerId'] || '',
          vehicleMake: makeId,
          vehicleModel: modelId,
          vehicleType: job['vehicleType'] || '',
          registration: job['registration'] || '',
          chassisNumber: job['chassisNumber'] || '',
          color: job.vehicleColor || '',
          year: job.vehicleYear || '',
          collectionAddress: job.collectionAddress || '',
          collectionCity: job['collectionCity'] || '',
          collectionPostcode: job.collectionPostcode || '',
          collectionContactName: job['collectionContactName'] || '',
          collectionContactPhone: job['collectionContactPhone'] || '',
          collectionNotes: job['collectionNotes'] || '',
          deliveryAddress: job.deliveryAddress || '',
          deliveryCity: job['deliveryCity'] || '',
          deliveryPostcode: job.deliveryPostcode || '',
          deliveryContactName: job['deliveryContactName'] || '',
          deliveryContactPhone: job['deliveryContactPhone'] || '',
          deliveryNotes: job['deliveryNotes'] || '',
          isSplitJourney: isSplitJourney,
          secondaryCollectionAddress: job['secondaryCollectionAddress'] || '',
          secondaryCollectionCity: job['secondaryCollectionCity'] || '',
          secondaryCollectionPostcode: job['secondaryCollectionPostcode'] || '',
          secondaryCollectionContactName: job['secondaryCollectionContactName'] || '',
          secondaryCollectionContactPhone: job['secondaryCollectionContactPhone'] || '',
          secondaryCollectionNotes: job['secondaryCollectionNotes'] || '',
          secondaryDeliveryAddress: job['secondaryDeliveryAddress'] || '',
          secondaryDeliveryCity: job['secondaryDeliveryCity'] || '',
          secondaryDeliveryPostcode: job['secondaryDeliveryPostcode'] || '',
          secondaryDeliveryContactName: job['secondaryDeliveryContactName'] || '',
          secondaryDeliveryContactPhone: job['secondaryDeliveryContactPhone'] || '',
          secondaryDeliveryNotes: job['secondaryDeliveryNotes'] || '',
          notes: typeof job['notes'] === 'string' ? job['notes'] : '',
        });

        this.updateSplitJourneyValidation(isSplitJourney);
      }, 100);
    } else {
      const isSplitJourney = job['isSplitJourney'] || false;

      this.jobForm.patchValue({
        customerId: job['customerId'] || '',
        vehicleMake: makeId,
        vehicleType: job['vehicleType'] || '',
        registration: job['registration'] || '',
        chassisNumber: job['chassisNumber'] || '',
        color: job['color'] || '',
        year: job['year'] || '',
        collectionAddress: job.collectionAddress || '',
        collectionCity: job['collectionCity'] || '',
        collectionPostcode: job.collectionPostcode || '',
        collectionContactName: job['collectionContactName'] || '',
        collectionContactPhone: job['collectionContactPhone'] || '',
        collectionNotes: job['collectionNotes'] || '',
        deliveryAddress: job.deliveryAddress || '',
        deliveryCity: job['deliveryCity'] || '',
        deliveryPostcode: job.deliveryPostcode || '',
        deliveryContactName: job['deliveryContactName'] || '',
        deliveryContactPhone: job['deliveryContactPhone'] || '',
        deliveryNotes: job['deliveryNotes'] || '',
        isSplitJourney: isSplitJourney,
        secondaryCollectionAddress: job['secondaryCollectionAddress'] || '',
        secondaryCollectionCity: job['secondaryCollectionCity'] || '',
        secondaryCollectionPostcode: job['secondaryCollectionPostcode'] || '',
        secondaryCollectionContactName: job['secondaryCollectionContactName'] || '',
        secondaryCollectionContactPhone: job['secondaryCollectionContactPhone'] || '',
        secondaryCollectionNotes: job['secondaryCollectionNotes'] || '',
        secondaryDeliveryAddress: job['secondaryDeliveryAddress'] || '',
        secondaryDeliveryCity: job['secondaryDeliveryCity'] || '',
        secondaryDeliveryPostcode: job['secondaryDeliveryPostcode'] || '',
        secondaryDeliveryContactName: job['secondaryDeliveryContactName'] || '',
        secondaryDeliveryContactPhone: job['secondaryDeliveryContactPhone'] || '',
        secondaryDeliveryNotes: job['secondaryDeliveryNotes'] || '',
        notes: typeof job['notes'] === 'string' ? job['notes'] : '',
      });

      this.updateSplitJourneyValidation(isSplitJourney);
    }
  }

  private checkPermissions() {
    const permissionSub = this.authService.hasPermission('canEditJobs').subscribe((hasPermission) => {
      if (!hasPermission) {
        this.showSnackbar('You do not have permission to edit jobs');
        this.router.navigate(['/jobs']);
      }
    });

    this.subscriptions.push(permissionSub);
  }

  private loadPreviousVehicleSelections() {
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

  onCustomerSelected(event: Event) {
    const select = event.target as HTMLSelectElement;
    const customerId = select?.value;

    if (!customerId) return;

    const selectedCustomer = this.customers.find((c) => c.id === customerId);

    if (selectedCustomer && selectedCustomer.address) {
      this.jobForm.patchValue({
        collectionAddress: selectedCustomer.address || '',
        collectionCity: selectedCustomer.city || '',
        collectionPostcode: selectedCustomer.postcode || '',
        collectionContactName: selectedCustomer.name || '',
        collectionContactPhone: selectedCustomer.phone || '',
      });
    }
  }

  applyPreviousSelection(selection: any) {
    this.jobForm.patchValue({
      vehicleMake: selection.makeId,
      vehicleModel: selection.modelId,
      registration: selection.registration,
      chassisNumber: selection.chassisNumber || '',
      color: selection.color || '',
      year: selection.year || '',
    });

    this.updateAvailableModels(selection.makeId);

    setTimeout(() => {
      this.jobForm.patchValue({
        vehicleModel: selection.modelId,
      });
    }, 100);
  }

  toggleSplitJourney() {
    const currentValue = this.jobForm.get('isSplitJourney')?.value;
    this.jobForm.get('isSplitJourney')?.setValue(!currentValue);

    if (!currentValue) {
      this.showSplitJourneyInfo();
    }
  }

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
    if (this.jobForm.dirty) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: {
          title: 'Discard Changes',
          message: 'Are you sure you want to discard your changes?',
          confirmText: 'Discard',
          cancelText: 'Continue Editing',
          confirmColor: 'warn',
        },
        width: '400px',
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          this.router.navigate(['/jobs', this.jobId]);
        }
      });
    } else {
      this.router.navigate(['/jobs', this.jobId]);
    }
  }

  onSubmit() {
    if (this.jobForm.invalid) {
      this.markFormGroupTouched(this.jobForm);
      this.showSnackbar('Please complete all required fields');
      return;
    }

    this.isSubmitting = true;

    const formValue = this.jobForm.value;

    const selectedMake = this.vehicleMakes.find((m) => m.id === formValue.vehicleMake);
    const selectedModel = this.availableModels.find((m) => m.id === formValue.vehicleModel);

    const selectedCustomer = this.customers.find((c) => c.id === formValue.customerId);

    const jobData: Partial<Job> = {
      vehicleId: formValue.chassisNumber || formValue.registration, // Using reg/chassis as vehicle ID
      make: selectedMake?.displayName || '',
      model: selectedModel?.name || '',
      registration: formValue.registration.toUpperCase(),

      customerId: formValue.customerId,
      customerName: selectedCustomer?.name || '',
      customerContact: selectedCustomer?.name || '',
      customerContactPhone: selectedCustomer?.phone || '',

      collectionAddress: formValue.collectionAddress,
      collectionCity: formValue.collectionCity,
      collectionPostcode: formValue.collectionPostcode,
      collectionContactName: formValue.collectionContactName,
      collectionContactPhone: formValue.collectionContactPhone,
      collectionNotes: formValue.collectionNotes,

      deliveryAddress: formValue.deliveryAddress,
      deliveryCity: formValue.deliveryCity,
      deliveryPostcode: formValue.deliveryPostcode,
      deliveryContactName: formValue.deliveryContactName,
      deliveryContactPhone: formValue.deliveryContactPhone,
      deliveryNotes: formValue.deliveryNotes,

      color: formValue.color,
      year: formValue.year,
      chassisNumber: formValue.chassisNumber ? formValue.chassisNumber.toUpperCase() : '',
      vehicleType: formValue.vehicleType,

      isSplitJourney: formValue.isSplitJourney,

      ...(formValue.isSplitJourney && {
        secondaryCollectionAddress: formValue.secondaryCollectionAddress,
        secondaryCollectionCity: formValue.secondaryCollectionCity,
        secondaryCollectionPostcode: formValue.secondaryCollectionPostcode,
        secondaryCollectionContactName: formValue.secondaryCollectionContactName,
        secondaryCollectionContactPhone: formValue.secondaryCollectionContactPhone,
        secondaryCollectionNotes: formValue.secondaryCollectionNotes,

        secondaryDeliveryAddress: formValue.secondaryDeliveryAddress,
        secondaryDeliveryCity: formValue.secondaryDeliveryCity,
        secondaryDeliveryPostcode: formValue.secondaryDeliveryPostcode,
        secondaryDeliveryContactName: formValue.secondaryDeliveryContactName,
        secondaryDeliveryContactPhone: formValue.secondaryDeliveryContactPhone,
        secondaryDeliveryNotes: formValue.secondaryDeliveryNotes,
      }),

      notes: formValue.notes,
    };

    this.saveToRecentSelections();

    this.jobService
      .updateJob(this.jobId, jobData)
      .pipe(finalize(() => (this.isSubmitting = false)))
      .subscribe({
        next: () => {
          this.showSnackbar('Job updated successfully');
          this.router.navigate(['/jobs', this.jobId]);
        },
        error: (error) => {
          console.error('Error updating job:', error);
          this.showSnackbar(`Error updating job: ${error.message}`);
        },
      });
  }

  saveToRecentSelections() {
    const formValue = this.jobForm.value;

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

    let selections = [];
    try {
      const savedData = localStorage.getItem('previousVehicleSelections');
      selections = savedData ? JSON.parse(savedData) : [];
    } catch (e) {
      console.error('Error retrieving previous vehicle selections:', e);
      selections = [];
    }

    const existingIndex = selections.findIndex((s: { registration: string }) => s.registration.toLowerCase() === vehicleSelection.registration.toLowerCase());

    if (existingIndex >= 0) {
      selections[existingIndex] = vehicleSelection;
    } else {
      selections.unshift(vehicleSelection);

      if (selections.length > 10) {
        selections = selections.slice(0, 10);
      }
    }

    localStorage.setItem('previousVehicleSelections', JSON.stringify(selections));

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
