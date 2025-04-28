import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  collectionData,
  Timestamp,
} from '@angular/fire/firestore';

// Models
interface Team {
  id: string;
  name: string;
}

@Component({
  selector: 'app-driver-form',
  templateUrl: './driver-form.component.html',
  styleUrls: ['./driver-form.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
})
export class DriverFormComponent implements OnInit, OnDestroy {
  driverForm!: FormGroup;
  isEditMode = false;
  loading = true;
  saving = false;
  driverId: string | null = null;
  teams: Team[] = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private firestore: Firestore,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadTeams();

    // Check if we're in edit mode
    this.route.paramMap.subscribe((params) => {
      this.driverId = params.get('id');

      if (this.driverId) {
        this.isEditMode = true;
        this.loadDriverData(this.driverId);
      } else {
        this.loading = false;
        this.generateDriverId();
      }
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Initialize the driver form
   */
  private initializeForm(): void {
    this.driverForm = this.formBuilder.group({
      id: [{ value: '', disabled: true }],
      displayName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(\+\d{1,3}[- ]?)?\d{10,14}$/),
        ],
      ],
      team: ['', Validators.required],
      role: [{ value: 'Driver', disabled: true }],
    });
  }

  /**
   * Generate a unique driver ID
   */
  private async generateDriverId(): Promise<void> {
    // Format: DRV-XXXXXX (where X is a random alphanumeric character)
    const generateRandomId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = 'DRV-';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Check if ID already exists
    const checkIdExists = async (id: string): Promise<boolean> => {
      const usersRef = collection(this.firestore, 'Users');
      const q = query(usersRef, where('id', '==', id));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    };

    // Generate a unique ID
    let newId = generateRandomId();
    let exists = await checkIdExists(newId);

    // Keep generating until we find a unique ID
    while (exists) {
      newId = generateRandomId();
      exists = await checkIdExists(newId);
    }

    this.driverForm.get('id')?.setValue(newId);
  }

  /**
   * Load teams from Firestore
   */
  private loadTeams(): void {
    try {
      const teamsCollection = collection(this.firestore, 'Teams');
      const teamsQuery = query(teamsCollection);

      const teamsSub = collectionData(teamsQuery, { idField: 'id' }).subscribe({
        next: (teams: any) => {
          this.teams = teams as Team[];
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
   * Load driver data for editing
   */
  private async loadDriverData(driverId: string): Promise<void> {
    try {
      const driverRef = doc(this.firestore, 'Users', driverId);
      const driverSnap = await getDoc(driverRef);

      if (driverSnap.exists()) {
        const driverData = driverSnap.data();

        // Populate the form with driver data
        this.driverForm.patchValue({
          id: driverId,
          displayName: driverData['displayName'] || '',
          email: driverData['email'] || '',
          phoneNumber: driverData['phoneNumber'] || '',
          team: driverData['team'] || '',
          role: 'Driver',
        });

        this.loading = false;
      } else {
        this.snackBar.open('Driver not found.', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.router.navigate(['/drivers']);
      }
    } catch (error) {
      console.error('Error loading driver data:', error);
      this.snackBar.open(
        'Error loading driver data. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
      this.loading = false;
    }
  }

  /**
   * Submit the form
   */
  async onSubmit(): Promise<void> {
    if (this.driverForm.invalid) {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.driverForm);

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
      const formValue = this.driverForm.getRawValue(); // Include disabled fields

      // Create driver data object
      const driverData = {
        displayName: formValue.displayName,
        email: formValue.email,
        phoneNumber: formValue.phoneNumber,
        team: formValue.team,
        role: 'Driver',
        updatedAt: Timestamp.now(),
      };

      if (this.isEditMode) {
        // Update existing driver
        const driverRef = doc(this.firestore, 'Users', this.driverId!);
        await updateDoc(driverRef, driverData);

        this.snackBar.open('Driver updated successfully.', 'Close', {
          duration: 3000,
        });
      } else {
        // Create new driver
        const newDriverId = formValue.id;
        const newDriverRef = doc(this.firestore, 'Users', newDriverId);

        await setDoc(newDriverRef, {
          ...driverData,
          id: newDriverId,
          createdAt: Timestamp.now(),
        });

        this.snackBar.open('Driver created successfully.', 'Close', {
          duration: 3000,
        });
      }

      this.router.navigate(['/drivers']);
    } catch (error) {
      console.error('Error saving driver:', error);
      this.snackBar.open('Error saving driver. Please try again.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.saving = false;
    }
  }

  /**
   * Cancel and navigate back
   */
  onCancel(): void {
    this.router.navigate(['/drivers']);
  }

  /**
   * Mark all controls in a form group as touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
