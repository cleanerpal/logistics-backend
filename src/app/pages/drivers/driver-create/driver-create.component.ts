import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { UserProfile, UserRole, UserPermissionKey } from '../../../interfaces/user-profile.interface';

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

  // Available options for dropdowns
  availableRoles = Object.values(UserRole);

  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private notificationService: NotificationService
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    // Check if we're in edit mode by looking for an ID in the route
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

  /**
   * Create the driver form with validation
   */
  private createForm(): void {
    this.driverForm = this.fb.group(
      {
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phoneNumber: ['', Validators.pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)],
        role: [UserRole.DRIVER, Validators.required],
        status: ['active', Validators.required],

        // Permissions
        permissions: this.fb.group({
          canAllocateJobs: [false],
          canApproveExpenses: [false],
          canCreateJobs: [false],
          canEditJobs: [false],
          canManageUsers: [false],
          canViewReports: [false],
          canViewUnallocated: [false],
          isAdmin: [false],
        }),

        // Account setup (only for new drivers)
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required],
        sendCredentials: [true],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );
  }

  /**
   * Custom validator to check if passwords match
   */
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

  /**
   * Load driver data when in edit mode
   */
  private loadDriverData(): void {
    this.isLoading = true;

    const userSub = this.authService
      .getUserById(this.driverId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (user) => {
          if (user) {
            this.updateFormWithDriverData(user);
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

  /**
   * Update form with driver data in edit mode
   */
  private updateFormWithDriverData(driver: UserProfile): void {
    // Remove password fields validation in edit mode
    this.driverForm.get('password')?.clearValidators();
    this.driverForm.get('confirmPassword')?.clearValidators();
    this.driverForm.get('password')?.updateValueAndValidity();
    this.driverForm.get('confirmPassword')?.updateValueAndValidity();

    // Update form with driver data
    this.driverForm.patchValue({
      firstName: driver.firstName || '',
      lastName: driver.lastName || '',
      email: driver.email || '',
      phoneNumber: driver.phoneNumber || '',
      role: driver.role || UserRole.DRIVER,
      status: driver.isActive ? 'active' : 'inactive',

      // Permissions
      permissions: {
        canAllocateJobs: driver.permissions?.canAllocateJobs || false,
        canApproveExpenses: driver.permissions?.canApproveExpenses || false,
        canCreateJobs: driver.permissions?.canCreateJobs || false,
        canEditJobs: driver.permissions?.canEditJobs || false,
        canManageUsers: driver.permissions?.canManageUsers || false,
        canViewReports: driver.permissions?.canViewReports || false,
        canViewUnallocated: driver.permissions?.canViewUnallocated || false,
        isAdmin: driver.permissions?.isAdmin || false,
      },
    });
  }

  /**
   * Handle role change - set default permissions based on role
   */
  onRoleChange(role: string): void {
    const permissionsGroup = this.driverForm.get('permissions') as FormGroup;

    // Reset all permissions
    Object.keys(permissionsGroup.controls).forEach((key) => {
      permissionsGroup.get(key)?.setValue(false);
    });

    // Set permissions based on role
    switch (role) {
      case UserRole.ADMIN:
        permissionsGroup.patchValue({
          canAllocateJobs: true,
          canApproveExpenses: true,
          canCreateJobs: true,
          canEditJobs: true,
          canManageUsers: true,
          canViewReports: true,
          canViewUnallocated: true,
          isAdmin: true,
        });
        break;

      case UserRole.MANAGER:
        permissionsGroup.patchValue({
          canAllocateJobs: true,
          canApproveExpenses: true,
          canCreateJobs: true,
          canEditJobs: true,
          canManageUsers: false,
          canViewReports: true,
          canViewUnallocated: true,
          isAdmin: false,
        });
        break;

      case UserRole.DISPATCHER:
        permissionsGroup.patchValue({
          canAllocateJobs: true,
          canApproveExpenses: false,
          canCreateJobs: true,
          canEditJobs: true,
          canManageUsers: false,
          canViewReports: true,
          canViewUnallocated: true,
          isAdmin: false,
        });
        break;

      case UserRole.DRIVER:
        permissionsGroup.patchValue({
          canAllocateJobs: false,
          canApproveExpenses: false,
          canCreateJobs: false,
          canEditJobs: false,
          canManageUsers: false,
          canViewReports: false,
          canViewUnallocated: false,
          isAdmin: false,
        });
        break;

      case UserRole.USER:
      default:
        permissionsGroup.patchValue({
          canAllocateJobs: false,
          canApproveExpenses: false,
          canCreateJobs: false,
          canEditJobs: false,
          canManageUsers: false,
          canViewReports: false,
          canViewUnallocated: false,
          isAdmin: false,
        });
        break;
    }
  }

  /**
   * Submit the form to create or update a driver
   */
  onSubmit(): void {
    if (this.driverForm.invalid) {
      this.markFormGroupTouched(this.driverForm);
      return;
    }

    this.isSubmitting = true;

    const formValues = this.driverForm.value;

    // Extract password for creating new user
    const password = formValues.password;
    const sendCredentials = formValues.sendCredentials;

    // Prepare user data without password fields
    const { password: _, confirmPassword: __, sendCredentials: ___, ...userData } = formValues;

    if (this.isEditMode) {
      // Update existing user
      this.updateDriver(userData);
    } else {
      // Create new user
      this.createDriver(userData, password, sendCredentials);
    }
  }

  /**
   * Create a new driver
   */
  private createDriver(userData: any, password: string, sendCredentials: boolean): void {
    const createSub = this.authService
      .signUp(userData.email, password, {
        firstName: userData.firstName,
        lastName: userData.lastName,
      })
      .subscribe({
        next: () => {
          // Now update the user profile with additional information
          this.authService.getUserByEmail(userData.email).subscribe({
            next: (user) => {
              if (user) {
                // Update user with additional information
                this.authService
                  .updateUserProfile(user.id, {
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    name: `${userData.firstName} ${userData.lastName}`.trim(),
                    phoneNumber: userData.phoneNumber,
                    role: userData.role,
                    isActive: userData.status === 'active',
                    permissions: userData.permissions,
                    updatedAt: new Date(),
                  })
                  .subscribe({
                    next: () => {
                      this.isSubmitting = false;

                      // Send email with credentials if requested
                      if (sendCredentials) {
                        // In a real app, you would call a service method to send credentials email
                        console.log('Sending email to:', userData.email);
                      }

                      this.notificationService.addNotification({
                        type: 'success',
                        title: 'Driver Created',
                        message: `${userData.firstName} ${userData.lastName} has been created successfully`,
                      });

                      this.router.navigate(['/drivers']);
                    },
                    error: (error) => {
                      this.handleError(error, 'creating driver profile');
                    },
                  });
              } else {
                this.handleError(new Error('User not found after creation'), 'finding new user');
              }
            },
            error: (error) => {
              this.handleError(error, 'finding new user');
            },
          });
        },
        error: (error) => {
          this.handleError(error, 'creating user account');
        },
      });

    this.subscriptions.push(createSub);
  }

  /**
   * Update an existing driver
   */
  private updateDriver(userData: any): void {
    const updateSub = this.authService
      .updateUserProfile(this.driverId, {
        firstName: userData.firstName,
        lastName: userData.lastName,
        name: `${userData.firstName} ${userData.lastName}`.trim(),
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        role: userData.role,
        isActive: userData.status === 'active',
        permissions: userData.permissions,
        updatedAt: new Date(),
      })
      .subscribe({
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

  /**
   * Handle form submission errors
   */
  private handleError(error: any, context: string): void {
    console.error(`Error ${context}:`, error);

    this.isSubmitting = false;

    this.notificationService.addNotification({
      type: 'error',
      title: 'Error',
      message: `Failed to ${this.isEditMode ? 'update' : 'create'} driver. ${error.message || ''}`,
    });
  }

  /**
   * Mark all form controls as touched to show validation errors
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Cancel form and return to drivers list
   */
  cancel(): void {
    if (this.isEditMode) {
      this.router.navigate(['/drivers', this.driverId]);
    } else {
      this.router.navigate(['/drivers']);
    }
  }
}
