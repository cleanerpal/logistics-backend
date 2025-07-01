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

// DVLA Response Interface
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

// Address Interface
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

  // Data sources
  customers: Customer[] = [];
  savedAddresses: SavedAddress[] = [];
  vehicleTypes: string[] = ['Car', 'Van', 'Truck', 'Motorbike', 'Bus', 'Other'];
  makes: MakeModel[] = [];
  models: MakeModel[] = [];
  fuelTypes: string[] = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'Other'];

  // Helper properties
  currentYear = new Date().getFullYear();
  maxYear = this.currentYear + 1;

  // DVLA lookup state
  isLoadingDvla = false;
  dvlaLookupCompleted = false;
  autoFilledFields = new Set<string>();

  // Form validation flags
  isVehicleFormValid = false;
  isCollectionFormValid = false;
  isDeliveryFormValid = false;

  private destroy$ = new Subject<void>();

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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): void {
    this.jobForm = this.fb.group({
      // Job basic info - restore jobType, remove priority
      jobType: ['standard', Validators.required],

      // Vehicle information
      vehicleInfo: this.fb.group({
        vehicleRegistration: ['', [Validators.required, this.registrationValidator]],
        vehicleType: ['', Validators.required],
        vehicleMake: [''],
        vehicleModel: [''],
        vehicleColor: [''],
        vehicleYear: ['', [Validators.min(1900), Validators.max(this.maxYear)]],
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
        savedAddressId: [''], // For selecting saved addresses
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
        savedAddressId: [''], // For selecting saved addresses
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

      // Second collection (for split journey)
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

      // General notes
      generalNotes: [''],
    });
  }

  private loadInitialData(): void {
    this.loading = true;

    // Load current user
    this.authService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
      });

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

    // Load saved addresses
    this.loadSavedAddresses();

    this.loading = false;
  }

  private loadSavedAddresses(): void {
    // TODO: Replace with actual service call to load saved addresses
    // For now, using mock data - replace with actual service
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

  // Form validators
  private registrationValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    // UK registration format validation
    const ukRegex = /^[A-Z]{2}[0-9]{2}\s?[A-Z]{3}$|^[A-Z][0-9]{1,3}\s?[A-Z]{3}$|^[A-Z]{3}\s?[0-9]{1,3}[A-Z]$/;

    if (!ukRegex.test(control.value.toUpperCase().replace(/\s/g, ''))) {
      return { invalidRegistration: true };
    }

    return null;
  }

  private phoneValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    // UK phone number validation
    const phoneRegex = /^(?:(?:\+44\s?|0)(?:1|2|3|7|8)(?:\d\s?){8,9})$/;

    if (!phoneRegex.test(control.value.replace(/\s/g, ''))) {
      return { invalidPhone: true };
    }

    return null;
  }

  // DVLA Vehicle Lookup - Manual Button Trigger
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

          // Use the error message from your service
          this.showError(error.message || 'Could not auto-fill vehicle details. Please enter manually.');
        },
      });
  }

  // Check if DVLA lookup button should be enabled
  get canPerformDvlaLookup(): boolean {
    const registration = this.jobForm.get('vehicleInfo.vehicleRegistration')?.value;
    return !!(registration && registration.length >= 7 && !this.isLoadingDvla);
  }

  // Get button text based on state
  get dvlaButtonText(): string {
    if (this.isLoadingDvla) return 'Searching...';
    if (this.dvlaLookupCompleted) return 'Search Again';
    return 'Search DVLA';
  }

  private populateVehicleDetails(dvlaData: DvlaVehicleInfo): void {
    const updateData: any = {};
    let autoFilledCount = 0;

    // Map DVLA data to form fields
    if (dvlaData.make) {
      // Try to find matching make in our database
      const matchingMake = this.makes.find((m) => m.name.toLowerCase() === dvlaData.make?.toLowerCase());
      if (matchingMake) {
        updateData.vehicleMake = matchingMake.id;
        this.autoFilledFields.add('vehicleMake');
        autoFilledCount++;
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
      // Map DVLA fuel types to our fuel types
      const fuelTypeMapping: { [key: string]: string } = {
        PETROL: 'Petrol',
        DIESEL: 'Diesel',
        ELECTRIC: 'Electric',
        'HYBRID ELECTRIC': 'Hybrid',
      };
      const mappedFuelType = fuelTypeMapping[dvlaData.fuelType.toUpperCase()] || dvlaData.fuelType;
      if (this.fuelTypes.includes(mappedFuelType)) {
        updateData.vehicleFuelType = mappedFuelType;
        this.autoFilledFields.add('vehicleFuelType');
        autoFilledCount++;
      }
    }

    // Determine vehicle type from DVLA data
    if (dvlaData.typeApproval) {
      const vehicleType = this.determineVehicleType(dvlaData);
      if (this.vehicleTypes.includes(vehicleType)) {
        updateData.vehicleType = vehicleType;
        this.autoFilledFields.add('vehicleType');
        autoFilledCount++;
      }
    }

    // Update the form
    this.jobForm.patchValue(
      {
        vehicleInfo: updateData,
      },
      { emitEvent: false }
    );

    // Load models if make was auto-filled
    if (updateData.vehicleMake) {
      this.loadModelsByMake(updateData.vehicleMake);
    }

    // Show success message
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

  // Address Selection
  private setupAddressSelectors(): void {
    // Collection address selector
    this.jobForm
      .get('collectionDetails.savedAddressId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((addressId) => {
        if (addressId) {
          this.populateAddressFields('collection', addressId);
        }
      });

    // Delivery address selector
    this.jobForm
      .get('deliveryDetails.savedAddressId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((addressId) => {
        if (addressId) {
          this.populateAddressFields('delivery', addressId);
        }
      });

    // Secondary collection address selector
    this.jobForm
      .get('secondaryCollectionDetails.savedAddressId')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((addressId) => {
        if (addressId) {
          this.populateAddressFields('secondaryCollection', addressId);
        }
      });

    // First delivery address selector
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

  // Get filtered addresses for dropdowns
  getFilteredAddresses(type: 'collection' | 'delivery' | 'both'): SavedAddress[] {
    return this.savedAddresses.filter((addr) => addr.isActive && (addr.type === type || addr.type === 'both'));
  }
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
      // Add validators for split journey fields
      this.addSplitJourneyValidators();
    } else {
      // Remove validators and clear values
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

    // Add required validators for first dropoff
    firstDropoff?.get('firstDropoffAddress')?.setValidators([Validators.required]);
    firstDropoff?.get('firstDropoffCity')?.setValidators([Validators.required]);
    firstDropoff?.get('firstDropoffPostcode')?.setValidators([Validators.required]);
    firstDropoff?.get('firstDropoffContactName')?.setValidators([Validators.required]);
    firstDropoff?.get('firstDropoffContactPhone')?.setValidators([Validators.required, this.phoneValidator]);

    // Add required validators for second collection
    secondCollection?.get('secondCollectionAddress')?.setValidators([Validators.required]);
    secondCollection?.get('secondCollectionCity')?.setValidators([Validators.required]);
    secondCollection?.get('secondCollectionPostcode')?.setValidators([Validators.required]);
    secondCollection?.get('secondCollectionContactName')?.setValidators([Validators.required]);
    secondCollection?.get('secondCollectionContactPhone')?.setValidators([Validators.required, this.phoneValidator]);

    // Update validity
    firstDropoff?.updateValueAndValidity();
    secondCollection?.updateValueAndValidity();
  }

  private removeSplitJourneyValidators(): void {
    const firstDropoff = this.jobForm.get('firstDropoffDetails') as FormGroup;
    const secondCollection = this.jobForm.get('secondCollectionDetails') as FormGroup;

    // Remove all validators
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

  // Form submission
  async onSubmit(): Promise<void> {
    if (this.jobForm.invalid) {
      this.markFormGroupTouched(this.jobForm);
      this.showError('Please fill in all required fields correctly');
      return;
    }

    if (!this.currentUser) {
      this.showError('User authentication required');
      return;
    }

    this.submitting = true;

    try {
      const formValue = this.jobForm.value;
      const jobData = this.transformFormDataToJob(formValue);

      // Handle both Observable and Promise returns from createJob
      const jobIdResult = this.jobService.createJob(jobData);

      let jobId: string;
      if (jobIdResult instanceof Promise) {
        jobId = await jobIdResult;
      } else {
        // If it's an Observable, convert to Promise using firstValueFrom
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
      // Basic info
      isSplitJourney: formValue.isSplitJourney || false,
      status: 'unallocated',
      stage: null,
      jobType: formValue.jobType || 'standard', // Restore jobType field

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
      collectionScheduledTime: formValue.collectionDetails.collectionScheduledTime
        ? Timestamp.fromDate(new Date(formValue.collectionDetails.collectionScheduledTime))
        : null,
      collectionNotes: formValue.collectionDetails.collectionNotes || null,

      // Delivery details
      deliveryAddress: formValue.deliveryDetails.deliveryAddress,
      deliveryCity: formValue.deliveryDetails.deliveryCity,
      deliveryPostcode: formValue.deliveryDetails.deliveryPostcode,
      deliveryContactName: formValue.deliveryDetails.deliveryContactName,
      deliveryContactPhone: formValue.deliveryDetails.deliveryContactPhone,
      deliveryContactEmail: formValue.deliveryDetails.deliveryContactEmail || null,
      deliveryScheduledTime: formValue.deliveryDetails.deliveryScheduledTime ? Timestamp.fromDate(new Date(formValue.deliveryDetails.deliveryScheduledTime)) : null,
      deliveryNotes: formValue.deliveryDetails.deliveryNotes || null,

      // Split journey details
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

      // General
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

      // Metadata
      createdBy: this.currentUser?.id || 'system',
      createdAt: now,
      updatedAt: now,
      statusUpdatedAt: now,
    };
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
    this.router.navigate(['/jobs']);
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

  get firstDropoffForm(): FormGroup {
    return this.jobForm.get('firstDropoffDetails') as FormGroup;
  }

  get secondCollectionForm(): FormGroup {
    return this.jobForm.get('secondCollectionDetails') as FormGroup;
  }

  get isSplitJourney(): boolean {
    return this.jobForm.get('isSplitJourney')?.value || false;
  }
}
