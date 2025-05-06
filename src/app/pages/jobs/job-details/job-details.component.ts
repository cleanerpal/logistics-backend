import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { AuthService } from '../../../services/auth.service';
import { JobService } from '../../../services/job.service';
import { Job, UserProfile } from '../../../interfaces/job.interface';
import { DriverSelectionDialogComponent } from '../../../dialogs/driver-selection-dialog.component';

interface Note {
  author: string;
  content: string;
  date: Date;
  id?: string;
}

// Note type for FireStore storage - dates as strings
interface NoteData {
  author: string;
  content: string;
  date: string | Date;
  id?: string;
}

// Interface for driver info
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

  // Driver information
  driverInfo: DriverInfo | null = null;

  jobNotes: Note[] = [];
  newNote: string = '';
  allowedStatuses: (
    | 'unallocated'
    | 'allocated'
    | 'collected'
    | 'delivered'
    | 'completed'
  )[] = ['unallocated', 'allocated', 'collected', 'delivered', 'completed'];

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jobService: JobService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // Get the job ID from the route
    const routeSub = this.route.params.subscribe((params) => {
      this.jobId = params['id'];
      this.loadJobDetails();
    });

    this.subscriptions.push(routeSub);

    // Check user permissions
    this.checkUserPermissions();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadJobDetails() {
    this.isLoading = true;

    const jobSub = this.jobService
      .getJobById(this.jobId)
      .pipe(
        switchMap((job) => {
          if (!job) {
            return of({ job: null, driverInfo: null });
          }

          // If job has a driver, fetch driver information
          if (job.driverId) {
            return this.authService.getUserById(job.driverId).pipe(
              catchError(() => of(null)),
              switchMap((driverProfile) => {
                const driver: DriverInfo | null = driverProfile
                  ? {
                      id: driverProfile.id,
                      name:
                        driverProfile.name ||
                        `${driverProfile.firstName || ''} ${
                          driverProfile.lastName || ''
                        }`.trim() ||
                        'Unknown Driver',
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

          // Load job notes if available
          if (this.job && this.job.notes) {
            this.processJobNotes(this.job);
          }
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Error loading job details:', error);
          this.showSnackbar('Error loading job details');
        },
      });

    this.subscriptions.push(jobSub);
  }

  private processJobNotes(job: Job) {
    // Process notes based on the format they're stored in
    const rawNotes: Note[] = [];

    if (Array.isArray(job.notes)) {
      rawNotes.push(...(job.notes as Note[]));
    } else if (typeof job.notes === 'string') {
      // If it's a single string, create a note from it
      rawNotes.push({
        author: job.createdBy || 'System',
        content: job.notes,
        date: job.createdAt,
      });
    } else if (typeof job.notes === 'object' && job.notes !== null) {
      // If it's an object of notes, convert to array
      try {
        const notesObject = job.notes as Record<string, any>;
        const noteEntries = Object.entries(notesObject).map(
          ([id, noteData]) => {
            // Ensure the note data has the needed structure
            const note: Note = {
              author: (noteData as any).author || 'Unknown',
              content: (noteData as any).content || '',
              date: new Date((noteData as any).date || new Date()),
            };
            return note;
          }
        );

        rawNotes.push(...noteEntries);
      } catch (error) {
        console.error('Error processing notes:', error);
      }
    }

    // If there are no notes, set empty array and return
    if (rawNotes.length === 0) {
      this.jobNotes = [];
      return;
    }

    // Fetch author names for each note
    const authorIds = new Set<string>();

    // Collect all unique author IDs that look like user IDs
    rawNotes.forEach((note) => {
      if (
        typeof note.author === 'string' &&
        note.author !== 'System' &&
        note.author !== 'Unknown' &&
        note.author.length > 20
      ) {
        // Only IDs are typically this long
        authorIds.add(note.author);
      }
    });

    // If no author IDs need to be resolved, just set the notes
    if (authorIds.size === 0) {
      this.jobNotes = rawNotes;
      return;
    }

    // Create a map to track author ID to name mapping
    const authorMap = new Map<string, string>();

    // Create array of promises to fetch author information
    const authorPromises = Array.from(authorIds).map((authorId) =>
      this.authService
        .getUserById(authorId)
        .toPromise()
        .then((user) => {
          if (user) {
            const authorName =
              user.name ||
              `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
              'Unknown User';
            authorMap.set(authorId, authorName);
          }
        })
        .catch(() => {
          // If we can't fetch author info, use a default name
          authorMap.set(authorId, 'Unknown User');
        })
    );

    // Wait for all author info to be fetched
    Promise.all(authorPromises)
      .then(() => {
        // Process all notes with author names
        this.jobNotes = rawNotes.map((note) => {
          // If the note author is an ID, replace with the name
          if (authorMap.has(note.author)) {
            return {
              ...note,
              author: authorMap.get(note.author) || note.author,
            };
          }
          return note;
        });
      })
      .catch((error) => {
        console.error('Error fetching note author names:', error);
        this.jobNotes = rawNotes;
      });
  }

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
    });

    this.subscriptions.push(permissionsSub);
  }

  setActiveTab(tab: 'details' | 'timeline' | 'expenses') {
    this.activeTab = tab;
  }

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

  isLastEvent(event: any): boolean {
    return (
      this.job?.['timeline']?.indexOf(event) ===
      this.job?.['timeline']?.length - 1
    );
  }

  goBack() {
    this.router.navigate(['/jobs']);
  }

  editJob() {
    if (this.job && (this.hasEditPermission || this.isAdmin)) {
      this.router.navigate(['/jobs', this.job.id, 'edit']);
    } else {
      this.showSnackbar('You do not have permission to edit this job');
    }
  }

  printJobDetails() {
    window.print();
  }

  addNote() {
    if (!this.newNote.trim() || !this.job) return;

    // Create a new note
    const newNote: Note = {
      author: this.currentUser?.name || 'User',
      content: this.newNote.trim(),
      date: new Date(),
    };

    // Add the note to the job
    const notesList: Note[] = [...(this.jobNotes || []), newNote];

    // Update the job - convert notes to a structure Firebase can store
    this.isLoading = true;

    // Create a simple object representation for Firestore
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
      },
      error: (error) => {
        console.error('Error adding note:', error);
        this.isLoading = false;
        this.showSnackbar('Error adding note');
      },
    });
  }

  updateJobStatus(
    newStatus:
      | 'unallocated'
      | 'allocated'
      | 'collected'
      | 'delivered'
      | 'completed'
  ) {
    if (!this.job) return;

    // Prevent unnecessary updates
    if (this.job.status === newStatus) return;

    // Different actions based on status change
    this.isLoading = true;

    // Check what type of transition we're making
    switch (newStatus) {
      case 'allocated':
        if (!this.hasAllocatePermission && !this.isAdmin) {
          this.showSnackbar('You do not have permission to allocate jobs');
          this.isLoading = false;
          return;
        }

        // Show driver selection dialog
        this.showDriverSelectionDialog();
        break;

      case 'unallocated':
        if (!this.hasEditPermission && !this.isAdmin) {
          this.showSnackbar('You do not have permission to unallocate jobs');
          this.isLoading = false;
          return;
        }

        this.jobService.unallocateJob(this.job.id).subscribe({
          next: () => {
            this.loadJobDetails();
            this.showSnackbar('Job unallocated successfully');
          },
          error: (error) => {
            console.error('Error unallocating job:', error);
            this.isLoading = false;
            this.showSnackbar('Error unallocating job');
          },
        });
        break;

      case 'collected':
        // Start collection process
        this.startCollection();
        break;

      case 'delivered':
        // Start delivery process
        this.startDelivery();
        break;

      case 'completed':
        // Update job status to completed
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
        jobTitle: `${this.job!.make} ${this.job!.model} (${
          this.job!.registration || 'No Reg'
        })`,
      },
      width: '450px',
      panelClass: ['custom-dialog-container', 'allocation-dialog'],
    });

    dialogRef.afterClosed().subscribe((driver) => {
      if (driver) {
        // Allocate the job to the selected driver
        this.allocateJobToDriver(driver.id);
      } else {
        this.isLoading = false;
      }
    });
  }

  /**
   * Allocate job to a specific driver
   */
  private allocateJobToDriver(driverId: string): void {
    if (!this.job) {
      this.isLoading = false;
      return;
    }

    // Prepare job data for allocation
    const jobData: Partial<Job> = {
      status: 'allocated',
      driverId: driverId,
      allocatedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: this.currentUser?.id,
    };

    // Update the job with driver allocation
    this.jobService.updateJob(this.job.id, jobData).subscribe({
      next: () => {
        this.loadJobDetails();
        this.showSnackbar('Job allocated successfully');
      },
      error: (error) => {
        console.error('Error allocating job to driver:', error);
        this.isLoading = false;
        this.showSnackbar('Error allocating job to driver');
      },
    });
  }

  startCollection() {
    if (!this.job) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Start Collection',
        message: 'Are you ready to start the collection process for this job?',
        confirmText: 'Start Collection',
        cancelText: 'Cancel',
        icon: 'departure_board', // Add icon
        confirmColor: 'primary',
      },
      width: '400px', // Set width
      panelClass: ['custom-dialog-container', 'collection-dialog'], // Add panel classes
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.jobService.startCollection(this.job!.id).subscribe({
          next: () => {
            this.loadJobDetails();
            this.showSnackbar('Collection started successfully');

            // Navigate to collection process
            this.router.navigate(['/jobs', this.job!.id, 'collection']);
          },
          error: (error) => {
            console.error('Error starting collection:', error);
            this.isLoading = false;
            this.showSnackbar('Error starting collection');
          },
        });
      } else {
        this.isLoading = false;
      }
    });
  }

  startDelivery() {
    if (!this.job) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Start Delivery',
        message: 'Are you ready to start the delivery process for this job?',
        confirmText: 'Start Delivery',
        cancelText: 'Cancel',
        icon: 'local_shipping', // Add icon
        confirmColor: 'primary',
      },
      width: '400px',
      panelClass: ['custom-dialog-container', 'delivery-dialog'],
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.jobService.startDelivery(this.job!.id).subscribe({
          next: () => {
            this.loadJobDetails();
            this.showSnackbar('Delivery started successfully');

            // Navigate to delivery process
            this.router.navigate(['/jobs', this.job!.id, 'delivery']);
          },
          error: (error) => {
            console.error('Error starting delivery:', error);
            this.isLoading = false;
            this.showSnackbar('Error starting delivery');
          },
        });
      } else {
        this.isLoading = false;
      }
    });
  }

  completeJob() {
    if (!this.job) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Complete Job',
        message: 'Are you sure you want to mark this job as completed?',
        confirmText: 'Complete Job',
        cancelText: 'Cancel',
        icon: 'check_circle', // Add icon
        confirmColor: 'primary',
      },
      width: '400px',
      panelClass: 'custom-dialog-container',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.jobService
          .updateJob(this.job!.id, {
            status: 'completed',
            updatedAt: new Date(),
          })
          .subscribe({
            next: () => {
              this.loadJobDetails();
              this.showSnackbar('Job marked as completed');
            },
            error: (error) => {
              console.error('Error completing job:', error);
              this.isLoading = false;
              this.showSnackbar('Error completing job');
            },
          });
      } else {
        this.isLoading = false;
      }
    });
  }

  getDriverName(): string {
    if (this.driverInfo) {
      return this.driverInfo.name;
    }

    if (!this.job?.driverId) {
      return 'Unassigned';
    }

    return 'Unknown Driver';
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';

    if (typeof date === 'string') {
      return new Date(date).toLocaleString();
    }

    // Handle Firebase Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
      const timestamp = date as unknown as { toDate: () => Date };
      return timestamp.toDate().toLocaleString();
    }

    return date.toLocaleString();
  }

  /**
   * Format date to UK format (DD/MM/YYYY)
   */
  formatUKDate(date: Date | undefined): string {
    if (!date) return 'N/A';

    if (typeof date === 'string') {
      date = new Date(date);
    }

    // Handle Firebase Timestamp
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
   */
  formatUKDateTime(date: Date | undefined): string {
    if (!date) return 'N/A';

    if (typeof date === 'string') {
      date = new Date(date);
    }

    // Handle Firebase Timestamp
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
   */
  getStatusFlowProgress(): number {
    if (!this.job) return 0;

    const statusOrder = [
      'unallocated',
      'allocated',
      'collected',
      'delivered',
      'completed',
    ];

    const currentStatusIndex = statusOrder.indexOf(this.job.status);
    if (currentStatusIndex === -1) return 0;

    // Calculate percentage based on position in flow
    return (currentStatusIndex / (statusOrder.length - 1)) * 100;
  }

  /**
   * Get status steps for the status flow visualization
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

    const currentStatusIndex = statusOrder.findIndex(
      (s) => s.key === this.job?.status
    );

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

    // Special cases mapping for certain manufacturers
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

    // Normalize the make name
    const normalized = make.toLowerCase().trim();

    // Check if it's a special case first
    if (specialCases[normalized]) {
      return `assets/images/car-logos/${specialCases[normalized]}.png`;
    }

    // Regular normalization: lowercase, replace spaces with underscores, replace hyphens with underscores
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

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
