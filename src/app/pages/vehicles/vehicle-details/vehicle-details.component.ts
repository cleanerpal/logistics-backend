import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription, forkJoin, of } from 'rxjs';
import { switchMap, catchError, finalize } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { VehicleService, Vehicle, VehiclePhoto, ConditionReport } from '../../../services/vehicle.service';
import { JobService } from '../../../services/job.service';

import { Job as JobInterface } from '../../../interfaces/job.interface';

type VehicleJob = JobInterface;

@Component({
  selector: 'app-vehicle-details',
  templateUrl: './vehicle-details.component.html',
  styleUrls: ['./vehicle-details.component.scss'],
  standalone: false,
})
export class VehicleDetailsComponent implements OnInit, OnDestroy {
  vehicleId: string = '';
  vehicle: Vehicle | null = null;
  activeTab: 'overview' | 'photos' | 'history' | 'reports' = 'overview';
  loading = false;
  error: string | null = null;
  hasEditPermission = false;

  filteredPhotos: VehiclePhoto[] = [];
  selectedJobFilter: string = 'all';
  photosSort: 'newest' | 'oldest' = 'newest';
  jobsWithPhotos: { id: string; createdAt: Date }[] = [];

  jobs: VehicleJob[] = [];

  selectedPhoto: VehiclePhoto | null = null;
  @ViewChild('photoViewerDialog') photoViewerDialog!: TemplateRef<any>;

  colorMap: { [key: string]: string } = {
    Black: '#333333',
    White: '#FFFFFF',
    Silver: '#C0C0C0',
    Grey: '#808080',
    Blue: '#0000FF',
    Red: '#FF0000',
    Green: '#008000',
    Yellow: '#FFFF00',
    Brown: '#A52A2A',
    Orange: '#FFA500',
    Purple: '#800080',
    Gold: '#FFD700',
    Beige: '#F5F5DC',
  };

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vehicleService: VehicleService,
    private jobService: JobService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.checkPermissions();

    const routeSub = this.route.params.subscribe((params) => {
      this.vehicleId = params['id'];
      this.loadVehicleDetails(this.vehicleId);
    });

    this.subscriptions.push(routeSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private checkPermissions(): void {
    const authSub = this.authService.getUserProfile().subscribe((user) => {
      this.hasEditPermission = user?.permissions?.canManageUsers || user?.permissions?.isAdmin || false;
    });
    this.subscriptions.push(authSub);
  }

  loadVehicleDetails(vehicleId: string): void {
    this.loading = true;
    this.error = null;

    const vehicleSub = this.vehicleService
      .getVehicleById(vehicleId)
      .pipe(
        switchMap((vehicle) => {
          if (!vehicle) {
            throw new Error('Vehicle not found');
          }

          this.vehicle = vehicle;

          return forkJoin({
            jobs: this.jobService.getJobsByVehicle(vehicleId),
          });
        }),
        catchError((error) => {
          this.error = error.message || 'Failed to load vehicle details';
          console.error('Error loading vehicle details:', error);
          return of({ jobs: [] });
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((result) => {
        if (this.vehicle) {
          this.jobs = result.jobs || [];

          this.setupPhotosData();
        }
      });

    this.subscriptions.push(vehicleSub);
  }

  private setupPhotosData(): void {
    if (!this.vehicle || !this.vehicle.photos) return;

    this.filteredPhotos = [...this.vehicle.photos];

    this.sortPhotos();

    const jobsMap = new Map<string, Date>();

    this.vehicle.photos.forEach((photo) => {
      if (!photo.jobId) return; // Skip photos without jobId

      const job = this.jobs.find((j) => j.id === photo.jobId);
      if (job) {
        jobsMap.set(photo.jobId, job.createdAt);
      } else {
        jobsMap.set(photo.jobId, photo.takenAt);
      }
    });

    this.jobsWithPhotos = Array.from(jobsMap.entries()).map(([id, createdAt]) => ({
      id,
      createdAt,
    }));

    this.jobsWithPhotos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  filterPhotos(): void {
    if (!this.vehicle || !this.vehicle.photos) return;

    if (this.selectedJobFilter === 'all') {
      this.filteredPhotos = [...this.vehicle.photos];
    } else {
      this.filteredPhotos = this.vehicle.photos.filter((photo) => photo.jobId === this.selectedJobFilter);
    }

    this.sortPhotos();
  }

  sortPhotos(): void {
    this.filteredPhotos.sort((a, b) => {
      const dateA = new Date(a.takenAt).getTime();
      const dateB = new Date(b.takenAt).getTime();

      return this.photosSort === 'newest'
        ? dateB - dateA // Newest first
        : dateA - dateB; // Oldest first
    });
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab as 'overview' | 'photos' | 'history' | 'reports';
  }

  editVehicle(): void {
    this.router.navigate(['/vehicles', this.vehicleId, 'edit']);
  }

  viewJob(jobId?: string): void {
    if (jobId) {
      this.router.navigate(['/jobs', jobId]);
    }
  }

  viewAllJobs(): void {
    this.router.navigate(['/jobs'], {
      queryParams: {
        registration: this.vehicle?.registration,
      },
    });
  }

  get latestPhoto(): VehiclePhoto | undefined {
    if (!this.vehicle || !this.vehicle.photos || this.vehicle.photos.length === 0) {
      return undefined;
    }

    return [...this.vehicle.photos].sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];
  }

  get latestJob(): VehicleJob | undefined {
    if (!this.jobs || this.jobs.length === 0) {
      return undefined;
    }

    return [...this.jobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  openPhotoViewer(photo: VehiclePhoto): void {
    this.selectedPhoto = photo;
    this.dialog.open(this.photoViewerDialog, {
      width: '800px',
      maxWidth: '95vw',
      panelClass: 'photo-viewer-dialog',
    });
  }

  closePhotoViewer(): void {
    this.dialog.closeAll();
  }

  getJobReference(jobId?: string): string {
    if (!jobId) return 'Unknown';

    const job = this.jobs.find((j) => j.id === jobId);
    return job ? job.id : jobId;
  }

  getReportAuthorName(authorId: string): string {
    return authorId || 'Unknown';
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';

    if (typeof date === 'string') {
      date = new Date(date);
    }

    if (date && typeof date === 'object' && 'toDate' in date) {
      const timestamp = date as unknown as { toDate: () => Date };
      date = timestamp.toDate();
    }

    return date.toLocaleDateString();
  }

  getColorHex(colorName: string): string {
    return this.colorMap[colorName] || '#CCCCCC'; // Default gray if not found
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  getJobProperty(job: VehicleJob | undefined, property: string): any {
    if (!job) return undefined;
    return (job as any)[property];
  }
}
