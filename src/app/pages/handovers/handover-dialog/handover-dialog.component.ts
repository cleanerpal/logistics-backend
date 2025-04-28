import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { FirebaseService } from '../../../services/firebase.service';
import {
  Firestore,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Observable, Subscription } from 'rxjs';

interface Driver {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'Driver' | 'Admin' | 'SuperAdmin';
}

interface Job {
  id: string;
  jobId: string;
  vehicleId: string;
  currentDriverId: string;
  currentDriver: string;
  status: string;
}

@Component({
  selector: 'app-handover-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatListModule,
    MatSnackBarModule,
  ],
  templateUrl: './handover-dialog.component.html',
  styleUrls: ['./handover-dialog.component.scss'],
})
export class HandoverDialogComponent implements OnInit, OnDestroy {
  // Form groups for each step
  detailsForm: FormGroup;
  driversForm: FormGroup;
  confirmationForm: FormGroup;

  // Canvas references for signatures
  @ViewChild('fromSignatureCanvas')
  fromSignatureCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('toSignatureCanvas')
  toSignatureCanvas!: ElementRef<HTMLCanvasElement>;

  // Data for dropdowns and selections
  activeJobs: Job[] = [];
  availableDrivers: Driver[] = [];
  reasonOptions = [
    { value: 'standardBreak', label: 'Standard Break' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'plannedRotation', label: 'Planned Rotation' },
    { value: 'other', label: 'Other' },
  ];

  // UI state
  loadingJobs = false;
  loadingDrivers = false;
  submitting = false;

  // Drawing state
  private fromDrawing = false;
  private toDrawing = false;
  private fromSignatureContext: CanvasRenderingContext2D | null = null;
  private toSignatureContext: CanvasRenderingContext2D | null = null;

  // Current selected job (for step 2)
  selectedJob: Job | null = null;

  // Subscriptions
  private jobsSubscription: Subscription | null = null;
  private driversSubscription: Subscription | null = null;

  constructor(
    private dialogRef: MatDialogRef<HandoverDialogComponent>,
    private fb: FormBuilder,
    private firestore: Firestore,
    private firebaseService: FirebaseService,
    private snackBar: MatSnackBar
  ) {
    // Initialize forms
    this.detailsForm = this.fb.group({
      jobId: ['', Validators.required],
      vehicleId: [{ value: '', disabled: true }],
      fromDriver: [{ value: '', disabled: true }],
      odometer: [
        '',
        [
          Validators.required,
          Validators.min(0),
          Validators.pattern(/^[0-9]+$/),
        ],
      ],
      location: ['', Validators.required],
      reason: ['', Validators.required],
      customReason: [''],
    });

    this.driversForm = this.fb.group({
      toDriverId: ['', Validators.required],
    });

    this.confirmationForm = this.fb.group({
      skipFromSignature: [false],
      skipToSignature: [false],
      fromSignatureNotes: [''],
      toSignatureNotes: [''],
      notes: [''],
    });

    // Add conditional validators for signature notes when skipped
    this.confirmationForm
      .get('skipFromSignature')
      ?.valueChanges.subscribe((skip) => {
        const fromSignatureNotesControl =
          this.confirmationForm.get('fromSignatureNotes');
        if (skip) {
          fromSignatureNotesControl?.setValidators([Validators.required]);
        } else {
          fromSignatureNotesControl?.clearValidators();
        }
        fromSignatureNotesControl?.updateValueAndValidity();
      });

    this.confirmationForm
      .get('skipToSignature')
      ?.valueChanges.subscribe((skip) => {
        const toSignatureNotesControl =
          this.confirmationForm.get('toSignatureNotes');
        if (skip) {
          toSignatureNotesControl?.setValidators([Validators.required]);
        } else {
          toSignatureNotesControl?.clearValidators();
        }
        toSignatureNotesControl?.updateValueAndValidity();
      });
  }

  ngOnInit(): void {
    this.loadActiveJobs();
    this.loadAvailableDrivers();

    // Listen for job selection to update vehicle and from driver
    this.detailsForm.get('jobId')?.valueChanges.subscribe((jobId) => {
      if (jobId) {
        const selectedJob = this.activeJobs.find((job) => job.id === jobId);
        if (selectedJob) {
          this.selectedJob = selectedJob;
          this.detailsForm.patchValue({
            vehicleId: selectedJob.vehicleId,
            fromDriver: selectedJob.currentDriver,
          });
        }
      }
    });

    // Add conditional validators for custom reason when reason is "other"
    this.detailsForm.get('reason')?.valueChanges.subscribe((reason) => {
      const customReasonControl = this.detailsForm.get('customReason');
      if (reason === 'other') {
        customReasonControl?.setValidators([Validators.required]);
      } else {
        customReasonControl?.clearValidators();
      }
      customReasonControl?.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void {
    if (this.jobsSubscription) {
      this.jobsSubscription.unsubscribe();
    }
    if (this.driversSubscription) {
      this.driversSubscription.unsubscribe();
    }
  }

  loadActiveJobs(): void {
    this.loadingJobs = true;

    // Query active jobs that can be handed over (status not completed or cancelled)
    const jobsCollection = collection(this.firestore, 'jobs');
    const jobsQuery = query(
      jobsCollection,
      where('status', 'not-in', ['completed', 'cancelled'])
    );

    this.jobsSubscription = this.firebaseService
      .getCollectionWithSnapshot<any>('jobs', [
        where('status', 'not-in', ['completed', 'cancelled']),
      ])
      .subscribe(
        (jobs) => {
          this.activeJobs = jobs.map((job) => ({
            id: job.id,
            jobId: job.jobId || job.id,
            vehicleId: job.vehicleId || 'N/A',
            currentDriverId: job.currentDriverId || 'N/A',
            currentDriver: job.currentDriver || 'N/A',
            status: job.status,
          }));
          this.loadingJobs = false;
        },
        (error) => {
          console.error('Error loading active jobs:', error);
          this.snackBar.open('Error loading active jobs', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loadingJobs = false;
        }
      );
  }

  loadAvailableDrivers(): void {
    this.loadingDrivers = true;

    // Query users with Driver role
    const usersCollection = collection(this.firestore, 'users');
    const driversQuery = query(
      usersCollection,
      where('role', 'in', ['Driver', 'Admin', 'SuperAdmin'])
    );

    this.driversSubscription = this.firebaseService
      .getCollectionWithSnapshot<any>('users', [
        where('role', 'in', ['Driver', 'Admin', 'SuperAdmin']),
      ])
      .subscribe(
        (users) => {
          this.availableDrivers = users.map((user) => ({
            id: user.id,
            displayName: user.displayName || user.email || 'Unknown Driver',
            email: user.email || 'N/A',
            photoURL: user.photoURL,
            role: user.role || 'Driver',
          }));
          this.loadingDrivers = false;
        },
        (error) => {
          console.error('Error loading available drivers:', error);
          this.snackBar.open('Error loading available drivers', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loadingDrivers = false;
        }
      );
  }

  // Initialize signature canvases after view is initialized
  initializeSignatureCanvases(): void {
    if (this.fromSignatureCanvas && this.toSignatureCanvas) {
      const fromCanvas = this.fromSignatureCanvas.nativeElement;
      const toCanvas = this.toSignatureCanvas.nativeElement;

      this.fromSignatureContext = fromCanvas.getContext('2d');
      this.toSignatureContext = toCanvas.getContext('2d');

      if (this.fromSignatureContext && this.toSignatureContext) {
        // Set up canvas styling
        this.fromSignatureContext.lineWidth = 2;
        this.fromSignatureContext.strokeStyle = '#4A3C31';
        this.fromSignatureContext.lineJoin = 'round';
        this.fromSignatureContext.lineCap = 'round';

        this.toSignatureContext.lineWidth = 2;
        this.toSignatureContext.strokeStyle = '#4A3C31';
        this.toSignatureContext.lineJoin = 'round';
        this.toSignatureContext.lineCap = 'round';
      }
    }
  }

  // Start drawing on a signature canvas
  startDrawing(
    event: MouseEvent | TouchEvent,
    canvasType: 'from' | 'to'
  ): void {
    event.preventDefault();

    if (canvasType === 'from') {
      if (this.confirmationForm.get('skipFromSignature')?.value) return;

      this.fromDrawing = true;
      const clientX = this.getClientX(event);
      const clientY = this.getClientY(event);
      const canvas = this.fromSignatureCanvas.nativeElement;
      const rect = canvas.getBoundingClientRect();

      this.fromSignatureContext?.beginPath();
      this.fromSignatureContext?.moveTo(
        clientX - rect.left,
        clientY - rect.top
      );
    } else {
      if (this.confirmationForm.get('skipToSignature')?.value) return;

      this.toDrawing = true;
      const clientX = this.getClientX(event);
      const clientY = this.getClientY(event);
      const canvas = this.toSignatureCanvas.nativeElement;
      const rect = canvas.getBoundingClientRect();

      this.toSignatureContext?.beginPath();
      this.toSignatureContext?.moveTo(clientX - rect.left, clientY - rect.top);
    }
  }

  // Draw on a signature canvas
  draw(event: MouseEvent | TouchEvent, canvasType: 'from' | 'to'): void {
    event.preventDefault();

    if (canvasType === 'from' && this.fromDrawing) {
      const clientX = this.getClientX(event);
      const clientY = this.getClientY(event);
      const canvas = this.fromSignatureCanvas.nativeElement;
      const rect = canvas.getBoundingClientRect();

      this.fromSignatureContext?.lineTo(
        clientX - rect.left,
        clientY - rect.top
      );
      this.fromSignatureContext?.stroke();
    } else if (canvasType === 'to' && this.toDrawing) {
      const clientX = this.getClientX(event);
      const clientY = this.getClientY(event);
      const canvas = this.toSignatureCanvas.nativeElement;
      const rect = canvas.getBoundingClientRect();

      this.toSignatureContext?.lineTo(clientX - rect.left, clientY - rect.top);
      this.toSignatureContext?.stroke();
    }
  }

  // Stop drawing on a signature canvas
  stopDrawing(canvasType: 'from' | 'to'): void {
    if (canvasType === 'from') {
      this.fromDrawing = false;
    } else {
      this.toDrawing = false;
    }
  }

  // Helper to get client X position from mouse or touch event
  private getClientX(event: MouseEvent | TouchEvent): number {
    if (event instanceof MouseEvent) {
      return event.clientX;
    } else {
      return (event as TouchEvent).touches[0].clientX;
    }
  }

  // Helper to get client Y position from mouse or touch event
  private getClientY(event: MouseEvent | TouchEvent): number {
    if (event instanceof MouseEvent) {
      return event.clientY;
    } else {
      return (event as TouchEvent).touches[0].clientY;
    }
  }

  // Clear a signature canvas
  clearSignature(canvasType: 'from' | 'to'): void {
    if (canvasType === 'from' && this.fromSignatureContext) {
      const canvas = this.fromSignatureCanvas.nativeElement;
      this.fromSignatureContext.clearRect(0, 0, canvas.width, canvas.height);
    } else if (canvasType === 'to' && this.toSignatureContext) {
      const canvas = this.toSignatureCanvas.nativeElement;
      this.toSignatureContext.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Check if a signature canvas is empty
  isSignatureEmpty(canvasType: 'from' | 'to'): boolean {
    if (canvasType === 'from') {
      const canvas = this.fromSignatureCanvas?.nativeElement;
      if (!canvas) return true;

      const context = canvas.getContext('2d');
      if (!context) return true;

      const pixelData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data;
      for (let i = 3; i < pixelData.length; i += 4) {
        if (pixelData[i] > 0) return false;
      }
      return true;
    } else {
      const canvas = this.toSignatureCanvas?.nativeElement;
      if (!canvas) return true;

      const context = canvas.getContext('2d');
      if (!context) return true;

      const pixelData = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data;
      for (let i = 3; i < pixelData.length; i += 4) {
        if (pixelData[i] > 0) return false;
      }
      return true;
    }
  }

  // Get a driver name by ID
  getDriverName(driverId: string): string {
    const driver = this.availableDrivers.find((d) => d.id === driverId);
    return driver ? driver.displayName : 'Unknown Driver';
  }

  // Get a reason label
  getReasonLabel(): string {
    const reason = this.detailsForm.get('reason')?.value;
    if (reason === 'other') {
      return this.detailsForm.get('customReason')?.value || '';
    }
    return this.reasonOptions.find((r) => r.value === reason)?.label || '';
  }

  // Submit the handover
  submitHandover(): void {
    this.submitting = true;

    // Validate forms
    if (
      !this.detailsForm.valid ||
      !this.driversForm.valid ||
      !this.confirmationForm.valid
    ) {
      this.snackBar.open('Please complete all required fields', 'Close', {
        duration: 5000,
      });
      this.submitting = false;
      return;
    }

    // Check signatures
    const skipFromSignature =
      this.confirmationForm.get('skipFromSignature')?.value;
    const skipToSignature = this.confirmationForm.get('skipToSignature')?.value;

    if (!skipFromSignature && this.isSignatureEmpty('from')) {
      this.snackBar.open('From driver signature is required', 'Close', {
        duration: 5000,
      });
      this.submitting = false;
      return;
    }

    if (!skipToSignature && this.isSignatureEmpty('to')) {
      this.snackBar.open('To driver signature is required', 'Close', {
        duration: 5000,
      });
      this.submitting = false;
      return;
    }

    // Collect handover data
    const job = this.activeJobs.find(
      (j) => j.id === this.detailsForm.get('jobId')?.value
    );
    const toDriverId = this.driversForm.get('toDriverId')?.value;
    const toDriver = this.getDriverName(toDriverId);
    const reason = this.detailsForm.get('reason')?.value;
    const customReason = this.detailsForm.get('customReason')?.value;

    // Get signatures as Base64 strings
    let fromSignature = null;
    let toSignature = null;

    if (!skipFromSignature) {
      fromSignature = this.fromSignatureCanvas.nativeElement.toDataURL();
    }

    if (!skipToSignature) {
      toSignature = this.toSignatureCanvas.nativeElement.toDataURL();
    }

    // Create handover data object
    const handoverData = {
      jobId: job?.jobId || 'Unknown',
      vehicleId: job?.vehicleId || 'Unknown',
      fromDriver: job?.currentDriver || 'Unknown',
      fromDriverId: job?.currentDriverId || 'Unknown',
      toDriver,
      toDriverId,
      timestamp: serverTimestamp(),
      location: this.detailsForm.get('location')?.value,
      odometer: parseInt(this.detailsForm.get('odometer')?.value),
      reason:
        reason === 'other'
          ? customReason
          : this.reasonOptions.find((r) => r.value === reason)?.label,
      notes: this.confirmationForm.get('notes')?.value || '',
      fromSignature,
      toSignature,
      fromSignatureNotes: skipFromSignature
        ? this.confirmationForm.get('fromSignatureNotes')?.value
        : '',
      toSignatureNotes: skipToSignature
        ? this.confirmationForm.get('toSignatureNotes')?.value
        : '',
      status: 'completed',
    };

    // Save handover to Firestore
    const handoversCollection = collection(this.firestore, 'driverHandovers');
    addDoc(handoversCollection, handoverData)
      .then((docRef) => {
        // Update job's current driver
        if (job) {
          this.firebaseService
            .updateDocument('jobs', job.id, {
              currentDriverId: toDriverId,
              currentDriver: toDriver,
              lastHandoverTimestamp: serverTimestamp(),
            })
            .then(() => {
              this.dialogRef.close({ ...handoverData, id: docRef.id });
            })
            .catch((error) => {
              console.error('Error updating job:', error);
              this.snackBar.open(
                'Handover created but job not updated',
                'Close',
                { duration: 5000 }
              );
              this.dialogRef.close({ ...handoverData, id: docRef.id });
            });
        } else {
          this.dialogRef.close({ ...handoverData, id: docRef.id });
        }
      })
      .catch((error) => {
        console.error('Error creating handover:', error);
        this.snackBar.open('Error creating handover', 'Close', {
          duration: 5000,
          panelClass: 'error-snackbar',
        });
        this.submitting = false;
      });
  }

  // Close dialog
  cancel(): void {
    this.dialogRef.close();
  }
}
