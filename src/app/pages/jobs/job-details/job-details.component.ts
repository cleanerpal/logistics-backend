import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { AuthService } from '../../../services/auth.service';
import { JobService } from '../../../services/job.service';
import { Job, UserProfile } from '../../../interfaces/job.interface';

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
    this.route.params.subscribe((params) => {
      this.jobId = params['id'];
      this.loadJobDetails();
    });

    // Check user permissions
    this.checkUserPermissions();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadJobDetails() {
    this.isLoading = true;

    const jobSub = this.jobService.getJobById(this.jobId).subscribe({
      next: (job) => {
        this.job = job;
        this.isLoading = false;

        // Load job notes if available
        if (job && job.notes) {
          this.processJobNotes(job);
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
    if (Array.isArray(job.notes)) {
      this.jobNotes = job.notes as Note[];
    } else if (typeof job.notes === 'string') {
      // If it's a single string, create a note from it
      this.jobNotes = [
        {
          author: job.createdBy || 'System',
          content: job.notes,
          date: job.createdAt,
        },
      ];
    } else if (typeof job.notes === 'object' && job.notes !== null) {
      // If it's an object of notes, convert to array
      try {
        const notesObject = job.notes as Record<string, any>;
        this.jobNotes = Object.entries(notesObject).map(([id, noteData]) => {
          // Ensure the note data has the needed structure
          const note: Note = {
            author: (noteData as any).author || 'Unknown',
            content: (noteData as any).content || '',
            date: new Date((noteData as any).date || new Date()),
          };
          return note;
        });
      } catch (error) {
        console.error('Error processing notes:', error);
        this.jobNotes = [];
      }
    } else {
      // Default - no notes
      this.jobNotes = [];
    }
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

        this.jobService.allocateJob(this.job.id).subscribe({
          next: () => {
            this.loadJobDetails();
            this.showSnackbar('Job allocated successfully');
          },
          error: (error) => {
            console.error('Error allocating job:', error);
            this.isLoading = false;
            this.showSnackbar('Error allocating job');
          },
        });
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

  startCollection() {
    if (!this.job) return;

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Start Collection',
        message: 'Are you ready to start the collection process for this job?',
        confirmText: 'Start Collection',
        cancelText: 'Cancel',
      },
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
      },
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
      },
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
   * Get vehicle brand logo path
   * @param make The vehicle manufacturer name
   * @returns Path to the logo image
   */
  getVehicleLogo(make: string): string {
    if (!make) return 'assets/images/car-logos/default.png';

    // Convert to lowercase and remove spaces/special characters for file matching
    const normalizedMake = make.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Return the path to the logo - add error handling with default logo
    return `assets/images/car-logos/${normalizedMake}.png`;
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
