import { Location } from '@angular/common';
import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';

import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Job } from '../../../interfaces/job.interface';
import { UserProfile, UserRole } from '../../../interfaces/user-profile.interface';
import { AuthService } from '../../../services/auth.service';
import { DriverNote, DriverService, DriverStats } from '../../../services/driver.service';
import { JobService } from '../../../services/job.service';
import { NotificationService } from '../../../services/notification.service';

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
  activeTab: 'details' | 'jobs' | 'permissions' | 'notes' = 'details';

  jobsDataSource = new MatTableDataSource<Job>([]);
  jobColumns: string[] = ['id', 'status', 'vehicle', 'collection', 'delivery', 'date', 'actions'];
  isJobsLoading = false;

  driverStats: DriverStats = {
    totalJobs: 0,
    pendingJobs: 0,
    completedJobs: 0,
    pendingExpenses: 0,
  };

  driverNotes: DriverNote[] = [];
  isNotesLoading = false;

  permissionsForm!: FormGroup;
  availableRoles = Object.values(UserRole);

  noteForm!: FormGroup;
  editingNote: DriverNote | null = null;

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
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private fb: FormBuilder
  ) {
    this.createForms();
  }

  ngOnInit(): void {
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

    const permissionSub = this.authService.hasPermission('canManageUsers').subscribe((hasPermission) => {
      this.hasEditPermission = hasPermission;
    });
    this.subscriptions.push(permissionSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private createForms(): void {
    this.permissionsForm = this.fb.group({
      role: ['', Validators.required],
    });

    this.noteForm = this.fb.group({
      content: ['', Validators.required],
    });
  }

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
            return forkJoin({
              jobs: this.loadDriverJobs(),
              notes: this.loadDriverNotes(),
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

  editPermissions(): void {
    if (!this.driver) return;

    this.permissionsForm.patchValue({
      role: this.driver.role || UserRole.DRIVER,
    });

    this.dialog.open(this.permissionsDialog, {
      width: '500px',
      disableClose: true,
    });
  }

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

  addNote(): void {
    this.editingNote = null;
    this.noteForm.reset();
    this.dialog.open(this.noteDialog, {
      width: '500px',
    });
  }

  editNote(note: DriverNote): void {
    this.editingNote = note;
    this.noteForm.patchValue({
      content: note.content,
    });
    this.dialog.open(this.noteDialog, {
      width: '500px',
    });
  }

  saveNote(): void {
    if (this.noteForm.invalid || !this.driver) return;

    const content = this.noteForm.get('content')?.value;

    this.authService.getUserProfile().subscribe((userProfile) => {
      if (!userProfile) {
        this.snackBar.open('You must be logged in to add notes', 'Close', { duration: 3000 });
        return;
      }

      if (this.editingNote) {
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

  editDriver(): void {
    this.router.navigate(['/drivers', this.driverId, 'edit']);
  }

  sendMessage(): void {
    this.snackBar.open('Messaging functionality will be implemented in a future release', 'Close', {
      duration: 3000,
    });
  }

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

  canUnassignJob(job: Job): boolean {
    return job.status === 'allocated' || job.status === 'unallocated';
  }

  viewJobDetails(jobId: string): void {
    this.router.navigate(['/jobs', jobId]);
  }

  editJob(jobId: string): void {
    this.router.navigate(['/jobs', jobId, 'edit']);
  }

  setActiveTab(tab: 'details' | 'jobs' | 'permissions' | 'notes'): void {
    this.activeTab = tab;
  }

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

  getInitials(name: string): string {
    if (!name) return '??';

    const nameParts = name.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0][0].toUpperCase();
    }
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  }

  getStatusClass(status: string | undefined): string {
    if (!status) return 'status-grey';

    switch (status.toLowerCase()) {
      case 'active':
        return 'status-green';
      case 'pending':
        return 'status-orange';
      case 'inactive':
      default:
        return 'status-grey';
    }
  }

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

  getJobStatusClass(status: string | undefined): string {
    if (!status) return 'status-grey';

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
        return 'status-grey';
      default:
        return 'status-grey';
    }
  }

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

  hasPermission(key: string): boolean {
    if (!this.driver || !this.driver.permissions) {
      return false;
    }

    if (this.driver.permissions.isAdmin) {
      return true;
    }

    return !!this.driver.permissions[key as keyof typeof this.driver.permissions];
  }

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

  goBack(): void {
    this.location.back();
  }
}
