import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { Location } from '@angular/common';
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, collection, doc, getDoc, getDocs, query, where, orderBy, serverTimestamp, addDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';

import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Job } from '../../../interfaces/job.interface';
import { UserProfile, UserRole } from '../../../interfaces/user-profile.interface';
import { AuthService } from '../../../services/auth.service';
import { ExpenseService } from '../../../services/expense.service';
import { FirebaseService } from '../../../services/firebase.service';
import { JobService } from '../../../services/job.service';
import { NotificationService } from '../../../services/notification.service';

interface DriverNote {
  id: string;
  content: string;
  date: Date;
  authorId: string;
  authorName: string;
}

interface DriverStats {
  totalJobs: number;
  pendingJobs: number;
  completedJobs: number;
  pendingExpenses: number;
}

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

  // Jobs table
  jobsDataSource = new MatTableDataSource<Job>([]);
  jobColumns: string[] = ['id', 'status', 'vehicle', 'collection', 'delivery', 'date', 'actions'];
  isJobsLoading = false;

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
    private jobService: JobService,
    private expenseService: ExpenseService,
    private firebaseService: FirebaseService,
    private notificationService: NotificationService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    public firestore: Firestore,
    public auth: Auth
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
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private createForms(): void {
    // Permissions form
    this.permissionsForm = this.fb.group({
      role: ['', Validators.required],
      canAllocateJobs: [false],
      canApproveExpenses: [false],
      canCreateJobs: [false],
      canEditJobs: [false],
      canManageUsers: [false],
      canViewReports: [false],
      canViewUnallocated: [false],
      isAdmin: [false],
    });

    // Note form
    this.noteForm = this.fb.group({
      content: ['', Validators.required],
    });
  }

  /**
   * Load driver details from Firebase
   */
  loadDriverDetails(): void {
    this.isLoading = true;

    const userSub = this.authService
      .getUserById(this.driverId)
      .pipe(
        tap((driver) => {
          this.driver = driver;
          if (driver) {
            this.initPermissionsForm();
          }
        }),
        switchMap((driver) => {
          if (driver) {
            // Load related data in parallel
            return forkJoin({
              jobs: this.loadDriverJobs(),
              notes: this.loadDriverNotes(),
              stats: this.calculateDriverStats(driver.id),
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
      .subscribe();

    this.subscriptions.push(userSub);
  }

  /**
   * Load driver jobs from Firebase
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
   * Calculate driver statistics based on jobs and expenses
   */
  calculateDriverStats(driverId: string): Observable<DriverStats> {
    return forkJoin({
      jobs: this.jobService.getJobsByDriver(driverId),
      expenses: this.expenseService.getExpensesByDriver(driverId),
    }).pipe(
      map(({ jobs, expenses }) => {
        const totalJobs = jobs.length;
        const pendingJobs = jobs.filter((job) => job.status === 'allocated' || job.status === 'collected').length;
        const completedJobs = jobs.filter((job) => job.status === 'delivered' || job.status === 'completed').length;
        const pendingExpenses = expenses.filter((expense) => expense.status === 'Pending').length;

        this.driverStats = {
          totalJobs,
          pendingJobs,
          completedJobs,
          pendingExpenses,
        };

        return this.driverStats;
      }),
      catchError((error) => {
        console.error('Error calculating driver stats:', error);
        return of(this.driverStats);
      })
    );
  }

  /**
   * Load driver notes from Firebase
   */
  loadDriverNotes(): Observable<DriverNote[]> {
    this.isNotesLoading = true;

    const notesRef = collection(this.firestore, 'driverNotes');
    const q = query(notesRef, where('driverId', '==', this.driverId), orderBy('date', 'desc'));

    return of(getDocs(q)).pipe(
      switchMap((promise) => promise),
      map((snapshot) => {
        // Transform notes and add author information
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          content: doc.data()['content'] || '',
          date: this.convertFirebaseTimestamp(doc.data()['date']),
          authorId: doc.data()['authorId'] || '',
          authorName: doc.data()['authorName'] || 'Unknown User',
        }));
      }),
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
   * Initialize permissions form with data from the driver
   */
  private initPermissionsForm(): void {
    if (!this.driver || !this.driver.permissions) return;

    this.permissionsForm.patchValue({
      role: this.driver.role || UserRole.DRIVER,
      canAllocateJobs: this.driver.permissions.canAllocateJobs || false,
      canApproveExpenses: this.driver.permissions.canApproveExpenses || false,
      canCreateJobs: this.driver.permissions.canCreateJobs || false,
      canEditJobs: this.driver.permissions.canEditJobs || false,
      canManageUsers: this.driver.permissions.canManageUsers || false,
      canViewReports: this.driver.permissions.canViewReports || false,
      canViewUnallocated: this.driver.permissions.canViewUnallocated || false,
      isAdmin: this.driver.permissions.isAdmin || false,
    });
  }

  /**
   * Set default permissions based on selected role
   */
  onRoleChange(event: any): void {
    const role = event.value;

    // Set default permissions based on role
    switch (role) {
      case UserRole.ADMIN:
        this.permissionsForm.patchValue({
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
        this.permissionsForm.patchValue({
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
        this.permissionsForm.patchValue({
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
        this.permissionsForm.patchValue({
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
      default:
        this.permissionsForm.patchValue({
          canAllocateJobs: false,
          canApproveExpenses: false,
          canCreateJobs: false,
          canEditJobs: false,
          canManageUsers: false,
          canViewReports: false,
          canViewUnallocated: false,
          isAdmin: false,
        });
    }
  }

  /**
   * Save updated permissions to Firebase
   */
  savePermissions(): void {
    if (!this.driver) return;

    const formValues = this.permissionsForm.value;

    const updatedProfile: Partial<UserProfile> = {
      role: formValues.role,
      permissions: {
        canAllocateJobs: formValues.canAllocateJobs,
        canApproveExpenses: formValues.canApproveExpenses,
        canCreateJobs: formValues.canCreateJobs,
        canEditJobs: formValues.canEditJobs,
        canManageUsers: formValues.canManageUsers,
        canViewReports: formValues.canViewReports,
        canViewUnallocated: formValues.canViewUnallocated,
        isAdmin: formValues.isAdmin,
      },
    };

    const updateSub = this.authService.updateUserProfile(this.driverId, updatedProfile).subscribe({
      next: () => {
        this.dialog.closeAll();
        this.notificationService.addNotification({
          type: 'success',
          title: 'Permissions Updated',
          message: 'The driver permissions have been updated successfully',
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

    this.subscriptions.push(updateSub);
  }

  /**
   * Open permissions dialog
   */
  editPermissions(): void {
    this.dialog.open(this.permissionsDialog, {
      width: '500px',
      disableClose: true,
    });
  }

  /**
   * Open note dialog for adding or editing
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
   * Save new or updated note to Firebase
   */
  saveNote(): void {
    if (this.noteForm.invalid) return;

    // Get current user for author info
    this.getUserFromAuth().subscribe((user) => {
      if (!user || !this.driver) {
        this.snackBar.open('You must be logged in to add notes', 'Close', { duration: 3000 });
        return;
      }

      const content = this.noteForm.get('content')?.value;

      // Get user profile for author name
      this.authService
        .getUserProfile()
        .pipe(
          switchMap((userProfile) => {
            const authorName = userProfile ? userProfile.name : 'Unknown User';

            if (this.editingNote) {
              // Update existing note
              const noteRef = doc(this.firestore, 'driverNotes', this.editingNote.id);
              return of(
                updateDoc(noteRef, {
                  content,
                  updatedAt: serverTimestamp(),
                })
              );
            } else {
              // Create new note
              const notesRef = collection(this.firestore, 'driverNotes');
              return of(
                addDoc(notesRef, {
                  driverId: this.driverId,
                  content,
                  date: serverTimestamp(),
                  authorId: user.uid,
                  authorName,
                })
              );
            }
          })
        )
        .subscribe({
          next: (promise) => {
            promise.then(() => {
              this.dialog.closeAll();
              this.loadDriverNotes(); // Refresh notes

              const message = this.editingNote ? 'Note updated successfully' : 'Note added successfully';
              this.snackBar.open(message, 'Close', { duration: 3000 });
            });
          },
          error: (error) => {
            console.error('Error saving note:', error);
            this.snackBar.open('Error saving note', 'Close', { duration: 3000 });
          },
        });
    });
  }

  /**
   * Delete note from Firebase
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
        // Alternative approach if deleteDocument is not available
        const noteRef = doc(this.firestore, 'driverNotes', note.id);
        of(deleteDoc(noteRef)).subscribe({
          next: (promise) => {
            promise.then(() => {
              this.loadDriverNotes(); // Refresh notes
              this.snackBar.open('Note deleted successfully', 'Close', { duration: 3000 });
            });
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
   * Delete driver from Firebase
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
        // In a real app, this would be a call to a method in the AuthService
        // to delete the user, followed by cleanup of related data

        // For now, we'll just deactivate the user
        this.authService.updateUserProfile(this.driverId, { isActive: false }).subscribe({
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
            this.calculateDriverStats(this.driverId); // Update stats
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
  setActiveTab(tab: 'details' | 'jobs' | 'permissions' | 'notes'): void {
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

    return (firstName[0] + lastName[0]).toUpperCase();
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
   * This accepts a string status value and returns the appropriate CSS class name
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
   * This accepts a string type value and returns the appropriate CSS class name
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

    const roleMap: Record<string, string> = {
      admin: 'role-admin',
      manager: 'role-manager',
      dispatcher: 'role-dispatcher',
      driver: 'role-driver',
      user: 'role-user',
    };

    return roleMap[role.toLowerCase()] || 'role-driver';
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
      case 'manager':
        return 'Manages drivers and operations with access to most features';
      case 'dispatcher':
        return 'Assigns and coordinates jobs between drivers and customers';
      case 'driver':
        return 'Handles vehicle transportation and delivery tasks';
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
   * Get the current user from Auth
   */
  private getUserFromAuth(): Observable<User | null> {
    return new Observable<User | null>((observer) => {
      // Get the current auth state
      const unsubscribe = onAuthStateChanged(
        this.auth,
        (user) => {
          observer.next(user);
          observer.complete();
        },
        (error) => {
          observer.error(error);
        }
      );

      // Return unsubscribe function for cleanup
      return unsubscribe;
    });
  }

  /**
   * Convert Firebase timestamp to Date
   */
  private convertFirebaseTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();

    // Firebase timestamp object with toDate() method
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate();
    }

    // String or number timestamp
    return new Date(timestamp);
  }
}
