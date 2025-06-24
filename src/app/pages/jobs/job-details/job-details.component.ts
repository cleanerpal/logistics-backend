import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { AuthService } from '../../../services/auth.service';
import { JobService } from '../../../services/job.service';
import { Job } from '../../../interfaces/job.interface';
import { UserProfile } from '../../../interfaces/user-profile.interface';
import { DriverSelectionDialogComponent } from '../../../dialogs/driver-selection-dialog.component';
import { JobDuplicateDialogComponent } from '../../../dialogs/job-duplicate-dialog.component';

// Interface for notes
interface Note {
  author: string;
  content: string;
  date: Date;
  id?: string;
}

// Interface for note data to be saved in Firestore
interface NoteData {
  author: string;
  content: string;
  date: string | Date;
  id?: string;
}

// Interface for driver information
interface DriverInfo {
  id: string;
  name: string;
  phoneNumber?: string;
}

@Component({
  selector: 'app-job-details',
  templateUrl: './job-details.component.html',
  styleUrls: ['./job-details.component.scss'],
  standalone: false,
})
export class JobDetailsComponent implements OnInit, OnDestroy {
  jobId: string = '';
  job: Job | null = null;
  activeTab: 'details' | 'timeline' | 'expenses' = 'details';
  isLoading = true;
  hasEditPermission = false;
  hasAllocatePermission = false;
  isAdmin = false;
  currentUser: UserProfile | null = null;
  private isDestroyed = false;

  driverInfo: DriverInfo | null = null;

  jobNotes: Note[] = [];
  newNote: string = '';

  allowedStatuses: ('unallocated' | 'allocated' | 'collected' | 'delivered' | 'completed')[] = ['unallocated', 'allocated', 'collected', 'delivered', 'completed'];

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jobService: JobService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Initialize the component by subscribing to route params and checking permissions
   */
  ngOnInit() {
    const routeSub = this.route.params.subscribe((params) => {
      this.jobId = params['id'];
      this.loadJobDetails();
    });

    this.subscriptions.push(routeSub);

    this.checkUserPermissions();
  }

  /**
   * Clean up subscriptions when the component is destroyed
   */
  ngOnDestroy() {
    this.isDestroyed = true;
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Load job details and driver information
   */
  private loadJobDetails() {
    this.isLoading = true;

    const jobSub = this.jobService
      .getJobById(this.jobId)
      .pipe(
        switchMap((job) => {
          if (!job) {
            return of({ job: null, driverInfo: null });
          }

          if (job.driverId) {
            return this.authService.getUserById(job.driverId).pipe(
              catchError(() => of(null)),
              switchMap((driverProfile) => {
                const driver: DriverInfo | null = driverProfile
                  ? {
                      id: driverProfile.id,
                      name: driverProfile.name || `${driverProfile.firstName || ''} ${driverProfile.lastName || ''}`.trim() || 'Unknown Driver',
                      phoneNumber: driverProfile.phoneNumber,
                    }
                  : null;

                return of({ job, driverInfo: driver });
              })
            );
          } else {
            return of({ job, driverInfo: null });
          }
        })
      )
      .subscribe({
        next: (result) => {
          this.job = result.job;
          this.driverInfo = result.driverInfo;
          this.isLoading = false;
          this.cdr.detectChanges();

          if (this.job && this.job.notes) {
            this.processJobNotes(this.job);
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error loading job details:', error);
          this.showSnackbar('Error loading job details');
          this.cdr.detectChanges();
        },
      });

    this.subscriptions.push(jobSub);
  }

  /**
   * Process job notes from various possible formats
   */
  private processJobNotes(job: Job) {
    const rawNotes: Note[] = [];

    if (Array.isArray(job.notes)) {
      rawNotes.push(...(job.notes as Note[]));
    } else if (typeof job.notes === 'string') {
      rawNotes.push({
        author: job.createdBy || 'System',
        content: job.notes,
        date: job.createdAt,
      });
    } else if (typeof job.notes === 'object' && job.notes !== null) {
      try {
        const notesObject = job.notes as Record<string, any>;
        const noteEntries = Object.entries(notesObject).map(([id, noteData]) => {
          const note: Note = {
            author: (noteData as any).author || 'Unknown',
            content: (noteData as any).content || '',
            date: new Date((noteData as any).date || new Date()),
          };
          return note;
        });

        rawNotes.push(...noteEntries);
      } catch (error) {
        console.error('Error processing notes:', error);
      }
    }

    if (rawNotes.length === 0) {
      this.jobNotes = [];
      return;
    }

    const authorIds = new Set<string>();

    rawNotes.forEach((note) => {
      if (typeof note.author === 'string' && note.author !== 'System' && note.author !== 'Unknown' && note.author.length > 20) {
        authorIds.add(note.author);
      }
    });

    if (authorIds.size === 0) {
      this.jobNotes = rawNotes;
      return;
    }

    const authorMap = new Map<string, string>();
    const authorRequests: Observable<any>[] = [];

    Array.from(authorIds).forEach((authorId) => {
      const request = this.authService.getUserById(authorId).pipe(
        tap((user) => {
          if (user) {
            const authorName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User';
            authorMap.set(authorId, authorName);
          }
        }),
        catchError(() => {
          authorMap.set(authorId, 'Unknown User');
          return of(null);
        })
      );
      authorRequests.push(request);
    });

    if (authorRequests.length > 0) {
      const authorSub = forkJoin(authorRequests).subscribe({
        next: () => {
          this.jobNotes = rawNotes.map((note) => {
            if (authorMap.has(note.author)) {
              return {
                ...note,
                author: authorMap.get(note.author) || note.author,
              };
            }
            return note;
          });
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error fetching note author names:', error);
          this.jobNotes = rawNotes;
          this.cdr.detectChanges();
        },
        complete: () => {
          if (authorSub) {
            this.subscriptions.push(authorSub);
          }
        },
      });
    } else {
      this.jobNotes = rawNotes;
    }
  }

  /**
   * Check user permissions and set flags
   */
  private checkUserPermissions() {
    const permissionsSub = combineLatest([
      this.authService.getUserProfile(),
      this.authService.hasPermission('canEditJobs'),
      this.authService.hasPermission('canAllocateJobs'),
      this.authService.hasPermission('isAdmin'),
    ]).subscribe(([user, canEdit, canAllocate, isAdmin]) => {
      this.currentUser = user;
      this.hasEditPermission = canEdit;
      this.hasAllocatePermission = canAllocate;
      this.isAdmin = isAdmin;
      this.cdr.detectChanges();
    });

    this.subscriptions.push(permissionsSub);
  }

  /**
   * Set the active tab for the job details view
   * @param tab The tab to activate
   */
  setActiveTab(tab: 'details' | 'timeline' | 'expenses') {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  /**
   * Get CSS class for job status
   * @param status The job status
   * @returns CSS class name
   */
  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      unallocated: 'status-unallocated',
      allocated: 'status-allocated',
      collected: 'status-collected',
      delivered: 'status-delivered',
      completed: 'status-completed',
    };
    return statusMap[status] || 'status-default';
  }

  /**
   * Get Material icon for timeline event
   * @param status The job status
   * @returns Icon name
   */
  getTimelineIcon(status: string): string {
    const iconMap: Record<string, string> = {
      unallocated: 'assignment',
      allocated: 'assignment_ind',
      collected: 'local_shipping',
      'in-transit': 'directions_car',
      delivered: 'check_circle',
      completed: 'done_all',
    };
    return iconMap[status] || 'radio_button_unchecked';
  }

  /**
   * Check if an event is the last in the timeline
   * @param event The timeline event
   * @returns True if it's the last event
   */
  isLastEvent(event: any): boolean {
    return this.job?.['timeline']?.indexOf(event) === this.job?.['timeline']?.length - 1;
  }

  /**
   * Navigate back to the jobs list
   */
  goBack() {
    this.router.navigate(['/jobs']);
  }

  /**
   * Navigate to the job edit page if the user has permission
   */
  editJob(job: Job, event: Event): void {
    event.stopPropagation(); // Prevent row click event
    this.router.navigate(['/jobs', job.id, 'edit']);
  }

  /**
   * Trigger the browser's print function
   */
  printJobDetails() {
    window.print();
  }

  /**
   * Add a new note to the job
   */
  addNote() {
    if (!this.newNote.trim() || !this.job) return;

    const newNote: Note = {
      author: this.currentUser?.name || 'User',
      content: this.newNote.trim(),
      date: new Date(),
    };

    const notesList: Note[] = [...(this.jobNotes || []), newNote];

    this.isLoading = true;

    const notesData: NoteData[] = notesList.map((note) => ({
      author: note.author,
      content: note.content,
      date: note.date,
    }));

    this.jobService.updateJob(this.job.id, { notes: notesData }).subscribe({
      next: () => {
        this.jobNotes = notesList;
        this.newNote = '';
        this.isLoading = false;
        this.showSnackbar('Note added successfully');
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error adding note:', error);
        this.isLoading = false;
        this.showSnackbar('Error adding note');
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * Update the job status
   * @param newStatus The new status to set
   */
  updateJobStatus(newStatus: 'unallocated' | 'allocated' | 'collected' | 'delivered' | 'completed') {
    if (!this.job) return;

    if (this.job.status === newStatus) return;

    this.isLoading = true;
    this.cdr.detectChanges();

    switch (newStatus) {
      case 'allocated':
        if (!this.hasAllocatePermission && !this.isAdmin) {
          this.showSnackbar('You do not have permission to allocate jobs');
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        this.showDriverSelectionDialog();
        break;

      case 'unallocated':
        if (!this.hasEditPermission && !this.isAdmin) {
          this.showSnackbar('You do not have permission to unallocate jobs');
          this.isLoading = false;
          this.cdr.detectChanges();
          return;
        }

        this.jobService.unallocateJob(this.job.id).subscribe({
          next: () => {
            this.loadJobDetails();
            this.showSnackbar('Job unallocated successfully');
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error unallocating job:', error);
            this.isLoading = false;
            this.showSnackbar('Error unallocating job');
            this.cdr.detectChanges();
          },
        });
        break;

      case 'collected':
        this.startCollection();
        break;

      case 'delivered':
        this.startDelivery();
        break;

      case 'completed':
        this.completeJob();
        break;
    }
  }

  /**
   * Show driver selection dialog and allocate job to selected driver
   */
  private showDriverSelectionDialog(): void {
    const dialogRef = this.dialog.open(DriverSelectionDialogComponent, {
      data: {
        jobId: this.job!.id,
        jobTitle: `${this.job!.make} ${this.job!.model} (${this.job!['registration'] || 'No Reg'})`,
      },
      width: '450px',
      panelClass: ['custom-dialog-container', 'allocation-dialog'],
    });

    dialogRef.afterClosed().subscribe((driver) => {
      if (this.isDestroyed) return;

      if (driver) {
        this.allocateJobToDriver(driver.id);
      } else {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Allocate job to a specific driver
   * @param driverId The ID of the driver to allocate to
   */
  private allocateJobToDriver(driverId: string): void {
    if (!this.job) {
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    const jobData: Partial<Job> = {
      status: 'allocated',
      driverId: driverId,
      allocatedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: this.currentUser?.id,
    };

    this.jobService.updateJob(this.job.id, jobData).subscribe({
      next: () => {
        this.loadJobDetails();
        this.showSnackbar('Job allocated successfully');
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error allocating job to driver:', error);
        this.isLoading = false;
        this.showSnackbar('Error allocating job to driver');
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * Start the collection process for a job
   */
  startCollection() {
    if (!this.job) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Start Collection',
        message: 'Are you ready to start the collection process for this job?',
        confirmText: 'Start Collection',
        cancelText: 'Cancel',
        icon: 'departure_board',
        confirmColor: 'primary',
      },
      width: '400px',
      panelClass: ['custom-dialog-container', 'collection-dialog'],
    });

    const dialogSub = dialogRef.afterClosed().subscribe((result) => {
      if (this.isDestroyed) return;

      if (result) {
        this.isLoading = true;
        this.cdr.detectChanges();

        const collectionSub = this.jobService.startCollection(this.job!.id).subscribe({
          next: () => {
            this.loadJobDetails();
            this.showSnackbar('Collection started successfully');
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error starting collection:', error);
            this.isLoading = false;
            this.showSnackbar('Error starting collection: ' + error.message);
            this.cdr.detectChanges();
          },
        });

        this.subscriptions.push(collectionSub);
      } else {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });

    this.subscriptions.push(dialogSub);
  }

  /**
   * Start the delivery process for a job
   */
  startDelivery() {
    if (!this.job) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Start Delivery',
        message: 'Are you ready to start the delivery process for this job?',
        confirmText: 'Start Delivery',
        cancelText: 'Cancel',
        icon: 'local_shipping',
        confirmColor: 'primary',
      },
      width: '400px',
      panelClass: ['custom-dialog-container', 'delivery-dialog'],
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (this.isDestroyed) return;

      if (result) {
        this.isLoading = true;
        this.cdr.detectChanges();

        this.jobService.startDelivery(this.job!.id).subscribe({
          next: () => {
            this.loadJobDetails();
            this.showSnackbar('Delivery started successfully');

            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Error starting delivery:', error);
            this.isLoading = false;
            this.showSnackbar('Error starting delivery');
            this.cdr.detectChanges();
          },
        });
      } else {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Mark the job as completed
   */
  completeJob() {
    if (!this.job) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Complete Job',
        message: 'Are you sure you want to mark this job as completed?',
        confirmText: 'Complete Job',
        cancelText: 'Cancel',
        icon: 'check_circle',
        confirmColor: 'primary',
      },
      width: '400px',
      panelClass: ['custom-dialog-container'],
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (this.isDestroyed) return;

      if (result) {
        this.isLoading = true;
        this.cdr.detectChanges();

        this.jobService
          .updateJob(this.job!.id, {
            status: 'completed',
            updatedAt: new Date(),
          })
          .subscribe({
            next: () => {
              this.loadJobDetails();
              this.showSnackbar('Job marked as completed');
              this.cdr.detectChanges();
            },
            error: (error) => {
              console.error('Error completing job:', error);
              this.isLoading = false;
              this.showSnackbar('Error completing job');
              this.cdr.detectChanges();
            },
          });
      } else {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Get the name of the assigned driver
   * @returns Driver name or 'Unassigned'/'Unknown Driver'
   */
  getDriverName(): string {
    if (this.driverInfo) {
      return this.driverInfo.name;
    }

    if (!this.job?.driverId) {
      return 'Unassigned';
    }

    return 'Unknown Driver';
  }

  /**
   * Format a date for display
   * @param date The date to format
   * @returns Formatted date string
   */
  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';

    if (typeof date === 'string') {
      return new Date(date).toLocaleString();
    }

    if (date && typeof date === 'object' && 'toDate' in date) {
      const timestamp = date as unknown as { toDate: () => Date };
      return timestamp.toDate().toLocaleString();
    }

    return date.toLocaleString();
  }

  /**
   * Format date to UK format (DD/MM/YYYY)
   * @param date The date to format
   * @returns Formatted date string
   */
  formatUKDate(date: Date | undefined): string {
    if (!date) return 'N/A';

    if (typeof date === 'string') {
      date = new Date(date);
    }

    if (date && typeof date === 'object' && 'toDate' in date) {
      const timestamp = date as unknown as { toDate: () => Date };
      date = timestamp.toDate();
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  /**
   * Format date and time to UK format (DD/MM/YYYY HH:MM)
   * @param date The date to format
   * @returns Formatted date-time string
   */
  formatUKDateTime(date: Date | undefined): string {
    if (!date) return 'N/A';

    if (typeof date === 'string') {
      date = new Date(date);
    }

    if (date && typeof date === 'object' && 'toDate' in date) {
      const timestamp = date as unknown as { toDate: () => Date };
      date = timestamp.toDate();
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  /**
   * Get the progress percentage for the status flow display
   * @returns Progress percentage
   */
  getStatusFlowProgress(): number {
    if (!this.job) return 0;

    const statusOrder = ['unallocated', 'allocated', 'collected', 'delivered', 'completed'];

    const currentStatusIndex = statusOrder.indexOf(this.job.status);
    if (currentStatusIndex === -1) return 0;

    return (currentStatusIndex / (statusOrder.length - 1)) * 100;
  }

  /**
   * Get status steps for the status flow visualization
   * @returns Array of status steps
   */
  getStatusFlow() {
    if (!this.job) return [];

    const statusOrder = [
      { key: 'unallocated', label: 'Unallocated' },
      { key: 'allocated', label: 'Allocated' },
      { key: 'collected', label: 'Collected' },
      { key: 'delivered', label: 'Delivered' },
      { key: 'completed', label: 'Completed' },
    ];

    const currentStatusIndex = statusOrder.findIndex((s) => s.key === this.job?.status);

    return statusOrder.map((status, index) => {
      return {
        ...status,
        active: index === currentStatusIndex,
        completed: index < currentStatusIndex,
      };
    });
  }

  /**
   * Get vehicle brand logo path with improved filename normalization
   * @param make The vehicle manufacturer name
   * @returns Path to the logo image
   */
  getVehicleLogo(make: string): string {
    if (!make) return 'assets/images/car-logos/default.png';

    const specialCases: Record<string, string> = {
      'mercedes-benz': 'mercedes',
      'mercedes benz': 'mercedes',
      vw: 'volkswagen',
      'range rover': 'land_rover',
      'jaguar land rover': 'jaguar',
      'rolls-royce': 'rolls_royce',
      'rolls royce': 'rolls_royce',
      bmw: 'bmw',
      audi: 'audi',
      toyota: 'toyota',
      honda: 'honda',
      nissan: 'nissan',
      ford: 'ford',
      chevrolet: 'chevrolet',
      hyundai: 'hyundai',
      kia: 'kia',
      mazda: 'mazda',
      subaru: 'subaru',
      lexus: 'lexus',
      jeep: 'jeep',
      tesla: 'tesla',
      porsche: 'porsche',
      ferrari: 'ferrari',
      lamborghini: 'lamborghini',
      bentley: 'bentley',
      maserati: 'maserati',
      bugatti: 'bugatti',
      mini: 'mini',
    };

    const normalized = make.toLowerCase().trim();

    if (specialCases[normalized]) {
      return `assets/images/car-logos/${specialCases[normalized]}.png`;
    }

    const normalizedFilename = normalized
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    return `assets/images/car-logos/${normalizedFilename}.png`;
  }

  /**
   * Handle image loading error by setting a default image
   * @param event The error event
   */
  handleImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/car-logos/default.png';
  }

  /**
   * Show a snackbar notification
   * @param message The message to display
   */
  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  /**
   * Add this import to the top of your job-details.component.ts file:
   * import { JobDuplicateDialogComponent } from '../../../dialogs/job-duplicate-dialog.component';
   *
   * Then add this method to your JobDetailsComponent class:
   */

  /**
   * Duplicate the current job
   */
  duplicateJob(): void {
    if (!this.job) return;

    const dialogRef = this.dialog.open(JobDuplicateDialogComponent, {
      data: {
        jobId: this.job.id,
        registrationNumber: this.job['registration'],
        makeModel: this.job.make && this.job.model ? `${this.job.make} ${this.job.model}` : undefined,
      },
      width: '400px',
      panelClass: ['custom-dialog-container', 'duplication-dialog'],
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (this.isDestroyed) return;

      if (result) {
        this.isLoading = true;
        this.cdr.detectChanges();

        this.jobService.duplicateJob(this.job!.id).subscribe({
          next: (newJobId) => {
            this.isLoading = false;
            this.showSnackbar('Job duplicated successfully');
            this.router.navigate(['/jobs', newJobId]);
          },
          error: (error) => {
            console.error('Error duplicating job:', error);
            this.isLoading = false;
            this.showSnackbar('Error duplicating job: ' + error.message);
            this.cdr.detectChanges();
          },
        });
      }
    });
  }
}
