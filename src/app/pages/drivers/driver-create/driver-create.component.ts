import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';
import { DriverService } from '../../../services/driver.service';
import { NotificationService } from '../../../services/notification.service';
import { UserProfile, UserRole, ROLE_PERMISSION_PRESETS } from '../../../interfaces/user-profile.interface';

@Component({
  selector: 'app-driver-create',
  templateUrl: './driver-create.component.html',
  styleUrls: ['./driver-create.component.scss'],
  standalone: false,
})
export class DriverCreateComponent implements OnInit, OnDestroy {
  driverForm!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  isEditMode = false;
  driverId: string = '';
  hidePassword = true;

  isCurrentUserAdmin = false;

  availableRoles = Object.values(UserRole);

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private driverService: DriverService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private notificationService: NotificationService
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    const adminSub = this.authService.getUserProfile().subscribe((userProfile) => {
      this.isCurrentUserAdmin = !!userProfile?.permissions?.isAdmin;

      this.setPermissionsReadonly(!this.isCurrentUserAdmin);

      if (!this.isCurrentUserAdmin) {
        this.availableRoles = this.availableRoles.filter((role) => role !== UserRole.ADMIN);
      }
    });

    this.subscriptions.push(adminSub);

    const routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEditMode = true;
        this.driverId = id;
        this.loadDriverData();
      }
    });
    this.subscriptions.push(routeSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private createForm(): void {
    this.driverForm = this.fb.group(
      {
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phoneNumber: ['', Validators.pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)],
        role: [UserRole.DRIVER, Validators.required],
        status: ['active', Validators.required],
        company: [''],
        type: ['customer'],
        licenseNumber: [''],
        licenseExpiry: [null],
        vehicleType: [''],
        areaCoverage: [''],
        availability: ['Full-time'],

        permissions: this.fb.group({
          canAllocateJobs: [{ value: false, disabled: true }],
          canApproveExpenses: [{ value: false, disabled: true }],
          canCreateJobs: [{ value: false, disabled: true }],
          canEditJobs: [{ value: false, disabled: true }],
          canManageUsers: [{ value: false, disabled: true }],
          canViewReports: [{ value: false, disabled: true }],
          canViewUnallocated: [{ value: false, disabled: true }],
          isAdmin: [{ value: false, disabled: true }],
          canViewSystemSettings: [{ value: false, disabled: true }],
          canManageCompanies: [{ value: false, disabled: true }],
          canViewAllJobs: [{ value: false, disabled: true }],
          canViewAssignedJobs: [{ value: true, disabled: true }],
          canCreateExpenses: [{ value: false, disabled: true }],
        }),

        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
        sendCredentials: [true],
        notes: [''],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );

    this.applyRolePermissions(UserRole.DRIVER);
  }

  private setPermissionsReadonly(readonly: boolean): void {
    const permissionsGroup = this.driverForm.get('permissions') as FormGroup;
    if (!permissionsGroup) return;

    Object.keys(permissionsGroup.controls).forEach((controlName) => {
      const control = permissionsGroup.get(controlName);
      if (control) {
        if (readonly) {
          control.disable();
        } else {
          if (controlName !== 'isAdmin' || this.isCurrentUserAdmin) {
            control.enable();
          }
        }
      }
    });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    if (password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    return null;
  }

  private loadDriverData(): void {
    this.isLoading = true;

    const userSub = this.driverService
      .getDriverById(this.driverId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (driver) => {
          if (driver) {
            this.updateFormWithDriverData(driver);
          } else {
            this.notificationService.addNotification({
              type: 'error',
              title: 'Error',
              message: 'Driver not found',
            });
            this.router.navigate(['/drivers']);
          }
        },
        error: (error) => {
          console.error('Error loading driver:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to load driver data',
          });
          this.router.navigate(['/drivers']);
        },
      });

    this.subscriptions.push(userSub);
  }

  private updateFormWithDriverData(driver: UserProfile): void {
    this.driverForm.get('password')?.clearValidators();
    this.driverForm.get('confirmPassword')?.clearValidators();
    this.driverForm.get('password')?.updateValueAndValidity();
    this.driverForm.get('confirmPassword')?.updateValueAndValidity();

    const driverRole = driver.role || '';
    if (driverRole === UserRole.ADMIN && !this.isCurrentUserAdmin) {
      this.notificationService.addNotification({
        type: 'warning',
        title: 'Permission Restricted',
        message: 'You do not have permission to edit admin accounts. Contact an administrator for help.',
      });
      this.router.navigate(['/drivers']);
      return;
    }

    this.driverForm.patchValue({
      firstName: driver.firstName || '',
      lastName: driver.lastName || '',
      email: driver.email || '',
      phoneNumber: driver.phoneNumber || driver.phone || '',
      role: driver.role || UserRole.DRIVER,
      status: driver.isActive ? 'active' : 'inactive',
      company: driver.company || '',
      type: driver.type || 'customer',
      licenseNumber: driver.licenseNumber || '',
      licenseExpiry: driver.licenseExpiry || null,
      vehicleType: driver.vehicleType || '',
      areaCoverage: driver.areaCoverage || '',
      availability: driver.availability || 'Full-time',
      notes: driver.notes || '',
    });

    const permissionsGroup = this.driverForm.get('permissions') as FormGroup;
    if (permissionsGroup && driver.permissions) {
      Object.keys(driver.permissions).forEach((key) => {
        const control = permissionsGroup.get(key);
        if (control) {
          control.setValue(!!driver.permissions?.[key]);
        }
      });
    }
  }

  onRoleChange(event: any): void {
    const selectedRole = event.value as UserRole;
    this.applyRolePermissions(selectedRole);
  }

  private applyRolePermissions(role: UserRole): void {
    const permissionsGroup = this.driverForm.get('permissions') as FormGroup;
    if (!permissionsGroup) return;

    const presetPermissions = ROLE_PERMISSION_PRESETS[role];
    if (!presetPermissions) return;

    Object.entries(presetPermissions).forEach(([key, value]) => {
      const control = permissionsGroup.get(key);
      if (control) {
        if (key === 'isAdmin' && value === true && !this.isCurrentUserAdmin) {
          return;
        }

        control.setValue(value);
      }
    });
  }

  onSubmit(): void {
    if (this.driverForm.invalid) {
      this.markFormGroupTouched(this.driverForm);
      return;
    }

    this.isSubmitting = true;

    const formValues = this.driverForm.value;
    const permissionsGroup = this.driverForm.get('permissions') as FormGroup;

    if (permissionsGroup && permissionsGroup.disabled) {
      const role = (formValues.role as UserRole) || UserRole.DRIVER;
      formValues.permissions = ROLE_PERMISSION_PRESETS[role];

      if (!this.isCurrentUserAdmin && formValues.permissions) {
        formValues.permissions.isAdmin = false;
      }
    }

    if (this.isEditMode) {
      this.updateDriver(formValues);
    } else {
      this.createDriver(formValues);
    }
  }

  private createDriver(formValues: any): void {
    const { password, confirmPassword, sendCredentials, ...userData } = formValues;

    const createSub = this.driverService.createDriver(userData.email, password, userData, sendCredentials).subscribe({
      next: (driverId) => {
        this.isSubmitting = false;

        this.notificationService.addNotification({
          type: 'success',
          title: 'Driver Created',
          message: `${userData.firstName} ${userData.lastName} has been created successfully`,
        });

        this.router.navigate(['/drivers']);
      },
      error: (error) => {
        this.handleError(error, 'creating driver');
      },
    });

    this.subscriptions.push(createSub);
  }

  private updateDriver(formValues: any): void {
    const { password, confirmPassword, sendCredentials, ...userData } = formValues;

    const updateSub = this.driverService.updateDriver(this.driverId, userData).subscribe({
      next: () => {
        this.isSubmitting = false;

        this.notificationService.addNotification({
          type: 'success',
          title: 'Driver Updated',
          message: `${userData.firstName} ${userData.lastName} has been updated successfully`,
        });

        this.router.navigate(['/drivers', this.driverId]);
      },
      error: (error) => {
        this.handleError(error, 'updating driver');
      },
    });

    this.subscriptions.push(updateSub);
  }

  private handleError(error: any, context: string): void {
    console.error(`Error ${context}:`, error);

    this.isSubmitting = false;

    this.notificationService.addNotification({
      type: 'error',
      title: 'Error',
      message: `Failed to ${this.isEditMode ? 'update' : 'create'} driver. ${error.message || ''}`,
    });
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  cancel(): void {
    if (this.isEditMode) {
      this.router.navigate(['/drivers', this.driverId]);
    } else {
      this.router.navigate(['/drivers']);
    }
  }

  canManageAdminPermissions(): boolean {
    return this.isCurrentUserAdmin;
  }
}
