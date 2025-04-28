import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { FirebaseService } from '../../../services/firebase.service';
import { AuditLogsService } from '../../../services/audit-logs.service';
import { Subject, takeUntil } from 'rxjs';

interface UserData {
  displayName: string;
  email: string;
  role: string;
  team: string;
  driverId: string;
}

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.scss'],
})
export class UserFormComponent implements OnInit, OnDestroy {
  userForm: FormGroup;
  isEditMode = false;
  userId?: string;
  isLoading = false;
  isSaving = false;

  roles = [
    { value: 'SuperAdmin', label: 'Super Admin' },
    { value: 'Admin', label: 'Admin' },
    { value: 'Driver', label: 'Driver' },
  ];

  teams = [
    { value: 'Belfast', label: 'Belfast Team' },
    { value: 'Derry', label: 'Derry Team' },
    { value: 'Newry', label: 'Newry Team' },
    { value: 'Lisburn', label: 'Lisburn Team' },
    { value: 'Ballymena', label: 'Ballymena Team' },
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private firebaseService: FirebaseService,
    private auditLogsService: AuditLogsService,
    private snackBar: MatSnackBar
  ) {
    this.userForm = this.createForm();
  }

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (params['id']) {
        this.isEditMode = true;
        this.userId = params['id'];
        if (this.userId) {
          this.loadUserData(this.userId);
        }
      }
    });

    // Handle role changes to show/hide driver-specific fields
    this.userForm
      .get('role')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((role) => {
        if (role === 'Driver') {
          this.userForm.get('driverId')?.enable();
          this.userForm.get('team')?.setValidators([Validators.required]);
        } else {
          this.userForm.get('driverId')?.disable();
          this.userForm.get('team')?.clearValidators();
        }
        this.userForm.get('team')?.updateValueAndValidity();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      displayName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      role: ['', [Validators.required]],
      team: [''],
      driverId: [{ value: this.generateDriverId(), disabled: true }],
    });
  }

  private loadUserData(userId: string): void {
    this.isLoading = true;

    this.firebaseService
      .getDocumentWithSnapshot<UserData>('users', userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (userData) => {
          if (userData) {
            this.userForm.patchValue({
              displayName: userData.displayName || '',
              email: userData.email || '',
              role: userData.role || '',
              team: userData.team || '',
              driverId: userData.driverId || this.generateDriverId(),
            });

            // Enable or disable driver ID field based on role
            if (userData.role === 'Driver') {
              this.userForm.get('driverId')?.enable();
              this.userForm.get('team')?.setValidators([Validators.required]);
              this.userForm.get('team')?.updateValueAndValidity();
            }
          } else {
            this.snackBar.open('User not found', 'Close', { duration: 3000 });
            this.router.navigate(['/users']);
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading user data:', error);
          this.snackBar.open('Error loading user data', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.isLoading = false;
          this.router.navigate(['/users']);
        },
      });
  }

  private generateDriverId(): string {
    // Generate a random driver ID with format DRV-XXXXX
    const randomId = Math.floor(10000 + Math.random() * 90000);
    return `DRV-${randomId}`;
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.markFormGroupTouched(this.userForm);
      return;
    }

    this.isSaving = true;
    const userData = this.prepareUserData();

    if (this.isEditMode && this.userId) {
      this.updateUser(this.userId, userData);
    } else {
      this.createUser(userData);
    }
  }

  private prepareUserData(): any {
    const formValue = this.userForm.value;
    const userData: any = {
      displayName: formValue.displayName,
      email: formValue.email,
      role: formValue.role,
    };

    if (formValue.team) {
      userData.team = formValue.team;
    }

    if (formValue.role === 'Driver') {
      userData.driverId =
        this.userForm.get('driverId')?.value || this.generateDriverId();
    }

    return userData;
  }

  private createUser(userData: any): void {
    this.firebaseService
      .addDocument('users', userData)
      .then((id) => {
        // Log to audit logs
        this.auditLogsService.createAuditLog({
          action: 'CREATE',
          resource: 'users',
          resourceId: id,
          details: `Created user: ${userData.displayName} (${userData.email})`,
          userName: userData.displayName,
          userId: id,
        });

        this.snackBar.open('User created successfully', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/users']);
      })
      .catch((error) => {
        console.error('Error creating user:', error);
        this.snackBar.open('Error creating user', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.isSaving = false;
      });
  }

  private updateUser(userId: string, userData: any): void {
    this.firebaseService
      .updateDocument('users', userId, userData)
      .then(() => {
        // Log to audit logs
        this.auditLogsService.createAuditLog({
          action: 'UPDATE',
          resource: 'users',
          resourceId: userId,
          details: `Updated user: ${userData.displayName} (${userData.email})`,
          userName: userData.displayName,
          userId: userId,
        });

        this.snackBar.open('User updated successfully', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/users']);
      })
      .catch((error) => {
        console.error('Error updating user:', error);
        this.snackBar.open('Error updating user', 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.isSaving = false;
      });
  }

  cancelEdit(): void {
    this.router.navigate(['/users']);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if ((control as FormGroup).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }
}
