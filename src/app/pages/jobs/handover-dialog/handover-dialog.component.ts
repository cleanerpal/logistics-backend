import {
  Component,
  ElementRef,
  Inject,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

// Firebase imports
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  getDoc,
  Timestamp,
  DocumentReference,
  CollectionReference,
  DocumentData,
  Query,
} from '@angular/fire/firestore';

// Interfaces
interface TeamMember {
  id: string;
  name: string;
  role: string;
  team: string;
}

interface DialogData {
  jobId: string;
  team: string;
}

@Component({
  selector: 'app-handover-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatStepperModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatListModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Initiate Handover</h2>

    <mat-dialog-content class="mat-typography">
      <mat-vertical-stepper [linear]="true" #stepper>
        <!-- Step 1: Handover Details -->
        <mat-step [stepControl]="handoverDetailsForm">
          <ng-template matStepLabel>Handover Details</ng-template>
          <form [formGroup]="handoverDetailsForm">
            <div class="step-content">
              <mat-form-field appearance="outline">
                <mat-label>Odometer Reading</mat-label>
                <input matInput type="number" formControlName="odometer" />
                <mat-error
                  *ngIf="
                    handoverDetailsForm.get('odometer')?.hasError('required')
                  "
                >
                  Odometer reading is required
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Current Location</mat-label>
                <input matInput formControlName="location" />
                <mat-error
                  *ngIf="
                    handoverDetailsForm.get('location')?.hasError('required')
                  "
                >
                  Current location is required
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Handover Reason</mat-label>
                <mat-select formControlName="reason">
                  <mat-option value="Standard Break">Standard Break</mat-option>
                  <mat-option value="Emergency">Emergency</mat-option>
                  <mat-option value="Planned Rotation"
                    >Planned Rotation</mat-option
                  >
                  <mat-option value="Other">Other</mat-option>
                </mat-select>
                <mat-error
                  *ngIf="
                    handoverDetailsForm.get('reason')?.hasError('required')
                  "
                >
                  Handover reason is required
                </mat-error>
              </mat-form-field>

              <ng-container
                *ngIf="handoverDetailsForm.get('reason')?.value === 'Other'"
              >
                <mat-form-field appearance="outline">
                  <mat-label>Notes</mat-label>
                  <textarea
                    matInput
                    formControlName="notes"
                    rows="3"
                  ></textarea>
                  <mat-error
                    *ngIf="
                      handoverDetailsForm.get('notes')?.hasError('required')
                    "
                  >
                    Notes are required for "Other" reason
                  </mat-error>
                </mat-form-field>
              </ng-container>
            </div>

            <div class="step-actions">
              <button
                mat-button
                matStepperNext
                [disabled]="handoverDetailsForm.invalid"
              >
                Next <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </form>
        </mat-step>

        <!-- Step 2: Driver Selection -->
        <mat-step [stepControl]="driverSelectionForm">
          <ng-template matStepLabel>Driver Selection</ng-template>
          <form [formGroup]="driverSelectionForm">
            <div class="step-content">
              <h3>Select New Driver</h3>

              <div class="driver-list-container" *ngIf="teamMembers.length > 0">
                <mat-selection-list
                  formControlName="driverId"
                  [multiple]="false"
                >
                  <mat-list-option
                    *ngFor="let driver of teamMembers"
                    [value]="driver.id"
                  >
                    <div class="driver-option">
                      <div class="driver-info">
                        <div class="driver-name">{{ driver.name }}</div>
                        <div class="driver-role">{{ driver.role }}</div>
                      </div>
                      <mat-icon class="selection-icon">arrow_forward</mat-icon>
                    </div>
                  </mat-list-option>
                </mat-selection-list>
              </div>

              <div class="no-drivers" *ngIf="teamMembers.length === 0">
                <p>No available drivers found for this team.</p>
              </div>
            </div>

            <div class="step-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button
                mat-button
                matStepperNext
                [disabled]="driverSelectionForm.invalid"
              >
                Next <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </form>
        </mat-step>

        <!-- Step 3: Confirmation / Signatures -->
        <mat-step>
          <ng-template matStepLabel>Confirmation</ng-template>
          <div class="step-content">
            <h3>Signature Confirmation</h3>

            <div class="signatures-container">
              <div class="signature-section">
                <h4>Current Driver's Signature</h4>
                <div class="signature-box">
                  <canvas
                    #currentDriverSignature
                    width="300"
                    height="150"
                  ></canvas>
                </div>
                <div class="signature-actions">
                  <button
                    mat-stroked-button
                    type="button"
                    (click)="clearSignature('current')"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div class="signature-section">
                <h4>New Driver's Signature</h4>
                <div class="signature-box">
                  <canvas #newDriverSignature width="300" height="150"></canvas>
                </div>
                <div class="signature-actions">
                  <button
                    mat-stroked-button
                    type="button"
                    (click)="clearSignature('new')"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div class="skip-signature-section">
              <div class="skip-checkbox-container">
                <mat-checkbox
                  [formControl]="skipSignaturesControl"
                  color="warn"
                >
                  Skip signatures (requires notes)
                </mat-checkbox>
              </div>

              <mat-form-field
                appearance="outline"
                *ngIf="skipSignaturesControl.value"
                class="skip-notes-field"
              >
                <mat-label>Signature Skip Reason</mat-label>
                <textarea
                  matInput
                  [formControl]="skipNotesControl"
                  rows="3"
                  placeholder="Explain why signatures are being skipped..."
                ></textarea>
                <mat-error *ngIf="skipNotesControl.hasError('required')">
                  Notes are required when skipping signatures
                </mat-error>
              </mat-form-field>
            </div>
          </div>

          <div class="step-actions">
            <button mat-button matStepperPrevious>
              <mat-icon>arrow_back</mat-icon> Back
            </button>
            <button
              mat-raised-button
              color="primary"
              (click)="completeHandover()"
              [disabled]="submitDisabled || saving"
            >
              <mat-spinner diameter="20" *ngIf="saving"></mat-spinner>
              <span *ngIf="!saving">
                <mat-icon>check</mat-icon> Complete Handover
              </span>
            </button>
          </div>
        </mat-step>
      </mat-vertical-stepper>
    </mat-dialog-content>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        max-width: 600px;
      }

      .mat-mdc-dialog-title {
        color: #4a3c31;
      }

      .mat-vertical-stepper {
        background-color: transparent;
      }

      .step-content {
        margin-top: 16px;
        margin-bottom: 16px;

        h3 {
          color: #4a3c31;
          margin-top: 0;
          margin-bottom: 16px;
        }
      }

      .step-actions {
        display: flex;
        justify-content: space-between;
        margin-top: 24px;

        button {
          &:last-child {
            margin-left: auto;
          }
        }
      }

      .driver-list-container {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
      }

      .driver-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .driver-info {
        display: flex;
        flex-direction: column;
      }

      .driver-name {
        font-weight: 500;
      }

      .driver-role {
        font-size: 12px;
        color: #666666;
      }

      .selection-icon {
        color: #c19a6b;
      }

      .no-drivers {
        padding: 16px;
        text-align: center;
        color: #666666;
        font-style: italic;
        background-color: #f5f5f5;
        border-radius: 4px;
      }

      .signatures-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
        margin-bottom: 24px;

        @media (min-width: 768px) {
          flex-direction: row;
        }
      }

      .signature-section {
        flex: 1;

        h4 {
          margin-top: 0;
          margin-bottom: 8px;
          color: #4a3c31;
        }
      }

      .signature-box {
        width: 100%;
        height: 150px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        margin-bottom: 8px;
        overflow: hidden;

        canvas {
          width: 100%;
          height: 100%;
          background-color: white;
        }
      }

      .signature-actions {
        display: flex;
        justify-content: flex-end;
      }

      .skip-signature-section {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #e0e0e0;
      }

      .skip-checkbox-container {
        margin-bottom: 16px;
      }

      .skip-notes-field {
        width: 100%;
      }
    `,
  ],
})
export class HandoverDialogComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private formBuilder: FormBuilder = inject(FormBuilder);
  private dialogRef: MatDialogRef<HandoverDialogComponent> = inject(
    MatDialogRef<HandoverDialogComponent>
  );
  private snackBar: MatSnackBar = inject(MatSnackBar);

  @Inject(MAT_DIALOG_DATA) private data: DialogData;

  @ViewChild('currentDriverSignature')
  currentDriverCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('newDriverSignature')
  newDriverCanvas!: ElementRef<HTMLCanvasElement>;

  handoverDetailsForm: FormGroup;
  driverSelectionForm: FormGroup;
  skipSignaturesControl = this.formBuilder.control(false);
  skipNotesControl = this.formBuilder.control({ value: '', disabled: true }, [
    Validators.required,
  ]);

  teamMembers: TeamMember[] = [];

  // Signature canvas contexts
  private currentDriverCtx: CanvasRenderingContext2D | null = null;
  private newDriverCtx: CanvasRenderingContext2D | null = null;

  // Signature drawing flags
  private isDrawingCurrent = false;
  private isDrawingNew = false;

  // State flags
  saving = false;

  // Current driver info
  currentDriverId: string | null = null;
  currentDriverName: string = 'Unknown';

  constructor(@Inject(MAT_DIALOG_DATA) data: DialogData) {
    this.data = data;

    // Initialize forms
    this.handoverDetailsForm = this.formBuilder.group({
      odometer: ['', [Validators.required]],
      location: ['', [Validators.required]],
      reason: ['', [Validators.required]],
      notes: [''],
    });

    this.driverSelectionForm = this.formBuilder.group({
      driverId: ['', [Validators.required]],
    });

    // Listen for reason changes to handle notes validation
    this.handoverDetailsForm.get('reason')?.valueChanges.subscribe((value) => {
      const notesControl = this.handoverDetailsForm.get('notes');
      if (value === 'Other') {
        notesControl?.setValidators([Validators.required]);
      } else {
        notesControl?.clearValidators();
      }
      notesControl?.updateValueAndValidity();
    });

    // Listen for skip signatures control
    this.skipSignaturesControl.valueChanges.subscribe((value) => {
      if (value) {
        this.skipNotesControl.enable();
      } else {
        this.skipNotesControl.disable();
      }
    });
  }

  ngOnInit(): void {
    this.loadTeamMembers();
    this.loadCurrentDriver();
  }

  ngAfterViewInit(): void {
    // Initialize signature canvases
    setTimeout(() => {
      this.initializeSignatureCanvases();
    }, 500);
  }

  /**
   * Load team members for driver selection
   */
  async loadTeamMembers(): Promise<void> {
    try {
      const q = query(
        collection(this.firestore, 'Users'),
        where('team', '==', this.data.team)
      );

      const querySnapshot = await getDocs(q);

      this.teamMembers = [];

      if (querySnapshot.docs.length > 0) {
        querySnapshot.docs.forEach((doc) => {
          const data = doc.data() as TeamMember;
          this.teamMembers.push(data);
        });
      }
    } catch (error) {
      console.error('Error loading team members:', error);
      this.snackBar.open(
        'Error loading team members. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    }
  }

  /**
   * Load current driver info
   */
  async loadCurrentDriver(): Promise<void> {
    try {
      if (!this.data.jobId) {
        console.error('No job ID provided');
        return;
      }

      const jobRef = doc(this.firestore, 'Jobs', this.data.jobId);
      const jobSnap = await getDoc(jobRef);

      if (jobSnap.exists()) {
        const data = jobSnap.data();

        if (data['currentDriverId']) {
          this.currentDriverId = data['currentDriverId'];

          // Load driver name
          if (this.currentDriverId) {
            const userRef = doc(this.firestore, 'Users', this.currentDriverId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
              const userData = userSnap.data();
              this.currentDriverName =
                userData['displayName'] || userData['email'] || 'Unknown';
            }
          }
        }
      }

      // Load handover history
      const handoversRef = collection(this.firestore, 'Handovers');
      const handoversQuery = query(
        handoversRef,
        where('jobId', '==', this.data.jobId)
      );
      const handoversSnap = await getDocs(handoversQuery);
    } catch (error) {
      console.error('Error loading current driver:', error);
    }
  }

  /**
   * Initialize signature canvases
   */
  initializeSignatureCanvases(): void {
    // Current driver signature
    const currentCanvas = this.currentDriverCanvas.nativeElement;
    this.currentDriverCtx = currentCanvas.getContext('2d');

    if (this.currentDriverCtx) {
      this.currentDriverCtx.lineWidth = 2;
      this.currentDriverCtx.lineCap = 'round';
      this.currentDriverCtx.strokeStyle = '#333333';

      // Set up event listeners
      this.setupSignatureEvents(currentCanvas, 'current');
    }

    // New driver signature
    const newCanvas = this.newDriverCanvas.nativeElement;
    this.newDriverCtx = newCanvas.getContext('2d');

    if (this.newDriverCtx) {
      this.newDriverCtx.lineWidth = 2;
      this.newDriverCtx.lineCap = 'round';
      this.newDriverCtx.strokeStyle = '#333333';

      // Set up event listeners
      this.setupSignatureEvents(newCanvas, 'new');
    }
  }

  /**
   * Set up event listeners for signature canvas
   */
  setupSignatureEvents(
    canvas: HTMLCanvasElement,
    type: 'current' | 'new'
  ): void {
    const ctx = type === 'current' ? this.currentDriverCtx : this.newDriverCtx;
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // Start drawing
    canvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      lastX = e.clientX - rect.left;
      lastY = e.clientY - rect.top;
    });

    // Draw
    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();

      lastX = x;
      lastY = y;

      if (type === 'current') {
        this.isDrawingCurrent = true;
      } else {
        this.isDrawingNew = true;
      }
    });

    // Stop drawing
    ['mouseup', 'mouseout'].forEach((event) => {
      canvas.addEventListener(event, () => {
        isDrawing = false;
      });
    });

    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      lastX = touch.clientX - rect.left;
      lastY = touch.clientY - rect.top;
      isDrawing = true;
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isDrawing || !ctx) return;

      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();

      lastX = x;
      lastY = y;

      if (type === 'current') {
        this.isDrawingCurrent = true;
      } else {
        this.isDrawingNew = true;
      }
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      isDrawing = false;
    });
  }

  /**
   * Clear signature
   */
  clearSignature(type: 'current' | 'new'): void {
    if (type === 'current' && this.currentDriverCtx) {
      const canvas = this.currentDriverCanvas.nativeElement;
      this.currentDriverCtx.clearRect(0, 0, canvas.width, canvas.height);
      this.isDrawingCurrent = false;
    } else if (type === 'new' && this.newDriverCtx) {
      const canvas = this.newDriverCanvas.nativeElement;
      this.newDriverCtx.clearRect(0, 0, canvas.width, canvas.height);
      this.isDrawingNew = false;
    }
  }

  /**
   * Get signature data URL
   */
  getSignatureDataUrl(type: 'current' | 'new'): string | null {
    const canvas =
      type === 'current'
        ? this.currentDriverCanvas?.nativeElement
        : this.newDriverCanvas?.nativeElement;

    return canvas ? canvas.toDataURL() : null;
  }

  /**
   * Check if submit is disabled
   */
  get submitDisabled(): boolean {
    if (this.skipSignaturesControl.value) {
      return this.skipNotesControl.invalid;
    } else {
      return !this.isDrawingCurrent || !this.isDrawingNew;
    }
  }

  /**
   * Complete handover process
   */
  async completeHandover(): Promise<void> {
    // Check forms validity
    if (this.handoverDetailsForm.invalid || this.driverSelectionForm.invalid) {
      this.snackBar.open('Please complete all required fields.', 'Close', {
        duration: 3000,
      });
      return;
    }

    // Check signature or skip notes
    if (
      !this.skipSignaturesControl.value &&
      (!this.isDrawingCurrent || !this.isDrawingNew)
    ) {
      this.snackBar.open(
        'Both signatures are required or check "Skip signatures".',
        'Close',
        {
          duration: 3000,
        }
      );
      return;
    }

    if (this.skipSignaturesControl.value && this.skipNotesControl.invalid) {
      this.snackBar.open(
        'Notes are required when skipping signatures.',
        'Close',
        {
          duration: 3000,
        }
      );
      return;
    }

    this.saving = true;

    try {
      // Get form values
      const handoverDetails = this.handoverDetailsForm.value;
      const newDriverId = this.driverSelectionForm.get('driverId')?.value;

      // Create handover record
      const handoverCollection = collection(this.firestore, 'Handovers');
      await addDoc(handoverCollection, {
        jobId: this.data.jobId,
        previousDriverId: this.currentDriverId,
        newDriverId: newDriverId,
        odometer: handoverDetails.odometer,
        location: handoverDetails.location,
        reason: handoverDetails.reason,
        notes: handoverDetails.reason === 'Other' ? handoverDetails.notes : '',
        skipSignatures: this.skipSignaturesControl.value,
        skipSignaturesNotes: this.skipSignaturesControl.value
          ? this.skipNotesControl.value
          : '',
        previousDriverSignature: this.skipSignaturesControl.value
          ? null
          : this.getSignatureDataUrl('current'),
        newDriverSignature: this.skipSignaturesControl.value
          ? null
          : this.getSignatureDataUrl('new'),
        timestamp: Timestamp.now(),
      });

      // Update job with new driver
      const jobRef = doc(this.firestore, 'Jobs', this.data.jobId);
      await updateDoc(jobRef, {
        currentDriverId: newDriverId,
        updatedAt: Timestamp.now(),
      });

      // Add to driver timeline
      const timelineCollection = collection(this.firestore, 'DriverTimeline');

      // End previous driver's timeline
      if (this.currentDriverId) {
        const timelineQuery = query(
          timelineCollection,
          where('jobId', '==', this.data.jobId),
          where('driverId', '==', this.currentDriverId),
          where('endTime', '==', null)
        );

        const querySnapshot = await getDocs(timelineQuery);

        if (querySnapshot.docs.length > 0) {
          querySnapshot.docs.forEach((doc) => {
            const data = doc.data() as DocumentData;
            if (data['notes']) {
              updateDoc(doc.ref, {
                endTime: Timestamp.now(),
                notes: `Handover to another driver: ${data['notes']}`,
              });
            }
          });
        }
      }

      // Get new driver name
      let newDriverName = '';
      const selectedDriver = this.teamMembers.find(
        (driver) => driver.id === newDriverId
      );
      if (selectedDriver) {
        newDriverName = selectedDriver.name;
      }

      // Start new driver's timeline
      await addDoc(timelineCollection, {
        jobId: this.data.jobId,
        driverId: newDriverId,
        driverName: newDriverName,
        startTime: Timestamp.now(),
        endTime: null,
        notes: `Received handover: ${handoverDetails.reason}`,
        isCurrent: true,
      });

      // Close dialog with success
      this.dialogRef.close({ success: true });
    } catch (error) {
      console.error('Error completing handover:', error);
      this.snackBar.open(
        'Error completing handover. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
      this.saving = false;
    }
  }
}
