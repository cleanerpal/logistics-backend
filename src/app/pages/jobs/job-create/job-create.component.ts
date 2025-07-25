import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, of, firstValueFrom } from 'rxjs';
import { takeUntil, debounceTime, switchMap, startWith, map } from 'rxjs/operators';
import { Timestamp } from 'firebase/firestore';

import { JobNewService } from '../../../services/job-new.service';
import { CustomerService } from '../../../services/customer.service';
import { MakeModelService } from '../../../services/make-model.service';
import { DvlaService } from '../../../services/dvla.service';
import { AuthService } from '../../../services/auth.service';
import { Job } from '../../../interfaces/job-new.interface';
import { Customer } from '../../../interfaces/customer.interface';
import { MakeModel } from '../../../interfaces/make-model.interface';
import { UserProfile } from '../../../interfaces/user-profile.interface';

export interface DvlaVehicleInfo {
  registrationNumber: string;
  make?: string;
  yearOfManufacture?: number;
  colour?: string;
  fuelType?: string;
  typeApproval?: string;
  wheelplan?: string;
  engineCapacity?: number;
  co2Emissions?: number;
  markedForExport?: boolean;
  dateOfLastV5CIssued?: string;
  motStatus?: string;
  motExpiryDate?: string;
  taxStatus?: string;
  taxDueDate?: string;
}

export interface SavedAddress {
  id: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  type: 'collection' | 'delivery' | 'both';
  isActive: boolean;
}

@Component({
  selector: 'app-job-create',
  templateUrl: './job-create.component.html',
  styleUrls: ['./job-create.component.scss'],
  standalone: false,
})
export class JobCreateComponent implements OnInit, OnDestroy {
  jobForm!: FormGroup;
  loading = false;
  submitting = false;
  currentUser: UserProfile | null = null;

  customers: Customer[] = [];
  savedAddresses: SavedAddress[] = [];
  vehicleTypes: string[] = ['Car', 'Van', 'Truck', 'Motorbike', 'Bus', 'Other'];
  makes: MakeModel[] = [];
  models: MakeModel[] = [];
  fuelTypes: string[] = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'Other'];
  filteredMakes: MakeModel[] = [];
  filteredModels: MakeModel[] = [];

  currentYear = new Date().getFullYear();
  maxYear = this.currentYear + 1;

  isLoadingDvla = false;
  dvlaLookupCompleted = false;
  autoFilledFields = new Set<string>();

  isVehicleFormValid = false;
  isCollectionFormValid = false;
  isDeliveryFormValid = false;

  private destroy$ = new Subject<void>();
  private lookupTimeout: any;
  private readonly LOOKUP_DELAY = 1500;

  constructor(
    private fb: FormBuilder,
    private jobService: JobNewService,
    private customerService: CustomerService,
    private makeModelService: MakeModelService,
    private dvlaService: DvlaService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.setupFormValidation();
    this.setupVehicleTypeChange();
    this.setupMakeChange();
    this.setupAutoLookup();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.lookupTimeout) {
      clearTimeout(this.lookupTimeout);
    }
  }

  private createForm(): void {
    this.jobForm = this.fb.group({
      // Job basic info - restore jobType, remove priority
      jobType: ['', Validators.required],

      // Vehicle information
      vehicleInfo: this.fb.group({
        vehicleRegistration: [''],
        vehicleType: ['', Validators.required],
        vehicleMake: [{ value: '', disabled: true }],
        vehicleModel: [{ value: '', disabled: true }],
        vehicleColor: [''],
        vehicleYear: [''],
        chassisNumber: [''],
        vehicleFuelType: [''],
      }),

      customerInfo: this.fb.group({
        customerId: [''],
        customerName: ['', Validators.required],
        customerJobNumber: [''],
        shippingReference: [''],
      }),

      // Collection details
      collectionDetails: this.fb.group({
        savedAddressId: [''], // For selecting saved addresses
        collectionAddress: [''],
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
        savedAddressId: [''], // For selecting saved addresses
        deliveryAddress: [''],
        deliveryCity: ['', Validators.required],
        deliveryPostcode: ['', Validators.required],
        deliveryContactName: ['', Validators.required],
        deliveryContactPhone: ['', [Validators.required, this.phoneValidator]],
        deliveryContactEmail: ['', [Validators.email]],
        deliveryScheduledTime: [''],
        deliveryNotes: [''],
      }),

      isSplitJourney: [false],
      firstDropoffDetails: this.fb.group({
        savedAddressId: [''],
        firstDropoffAddress: [''],
        firstDropoffCity: [''],
        firstDropoffPostcode: [''],
        firstDropoffContactName: [''],
        firstDropoffContactPhone: [''],
        firstDropoffContactEmail: [''],
        firstDropoffScheduledTime: [''],
        firstDropoffNotes: [''],
      }),

      secondCollectionDetails: this.fb.group({
        savedAddressId: [''],
        secondCollectionAddress: [''],
        secondCollectionCity: [''],
        secondCollectionPostcode: [''],
        secondCollectionContactName: [''],
        secondCollectionContactPhone: [''],
        secondCollectionContactEmail: [''],
        secondCollectionScheduledTime: [''],
        secondCollectionNotes: [''],
      }),

      generalNotes: [''],
    });
  }

  private loadInitialData(): void {
    this.loading = true;

    this.authService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
      });

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

    this.loadSavedAddresses();

    this.loading = false;
  }

  private loadSavedAddresses(): void {
    this.savedAddresses = [
      {
        id: '1',
        name: 'Main Depot',
        address: '123 Industrial Estate',
        city: 'Belfast',
        postcode: 'BT1 1AA',
        contactName: 'Depot Manager',
        contactPhone: '028 9xxx xxxx',
        contactEmail: 'depot@company.com',
        type: 'both',
        isActive: true,
      },
      {
        id: '2',
        name: 'Customer Warehouse',
        address: '456 Business Park',
        city: 'Lisburn',
        postcode: 'BT28 2BB',
        contactName: 'Warehouse Supervisor',
        contactPhone: '028 9xxx yyyy',
        type: 'delivery',
        isActive: true,
      },
    ];
  }

  private setupFormValidation(): void {
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
    this.vehicleInfoForm
      .get('vehicleType')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((vehicleType: string) => {
        this.filteredMakes = [];
        this.filteredModels = [];
        this.vehicleInfoForm.get('vehicleMake')?.reset();
        this.vehicleInfoForm.get('vehicleModel')?.reset();
        this.vehicleInfoForm.get('vehicleMake')?.disable();
        this.vehicleInfoForm.get('vehicleModel')?.disable();
        if (vehicleType) {
          this.vehicleInfoForm.get('vehicleMake')?.enable();
          this.loadMakesByType(vehicleType);
        }
      });
  }

  private setupMakeChange(): void {
    this.vehicleInfoForm
      .get('vehicleMake')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((makeId: string) => {
        this.filteredModels = [];
        this.vehicleInfoForm.get('vehicleModel')?.reset();
        this.vehicleInfoForm.get('vehicleModel')?.disable();
        if (makeId) {
          this.vehicleInfoForm.get('vehicleModel')?.enable();
          this.loadModelsByMake(makeId);
        }
      });
  }

  onMakeChange(): void {
    const makeId = this.vehicleInfoForm.get('vehicleMake')?.value;
    const makeObj = this.filteredMakes.find((m) => m.id === makeId);
  }

  onModelChange(): void {}

  private loadMakesByType(vehicleType: string): void {
    this.makeModelService.getMakesByType(vehicleType).subscribe({
      next: (makes) => {
        this.filteredMakes = makes;
      },
      error: (err) => {
        this.filteredMakes = [];
        this.showError('Failed to load makes for selected type');
      },
    });
  }

  private loadModelsByMake(makeId: string): void {
    this.makeModelService.getModelsByMake(makeId).subscribe({
      next: (models) => {
        this.filteredModels = models;
      },
      error: (err) => {
        this.filteredModels = [];
        this.showError('Failed to load models for selected make');
      },
    });
  }

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

  onDvlaLookupClick(): void {
    const registration = this.jobForm.get('vehicleInfo.vehicleRegistration')?.value;

    if (!registration || registration.length < 7) {
      this.showError('Please enter a valid registration number (minimum 7 characters)');
      return;
    }

    if (this.isLoadingDvla) return;

    this.performDvlaLookup(registration);
  }

  private performDvlaLookup(registration: string): void {
    this.isLoadingDvla = true;
    this.dvlaLookupCompleted = false;
    this.autoFilledFields.clear();

    this.dvlaService
      .fetchVehicleDetails(registration)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: DvlaVehicleInfo) => {
          this.dvlaLookupCompleted = true;
          this.isLoadingDvla = false;
          this.populateVehicleDetails(response);
        },
        error: (error) => {
          this.isLoadingDvla = false;
          this.dvlaLookupCompleted = false;
          console.error('DVLA lookup error:', error);

          this.showError(error.message || 'Could not auto-fill vehicle details. Please enter manually.');
        },
      });
  }

  get canPerformDvlaLookup(): boolean {
    const registration = this.jobForm.get('vehicleInfo.vehicleRegistration')?.value;
    return !!(registration && registration.length >= 7 && !this.isLoadingDvla);
  }

  get dvlaButtonText(): string {
    if (this.isLoadingDvla) return 'Searching...';
    if (this.dvlaLookupCompleted) return 'Search Again';
    return 'Search DVLA';
  }

  private populateVehicleDetails(dvlaData: DvlaVehicleInfo): void {
    console.log('DVLA data returned:', dvlaData);

    const updateData: any = {};
    let autoFilledCount = 0;

    // Auto-select make if found (search in all makes, not just filtered ones)
    if (typeof dvlaData?.make === 'string' && dvlaData.make) {
      const foundMake = this.makes.find(
        (make) => make.displayName?.toLowerCase() === dvlaData.make!.toLowerCase() || make.name?.toLowerCase() === dvlaData.make!.toLowerCase()
      );
      if (foundMake) {
        console.log('Found make:', foundMake);
        updateData.vehicleMake = foundMake['docId'] || foundMake.id;
        this.autoFilledFields.add('vehicleMake');
        autoFilledCount++;
      } else {
        console.log('Make not found in database:', dvlaData.make);
      }
    }

    if (dvlaData.colour) {
      updateData.vehicleColor = dvlaData.colour;
      this.autoFilledFields.add('vehicleColor');
      autoFilledCount++;
    }

    if (dvlaData.yearOfManufacture) {
      updateData.vehicleYear = dvlaData.yearOfManufacture;
      this.autoFilledFields.add('vehicleYear');
      autoFilledCount++;
    }

    if (dvlaData.fuelType) {
      console.log('DVLA fuel type:', dvlaData.fuelType);
      const fuelTypeMapping: { [key: string]: string } = {
        PETROL: 'Petrol',
        DIESEL: 'Diesel',
        ELECTRIC: 'Electric',
        'HYBRID ELECTRIC': 'Hybrid',
        HYBRID: 'Hybrid',
      };
      const mappedFuelType = fuelTypeMapping[dvlaData.fuelType.toUpperCase()] || dvlaData.fuelType;
      console.log('Mapped fuel type:', mappedFuelType);
      console.log('Available fuel types:', this.fuelTypes);

      if (this.fuelTypes.includes(mappedFuelType)) {
        updateData.vehicleFuelType = mappedFuelType;
        this.autoFilledFields.add('vehicleFuelType');
        autoFilledCount++;
        console.log('Fuel type set to:', mappedFuelType);
      } else {
        console.log('Fuel type not found in available options:', mappedFuelType);
      }
    }

    if (dvlaData.typeApproval) {
      const vehicleType = this.determineVehicleType(dvlaData);
      if (this.vehicleTypes.includes(vehicleType)) {
        updateData.vehicleType = vehicleType;
        this.autoFilledFields.add('vehicleType');
        autoFilledCount++;
      }
    }

    // Apply the updates to the form
    if (Object.keys(updateData).length > 0) {
      this.vehicleInfoForm.patchValue(updateData, { emitEvent: false });

      // If make was set, trigger the make change to load models
      if (updateData.vehicleMake) {
        // Use setValue with emitEvent: true to trigger the valueChanges subscription
        this.vehicleInfoForm.get('vehicleMake')?.setValue(updateData.vehicleMake, { emitEvent: true });
      }
    }

    if (autoFilledCount > 0) {
      this.showSuccess(`Auto-filled ${autoFilledCount} vehicle details from DVLA`);
    }
  }

  private determineVehicleType(apiResponse: DvlaVehicleInfo): string {
    const typeApproval = apiResponse.typeApproval?.toUpperCase();
    const wheelplan = apiResponse.wheelplan?.toUpperCase();

    if (typeApproval === 'M1') return 'Car';
    if (typeApproval === 'N1') return 'Van';
    if (typeApproval === 'N2' || typeApproval === 'N3') return 'Truck';
    if (typeApproval === 'M2' || typeApproval === 'M3') return 'Bus';
    if (typeApproval === 'L1' || typeApproval === 'L2' || typeApproval === 'L3' || typeApproval === 'L4' || typeApproval === 'L5') return 'Motorbike';

    if (wheelplan && (wheelplan.includes('MOTORCYCLE') || wheelplan.includes('MOPED') || wheelplan.includes('SCOOTER'))) {
      return 'Motorbike';
    }

    return 'Other';
  }

  private setupAddressSelectors(): void {
    this.jobForm
      .get('collectionDetails.savedAddressId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((addressId) => {
        if (addressId) {
          this.populateAddressFields('collection', addressId);
        }
      });

    this.jobForm
      .get('deliveryDetails.savedAddressId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((addressId) => {
        if (addressId) {
          this.populateAddressFields('delivery', addressId);
        }
      });

    this.jobForm
      .get('secondaryCollectionDetails.savedAddressId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((addressId) => {
        if (addressId) {
          this.populateAddressFields('secondaryCollection', addressId);
        }
      });

    this.jobForm
      .get('firstDeliveryDetails.savedAddressId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((addressId) => {
        if (addressId) {
          this.populateAddressFields('firstDelivery', addressId);
        }
      });
  }

  private populateAddressFields(type: string, addressId: string): void {
    const savedAddress = this.savedAddresses.find((addr) => addr.id === addressId);
    if (!savedAddress) return;

    const fieldMappings: { [key: string]: string } = {
      collection: 'collectionDetails',
      delivery: 'deliveryDetails',
      firstDropoff: 'firstDropoffDetails',
      secondCollection: 'secondCollectionDetails',
    };

    const formGroupName = fieldMappings[type];
    if (!formGroupName) return;

    const addressFields: { [key: string]: any } = {};

    if (type === 'collection') {
      addressFields['collectionAddress'] = savedAddress.address;
      addressFields['collectionCity'] = savedAddress.city;
      addressFields['collectionPostcode'] = savedAddress.postcode;
      addressFields['collectionContactName'] = savedAddress.contactName || '';
      addressFields['collectionContactPhone'] = savedAddress.contactPhone || '';
      addressFields['collectionContactEmail'] = savedAddress.contactEmail || '';
    } else if (type === 'delivery') {
      addressFields['deliveryAddress'] = savedAddress.address;
      addressFields['deliveryCity'] = savedAddress.city;
      addressFields['deliveryPostcode'] = savedAddress.postcode;
      addressFields['deliveryContactName'] = savedAddress.contactName || '';
      addressFields['deliveryContactPhone'] = savedAddress.contactPhone || '';
      addressFields['deliveryContactEmail'] = savedAddress.contactEmail || '';
    } else if (type === 'firstDropoff') {
      addressFields['firstDropoffAddress'] = savedAddress.address;
      addressFields['firstDropoffCity'] = savedAddress.city;
      addressFields['firstDropoffPostcode'] = savedAddress.postcode;
      addressFields['firstDropoffContactName'] = savedAddress.contactName || '';
      addressFields['firstDropoffContactPhone'] = savedAddress.contactPhone || '';
      addressFields['firstDropoffContactEmail'] = savedAddress.contactEmail || '';
    } else if (type === 'secondCollection') {
      addressFields['secondCollectionAddress'] = savedAddress.address;
      addressFields['secondCollectionCity'] = savedAddress.city;
      addressFields['secondCollectionPostcode'] = savedAddress.postcode;
      addressFields['secondCollectionContactName'] = savedAddress.contactName || '';
      addressFields['secondCollectionContactPhone'] = savedAddress.contactPhone || '';
      addressFields['secondCollectionContactEmail'] = savedAddress.contactEmail || '';
    }

    this.jobForm.patchValue({
      [formGroupName]: addressFields,
    });

    this.showSuccess(`Address populated from saved location: ${savedAddress.name}`);
  }

  getFilteredAddresses(type: 'collection' | 'delivery' | 'both'): SavedAddress[] {
    return this.savedAddresses.filter((addr) => addr.isActive && (addr.type === type || addr.type === 'both'));
  }
  onCustomerSelect(customerId: string): void {
    const customer = this.customers.find((c) => c.id === customerId);
    if (customer) {
      this.jobForm.patchValue({
        customerInfo: {
          customerName: customer.name,
        },
      });
    }
  }

  onCollectionAddressSelect(addressId: string): void {
    const address = this.savedAddresses.find((a) => a.id === addressId);
    if (address) {
      this.jobForm.patchValue({
        collectionDetails: {
          collectionAddress: address.address,
          collectionCity: address.city,
          collectionPostcode: address.postcode,
          collectionContactName: address.contactName || '',
          collectionContactPhone: address.contactPhone || '',
          collectionContactEmail: address.contactEmail || '',
        },
      });
    }
  }

  onDeliveryAddressSelect(addressId: string): void {
    const address = this.savedAddresses.find((a) => a.id === addressId);
    if (address) {
      this.jobForm.patchValue({
        deliveryDetails: {
          deliveryAddress: address.address,
          deliveryCity: address.city,
          deliveryPostcode: address.postcode,
          deliveryContactName: address.contactName || '',
          deliveryContactPhone: address.contactPhone || '',
          deliveryContactEmail: address.contactEmail || '',
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
    const firstDropoff = this.jobForm.get('firstDropoffDetails');
    const secondCollection = this.jobForm.get('secondCollectionDetails');

    firstDropoff?.get('firstDropoffAddress')?.setValidators([Validators.required]);
    firstDropoff?.get('firstDropoffCity')?.setValidators([Validators.required]);
    firstDropoff?.get('firstDropoffPostcode')?.setValidators([Validators.required]);
    firstDropoff?.get('firstDropoffContactName')?.setValidators([Validators.required]);
    firstDropoff?.get('firstDropoffContactPhone')?.setValidators([Validators.required, this.phoneValidator]);

    secondCollection?.get('secondCollectionAddress')?.setValidators([Validators.required]);
    secondCollection?.get('secondCollectionCity')?.setValidators([Validators.required]);
    secondCollection?.get('secondCollectionPostcode')?.setValidators([Validators.required]);
    secondCollection?.get('secondCollectionContactName')?.setValidators([Validators.required]);
    secondCollection?.get('secondCollectionContactPhone')?.setValidators([Validators.required, this.phoneValidator]);

    firstDropoff?.updateValueAndValidity();
    secondCollection?.updateValueAndValidity();
  }

  private removeSplitJourneyValidators(): void {
    const firstDropoff = this.jobForm.get('firstDropoffDetails') as FormGroup;
    const secondCollection = this.jobForm.get('secondCollectionDetails') as FormGroup;

    if (firstDropoff) {
      Object.keys(firstDropoff.controls).forEach((key) => {
        firstDropoff.get(key)?.clearValidators();
        firstDropoff.get(key)?.updateValueAndValidity();
      });
    }

    if (secondCollection) {
      Object.keys(secondCollection.controls).forEach((key) => {
        secondCollection.get(key)?.clearValidators();
        secondCollection.get(key)?.updateValueAndValidity();
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

  async onSubmit(): Promise<void> {
    if (this.submitting) return;

    // Mark all fields as touched to show validation errors
    this.markFormGroupTouched(this.jobForm);

    // Update validation status for all form groups
    this.updateFormValidationStatus();

    if (this.jobForm.valid) {
      this.submitting = true;
      await this.createJob();
    } else {
      this.showError('Please fill in all required fields');
      this.scrollToFirstError();
    }
  }

  private markFormGroupTouched(formGroup: any): void {
    Object.keys(formGroup.controls).forEach((key) => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private updateFormValidationStatus(): void {
    // Force validation update for all sections
    this.jobForm.get('vehicleInfo')?.updateValueAndValidity();
    this.jobForm.get('collectionDetails')?.updateValueAndValidity();
    this.jobForm.get('deliveryDetails')?.updateValueAndValidity();
    if (this.isSplitJourney) {
      this.jobForm.get('firstDropoffDetails')?.updateValueAndValidity();
      this.jobForm.get('secondCollectionDetails')?.updateValueAndValidity();
    }
  }

  private scrollToFirstError(): void {
    const firstError = document.querySelector('.mat-form-field-invalid');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private async createJob(): Promise<void> {
    if (!this.currentUser) {
      this.showError('User authentication required');
      this.submitting = false;
      return;
    }

    try {
      const formValue = this.jobForm.value;
      const jobData = this.transformFormDataToJob(formValue);

      const jobIdResult = this.jobService.createJob(jobData);

      let jobId: string;
      if (jobIdResult instanceof Promise) {
        jobId = await jobIdResult;
      } else {
        jobId = await firstValueFrom(jobIdResult);
      }

      this.showSuccess(`Job created successfully! Job ID: ${jobId.substring(0, 8)}...`);
      this.router.navigate(['/jobs', jobId]);
    } catch (error: any) {
      console.error('Error creating job:', error);
      this.showError(error.message || 'Failed to create job. Please try again.');
    } finally {
      this.submitting = false;
    }
  }

  private transformFormDataToJob(formValue: any): Partial<Job> {
    const now = Timestamp.now();

    return {
      isSplitJourney: formValue.isSplitJourney || false,
      status: 'unallocated',
      stage: null,
      jobType: formValue.jobType || 'standard', // Restore jobType field

      vehicleRegistration: formValue.vehicleInfo.vehicleRegistration?.toUpperCase(),
      vehicleType: formValue.vehicleInfo.vehicleType,
      vehicleMake: formValue.vehicleInfo.vehicleMake,
      vehicleModel: formValue.vehicleInfo.vehicleModel,
      vehicleColor: formValue.vehicleInfo.vehicleColor,
      vehicleYear: formValue.vehicleInfo.vehicleYear || null,
      chassisNumber: formValue.vehicleInfo.chassisNumber,
      vehicleFuelType: formValue.vehicleInfo.vehicleFuelType,

      customerId: formValue.customerInfo.customerId || null,
      customerName: formValue.customerInfo.customerName,
      customerJobNumber: formValue.customerInfo.customerJobNumber || null,
      shippingReference: formValue.customerInfo.shippingReference || null,

      collectionAddress: formValue.collectionDetails.collectionAddress,
      collectionCity: formValue.collectionDetails.collectionCity,
      collectionPostcode: formValue.collectionDetails.collectionPostcode,
      collectionContactName: formValue.collectionDetails.collectionContactName,
      collectionContactPhone: formValue.collectionDetails.collectionContactPhone,
      collectionContactEmail: formValue.collectionDetails.collectionContactEmail || null,
      collectionScheduledTime: formValue.collectionDetails.collectionScheduledTime
        ? Timestamp.fromDate(new Date(formValue.collectionDetails.collectionScheduledTime))
        : null,
      collectionNotes: formValue.collectionDetails.collectionNotes || null,

      deliveryAddress: formValue.deliveryDetails.deliveryAddress,
      deliveryCity: formValue.deliveryDetails.deliveryCity,
      deliveryPostcode: formValue.deliveryDetails.deliveryPostcode,
      deliveryContactName: formValue.deliveryDetails.deliveryContactName,
      deliveryContactPhone: formValue.deliveryDetails.deliveryContactPhone,
      deliveryContactEmail: formValue.deliveryDetails.deliveryContactEmail || null,
      deliveryScheduledTime: formValue.deliveryDetails.deliveryScheduledTime ? Timestamp.fromDate(new Date(formValue.deliveryDetails.deliveryScheduledTime)) : null,
      deliveryNotes: formValue.deliveryDetails.deliveryNotes || null,

      firstDropoffAddress: formValue.isSplitJourney ? formValue.firstDropoffDetails.firstDropoffAddress : null,
      firstDropoffCity: formValue.isSplitJourney ? formValue.firstDropoffDetails.firstDropoffCity : null,
      firstDropoffPostcode: formValue.isSplitJourney ? formValue.firstDropoffDetails.firstDropoffPostcode : null,
      firstDropoffContactName: formValue.isSplitJourney ? formValue.firstDropoffDetails.firstDropoffContactName : null,
      firstDropoffContactPhone: formValue.isSplitJourney ? formValue.firstDropoffDetails.firstDropoffContactPhone : null,
      firstDropoffContactEmail: formValue.isSplitJourney ? formValue.firstDropoffDetails.firstDropoffContactEmail : null,
      firstDropoffScheduledTime:
        formValue.isSplitJourney && formValue.firstDropoffDetails.firstDropoffScheduledTime
          ? Timestamp.fromDate(new Date(formValue.firstDropoffDetails.firstDropoffScheduledTime))
          : null,
      firstDropoffNotes: formValue.isSplitJourney ? formValue.firstDropoffDetails.firstDropoffNotes : null,

      secondCollectionAddress: formValue.isSplitJourney ? formValue.secondCollectionDetails.secondCollectionAddress : null,
      secondCollectionCity: formValue.isSplitJourney ? formValue.secondCollectionDetails.secondCollectionCity : null,
      secondCollectionPostcode: formValue.isSplitJourney ? formValue.secondCollectionDetails.secondCollectionPostcode : null,
      secondCollectionContactName: formValue.isSplitJourney ? formValue.secondCollectionDetails.secondCollectionContactName : null,
      secondCollectionContactPhone: formValue.isSplitJourney ? formValue.secondCollectionDetails.secondCollectionContactPhone : null,
      secondCollectionContactEmail: formValue.isSplitJourney ? formValue.secondCollectionDetails.secondCollectionContactEmail : null,
      secondCollectionScheduledTime:
        formValue.isSplitJourney && formValue.secondCollectionDetails.secondCollectionScheduledTime
          ? Timestamp.fromDate(new Date(formValue.secondCollectionDetails.secondCollectionScheduledTime))
          : null,
      secondCollectionNotes: formValue.isSplitJourney ? formValue.secondCollectionDetails.secondCollectionNotes : null,

      generalNotes: formValue.generalNotes
        ? [
            {
              id: `note_${now.toMillis()}`,
              authorId: this.currentUser?.id || 'system',
              authorName: this.currentUser?.name || 'System',
              content: formValue.generalNotes,
              createdAt: now,
            },
          ]
        : null,
      hasDamageCommitted: false,

      createdBy: this.currentUser?.id || 'system',
      createdAt: now,
      updatedAt: now,
      statusUpdatedAt: now,
    };
  }

  onCancel(): void {
    this.router.navigate(['/jobs']);
  }

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

  get firstDropoffForm(): FormGroup {
    return this.jobForm.get('firstDropoffDetails') as FormGroup;
  }

  get secondCollectionForm(): FormGroup {
    return this.jobForm.get('secondCollectionDetails') as FormGroup;
  }

  get isSplitJourney(): boolean {
    return this.jobForm.get('isSplitJourney')?.value || false;
  }

  private setupAutoLookup(): void {
    this.vehicleInfoForm
      .get('vehicleRegistration')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((regValue: string) => {
        if (this.lookupTimeout) {
          clearTimeout(this.lookupTimeout);
        }

        if (regValue && regValue.trim() && this.isValidRegistration(regValue)) {
          this.lookupTimeout = setTimeout(() => {
            this.performAutoLookup();
          }, this.LOOKUP_DELAY);
        }
      });
  }

  isValidRegistration(regValue: string): boolean {
    if (!regValue) return false;

    const patterns = [
      /^[A-Z]{2}\d{2}\s?[A-Z]{3}$/i, // Current format: AB12 CDE
      /^[A-Z]\d{1,3}\s?[A-Z]{3}$/i, // Older format: A123 BCD
      /^[A-Z]{1,3}\d{1,4}[A-Z]?$/i, // Personal plates: ABC123, A1
    ];

    return patterns.some((pattern) => pattern.test(regValue.trim()));
  }

  private performAutoLookup(): void {
    const regValue = this.vehicleInfoForm.get('vehicleRegistration')?.value;
    if (regValue && this.isValidRegistration(regValue) && !this.isLoadingDvla) {
      this.onDvlaLookupClick();
    }
  }
}
