import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription, Observable, map, of } from 'rxjs';
import { CommonModule, NgFor, NgIf, AsyncPipe } from '@angular/common';

// Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatStepperModule } from '@angular/material/stepper';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';

// Firebase imports
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  collectionData,
  Timestamp,
  DocumentData,
} from '@angular/fire/firestore';

// Interfaces
interface DriverTimeline {
  id: string;
  driverId: string;
  driverName: string;
  startTime: Timestamp;
  endTime: Timestamp | null;
  notes: string;
  isCurrent: boolean;
}

interface Address {
  id: string;
  companyId: string;
  companyName: string;
  building: string;
  street: string;
  city: string;
  postcode: string;
  country: string;
  isHeadOffice: boolean;
}

// Components
import { HandoverDialogComponent } from '../handover-dialog/handover-dialog.component';

@Component({
  selector: 'app-job-form',
  templateUrl: './job-form.component.html',
  styleUrls: ['./job-form.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    AsyncPipe,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    MatStepperModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTabsModule,
    MatTableModule,
    MatDialogModule,
    MatMenuModule,
  ],
})
export class JobFormComponent implements OnInit, OnDestroy {
  private formBuilder: FormBuilder = inject(FormBuilder);
  private firestore: Firestore = inject(Firestore);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private snackBar: MatSnackBar = inject(MatSnackBar);
  private dialog: MatDialog = inject(MatDialog);

  jobForm!: FormGroup;
  isEditMode = false;
  loading = true;
  saving = false;
  jobId: string | null = null;

  // For displaying driver timeline in edit mode
  driverTimeline: DriverTimeline[] = [];
  displayedColumns: string[] = [
    'driverName',
    'startTime',
    'endTime',
    'notes',
    'current',
  ];

  // Options for dropdowns
  teams: string[] = [];
  vehicleTypes: string[] = ['Car', 'Van', 'Truck', 'Motorcycle'];
  addressOptions: Address[] = [];

  // For checking if the user is a SuperAdmin
  isSuperAdmin = true; // This would be determined by your auth service

  // Subscriptions
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.initializeForm();
    this.loadTeams();
    this.loadAddresses();

    // Check if we're in edit mode
    this.route.paramMap.subscribe((params) => {
      this.jobId = params.get('id');

      if (this.jobId) {
        this.isEditMode = true;
        this.loadJobData(this.jobId);
      } else {
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Initialize the job form
   */
  initializeForm(): void {
    this.jobForm = this.formBuilder.group({
      // Job Type
      jobType: ['Standard', Validators.required],
      customerReference: [''],
      shippingReference: ['', Validators.required],
      priority: [false],

      // Vehicle Details
      vehicleDetails: this.formBuilder.group({
        type: ['', Validators.required],
        make: ['', Validators.required],
        model: ['', Validators.required],
        registration: ['', Validators.required],
        year: [
          new Date().getFullYear(),
          [Validators.required, Validators.min(1900), Validators.max(2100)],
        ],
        location: [''],
      }),

      // Collection Details
      collectionDetails: this.formBuilder.group({
        building: ['', Validators.required],
        street: ['', Validators.required],
        city: ['', Validators.required],
        postcode: [
          '',
          [
            Validators.required,
            Validators.pattern(/^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/),
          ],
        ],
        country: ['United Kingdom', Validators.required],
        contactName: ['', Validators.required],
        contactPhone: [
          '',
          [Validators.required, Validators.pattern(/^(\+44|0)\d{10}$/)],
        ],
        contactEmail: ['', [Validators.email]],
        instructions: [''],
        date: [new Date(), Validators.required],
      }),

      // Delivery Details
      deliveryDetails: this.formBuilder.group({
        building: ['', Validators.required],
        street: ['', Validators.required],
        city: ['', Validators.required],
        postcode: [
          '',
          [
            Validators.required,
            Validators.pattern(/^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/),
          ],
        ],
        country: ['United Kingdom', Validators.required],
        contactName: ['', Validators.required],
        contactPhone: [
          '',
          [Validators.required, Validators.pattern(/^(\+44|0)\d{10}$/)],
        ],
        contactEmail: ['', [Validators.email]],
        instructions: [''],
        date: [new Date(Date.now() + 86400000), Validators.required], // Default to tomorrow
      }),

      // Secondary Points (for Split Journey)
      secondaryPoints: this.formBuilder.array([]),

      // Team Assignment
      team: ['', Validators.required],
    });

    // Listen for job type changes to add/remove validation for secondary points
    this.jobForm.get('jobType')?.valueChanges.subscribe((value) => {
      if (value === 'Split Journey') {
        this.ensureSecondaryPoint();
      }
    });
  }

  /**
   * Create a new secondary point form group
   */
  createSecondaryPointGroup(): FormGroup {
    return this.formBuilder.group({
      building: ['', Validators.required],
      street: ['', Validators.required],
      city: ['', Validators.required],
      postcode: [
        '',
        [
          Validators.required,
          Validators.pattern(/^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/),
        ],
      ],
      country: ['United Kingdom', Validators.required],
      contactName: ['', Validators.required],
      contactPhone: [
        '',
        [Validators.required, Validators.pattern(/^(\+44|0)\d{10}$/)],
      ],
      contactEmail: ['', [Validators.email]],
      instructions: [''],
    });
  }

  /**
   * Get secondary points form array
   */
  get secondaryPoints(): FormArray {
    return this.jobForm.get('secondaryPoints') as FormArray;
  }

  /**
   * Ensure there's at least one secondary point for Split Journey
   */
  ensureSecondaryPoint(): void {
    if (this.secondaryPoints.length === 0) {
      this.addSecondaryPoint();
    }
  }

  /**
   * Add a new secondary point
   */
  addSecondaryPoint(): void {
    this.secondaryPoints.push(this.createSecondaryPointGroup());
  }

  /**
   * Remove a secondary point
   */
  removeSecondaryPoint(index: number): void {
    this.secondaryPoints.removeAt(index);
  }

  /**
   * Load teams from Firestore
   */
  loadTeams(): void {
    try {
      const teamsCollection = collection(this.firestore, 'Teams');
      const teamsQuery = query(teamsCollection, orderBy('name'));

      const teamsSub = collectionData(teamsQuery, { idField: 'id' }).subscribe({
        next: (teams) => {
          this.teams = teams.map((team) => team['name']);
        },
        error: (error) => {
          console.error('Error loading teams:', error);
          this.snackBar.open(
            'Error loading teams. Please try again.',
            'Close',
            {
              duration: 5000,
              panelClass: ['error-snackbar'],
            }
          );
        },
      });

      this.subscriptions.push(teamsSub);
    } catch (error) {
      console.error('Error setting up teams subscription:', error);
    }
  }

  /**
   * Load company addresses from Firestore
   */
  loadAddresses(): void {
    try {
      const addressesCollection = collection(this.firestore, 'Addresses');
      const addressesQuery = query(addressesCollection);

      const addressesSub = collectionData(addressesQuery, {
        idField: 'id',
      }).subscribe({
        next: (addresses) => {
          this.addressOptions = addresses as Address[];
        },
        error: (error) => {
          console.error('Error loading addresses:', error);
        },
      });

      this.subscriptions.push(addressesSub);
    } catch (error) {
      console.error('Error setting up addresses subscription:', error);
    }
  }

  /**
   * Load job data for editing
   */
  async loadJobData(jobId: string): Promise<void> {
    try {
      const jobRef = doc(this.firestore, 'Jobs', jobId);
      const jobSnap = await getDoc(jobRef);

      if (jobSnap.exists()) {
        const jobData = jobSnap.data();

        // Reset the form with job data
        this.jobForm.patchValue({
          jobType: jobData['jobType'] || 'Standard',
          customerReference: jobData['customerReference'] || '',
          shippingReference: jobData['shippingReference'] || '',
          priority: jobData['priority'] || false,

          vehicleDetails: {
            type: jobData['vehicleType'] || '',
            make: jobData['vehicleMake'] || '',
            model: jobData['vehicleModel'] || '',
            registration: jobData['vehicleRegistration'] || '',
            year: jobData['vehicleYear'] || new Date().getFullYear(),
            location: jobData['vehicleLocation'] || '',
          },

          collectionDetails: {
            building: jobData['collectionBuilding'] || '',
            street: jobData['collectionStreet'] || '',
            city: jobData['collectionCity'] || '',
            postcode: jobData['collectionPostcode'] || '',
            country: jobData['collectionCountry'] || 'United Kingdom',
            contactName: jobData['collectionContactName'] || '',
            contactPhone: jobData['collectionContactPhone'] || '',
            contactEmail: jobData['collectionContactEmail'] || '',
            instructions: jobData['collectionInstructions'] || '',
            date: jobData['collectionDate']?.toDate() || new Date(),
          },

          deliveryDetails: {
            building: jobData['deliveryBuilding'] || '',
            street: jobData['deliveryStreet'] || '',
            city: jobData['deliveryCity'] || '',
            postcode: jobData['deliveryPostcode'] || '',
            country: jobData['deliveryCountry'] || 'United Kingdom',
            contactName: jobData['deliveryContactName'] || '',
            contactPhone: jobData['deliveryContactPhone'] || '',
            contactEmail: jobData['deliveryContactEmail'] || '',
            instructions: jobData['deliveryInstructions'] || '',
            date:
              jobData['deliveryDate']?.toDate() ||
              new Date(Date.now() + 86400000),
          },

          team: jobData['team'] || '',
        });

        // Handle secondary points for Split Journey
        if (
          jobData['jobType'] === 'Split Journey' &&
          jobData['secondaryPoints']?.length > 0
        ) {
          this.secondaryPoints.clear();

          jobData['secondaryPoints'].forEach((point: any) => {
            this.secondaryPoints.push(
              this.formBuilder.group({
                building: [point.building || '', Validators.required],
                street: [point.street || '', Validators.required],
                city: [point.city || '', Validators.required],
                postcode: [
                  point.postcode || '',
                  [
                    Validators.required,
                    Validators.pattern(/^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/),
                  ],
                ],
                country: [
                  point.country || 'United Kingdom',
                  Validators.required,
                ],
                contactName: [point.contactName || '', Validators.required],
                contactPhone: [
                  point.contactPhone || '',
                  [Validators.required, Validators.pattern(/^(\+44|0)\d{10}$/)],
                ],
                contactEmail: [point.contactEmail || '', [Validators.email]],
                instructions: [point.instructions || ''],
              })
            );
          });
        }

        // Load driver timeline for edit mode
        await this.loadDriverTimeline(jobId);

        this.loading = false;
      } else {
        this.snackBar.open('Job not found.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.router.navigate(['/jobs']);
      }
    } catch (error) {
      console.error('Error loading job data:', error);
      this.snackBar.open('Error loading job data. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      this.loading = false;
    }
  }

  /**
   * Load driver timeline for a job
   */
  async loadDriverTimeline(jobId: string): Promise<void> {
    try {
      const timelineCollection = collection(this.firestore, 'DriverTimeline');
      const timelineQuery = query(
        timelineCollection,
        where('jobId', '==', jobId),
        orderBy('startTime', 'desc')
      );

      const querySnapshot = await getDocs(timelineQuery);
      this.driverTimeline = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        this.driverTimeline.push({
          id: doc.id,
          driverId: data['driverId'],
          driverName: data['driverName'],
          startTime: data['startTime'],
          endTime: data['endTime'],
          notes: data['notes'],
          isCurrent: data['endTime'] === null,
        });
      });
    } catch (error) {
      console.error('Error loading driver timeline:', error);
    }
  }

  /**
   * Fill address fields from autocomplete
   */
  fillAddressFields(addressGroup: string, address: Address): void {
    const group = this.jobForm.get(addressGroup) as FormGroup;

    if (group) {
      group.patchValue({
        building: address.building,
        street: address.street,
        city: address.city,
        postcode: address.postcode,
        country: address.country,
      });
    }
  }

  /**
   * Filter addresses for autocomplete
   */
  filterAddresses(value: string): Address[] {
    const filterValue = value.toLowerCase();
    return this.addressOptions.filter(
      (address) =>
        address.companyName.toLowerCase().includes(filterValue) ||
        address.postcode.toLowerCase().includes(filterValue) ||
        address.city.toLowerCase().includes(filterValue)
    );
  }

  /**
   * Open handover dialog
   */
  openHandoverDialog(): void {
    if (!this.jobId) return;

    const dialogRef = this.dialog.open(HandoverDialogComponent, {
      width: '600px',
      data: {
        jobId: this.jobId,
        team: this.jobForm.get('team')?.value,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.success) {
        // Reload driver timeline after handover
        this.loadDriverTimeline(this.jobId!);

        this.snackBar.open('Handover completed successfully.', 'Close', {
          duration: 3000,
        });
      }
    });
  }

  /**
   * Submit the form
   */
  async onSubmit(): Promise<void> {
    if (this.jobForm.invalid) {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.jobForm);

      this.snackBar.open(
        'Please fix the validation errors before submitting.',
        'Close',
        {
          duration: 5000,
          panelClass: ['warning-snackbar'],
        }
      );
      return;
    }

    this.saving = true;

    try {
      const formValue = this.jobForm.value;

      // Create job data object
      const jobData = {
        jobType: formValue.jobType,
        customerReference: formValue.customerReference,
        shippingReference: formValue.shippingReference,
        priority: formValue.priority,

        vehicleType: formValue.vehicleDetails.type,
        vehicleMake: formValue.vehicleDetails.make,
        vehicleModel: formValue.vehicleDetails.model,
        vehicleRegistration: formValue.vehicleDetails.registration,
        vehicleYear: formValue.vehicleDetails.year,
        vehicleLocation: formValue.vehicleDetails.location,

        collectionBuilding: formValue.collectionDetails.building,
        collectionStreet: formValue.collectionDetails.street,
        collectionCity: formValue.collectionDetails.city,
        collectionPostcode: formValue.collectionDetails.postcode,
        collectionCountry: formValue.collectionDetails.country,
        collectionContactName: formValue.collectionDetails.contactName,
        collectionContactPhone: formValue.collectionDetails.contactPhone,
        collectionContactEmail: formValue.collectionDetails.contactEmail,
        collectionInstructions: formValue.collectionDetails.instructions,
        collectionDate: Timestamp.fromDate(formValue.collectionDetails.date),

        deliveryBuilding: formValue.deliveryDetails.building,
        deliveryStreet: formValue.deliveryDetails.street,
        deliveryCity: formValue.deliveryDetails.city,
        deliveryPostcode: formValue.deliveryDetails.postcode,
        deliveryCountry: formValue.deliveryDetails.country,
        deliveryContactName: formValue.deliveryDetails.contactName,
        deliveryContactPhone: formValue.deliveryDetails.contactPhone,
        deliveryContactEmail: formValue.deliveryDetails.contactEmail,
        deliveryInstructions: formValue.deliveryDetails.instructions,
        deliveryDate: Timestamp.fromDate(formValue.deliveryDetails.date),

        team: formValue.team,

        // Only include secondaryPoints if job type is Split Journey
        ...(formValue.jobType === 'Split Journey' && {
          secondaryPoints: formValue.secondaryPoints,
        }),

        // If creating a new job, set status to Unallocated
        ...(!this.isEditMode && {
          status: 'Unallocated',
          createdAt: Timestamp.now(),
        }),

        // Always update the updatedAt timestamp
        updatedAt: Timestamp.now(),
      };

      if (this.isEditMode && this.jobId) {
        // Update existing job
        const jobRef = doc(this.firestore, 'Jobs', this.jobId);
        await updateDoc(jobRef, jobData);

        this.snackBar.open('Job updated successfully.', 'Close', {
          duration: 3000,
        });
      } else {
        // Create new job
        const jobsCollection = collection(this.firestore, 'Jobs');
        const docRef = await addDoc(jobsCollection, jobData);

        this.snackBar.open('Job created successfully.', 'Close', {
          duration: 3000,
        });

        // Navigate to edit page for the new job
        this.router.navigate(['/jobs/edit', docRef.id]);
      }

      this.saving = false;
    } catch (error) {
      console.error('Error saving job:', error);
      this.snackBar.open('Error saving job. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      this.saving = false;
    }
  }

  /**
   * Cancel and navigate back
   */
  onCancel(): void {
    this.router.navigate(['/jobs']);
  }

  /**
   * Mark all controls in a form group as touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach((c) => {
          if (c instanceof FormGroup) {
            this.markFormGroupTouched(c);
          } else {
            c.markAsTouched();
          }
        });
      }
    });
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: Timestamp | null): string {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
