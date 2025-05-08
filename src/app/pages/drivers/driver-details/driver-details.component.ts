import { Location } from '@angular/common';
import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Observable, Subscription, forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';

import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Job } from '../../../interfaces/job.interface';
import { UserProfile, UserRole } from '../../../interfaces/user-profile.interface';
import { AuthService } from '../../../services/auth.service';
import { DriverNote, DriverService, DriverStats } from '../../../services/driver.service';
import { JobService } from '../../../services/job.service';
import { NotificationService } from '../../../services/notification.service';
import { LeaveRequest, LeaveRequestStatus } from '../../../interfaces/leave-request.interface';
import { LeaveRequestService } from '../../../services/leave-request.service';
import { LeaveRequestProcessDialogComponent } from '../../../pages/leave-requests/leave-request-process-dialog/leave-request-process-dialog.component';
import { LeaveRequestCreateDialogComponent } from '../../../pages/leave-requests/leave-request-create-dialog/leave-request-create-dialog.component';

interface PermissionInfo {
  key: string;
  name: string;
  description: string;
}

@Component({
  selector: 'app-driver-details',
  templateUrl: './driver-details.component.html',
  styleUrls: ['./driver-details.component.scss'],
  standalone: false,
})
export class DriverDetailsComponent implements OnInit, OnDestroy {
  driverId: string = '';
  driver: UserProfile | null = null;
  isLoading = true;
  hasEditPermission = false;
  activeTab: 'details' | 'jobs' | 'leave' | 'permissions' | 'notes' = 'details';

  // Jobs table
  jobsDataSource = new MatTableDataSource<Job>([]);
  jobColumns: string[] = ['id', 'status', 'vehicle', 'collection', 'delivery', 'date', 'actions'];
  isJobsLoading = false;

  // Leave requests table
  leaveRequestsDataSource = new MatTableDataSource<LeaveRequest>([]);
  leaveColumns: string[] = ['type', 'dates', 'duration', 'status', 'submitted', 'actions'];
  isLeaveRequestsLoading = false;
  hasLeaveApprovePermission = false;

  // Driver stats
  driverStats: DriverStats = {
    totalJobs: 0,
    pendingJobs: 0,
    completedJobs: 0,
    pendingExpenses: 0,
  };

  // Driver notes
  driverNotes: DriverNote[] = [];
  isNotesLoading = false;

  // Permissions
  permissionsForm!: FormGroup;
  availableRoles = Object.values(UserRole);

  // Notes
  noteForm!: FormGroup;
  editingNote: DriverNote | null = null;

  // Permission list
  permissionList: PermissionInfo[] = [
    {
      key: 'canAllocateJobs',
      name: 'Allocate Jobs',
      description: 'Ability to assign jobs to drivers',
    },
    {
      key: 'canApproveExpenses',
      name: 'Approve Expenses',
      description: 'Ability to approve expense claims submitted by drivers',
    },
    {
      key: 'canCreateJobs',
      name: 'Create Jobs',
      description: 'Ability to create new jobs in the system',
    },
    {
      key: 'canEditJobs',
      name: 'Edit Jobs',
      description: 'Ability to modify existing job details',
    },
    {
      key: 'canManageUsers',
      name: 'Manage Users',
      description: 'Ability to create, edit, and delete users',
    },
    {
      key: 'canViewReports',
      name: 'View Reports',
      description: 'Access to system reports and analytics',
    },
    {
      key: 'canViewUnallocated',
      name: 'View Unallocated Jobs',
      description: 'Ability to see jobs that have not been assigned to a driver',
    },
    {
      key: 'isAdmin',
      name: 'Administrator',
      description: 'Full system access with all permissions granted',
    },
    {
      key: 'canViewSystemSettings',
      name: 'View System Settings',
      description: 'Access to system configuration and settings',
    },
    {
      key: 'canManageCompanies',
      name: 'Manage Companies',
      description: 'Ability to create and edit company information',
    },
    {
      key: 'canViewAllJobs',
      name: 'View All Jobs',
      description: 'Access to see all jobs in the system regardless of assignment',
    },
    {
      key: 'canViewAssignedJobs',
      name: 'View Assigned Jobs',
      description: 'Ability to see jobs assigned to the driver',
    },
    {
      key: 'canCreateExpenses',
      name: 'Create Expenses',
      description: 'Ability to submit expense claims',
    },
  ];

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('permissionsDialog') permissionsDialog!: TemplateRef<any>;
  @ViewChild('noteDialog') noteDialog!: TemplateRef<any>;

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private authService: AuthService,
    private driverService: DriverService,
    private jobService: JobService,
    private notificationService: NotificationService,
    private leaveRequestService: LeaveRequestService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private fb: FormBuilder
  ) {
    this.createForms();
  }

  ngOnInit(): void {
    // Get driver ID from route
    const routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.driverId = id;
        this.loadDriverDetails();
      } else {
        this.router.navigate(['/drivers']);
      }
    });
    this.subscriptions.push(routeSub);

    // Check permissions
    const permissionSub = this.authService.hasPermission('canManageUsers').subscribe((hasPermission) => {
      this.hasEditPermission = hasPermission;
    });
    this.subscriptions.push(permissionSub);

    // Check leave request approval permissions
    const leavePermissionSub = this.authService.hasAnyPermission(['canApproveLeaveRequests', 'isAdmin']).subscribe((hasPermission) => {
      this.hasLeaveApprovePermission = hasPermission;
    });
    this.subscriptions.push(leavePermissionSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private createForms(): void {
    // Permissions form
    this.permissionsForm = this.fb.group({
      role: ['', Validators.required],
    });

    // Note form
    this.noteForm = this.fb.group({
      content: ['', Validators.required],
    });
  }

  /**
   * Load driver details and related data
   */
  loadDriverDetails(): void {
    this.isLoading = true;

    const detailsSub = this.driverService
      .getDriverById(this.driverId)
      .pipe(
        tap((driver) => {
          this.driver = driver;
        }),
        switchMap((driver) => {
          if (driver) {
            // Load related data in parallel
            return forkJoin({
              jobs: this.loadDriverJobs(),
              notes: this.loadDriverNotes(),
              leaveRequests: this.loadDriverLeaveRequests(),
              stats: this.driverService.getDriverStats(driver.id),
            });
          }
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        }),
        catchError((error) => {
          console.error('Error loading driver details:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to load driver details',
          });
          this.router.navigate(['/drivers']);
          return of(null);
        })
      )
      .subscribe((result) => {
        if (result && this.driver) {
          this.driverStats = result.stats;
        }
      });

    this.subscriptions.push(detailsSub);
  }

  /**
   * Load driver jobs
   */
  loadDriverJobs(): Observable<Job[]> {
    this.isJobsLoading = true;

    return this.jobService.getJobsByDriver(this.driverId).pipe(
      tap((jobs) => {
        this.jobsDataSource.data = jobs;
        setTimeout(() => {
          if (this.sort && this.paginator) {
            this.jobsDataSource.sort = this.sort;
            this.jobsDataSource.paginator = this.paginator;
          }
        });
        this.isJobsLoading = false;
      }),
      catchError((error) => {
        console.error('Error loading driver jobs:', error);
        this.isJobsLoading = false;
        return of([]);
      })
    );
  }

  /**
   * Load driver notes
   */
  loadDriverNotes(): Observable<DriverNote[]> {
    this.isNotesLoading = true;

    return this.driverService.getDriverNotes(this.driverId).pipe(
      tap((notes) => {
        this.driverNotes = notes;
        this.isNotesLoading = false;
      }),
      catchError((error) => {
        console.error('Error loading driver notes:', error);
        this.isNotesLoading = false;
        return of([]);
      })
    );
  }

  /**
   * Load driver leave requests
   */
  loadDriverLeaveRequests(): Observable<LeaveRequest[]> {
    this.isLeaveRequestsLoading = true;

    return this.leaveRequestService.getDriverLeaveRequests(this.driverId).pipe(
      tap((leaveRequests) => {
        this.leaveRequestsDataSource.data = leaveRequests;
        setTimeout(() => {
          if (this.sort && this.paginator) {
            this.leaveRequestsDataSource.sort = this.sort;
            this.leaveRequestsDataSource.paginator = this.paginator;
          }
        });
        this.isLeaveRequestsLoading = false;
      }),
      catchError((error) => {
        console.error('Error loading leave requests:', error);
        this.isLeaveRequestsLoading = false;
        return of([]);
      })
    );
  }

  /**
   * Open permissions dialog
   */
  editPermissions(): void {
    if (!this.driver) return;

    // Initialize form with current role
    this.permissionsForm.patchValue({
      role: this.driver.role || UserRole.DRIVER,
    });

    this.dialog.open(this.permissionsDialog, {
      width: '500px',
      disableClose: true,
    });
  }

  /**
   * Save updated permissions based on role
   */
  savePermissions(): void {
    if (!this.driver) return;

    const role = this.permissionsForm.value.role as UserRole;

    this.driverService.updateDriverPermissions(this.driverId, role).subscribe({
      next: () => {
        this.dialog.closeAll();
        this.notificationService.addNotification({
          type: 'success',
          title: 'Permissions Updated',
          message: `The driver permissions have been set to ${role} role successfully`,
        });
        this.loadDriverDetails(); // Refresh driver data
      },
      error: (error) => {
        console.error('Error updating permissions:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to update permissions',
        });
      },
    });
  }

  /**
   * Open note dialog for adding
   */
  addNote(): void {
    this.editingNote = null;
    this.noteForm.reset();
    this.dialog.open(this.noteDialog, {
      width: '500px',
    });
  }

  /**
   * Open note dialog for editing
   */
  editNote(note: DriverNote): void {
    this.editingNote = note;
    this.noteForm.patchValue({
      content: note.content,
    });
    this.dialog.open(this.noteDialog, {
      width: '500px',
    });
  }

  /**
   * Save new or updated note
   */
  saveNote(): void {
    if (this.noteForm.invalid || !this.driver) return;

    const content = this.noteForm.get('content')?.value;

    // Get current user for author info
    this.authService.getUserProfile().subscribe((userProfile) => {
      if (!userProfile) {
        this.snackBar.open('You must be logged in to add notes', 'Close', { duration: 3000 });
        return;
      }

      if (this.editingNote) {
        // Update existing note
        this.driverService.updateDriverNote(this.editingNote.id, content).subscribe({
          next: () => {
            this.dialog.closeAll();
            this.loadDriverNotes(); // Refresh notes
            this.snackBar.open('Note updated successfully', 'Close', { duration: 3000 });
          },
          error: (error) => {
            console.error('Error updating note:', error);
            this.snackBar.open('Error updating note', 'Close', { duration: 3000 });
          },
        });
      } else {
        // Add new note
        this.driverService.addDriverNote(this.driverId, content, userProfile.id, userProfile.name).subscribe({
          next: () => {
            this.dialog.closeAll();
            this.loadDriverNotes(); // Refresh notes
            this.snackBar.open('Note added successfully', 'Close', { duration: 3000 });
          },
          error: (error) => {
            console.error('Error adding note:', error);
            this.snackBar.open('Error adding note', 'Close', { duration: 3000 });
          },
        });
      }
    });
  }

  /**
   * Delete note
   */
  deleteNote(note: DriverNote): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Note',
        message: 'Are you sure you want to delete this note? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.driverService.deleteDriverNote(note.id).subscribe({
          next: () => {
            this.loadDriverNotes(); // Refresh notes
            this.snackBar.open('Note deleted successfully', 'Close', { duration: 3000 });
          },
          error: (error) => {
            console.error('Error deleting note:', error);
            this.snackBar.open('Error deleting note', 'Close', { duration: 3000 });
          },
        });
      }
    });
  }

  /**
   * Delete driver
   */
  deleteDriver(): void {
    if (!this.driver) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Driver',
        message: `Are you sure you want to delete ${this.driver.firstName} ${this.driver.lastName}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
        icon: 'delete_forever',
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Deactivate the driver (soft delete)
        this.driverService.deactivateDriver(this.driverId).subscribe({
          next: () => {
            this.notificationService.addNotification({
              type: 'success',
              title: 'Driver Deleted',
              message: `${this.driver?.firstName} ${this.driver?.lastName} has been deleted successfully`,
            });
            this.router.navigate(['/drivers']);
          },
          error: (error) => {
            console.error('Error deleting driver:', error);
            this.notificationService.addNotification({
              type: 'error',
              title: 'Error',
              message: 'Failed to delete driver',
            });
          },
        });
      }
    });
  }

  /**
   * Navigate to edit driver page
   */
  editDriver(): void {
    this.router.navigate(['/drivers', this.driverId, 'edit']);
  }

  /**
   * Send message to driver
   */
  sendMessage(): void {
    // This would integrate with a messaging system in a real app
    this.snackBar.open('Messaging functionality will be implemented in a future release', 'Close', {
      duration: 3000,
    });
  }

  /**
   * Handle unassign job
   */
  unassignJob(job: Job): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Unassign Job',
        message: `Are you sure you want to unassign job ${job.id} from this driver?`,
        confirmText: 'Unassign',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.jobService.unallocateJob(job.id).subscribe({
          next: () => {
            this.loadDriverJobs(); // Refresh jobs list
            // Refresh driver stats
            this.driverService.getDriverStats(this.driverId).subscribe((stats) => {
              this.driverStats = stats;
            });

            this.notificationService.addNotification({
              type: 'success',
              title: 'Job Unassigned',
              message: `Job ${job.id} has been unassigned successfully`,
            });
          },
          error: (error) => {
            console.error('Error unassigning job:', error);
            this.notificationService.addNotification({
              type: 'error',
              title: 'Error',
              message: 'Failed to unassign job',
            });
          },
        });
      }
    });
  }

  /**
   * Check if a job can be unassigned (based on status)
   */
  canUnassignJob(job: Job): boolean {
    // Only allow unassigning if the job is allocated (not yet started)
    return job.status === 'allocated' || job.status === 'unallocated';
  }

  /**
   * Navigate to view job details
   */
  viewJobDetails(jobId: string): void {
    this.router.navigate(['/jobs', jobId]);
  }

  /**
   * Navigate to edit job
   */
  editJob(jobId: string): void {
    this.router.navigate(['/jobs', jobId, 'edit']);
  }

  /**
   * Set active tab
   */
  setActiveTab(tab: 'details' | 'jobs' | 'leave' | 'permissions' | 'notes'): void {
    this.activeTab = tab;
  }

  /**
   * Get initials for driver avatar
   */
  getDriverInitials(driver: UserProfile | null): string {
    if (!driver) return '??';

    if (driver.name && driver.name.length > 0) {
      const nameParts = driver.name.split(' ');
      if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return nameParts[0][0].toUpperCase();
    }

    const firstName = driver.firstName || '';
    const lastName = driver.lastName || '';

    if (!firstName && !lastName) {
      return driver.email[0].toUpperCase();
    }

    return ((firstName[0] || '') + (lastName[0] || '')).toUpperCase();
  }

  /**
   * Get initials from name for notes
   */
  getInitials(name: string): string {
    if (!name) return '??';

    const nameParts = name.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0][0].toUpperCase();
    }
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  }

  /**
   * Get status class for CSS styling
   */
  getStatusClass(status: string | undefined): string {
    if (!status) return 'status-gray';

    switch (status.toLowerCase()) {
      case 'active':
        return 'status-green';
      case 'pending':
        return 'status-orange';
      case 'inactive':
      default:
        return 'status-gray';
    }
  }

  /**
   * Get type class for CSS styling
   */
  getTypeClass(type: string | undefined): string {
    if (!type) return 'type-blue';

    switch (type.toLowerCase()) {
      case 'customer':
        return 'type-blue';
      case 'supplier':
        return 'type-purple';
      case 'partner':
        return 'type-orange';
      default:
        return 'type-blue';
    }
  }

  /**
   * Get role class for CSS styling
   */
  getRoleClass(role: string | undefined): string {
    if (!role) return 'role-driver';

    switch (role.toLowerCase()) {
      case 'admin':
        return 'role-admin';
      case 'system user':
        return 'role-manager';
      case 'contractor':
        return 'role-dispatcher';
      case 'driver':
        return 'role-driver';
      default:
        return 'role-driver';
    }
  }

  /**
   * Get job status class for CSS styling
   */
  getJobStatusClass(status: string | undefined): string {
    if (!status) return 'status-gray';

    switch (status.toLowerCase()) {
      case 'allocated':
        return 'status-orange';
      case 'collected':
        return 'status-info';
      case 'delivered':
        return 'status-success';
      case 'completed':
        return 'status-green';
      case 'unallocated':
        return 'status-gray';
      default:
        return 'status-gray';
    }
  }

  /**
   * Get permission icon for CSS styling
   */
  getPermissionIcon(key: string): string {
    const icons: { [key: string]: string } = {
      canAllocateJobs: 'assignment_ind',
      canApproveExpenses: 'payments',
      canCreateJobs: 'add_task',
      canEditJobs: 'edit_note',
      canManageUsers: 'manage_accounts',
      canViewReports: 'assessment',
      canViewUnallocated: 'visibility',
      isAdmin: 'admin_panel_settings',
      canViewSystemSettings: 'settings',
      canManageCompanies: 'business',
      canViewAllJobs: 'list_alt',
      canViewAssignedJobs: 'assignment_turned_in',
      canCreateExpenses: 'receipt_long',
    };

    return icons[key] || 'check_circle';
  }

  /**
   * Check if driver has a specific permission
   */
  hasPermission(key: string): boolean {
    if (!this.driver || !this.driver.permissions) {
      return false;
    }

    // Check for admin first (admins have all permissions)
    if (this.driver.permissions.isAdmin) {
      return true;
    }

    // Check specific permission
    return !!this.driver.permissions[key as keyof typeof this.driver.permissions];
  }

  /**
   * Get role description
   */
  getRoleDescription(role: string | undefined): string {
    if (!role) return 'Standard user with limited access';

    switch (role.toLowerCase()) {
      case 'admin':
        return 'Full system administrator with access to all features and settings';
      case 'system user':
        return 'Access to most features except system administration';
      case 'contractor':
        return 'Limited access to view only assigned jobs and submit expenses';
      case 'driver':
        return 'Can view and manage assigned jobs and submit expenses';
      default:
        return 'Standard user with limited access';
    }
  }

  /**
   * Navigate back
   */
  goBack(): void {
    this.location.back();
  }

  /**
   * Calculate duration between two dates in days
   */
  calculateDuration(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate the difference in milliseconds
    const diffTime = Math.abs(end.getTime() - start.getTime());

    // Convert to days and add 1 to include both start and end dates
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return diffDays;
  }

  /**
   * Get status class for leave request status
   */
  getLeaveStatusClass(status: string): string {
    switch (status) {
      case LeaveRequestStatus.APPROVED:
        return 'status-green';
      case LeaveRequestStatus.DENIED:
        return 'status-red';
      case LeaveRequestStatus.PENDING:
        return 'status-orange';
      case LeaveRequestStatus.CANCELLED:
        return 'status-gray';
      default:
        return 'status-gray';
    }
  }

  /**
   * Check if user can process a leave request
   */
  canProcessLeaveRequest(request: LeaveRequest): boolean {
    return request.status === LeaveRequestStatus.PENDING && this.hasLeaveApprovePermission;
  }

  /**
   * Open dialog to create a new leave request
   */
  createLeaveRequest(): void {
    if (!this.driver) return;

    const dialogRef = this.dialog.open(LeaveRequestCreateDialogComponent, {
      width: '500px',
      data: {
        driverId: this.driverId,
        driverName: `${this.driver.firstName} ${this.driver.lastName}`,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDriverLeaveRequests().subscribe();
      }
    });
  }

  /**
   * Process (approve or deny) a leave request
   */
  processLeaveRequest(request: LeaveRequest, isApproval: boolean): void {
    const dialogRef = this.dialog.open(LeaveRequestProcessDialogComponent, {
      width: '500px',
      data: {
        request,
        isApproval,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        if (isApproval) {
          this.approveLeaveRequest(request.id, result.notes);
        } else {
          this.denyLeaveRequest(request.id, result.notes);
        }
      }
    });
  }

  /**
   * Approve a leave request
   */
  approveLeaveRequest(requestId: string, notes?: string): void {
    this.isLeaveRequestsLoading = true;

    const approveSub = this.leaveRequestService
      .approveLeaveRequest(requestId, notes)
      .pipe(finalize(() => (this.isLeaveRequestsLoading = false)))
      .subscribe({
        next: () => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Leave Request Approved',
            message: 'The leave request has been approved successfully',
          });
          this.loadDriverLeaveRequests().subscribe();
        },
        error: (error) => {
          console.error('Error approving leave request:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to approve leave request',
          });
        },
      });

    this.subscriptions.push(approveSub);
  }

  /**
   * Deny a leave request
   */
  denyLeaveRequest(requestId: string, notes?: string): void {
    this.isLeaveRequestsLoading = true;

    const denySub = this.leaveRequestService
      .denyLeaveRequest(requestId, notes)
      .pipe(finalize(() => (this.isLeaveRequestsLoading = false)))
      .subscribe({
        next: () => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Leave Request Denied',
            message: 'The leave request has been denied',
          });
          this.loadDriverLeaveRequests().subscribe();
        },
        error: (error) => {
          console.error('Error denying leave request:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to deny leave request',
          });
        },
      });

    this.subscriptions.push(denySub);
  }
}
