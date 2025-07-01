import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';

import { Customer } from '../../../interfaces/customer.interface';
import { Job } from '../../../interfaces/job-new.interface';
import { MakeModel } from '../../../interfaces/make-model.interface';
import { UserProfile } from '../../../interfaces/user-profile.interface';
import { AuthService } from '../../../services/auth.service';
import { CustomerService } from '../../../services/customer.service';
import { JobNewService } from '../../../services/job-new.service';
import { MakeModelService } from '../../../services/make-model.service';

@Component({
  selector: 'app-job-edit',
  templateUrl: './job-edit.component.html',
  styleUrls: ['./job-edit.component.scss'],
  standalone: false,
})
export class JobEditComponent implements OnInit, OnDestroy {
  jobForm!: FormGroup;
  originalJob: Job | null = null;
  loading = true;
  submitting = false;
  currentUser: UserProfile | null = null;

  // Data sources
  customers: Customer[] = [];
  vehicleTypes: string[] = ['Car', 'Van', 'Truck', 'Motorbike', 'Bus', 'Other'];
  makes: MakeModel[] = [];
  models: MakeModel[] = [];
  fuelTypes: string[] = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'Other'];

  // Helper properties
  currentYear = new Date().getFullYear();
  maxYear = this.currentYear + 1;

  // Status options (for authorized users)
  statusOptions = [
    { value: 'unallocated', label: 'Unallocated' },
    { value: 'allocated', label: 'Allocated' },
    { value: 'collection-in-progress', label: 'Collection In Progress' },
    { value: 'collected', label: 'Collected' },
    { value: 'loaded', label: 'Loaded' },
    { value: 'in-transit', label: 'In Transit' },
    { value: 'delivery-in-progress', label: 'Delivery In Progress' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'aborted', label: 'Aborted' },
  ];

  // Form validation flags
  isVehicleFormValid = false;
  isCollectionFormValid = false;
  isDeliveryFormValid = false;

  // Permissions
  canEditStatus = false;
  canEditJobs = false;
  canManageJobs = false;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private jobService: JobNewService,
    private customerService: CustomerService,
    private makeModelService: MakeModelService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.initializePermissions();
    this.loadInitialData();
    this.loadJob();
    this.setupFormValidation();
    this.setupVehicleTypeChange();
    this.setupMakeChange();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializePermissions(): void {
    this.authService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this.canEditJobs = user?.permissions?.canEditJobs || user?.permissions?.isAdmin || false;
        this.canManageJobs = user?.permissions?.canManageUsers || user?.permissions?.isAdmin || false;
        this.canEditStatus = user?.permissions?.canAllocateJobs || user?.permissions?.isAdmin || false;

        if (!this.canEditJobs) {
          this.showError('You do not have permission to edit jobs');
          this.router.navigate(['/jobs']);
        }
      });
  }

  private createForm(): void {
    this.jobForm = this.fb.group({
      // Job basic info
      status: [{ value: '', disabled: !this.canEditStatus }, Validators.required],

      // Vehicle information
      vehicleInfo: this.fb.group({
        vehicleRegistration: ['', [Validators.required, this.registrationValidator]],
        vehicleType: ['', Validators.required],
        vehicleMake: [''],
        vehicleModel: [''],
        vehicleColor: [''],
        vehicleYear: ['', [Validators.min(1900), Validators.max(new Date().getFullYear() + 1)]],
        chassisNumber: [''],
        vehicleFuelType: [''],
      }),

      // Customer information
      customerInfo: this.fb.group({
        customerId: [''],
        customerName: ['', Validators.required],
        customerJobNumber: [''],
        shippingReference: [''],
      }),

      // Collection details
      collectionDetails: this.fb.group({
        collectionAddress: ['', Validators.required],
        collectionCity: ['', Validators.required],
        collectionPostcode: ['', Validators.required],
        collectionContactName: ['', Validators.required],
        collectionContactPhone: ['', [Validators.required, this.phoneValidator]],
        collectionContactEmail: ['', [Validators.email]],
        collectionScheduledTime: [''],
        collectionNotes: [''],
      }),

      // Delivery details
      deliveryDetails: this.fb.group({
        deliveryAddress: ['', Validators.required],
        deliveryCity: ['', Validators.required],
        deliveryPostcode: ['', Validators.required],
        deliveryContactName: ['', Validators.required],
        deliveryContactPhone: ['', [Validators.required, this.phoneValidator]],
        deliveryContactEmail: ['', [Validators.email]],
        deliveryScheduledTime: [''],
        deliveryNotes: [''],
      }),

      // Split journey (optional)
      isSplitJourney: [false],
      secondaryCollectionDetails: this.fb.group({
        secondaryCollectionAddress: [''],
        secondaryCollectionCity: [''],
        secondaryCollectionPostcode: [''],
        secondaryCollectionContactName: [''],
        secondaryCollectionContactPhone: [''],
        secondaryCollectionContactEmail: [''],
        secondaryCollectionScheduledTime: [''],
        secondaryCollectionNotes: [''],
      }),

      // First delivery (for split journey)
      firstDeliveryDetails: this.fb.group({
        firstDeliveryAddress: [''],
        firstDeliveryCity: [''],
        firstDeliveryPostcode: [''],
        firstDeliveryContactName: [''],
        firstDeliveryContactPhone: [''],
        firstDeliveryContactEmail: [''],
        firstDeliveryScheduledTime: [''],
        firstDeliveryNotes: [''],
      }),

      // General notes
      generalNotes: [''],
    });
  }

  private loadJob(): void {
    this.route.params
      .pipe(
        switchMap((params) => {
          const jobId = params['id'];
          if (!jobId) {
            throw new Error('Job ID not provided');
          }
          return this.jobService.getJobById(jobId);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (job) => {
          if (job) {
            this.originalJob = job;
            this.populateForm(job);
            this.loading = false;
          } else {
            this.showError('Job not found');
            this.router.navigate(['/jobs']);
          }
        },
        error: (error) => {
          console.error('Error loading job:', error);
          this.showError('Failed to load job details');
          this.router.navigate(['/jobs']);
        },
      });
  }

  private populateForm(job: Job): void {
    // Convert Firestore timestamps to datetime-local format
    const formatDateTimeLocal = (timestamp: any): string => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toISOString().slice(0, 16);
    };

    // Get formatted notes
    const getNotesString = (notes: any): string => {
      if (!notes) return '';
      if (typeof notes === 'string') return notes;
      if (Array.isArray(notes) && notes.length > 0) {
        return notes.map((note) => note.content).join('\n\n');
      }
      return '';
    };

    this.jobForm.patchValue({
      status: job.status,

      vehicleInfo: {
        vehicleRegistration: job.vehicleRegistration || '',
        vehicleType: job.vehicleType || '',
        vehicleMake: job.vehicleMake || '',
        vehicleModel: job.vehicleModel || '',
        vehicleColor: job.vehicleColor || '',
        vehicleYear: job.vehicleYear || '',
        chassisNumber: job.chassisNumber || '',
        vehicleFuelType: job.vehicleFuelType || '',
      },

      customerInfo: {
        customerId: job.customerId || '',
        customerName: job.customerName || '',
        customerJobNumber: job.customerJobNumber || '',
        shippingReference: job.shippingReference || '',
      },

      collectionDetails: {
        collectionAddress: job.collectionAddress || '',
        collectionCity: job.collectionCity || '',
        collectionPostcode: job.collectionPostcode || '',
        collectionContactName: job.collectionContactName || '',
        collectionContactPhone: job.collectionContactPhone || '',
        collectionContactEmail: job.collectionContactEmail || '',
        collectionScheduledTime: formatDateTimeLocal(job.collectionScheduledTime),
        collectionNotes: job.collectionNotes || '',
      },

      deliveryDetails: {
        deliveryAddress: job.deliveryAddress || '',
        deliveryCity: job.deliveryCity || '',
        deliveryPostcode: job.deliveryPostcode || '',
        deliveryContactName: job.deliveryContactName || '',
        deliveryContactPhone: job.deliveryContactPhone || '',
        deliveryContactEmail: job.deliveryContactEmail || '',
        deliveryScheduledTime: formatDateTimeLocal(job.deliveryScheduledTime),
        deliveryNotes: job.deliveryNotes || '',
      },

      isSplitJourney: job.isSplitJourney || false,

      secondaryCollectionDetails: {
        secondaryCollectionAddress: job.secondaryCollectionAddress || '',
        secondaryCollectionCity: job.secondaryCollectionCity || '',
        secondaryCollectionPostcode: job.secondaryCollectionPostcode || '',
        secondaryCollectionContactName: job.secondaryCollectionContactName || '',
        secondaryCollectionContactPhone: job.secondaryCollectionContactPhone || '',
        secondaryCollectionContactEmail: job.secondaryCollectionContactEmail || '',
        secondaryCollectionScheduledTime: formatDateTimeLocal(job.secondaryCollectionScheduledTime),
        secondaryCollectionNotes: job.secondaryCollectionNotes || '',
      },

      firstDeliveryDetails: {
        firstDeliveryAddress: job.firstDeliveryAddress || '',
        firstDeliveryCity: job.firstDeliveryCity || '',
        firstDeliveryPostcode: job.firstDeliveryPostcode || '',
        firstDeliveryContactName: job.firstDeliveryContactName || '',
        firstDeliveryContactPhone: job.firstDeliveryContactPhone || '',
        firstDeliveryContactEmail: job.firstDeliveryContactEmail || '',
        firstDeliveryScheduledTime: formatDateTimeLocal(job.firstDeliveryScheduledTime),
        firstDeliveryNotes: job.firstDeliveryNotes || '',
      },

      generalNotes: getNotesString(job.generalNotes),
    });

    // Update status control based on permissions
    if (!this.canEditStatus) {
      this.jobForm.get('status')?.disable();
    }

    // Setup split journey validators if needed
    if (job.isSplitJourney) {
      this.addSplitJourneyValidators();
    }

    // Load make/model data if vehicle type is set
    if (job.vehicleType) {
      this.loadMakesByType(job.vehicleType);
      if (job.vehicleMake) {
        this.loadModelsByMake(job.vehicleMake);
      }
    }
  }

  private loadInitialData(): void {
    // Load customers
    this.customerService
      .getAllCustomers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customers) => {
          this.customers = customers;
        },
        error: (error) => {
          console.error('Error loading customers:', error);
          this.showError('Failed to load customers');
        },
      });

    // Load makes
    this.makeModelService
      .getAllMakes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (makes) => {
          this.makes = makes;
        },
        error: (error) => {
          console.error('Error loading makes:', error);
          this.showError('Failed to load vehicle makes');
        },
      });
  }

  private setupFormValidation(): void {
    // Monitor form sections validity
    this.jobForm
      .get('vehicleInfo')
      ?.statusChanges.pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.isVehicleFormValid = status === 'VALID';
      });

    this.jobForm
      .get('collectionDetails')
      ?.statusChanges.pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.isCollectionFormValid = status === 'VALID';
      });

    this.jobForm
      .get('deliveryDetails')
      ?.statusChanges.pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        this.isDeliveryFormValid = status === 'VALID';
      });
  }

  private setupVehicleTypeChange(): void {
    this.jobForm
      .get('vehicleInfo.vehicleType')
      ?.valueChanges.pipe(takeUntil(this.destroy$), debounceTime(300))
      .subscribe((vehicleType) => {
        if (vehicleType) {
          this.loadMakesByType(vehicleType);
        }
      });
  }

  private setupMakeChange(): void {
    this.jobForm
      .get('vehicleInfo.vehicleMake')
      ?.valueChanges.pipe(takeUntil(this.destroy$), debounceTime(300))
      .subscribe((makeId) => {
        if (makeId) {
          this.loadModelsByMake(makeId);
        }
      });
  }

  private loadMakesByType(vehicleType: string): void {
    this.makeModelService
      .getMakesByType(vehicleType)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (makes) => {
          this.makes = makes;
          // Reset make and model if current selection is not available
          const currentMake = this.jobForm.get('vehicleInfo.vehicleMake')?.value;
          if (currentMake && !makes.some((m) => m.id === currentMake)) {
            this.jobForm.patchValue({
              vehicleInfo: {
                vehicleMake: '',
                vehicleModel: '',
              },
            });
            this.models = [];
          }
        },
        error: (error) => {
          console.error('Error loading makes:', error);
          this.showError('Failed to load vehicle makes for selected type');
        },
      });
  }

  private loadModelsByMake(makeId: string): void {
    this.makeModelService
      .getModelsByMake(makeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (models) => {
          this.models = models;
          // Reset model if current selection is not available
          const currentModel = this.jobForm.get('vehicleInfo.vehicleModel')?.value;
          if (currentModel && !models.some((m) => m.id === currentModel)) {
            this.jobForm.patchValue({
              vehicleInfo: {
                vehicleModel: '',
              },
            });
          }
        },
        error: (error) => {
          console.error('Error loading models:', error);
          this.showError('Failed to load vehicle models for selected make');
        },
      });
  }

  // Form validators (same as create component)
  private registrationValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const ukRegex = /^[A-Z]{2}[0-9]{2}\s?[A-Z]{3}$|^[A-Z][0-9]{1,3}\s?[A-Z]{3}$|^[A-Z]{3}\s?[0-9]{1,3}[A-Z]$/;
    if (!ukRegex.test(control.value.toUpperCase().replace(/\s/g, ''))) {
      return { invalidRegistration: true };
    }
    return null;
  }

  private phoneValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const phoneRegex = /^(?:(?:\+44\s?|0)(?:1|2|3|7|8)(?:\d\s?){8,9})$/;
    if (!phoneRegex.test(control.value.replace(/\s/g, ''))) {
      return { invalidPhone: true };
    }
    return null;
  }

  // Event handlers
  onCustomerSelect(customerId: string): void {
    const customer = this.customers.find((c) => c.id === customerId);
    if (customer) {
      this.jobForm.patchValue({
        customerInfo: {
          customerName: customer.name,
          customerId: customer.id,
        },
      });
    }
  }

  onSplitJourneyToggle(): void {
    const isSplit = this.jobForm.get('isSplitJourney')?.value;

    if (isSplit) {
      this.addSplitJourneyValidators();
    } else {
      this.removeSplitJourneyValidators();
      this.jobForm.patchValue({
        secondaryCollectionDetails: this.getEmptyContactForm(),
        firstDeliveryDetails: this.getEmptyContactForm(),
      });
    }
  }

  private addSplitJourneyValidators(): void {
    const secondaryCollection = this.jobForm.get('secondaryCollectionDetails');
    const firstDelivery = this.jobForm.get('firstDeliveryDetails');

    // Add required validators for secondary collection
    secondaryCollection?.get('secondaryCollectionAddress')?.setValidators([Validators.required]);
    secondaryCollection?.get('secondaryCollectionCity')?.setValidators([Validators.required]);
    secondaryCollection?.get('secondaryCollectionPostcode')?.setValidators([Validators.required]);
    secondaryCollection?.get('secondaryCollectionContactName')?.setValidators([Validators.required]);
    secondaryCollection?.get('secondaryCollectionContactPhone')?.setValidators([Validators.required, this.phoneValidator]);

    // Add required validators for first delivery
    firstDelivery?.get('firstDeliveryAddress')?.setValidators([Validators.required]);
    firstDelivery?.get('firstDeliveryCity')?.setValidators([Validators.required]);
    firstDelivery?.get('firstDeliveryPostcode')?.setValidators([Validators.required]);
    firstDelivery?.get('firstDeliveryContactName')?.setValidators([Validators.required]);
    firstDelivery?.get('firstDeliveryContactPhone')?.setValidators([Validators.required, this.phoneValidator]);

    // Update validity
    secondaryCollection?.updateValueAndValidity();
    firstDelivery?.updateValueAndValidity();
  }

  private removeSplitJourneyValidators(): void {
    const secondaryCollection = this.jobForm.get('secondaryCollectionDetails') as FormGroup;
    const firstDelivery = this.jobForm.get('firstDeliveryDetails') as FormGroup;

    // Remove all validators
    if (secondaryCollection) {
      Object.keys(secondaryCollection.controls).forEach((key) => {
        secondaryCollection.get(key)?.clearValidators();
        secondaryCollection.get(key)?.updateValueAndValidity();
      });
    }

    if (firstDelivery) {
      Object.keys(firstDelivery.controls).forEach((key) => {
        firstDelivery.get(key)?.clearValidators();
        firstDelivery.get(key)?.updateValueAndValidity();
      });
    }
  }

  private getEmptyContactForm() {
    return {
      address: '',
      city: '',
      postcode: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      scheduledTime: '',
      notes: '',
    };
  }

  // Form submission
  async onSubmit(): Promise<void> {
    if (this.jobForm.invalid) {
      this.markFormGroupTouched(this.jobForm);
      this.showError('Please fill in all required fields correctly');
      return;
    }

    if (!this.currentUser || !this.originalJob) {
      this.showError('Missing required data for update');
      return;
    }

    this.submitting = true;

    try {
      const formValue = this.jobForm.getRawValue(); // getRawValue to include disabled fields
      const jobData = this.transformFormDataToJob(formValue);

      await this.jobService.updateJob(this.originalJob.id, jobData);

      this.showSuccess('Job updated successfully!');
      this.router.navigate(['/jobs', this.originalJob.id]);
    } catch (error: any) {
      console.error('Error updating job:', error);
      this.showError(error.message || 'Failed to update job. Please try again.');
    } finally {
      this.submitting = false;
    }
  }

  private transformFormDataToJob(formValue: any): Partial<Job> {
    const now = new Date();

    return {
      // Status (only update if user has permission)
      ...(this.canEditStatus && { status: formValue.status }),

      // Basic info
      isSplitJourney: formValue.isSplitJourney || false,

      // Vehicle info
      vehicleRegistration: formValue.vehicleInfo.vehicleRegistration?.toUpperCase(),
      vehicleType: formValue.vehicleInfo.vehicleType,
      vehicleMake: formValue.vehicleInfo.vehicleMake,
      vehicleModel: formValue.vehicleInfo.vehicleModel,
      vehicleColor: formValue.vehicleInfo.vehicleColor,
      vehicleYear: formValue.vehicleInfo.vehicleYear || null,
      chassisNumber: formValue.vehicleInfo.chassisNumber,
      vehicleFuelType: formValue.vehicleInfo.vehicleFuelType,

      // Customer info
      customerId: formValue.customerInfo.customerId || null,
      customerName: formValue.customerInfo.customerName,
      customerJobNumber: formValue.customerInfo.customerJobNumber || null,
      shippingReference: formValue.customerInfo.shippingReference || null,

      // Collection details
      collectionAddress: formValue.collectionDetails.collectionAddress,
      collectionCity: formValue.collectionDetails.collectionCity,
      collectionPostcode: formValue.collectionDetails.collectionPostcode,
      collectionContactName: formValue.collectionDetails.collectionContactName,
      collectionContactPhone: formValue.collectionDetails.collectionContactPhone,
      collectionContactEmail: formValue.collectionDetails.collectionContactEmail || null,
      collectionScheduledTime: formValue.collectionDetails.collectionScheduledTime ? new Date(formValue.collectionDetails.collectionScheduledTime) : null,
      collectionNotes: formValue.collectionDetails.collectionNotes || null,

      // Delivery details
      deliveryAddress: formValue.deliveryDetails.deliveryAddress,
      deliveryCity: formValue.deliveryDetails.deliveryCity,
      deliveryPostcode: formValue.deliveryDetails.deliveryPostcode,
      deliveryContactName: formValue.deliveryDetails.deliveryContactName,
      deliveryContactPhone: formValue.deliveryDetails.deliveryContactPhone,
      deliveryContactEmail: formValue.deliveryDetails.deliveryContactEmail || null,
      deliveryScheduledTime: formValue.deliveryDetails.deliveryScheduledTime ? new Date(formValue.deliveryDetails.deliveryScheduledTime) : null,
      deliveryNotes: formValue.deliveryDetails.deliveryNotes || null,

      // Split journey details
      secondaryCollectionAddress: formValue.isSplitJourney ? formValue.secondaryCollectionDetails.secondaryCollectionAddress : null,
      secondaryCollectionCity: formValue.isSplitJourney ? formValue.secondaryCollectionDetails.secondaryCollectionCity : null,
      secondaryCollectionPostcode: formValue.isSplitJourney ? formValue.secondaryCollectionDetails.secondaryCollectionPostcode : null,
      secondaryCollectionContactName: formValue.isSplitJourney ? formValue.secondaryCollectionDetails.secondaryCollectionContactName : null,
      secondaryCollectionContactPhone: formValue.isSplitJourney ? formValue.secondaryCollectionDetails.secondaryCollectionContactPhone : null,
      secondaryCollectionContactEmail: formValue.isSplitJourney ? formValue.secondaryCollectionDetails.secondaryCollectionContactEmail : null,
      secondaryCollectionScheduledTime:
        formValue.isSplitJourney && formValue.secondaryCollectionDetails.secondaryCollectionScheduledTime
          ? new Date(formValue.secondaryCollectionDetails.secondaryCollectionScheduledTime)
          : null,
      secondaryCollectionNotes: formValue.isSplitJourney ? formValue.secondaryCollectionDetails.secondaryCollectionNotes : null,

      firstDeliveryAddress: formValue.isSplitJourney ? formValue.firstDeliveryDetails.firstDeliveryAddress : null,
      firstDeliveryCity: formValue.isSplitJourney ? formValue.firstDeliveryDetails.firstDeliveryCity : null,
      firstDeliveryPostcode: formValue.isSplitJourney ? formValue.firstDeliveryDetails.firstDeliveryPostcode : null,
      firstDeliveryContactName: formValue.isSplitJourney ? formValue.firstDeliveryDetails.firstDeliveryContactName : null,
      firstDeliveryContactPhone: formValue.isSplitJourney ? formValue.firstDeliveryDetails.firstDeliveryContactPhone : null,
      firstDeliveryContactEmail: formValue.isSplitJourney ? formValue.firstDeliveryDetails.firstDeliveryContactEmail : null,
      firstDeliveryScheduledTime:
        formValue.isSplitJourney && formValue.firstDeliveryDetails.firstDeliveryScheduledTime
          ? new Date(formValue.firstDeliveryDetails.firstDeliveryScheduledTime)
          : null,
      firstDeliveryNotes: formValue.isSplitJourney ? formValue.firstDeliveryDetails.firstDeliveryNotes : null,

      // General notes - append to existing notes if changed
      ...(formValue.generalNotes &&
        formValue.generalNotes !== this.getExistingNotesString() && {
          generalNotes: [
            ...(this.originalJob?.generalNotes || []),
            {
              content: `Updated: ${formValue.generalNotes}`,
              createdAt: now,
              createdBy: this.currentUser?.id || 'system',
            },
          ],
        }),

      // Metadata
      updatedBy: this.currentUser?.id || 'system',
      updatedAt: now,
      ...(this.canEditStatus && formValue.status !== this.originalJob?.status && { statusUpdatedAt: now }),
    };
  }

  private getExistingNotesString(): string {
    if (!this.originalJob?.generalNotes) return '';
    if (typeof this.originalJob.generalNotes === 'string') return this.originalJob.generalNotes;
    if (Array.isArray(this.originalJob.generalNotes) && this.originalJob.generalNotes.length > 0) {
      return this.originalJob.generalNotes.map((note) => note.content).join('\n\n');
    }
    return '';
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  // Navigation
  onCancel(): void {
    if (this.originalJob) {
      this.router.navigate(['/jobs', this.originalJob.id]);
    } else {
      this.router.navigate(['/jobs']);
    }
  }

  // Utility methods
  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['success-snackbar'],
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 7000,
      panelClass: ['error-snackbar'],
    });
  }

  // Getters for template
  get vehicleInfoForm(): FormGroup {
    return this.jobForm.get('vehicleInfo') as FormGroup;
  }

  get customerInfoForm(): FormGroup {
    return this.jobForm.get('customerInfo') as FormGroup;
  }

  get collectionDetailsForm(): FormGroup {
    return this.jobForm.get('collectionDetails') as FormGroup;
  }

  get deliveryDetailsForm(): FormGroup {
    return this.jobForm.get('deliveryDetails') as FormGroup;
  }

  get secondaryCollectionForm(): FormGroup {
    return this.jobForm.get('secondaryCollectionDetails') as FormGroup;
  }

  get firstDeliveryForm(): FormGroup {
    return this.jobForm.get('firstDeliveryDetails') as FormGroup;
  }

  get isSplitJourney(): boolean {
    return this.jobForm.get('isSplitJourney')?.value || false;
  }

  get hasUnsavedChanges(): boolean {
    return this.jobForm.dirty && !this.submitting;
  }
}
