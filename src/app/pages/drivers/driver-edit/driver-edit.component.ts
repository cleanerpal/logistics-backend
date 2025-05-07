import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';
import { DriverService } from '../../../services/driver.service';
import { NotificationService } from '../../../services/notification.service';
import { UserProfile, UserRole, ROLE_PERMISSION_PRESETS } from '../../../interfaces/user-profile.interface';

@Component({
  selector: 'app-driver-edit',
  templateUrl: './driver-edit.component.html',
  styleUrls: ['./driver-edit.component.scss'],
  standalone: false,
})
export class DriverEditComponent implements OnInit, OnDestroy {
  driverForm!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  driverId: string = '';
  driver: UserProfile | null = null;

  // Current user permissions
  isCurrentUserAdmin = false;

  // Available options for dropdowns
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
    // Check if the current user is an admin
    const adminSub = this.authService.getUserProfile().subscribe((userProfile) => {
      this.isCurrentUserAdmin = !!userProfile?.permissions?.isAdmin;

      // Make permissions form controls readonly if not admin
      this.setPermissionsReadonly(!this.isCurrentUserAdmin);

      // If not admin, remove Admin from available roles
      if (!this.isCurrentUserAdmin) {
        this.availableRoles = this.availableRoles.filter((role) => role !== UserRole.ADMIN);
      }
    });

    this.subscriptions.push(adminSub);

    // Get driver ID from route
    const routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.driverId = id;
        this.loadDriverData();
      } else {
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: 'Driver ID not provided',
        });
        this.router.navigate(['/drivers']);
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
    this.driverForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', Validators.pattern(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)],
      role: [UserRole.DRIVER, Validators.required],
      status: ['active', Validators.required],

      // Additional driver details
      company: [''],
      type: ['customer'],
      licenseNumber: [''],
      licenseExpiry: [''],
      vehicleType: [''],
      areaCoverage: [''],
      availability: [''],

      // Permissions
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
    });
  }

  /**
   * Set permissions form controls to readonly or editable
   */
  private setPermissionsReadonly(readonly: boolean): void {
    const permissionsGroup = this.driverForm.get('permissions') as FormGroup;
    if (!permissionsGroup) return;

    Object.keys(permissionsGroup.controls).forEach((controlName) => {
      const control = permissionsGroup.get(controlName);
      if (control) {
        if (readonly) {
          control.disable();
        } else {
          // Only enable non-admin controls or if the current user is admin
          if (controlName !== 'isAdmin' || this.isCurrentUserAdmin) {
            control.enable();
          }
        }
      }
    });
  }

  /**
   * Load driver data
   */
  private loadDriverData(): void {
    this.isLoading = true;

    const userSub = this.driverService
      .getDriverById(this.driverId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (driver) => {
          if (driver) {
            this.driver = driver;
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

  /**
   * Update form with driver data
   */
  private updateFormWithDriverData(driver: UserProfile): void {
    // Check if editing an admin and current user is not admin
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

    // Update form with driver data
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
      licenseExpiry: driver.licenseExpiry || '',
      vehicleType: driver.vehicleType || '',
      areaCoverage: driver.areaCoverage || '',
      availability: driver.availability || '',
    });

    // Update permissions values with null safety checks
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

  /**
   * Handle role change - set default permissions based on role
   */
  onRoleChange(event: any): void {
    const selectedRole = event.value as UserRole;
    this.applyRolePermissions(selectedRole);
  }

  /**
   * Apply preset permissions based on selected role
   */
  private applyRolePermissions(role: UserRole): void {
    const permissionsGroup = this.driverForm.get('permissions') as FormGroup;
    if (!permissionsGroup) return;

    // Get the preset permissions for the selected role
    const presetPermissions = ROLE_PERMISSION_PRESETS[role];
    if (!presetPermissions) return;

    // Apply each permission to the form
    Object.entries(presetPermissions).forEach(([key, value]) => {
      const control = permissionsGroup.get(key);
      if (control) {
        // Check if setting admin status and current user is not admin
        if (key === 'isAdmin' && value === true && !this.isCurrentUserAdmin) {
          // Skip setting admin status
          return;
        }

        control.setValue(value);
      }
    });
  }

  /**
   * Submit the form to update driver
   */
  onSubmit(): void {
    if (this.driverForm.invalid) {
      this.markFormGroupTouched(this.driverForm);
      return;
    }

    this.isSubmitting = true;

    const formValues = this.driverForm.value;
    const permissionsGroup = this.driverForm.get('permissions') as FormGroup;

    // Set permissions from the role if controls are disabled (non-admin user)
    if (permissionsGroup && permissionsGroup.disabled) {
      const role = (formValues.role as UserRole) || UserRole.DRIVER;
      formValues.permissions = ROLE_PERMISSION_PRESETS[role];

      // Ensure non-admins can't set admin status
      if (!this.isCurrentUserAdmin) {
        formValues.permissions.isAdmin = false;
      }
    }

    // Update driver
    this.updateDriver(formValues);
  }

  /**
   * Update driver
   */
  private updateDriver(formValues: any): void {
    const updateSub = this.driverService.updateDriver(this.driverId, formValues).subscribe({
      next: () => {
        this.isSubmitting = false;

        this.notificationService.addNotification({
          type: 'success',
          title: 'Driver Updated',
          message: `${formValues.firstName} ${formValues.lastName} has been updated successfully`,
        });

        this.router.navigate(['/drivers', this.driverId]);
      },
      error: (error) => {
        this.handleError(error);
      },
    });

    this.subscriptions.push(updateSub);
  }

  /**
   * Handle form submission errors
   */
  private handleError(error: any): void {
    console.error('Error updating driver:', error);

    this.isSubmitting = false;

    this.notificationService.addNotification({
      type: 'error',
      title: 'Error',
      message: `Failed to update driver. ${error.message || ''}`,
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
   * Cancel form and return to driver details
   */
  cancel(): void {
    this.router.navigate(['/drivers', this.driverId]);
  }

  /**
   * Check if current user can edit admin permissions
   */
  canManageAdminPermissions(): boolean {
    return this.isCurrentUserAdmin;
  }

  /**
   * Get available driver types
   */
  getDriverTypes(): string[] {
    return ['customer', 'supplier', 'partner'];
  }

  /**
   * Get available availability options
   */
  getAvailabilityOptions(): string[] {
    return ['Full-time', 'Part-time', 'Weekdays Only', 'Weekends Only', 'On Demand'];
  }
}
