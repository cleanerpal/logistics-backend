import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FirebaseService } from '../../../services/firebase.service';
import { Firestore, doc, getDoc, Timestamp } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

interface DriverHandover {
  id: string;
  jobId: string;
  vehicleId: string;
  fromDriver: string;
  fromDriverId: string;
  toDriver: string;
  toDriverId: string;
  timestamp: any;
  location: string;
  odometer: number;
  notes: string;
  reason: string;
  fromSignature?: string;
  toSignature?: string;
  fromSignatureNotes?: string;
  toSignatureNotes?: string;
}

@Component({
  selector: 'app-handover-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './handover-details.component.html',
  styleUrls: ['./handover-details.component.scss'],
})
export class HandoverDetailsComponent implements OnInit, OnDestroy {
  handoverId: string = '';
  handover: DriverHandover | null = null;

  // Signature canvas references
  @ViewChild('fromSignatureImg')
  fromSignatureImg!: ElementRef<HTMLImageElement>;
  @ViewChild('toSignatureImg') toSignatureImg!: ElementRef<HTMLImageElement>;

  // Loading state
  loading = true;

  // Job details (to be fetched)
  jobDetails: any = null;

  // Subscriptions
  private handoverSubscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firestore: Firestore,
    private firebaseService: FirebaseService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Get handover ID from route params
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.handoverId = id;
        this.loadHandoverDetails(this.handoverId);
      } else {
        this.navigateBack();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.handoverSubscription) {
      this.handoverSubscription.unsubscribe();
    }
  }

  loadHandoverDetails(handoverId: string): void {
    this.loading = true;

    this.handoverSubscription = this.firebaseService
      .getDocumentWithSnapshot<DriverHandover>('driverHandovers', handoverId)
      .subscribe(
        (handoverData) => {
          if (!handoverData) {
            this.snackBar.open('Handover not found', 'Close', {
              duration: 5000,
            });
            this.navigateBack();
            return;
          }

          this.handover = {
            ...handoverData,
            timestamp:
              handoverData.timestamp instanceof Timestamp
                ? handoverData.timestamp.toDate()
                : handoverData.timestamp instanceof Date
                ? handoverData.timestamp
                : new Date(handoverData.timestamp),
          };

          // Load associated job details if available
          if (this.handover.jobId) {
            this.loadJobDetails(this.handover.jobId);
          } else {
            this.loading = false;
          }
        },
        (error) => {
          console.error('Error loading handover details:', error);
          this.snackBar.open('Error loading handover details', 'Close', {
            duration: 5000,
            panelClass: 'error-snackbar',
          });
          this.loading = false;
        }
      );
  }

  async loadJobDetails(jobId: string): Promise<void> {
    try {
      const jobDocRef = doc(this.firestore, 'jobs', jobId);
      const jobDocSnap = await getDoc(jobDocRef);

      if (jobDocSnap.exists()) {
        this.jobDetails = {
          id: jobDocSnap.id,
          ...jobDocSnap.data(),
        };
      }

      this.loading = false;
    } catch (error) {
      console.error('Error loading job details:', error);
      this.loading = false;
    }
  }

  navigateBack(): void {
    this.router.navigate(['/handovers/history']);
  }

  navigateToJob(): void {
    if (this.handover?.jobId) {
      this.router.navigate(['/jobs/edit', this.handover.jobId]);
    }
  }

  navigateToDriverProfile(driverId: string): void {
    this.router.navigate(['/drivers', driverId]);
  }

  navigateToVehicle(): void {
    if (this.handover?.vehicleId) {
      this.router.navigate(['/vehicles', this.handover.vehicleId]);
    }
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return 'N/A';

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    return date.toLocaleString();
  }

  printHandover(): void {
    window.print();
  }

  // Export handover as PDF (could be implemented with jsPDF or similar)
  exportPdf(): void {
    this.snackBar.open('PDF export functionality coming soon', 'Close', {
      duration: 3000,
    });
  }
}
