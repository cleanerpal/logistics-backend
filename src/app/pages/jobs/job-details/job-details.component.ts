import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

// Firebase imports
import {
  Firestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  DocumentData,
} from '@angular/fire/firestore';

// Import Job model
import { Job } from '../../../models/jobs.model';
import { HandoverDialogComponent } from '../handover-dialog/handover-dialog.component';

// Interface for driver timeline
interface DriverTimeline {
  id: string;
  driverId: string;
  driverName: string;
  startTime: Timestamp;
  endTime: Timestamp | null;
  notes: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-job-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTabsModule,
    MatListModule,
    MatDialogModule,
  ],
  templateUrl: './job-details.component.html',
  styleUrls: ['./job-details.component.scss'],
})
export class JobDetailsComponent implements OnInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private route: ActivatedRoute = inject(ActivatedRoute);
  private router: Router = inject(Router);
  private snackBar: MatSnackBar = inject(MatSnackBar);
  private dialog: MatDialog = inject(MatDialog);

  job: Job | null = null;
  jobId: string | null = null;
  loading = true;
  driverTimeline: DriverTimeline[] = [];
  handoverHistory: any[] = [];

  // To check if user has admin privileges
  isSuperAdmin = true; // This would normally be set by your auth service

  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    // Get job ID from route params
    this.route.paramMap.subscribe((params) => {
      this.jobId = params.get('id');

      if (this.jobId) {
        this.loadJobData(this.jobId);
      } else {
        this.snackBar.open('Job ID not provided.', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/jobs']);
      }
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  /**
   * Load job data from Firestore
   */
  async loadJobData(jobId: string): Promise<void> {
    try {
      this.loading = true;

      const jobRef = doc(this.firestore, 'Jobs', jobId);
      const jobSnap = await getDoc(jobRef);

      if (jobSnap.exists()) {
        const data = jobSnap.data() as DocumentData;

        // Create job object
        this.job = {
          id: jobSnap.id,
          ...(data as any),
        } as Job;

        // Load related data
        await Promise.all([
          this.loadDriverTimeline(jobId),
          this.loadHandoverHistory(jobId),
        ]);

        this.loading = false;
      } else {
        this.snackBar.open('Job not found.', 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/jobs']);
      }
    } catch (error) {
      console.error('Error loading job data:', error);
      this.snackBar.open('Error loading job data.', 'Close', {
        duration: 3000,
      });
      this.loading = false;
    }
  }

  /**
   * Load driver timeline from Firestore
   */
  async loadDriverTimeline(jobId: string): Promise<void> {
    try {
      const timelineCollection = collection(this.firestore, 'DriverTimeline');
      const timelineQuery = query(
        timelineCollection,
        where('jobId', '==', jobId),
        orderBy('startTime', 'desc')
      );

      const querySnapshot = await getDocs(timelineQuery);
      this.driverTimeline = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        this.driverTimeline.push({
          id: doc.id,
          driverId: data['driverId'],
          driverName: data['driverName'],
          startTime: data['startTime'],
          endTime: data['endTime'],
          notes: data['notes'],
          isCurrent: data['endTime'] === null,
        });
      });
    } catch (error) {
      console.error('Error loading driver timeline:', error);
    }
  }

  /**
   * Load handover history from Firestore
   */
  async loadHandoverHistory(jobId: string): Promise<void> {
    try {
      const handoversCollection = collection(this.firestore, 'Handovers');
      const handoversQuery = query(
        handoversCollection,
        where('jobId', '==', jobId),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(handoversQuery);
      this.handoverHistory = [];

      querySnapshot.forEach((doc) => {
        this.handoverHistory.push({
          id: doc.id,
          ...doc.data(),
        });
      });
    } catch (error) {
      console.error('Error loading handover history:', error);
    }
  }

  /**
   * Open handover dialog
   */
  openHandoverDialog(): void {
    if (!this.job) return;

    const dialogRef = this.dialog.open(HandoverDialogComponent, {
      width: '600px',
      data: {
        jobId: this.job.id,
        team: this.job.team,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.success) {
        // Reload data
        this.loadJobData(this.job!.id);

        this.snackBar.open('Handover completed successfully.', 'Close', {
          duration: 3000,
        });
      }
    });
  }

  /**
   * Navigate to edit job
   */
  editJob(): void {
    if (!this.job) return;
    this.router.navigate(['/jobs/edit', this.job.id]);
  }

  /**
   * Navigate back to jobs list
   */
  goBack(): void {
    this.router.navigate(['/jobs']);
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: Timestamp | null): string {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate();
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get status color
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'Unallocated':
        return '#F44336'; // Red
      case 'Allocated':
        return '#FFC107'; // Amber
      case 'Collected':
        return '#2196F3'; // Blue
      case 'Delivered':
        return '#4CAF50'; // Green
      case 'Cancelled':
        return '#9E9E9E'; // Grey
      default:
        return '#9E9E9E'; // Grey
    }
  }
}
