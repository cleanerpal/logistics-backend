import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import * as shape from 'd3-shape';
import { Timestamp } from '@angular/fire/firestore';

import { BehaviorSubject, Subject, Subscription, combineLatest, interval, of, timer } from 'rxjs';
import { catchError, delay, finalize, switchMap, take, takeUntil, timeout } from 'rxjs/operators';

import { ConfirmationDialogComponent } from '../../dialogs/confirmation-dialog.component';
import { DriverSelectionDialogComponent } from '../../dialogs/driver-selection-dialog.component';
import { AuthService } from '../../services/auth.service';

import { NotificationService } from '../../services/notification.service';
import { VehicleService } from '../../services/vehicle.service';

import { Job } from '../../interfaces/job-new.interface';
import { UserProfile } from '../../interfaces/user-profile.interface';
import { Vehicle } from '../../interfaces/vehicle.interface';
import { JobNewService } from '../../services/job-new.service';

interface TrendData {
  name: string;
  value: number;
}

interface PeriodMetric {
  current: number;
  change: number;
  increased: boolean;
  data: TrendData[];
}

interface DeliveryMetrics {
  week: PeriodMetric;
  month: PeriodMetric;
  year: PeriodMetric;
}

interface TrendInfo {
  percentChange: number;
  increased: boolean;
}

interface DashboardMetrics {
  activeJobs: number;
  unallocatedJobs: number;
  totalJobs: number;
  completedJobs: number;
  collectedJobs: number;
  deliveredJobs: number;
  activeJobsTrend: TrendInfo;
  unallocatedJobsTrend: TrendInfo;
}

enum DriverStatus {
  AVAILABLE = 'Available',
  BUSY = 'Busy',
  ON_LEAVE = 'On Leave',
  OFFLINE = 'Offline',
}

interface EnhancedDriverInfo {
  profile: UserProfile;
  status: DriverStatus;
  currentJobs: number;
  lastActivity?: Date;
  activeJobs?: Job[];
  isAvailable: boolean;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: false,
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns: string[] = ['shippingReference', 'regNumber', 'customerName', 'collectionDate', 'collectionTown', 'deliveryTown', 'status', 'driver', 'actions'];

  jobsDataSource = new MatTableDataSource<Job>([]);
  isLoading = true;
  isLoadingDrivers = true;
  curve = shape.curveLinear;
  jobs: Job[] = [];
  vehicles: Vehicle[] = [];

  // Dashboard refresh interval (5 minutes)
  private readonly REFRESH_INTERVAL = 5 * 60 * 1000;
  private readonly LOADING_TIMEOUT = 10000; // 10 seconds

  // Previous metrics for trend calculation
  private previousJobCounts = {
    active: 0,
    unallocated: 0,
    total: 0,
  };

  // Dashboard metrics
  metrics: DashboardMetrics = {
    activeJobs: 0,
    unallocatedJobs: 0,
    totalJobs: 0,
    completedJobs: 0,
    collectedJobs: 0,
    deliveredJobs: 0,
    activeJobsTrend: {
      percentChange: 0,
      increased: false,
    },
    unallocatedJobsTrend: {
      percentChange: 0,
      increased: false,
    },
  };

  // Track metric changes over time for charts
  private metricHistory = {
    activeJobs: [] as number[],
    unallocatedJobs: [] as number[],
    totalJobs: [] as number[],
  };

  // Delivery metrics
  deliveryMetrics: DeliveryMetrics = {
    week: {
      current: 0,
      change: 0,
      increased: false,
      data: [],
    },
    month: {
      current: 0,
      change: 0,
      increased: false,
      data: [],
    },
    year: {
      current: 0,
      change: 0,
      increased: false,
      data: [],
    },
  };

  // Chart data
  jobStatusChartData: any[] = [];
  deliveryTrendData: any[] = [];

  // Using string-based color schemes (most reliable approach)
  pieChartColorScheme: string = 'cool';
  lineChartColorScheme: string = 'cool';

  // Driver-related properties
  allDrivers: EnhancedDriverInfo[] = [];
  filteredDrivers: EnhancedDriverInfo[] = [];
  selectedDriverStatus: string = 'All';
  driverStatusOptions = ['All', 'Available', 'Busy', 'On Leave', 'Offline'];

  // Data loading states
  private jobsLoaded$ = new BehaviorSubject<boolean>(false);
  private driversLoaded$ = new BehaviorSubject<boolean>(false);
  private metricsLoaded$ = new BehaviorSubject<boolean>(false);
  private vehiclesLoaded$ = new BehaviorSubject<boolean>(false);

  // Cleanup
  private destroy$ = new Subject<void>();
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private jobService: JobNewService,
    private authService: AuthService,
    private vehicleService: VehicleService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {
    this.jobsDataSource = new MatTableDataSource<Job>([]);
  }

  ngOnInit(): void {
    console.log('Dashboard initializing...');

    // Force loading to complete after timeout
    this.setupLoadingTimeout();
    this.setupDataSubscriptions();
    this.setupCustomSort();

    // Initialize with default data first
    this.initializeDefaultData();

    // Then try to load real data
    this.initDashboardData();
    this.setupRefreshInterval();
  }

  ngAfterViewInit(): void {
    if (this.sort && this.paginator) {
      this.jobsDataSource.sort = this.sort;
      this.jobsDataSource.paginator = this.paginator;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private setupLoadingTimeout(): void {
    timer(this.LOADING_TIMEOUT)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isLoading) {
          console.warn('Dashboard loading timeout - forcing completion');
          this.forceLoadingComplete();
        }
      });
  }

  private forceLoadingComplete(): void {
    this.isLoading = false;
    this.isLoadingDrivers = false;
    this.jobsLoaded$.next(true);
    this.driversLoaded$.next(true);
    this.metricsLoaded$.next(true);
    this.vehiclesLoaded$.next(true);

    this.notificationService.addNotification({
      type: 'warning',
      title: 'Loading Timeout',
      message: 'Dashboard took longer than expected to load. Some data may be incomplete.',
    });
  }

  private initializeDefaultData(): void {
    console.log('Initializing default dashboard data');

    // Set default metrics
    this.metrics = {
      activeJobs: 0,
      unallocatedJobs: 0,
      totalJobs: 0,
      completedJobs: 0,
      collectedJobs: 0,
      deliveredJobs: 0,
      activeJobsTrend: { percentChange: 0, increased: false },
      unallocatedJobsTrend: { percentChange: 0, increased: false },
    };

    // Set default delivery metrics
    this.deliveryMetrics = {
      week: { current: 0, change: 0, increased: false, data: [] },
      month: { current: 0, change: 0, increased: false, data: [] },
      year: { current: 0, change: 0, increased: false, data: [] },
    };

    // Set default chart data
    this.jobStatusChartData = [{ name: 'No Data Available', value: 1 }];

    this.deliveryTrendData = [];

    // Initialize empty arrays
    this.jobs = [];
    this.vehicles = [];
    this.allDrivers = [];
    this.filteredDrivers = [];

    // Set data source
    this.jobsDataSource.data = [];
  }

  private setupDataSubscriptions(): void {
    // Monitor all loading states with detailed logging
    const dataLoadingSubscription = combineLatest([this.jobsLoaded$, this.driversLoaded$, this.metricsLoaded$, this.vehiclesLoaded$]).subscribe(
      ([jobsLoaded, driversLoaded, metricsLoaded, vehiclesLoaded]) => {
        this.isLoading = !(jobsLoaded && metricsLoaded && vehiclesLoaded);
        this.isLoadingDrivers = !driversLoaded;

        if (!this.isLoading) {
          console.log('Dashboard loading completed!');
        }
      }
    );

    this.subscriptions.push(dataLoadingSubscription);
  }

  private setupCustomSort(): void {
    this.jobsDataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'timestamp':
          //
          if (item['timestamp'] instanceof Timestamp) {
            return item['timestamp'].toDate().getTime();
          }
          return item['timestamp'] ? new Date(item['timestamp']).getTime() : 0;
        case 'collectionDate':
          if (item['collectionDate'] instanceof Timestamp) {
            return item['collectionDate'].toDate().getTime();
          }
          return item['collectionDate'] ? new Date(item['collectionDate']).getTime() : 0;
        case 'createdAt':
          if (item.createdAt instanceof Timestamp) {
            return item.createdAt.toDate().getTime();
          }
          return item.createdAt ? new Date(item.createdAt).getTime() : 0;
        case 'updatedAt':
          if (item.updatedAt instanceof Timestamp) {
            return item.updatedAt.toDate().getTime();
          }
          return item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        default:
          const value = item[property as keyof Job];
          return typeof value === 'string' ? value.toLowerCase() : value;
      }
    };
  }

  private setupRefreshInterval(): void {
    const refreshSub = interval(this.REFRESH_INTERVAL)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshDashboardData();
      });

    this.subscriptions.push(refreshSub);
  }

  private initDashboardData(): void {
    this.storePreviousMetrics();
    this.loadJobs();
    this.loadDriversWithJobs();
    this.loadVehicles();
    this.loadDeliveryMetrics();
    this.loadDashboardStats();
  }

  refreshDashboardData(): void {
    this.storePreviousMetrics();

    this.notificationService.addNotification({
      type: 'info',
      title: 'Dashboard Refreshing',
      message: 'Dashboard data is being refreshed...',
    });

    // Reset loading states
    this.jobsLoaded$.next(false);
    this.driversLoaded$.next(false);
    this.metricsLoaded$.next(false);
    this.vehiclesLoaded$.next(false);

    // Reload all data
    this.initDashboardData();
  }

  private storePreviousMetrics(): void {
    this.previousJobCounts = {
      active: this.metrics.activeJobs,
      unallocated: this.metrics.unallocatedJobs,
      total: this.metrics.totalJobs,
    };

    // Add current metrics to history for charts
    if (this.metrics.totalJobs > 0) {
      this.metricHistory.activeJobs.push(this.metrics.activeJobs);
      this.metricHistory.unallocatedJobs.push(this.metrics.unallocatedJobs);
      this.metricHistory.totalJobs.push(this.metrics.totalJobs);

      // Keep only the last 14 data points for trends
      if (this.metricHistory.activeJobs.length > 14) {
        this.metricHistory.activeJobs.shift();
        this.metricHistory.unallocatedJobs.shift();
        this.metricHistory.totalJobs.shift();
      }
    }
  }

  private loadJobs(): void {
    const jobsSub = this.jobService
      .getRecentJobs(50)
      .pipe(
        timeout(8000),
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error loading jobs:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error Loading Jobs',
            message: 'There was a problem loading job data from the database.',
          });
          return of([]);
        }),
        finalize(() => {
          this.jobsLoaded$.next(true);
        })
      )
      .subscribe({
        next: (jobs: Job[]) => {
          this.jobs = jobs;
          console.log(this.jobs);
          this.jobsDataSource.data = jobs;
          this.calculateJobMetrics(jobs);
          this.updateJobStatusChart(jobs);
        },
        error: (error: any) => {
          console.error('Jobs subscription error:', error);
          this.jobsLoaded$.next(true);
        },
      });

    this.subscriptions.push(jobsSub);
  }

  private loadDashboardStats(): void {
    const statsSub = this.jobService
      .getDashboardStats()
      .pipe(
        timeout(8000),
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error loading dashboard stats:', error);
          return of({
            unallocated: 0,
            allocated: 0,
            collected: 0,
            delivered: 0,
            completed: 0,
            total: 0,
            active: 0,
          });
        })
      )
      .subscribe({
        next: (stats: any) => {
          this.updateMetricsFromStats(stats);
        },
        error: (error: any) => {
          console.error('Dashboard stats error:', error);
        },
      });

    this.subscriptions.push(statsSub);
  }

  private loadVehicles(): void {
    // Simplified vehicle loading to avoid type conflicts
    const vehiclesSub = of([] as any[])
      .pipe(
        delay(100), // Small delay to prevent race conditions
        finalize(() => {
          this.vehiclesLoaded$.next(true);
        })
      )
      .subscribe({
        next: (vehicles) => {
          this.vehicles = vehicles;
        },
        error: (error: any) => {
          console.error('Vehicles subscription error:', error);
          this.vehicles = [];
          this.vehiclesLoaded$.next(true);
        },
      });

    this.subscriptions.push(vehiclesSub);

    // Optionally try to load real vehicles in the background
    this.loadVehiclesBackground();
  }

  private loadVehiclesBackground(): void {
    // Try to load vehicles without blocking the dashboard
    this.vehicleService.vehicles$
      .pipe(
        take(1),
        timeout(5000),
        catchError((error) => {
          console.error('Background vehicle loading failed:', error);
          return of([]);
        })
      )
      .subscribe({
        next: (vehicles: any[]) => {
          if (vehicles && vehicles.length > 0) {
            this.vehicles = vehicles;
          }
        },
        error: (error) => {
          console.error('Background vehicle error:', error);
        },
      });
  }

  private loadDriversWithJobs(): void {
    const driversSub = this.authService
      .getDrivers()
      .pipe(
        timeout(8000),
        takeUntil(this.destroy$),
        switchMap((drivers) => {
          if (drivers.length === 0) {
            return of([]);
          }

          // Create enhanced driver info with empty jobs for now
          const enhancedDrivers = drivers.map((driver) => this.createEnhancedDriverInfo(driver, []));

          return of(enhancedDrivers);
        }),
        catchError((error) => {
          console.error('Error loading drivers with jobs:', error);
          return of([]);
        }),
        finalize(() => {
          this.driversLoaded$.next(true);
          console.log('Drivers loading completed');
        })
      )
      .subscribe({
        next: (enhancedDrivers: EnhancedDriverInfo[]) => {
          console.log('Drivers loaded:', enhancedDrivers.length);
          this.allDrivers = enhancedDrivers;
          this.filterDrivers();
        },
        error: (error: any) => {
          console.error('Drivers subscription error:', error);
          this.driversLoaded$.next(true);
        },
      });

    this.subscriptions.push(driversSub);
  }

  private loadDeliveryMetrics(): void {
    // Simplified delivery metrics loading
    const deliveriesSub = timer(200)
      .pipe(
        switchMap(() => of([])), // Return empty for now
        finalize(() => {
          this.metricsLoaded$.next(true);
          console.log('Delivery metrics loading completed');
        })
      )
      .subscribe({
        next: (deliveryJobs) => {
          console.log('Delivery metrics loaded');
          this.initializeEmptyDeliveryMetrics();
        },
        error: (error: any) => {
          console.error('Delivery metrics error:', error);
          this.metricsLoaded$.next(true);
        },
      });

    this.subscriptions.push(deliveriesSub);
  }

  private createEnhancedDriverInfo(driver: UserProfile, jobs: Job[]): EnhancedDriverInfo {
    const activeJobs = jobs.filter((job) => ['allocated', 'collected', 'in-transit'].includes(job.status));

    // Ensure we always get a proper boolean value
    const driverIsActive = Boolean(driver.isActive);
    const hasNoActiveJobs = activeJobs.length === 0;
    const isAvailable = hasNoActiveJobs && driverIsActive;

    // Determine status based on job load and last activity
    let status: DriverStatus;
    if (!driverIsActive) {
      status = DriverStatus.OFFLINE;
    } else if (activeJobs.length > 0) {
      status = DriverStatus.BUSY;
    } else {
      status = DriverStatus.AVAILABLE;
    }

    return {
      profile: driver,
      status,
      currentJobs: activeJobs.length,
      activeJobs,
      isAvailable, // Now guaranteed to be boolean
      lastActivity: this.calculateLastActivity(jobs),
    };
  }

  private calculateLastActivity(jobs: Job[]): Date | undefined {
    if (jobs.length === 0) return undefined;

    return jobs.reduce((latest, job) => {
      // Ensure job.updatedAt and job.createdAt are handled as Timestamp objects
      const jobUpdate = (job.updatedAt || job.createdAt) as Timestamp;
      if (!jobUpdate) return latest;

      // Convert Timestamp to Date using .toDate()
      const jobDate = jobUpdate.toDate();
      return !latest || jobDate > latest ? jobDate : latest;
    }, undefined as Date | undefined);
  }

  private calculateJobMetrics(jobs: Job[]): void {
    const activeStatuses = ['unallocated', 'allocated', 'collected', 'in-transit'];
    const completedStatuses = ['delivered', 'completed'];

    const activeJobs = jobs.filter((job) => activeStatuses.includes(job.status));
    const unallocatedJobs = jobs.filter((job) => job.status === 'unallocated');
    const collectedJobs = jobs.filter((job) => job.status === 'collected');
    const deliveredJobs = jobs.filter((job) => job.status === 'delivered');
    const completedJobs = jobs.filter((job) => completedStatuses.includes(job.status));

    // Calculate trends
    const activeJobsTrend = this.calculateTrend(activeJobs.length, this.previousJobCounts.active);
    const unallocatedJobsTrend = this.calculateTrend(unallocatedJobs.length, this.previousJobCounts.unallocated);

    this.metrics = {
      activeJobs: activeJobs.length,
      unallocatedJobs: unallocatedJobs.length,
      totalJobs: jobs.length,
      completedJobs: completedJobs.length,
      collectedJobs: collectedJobs.length,
      deliveredJobs: deliveredJobs.length,
      activeJobsTrend,
      unallocatedJobsTrend,
    };
  }

  private updateMetricsFromStats(stats: any): void {
    const activeJobsTrend = this.calculateTrend(stats.active, this.previousJobCounts.active);
    const unallocatedJobsTrend = this.calculateTrend(stats.unallocated, this.previousJobCounts.unallocated);

    this.metrics = {
      ...this.metrics,
      activeJobs: stats.active,
      unallocatedJobs: stats.unallocated,
      totalJobs: stats.total,
      completedJobs: stats.completed,
      collectedJobs: stats.collected,
      deliveredJobs: stats.delivered,
      activeJobsTrend,
      unallocatedJobsTrend,
    };
  }

  private calculateTrend(current: number, previous: number): TrendInfo {
    if (previous === 0) {
      return {
        percentChange: current > 0 ? 100 : 0,
        increased: current > 0,
      };
    }

    const percentChange = ((current - previous) / previous) * 100;
    return {
      percentChange: Math.abs(percentChange),
      increased: percentChange > 0,
    };
  }

  private updateJobStatusChart(jobs: Job[]): void {
    if (jobs.length === 0) {
      this.jobStatusChartData = [{ name: 'No Data', value: 1 }];
      return;
    }

    const statusCounts = jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    this.jobStatusChartData = Object.entries(statusCounts).map(([status, count]) => ({
      name: this.formatStatusName(status),
      value: count,
    }));
  }

  private formatStatusName(status: string): string {
    return status
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private initializeEmptyDeliveryMetrics(): void {
    this.deliveryMetrics = {
      week: { current: 0, change: 0, increased: false, data: [] },
      month: { current: 0, change: 0, increased: false, data: [] },
      year: { current: 0, change: 0, increased: false, data: [] },
    };
  }

  // Filter and search methods
  filterDrivers(): void {
    if (this.selectedDriverStatus === 'All') {
      this.filteredDrivers = this.allDrivers;
    } else {
      this.filteredDrivers = this.allDrivers.filter((driver) => driver.status === this.selectedDriverStatus);
    }
  }

  onDriverStatusChange(): void {
    this.filterDrivers();
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.jobsDataSource.filter = filterValue.trim().toLowerCase();

    if (this.jobsDataSource.paginator) {
      this.jobsDataSource.paginator.firstPage();
    }
  }

  // Navigation methods
  viewJob(job: Job): void {
    this.router.navigate(['/jobs', job.id]);
  }

  editJob(job: Job, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/jobs', job.id, 'edit']);
  }

  viewDriver(driver: UserProfile): void {
    this.router.navigate(['/drivers', driver.id]);
  }

  // Action methods
  allocateJob(job: Job): void {
    const dialogRef = this.dialog.open(DriverSelectionDialogComponent, {
      width: '500px',
      data: { job },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.jobService.allocateJobToDriver(job.id, result.driverId).subscribe({
          next: () => {
            this.notificationService.addNotification({
              type: 'success',
              title: 'Job Allocated',
              message: `Job ${job.id} has been allocated successfully.`,
            });
          },
          error: (error: any) => {
            this.notificationService.addNotification({
              type: 'error',
              title: 'Allocation Failed',
              message: `Failed to allocate job: ${error.message}`,
            });
          },
        });
      }
    });
  }

  deleteJob(job: Job): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Job',
        message: `Are you sure you want to delete job ${job.id}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.jobService.deleteJob(job.id).subscribe({
          next: () => {
            this.notificationService.addNotification({
              type: 'success',
              title: 'Job Deleted',
              message: `Job ${job.id} has been deleted successfully.`,
            });
          },
          error: (error: any) => {
            this.notificationService.addNotification({
              type: 'error',
              title: 'Delete Failed',
              message: `Failed to delete job: ${error.message}`,
            });
          },
        });
      }
    });
  }

  // Utility methods
  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      unallocated: 'status-unallocated',
      allocated: 'status-allocated',
      collected: 'status-collected',
      'in-transit': 'status-in-transit',
      delivered: 'status-delivered',
      completed: 'status-completed',
    };
    return statusMap[status] || 'status-default';
  }

  getDriverStatusClass(status: DriverStatus): string {
    const statusMap: Record<DriverStatus, string> = {
      [DriverStatus.AVAILABLE]: 'driver-available',
      [DriverStatus.BUSY]: 'driver-busy',
      [DriverStatus.ON_LEAVE]: 'driver-on-leave',
      [DriverStatus.OFFLINE]: 'driver-offline',
    };
    return statusMap[status] || 'driver-default';
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  formatDateTime(date: Date | string | undefined): string {
    if (!date) return 'N/A';

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getDriverName(driverId: string | null): string {
    if (!driverId) return 'Unassigned';

    const driver = this.allDrivers.find((d) => d.profile.id === driverId);
    return driver ? driver.profile.name : 'Unknown Driver';
  }

  createNewJob(): void {
    this.router.navigate(['/jobs/new']);
  }

  // View driver details
  viewDriverDetails(driver: EnhancedDriverInfo): void {
    this.router.navigate(['/drivers', driver.profile.id]);
  }

  viewJobDetails(job: Job): void {
    this.router.navigate(['/jobs', job.id]);
  }

  // Assign job to driver dialog
  assignJob(job: Job, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    // First open confirmation dialog
    const confirmDialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Assign Job',
        message: `Do you want to assign job ${job.id}?`,
        confirmText: 'Proceed',
        cancelText: 'Cancel',
        icon: 'assignment_ind',
      },
    });

    confirmDialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Open driver selection dialog
        this.openDriverSelectionDialog(job);
      }
    });
  }

  private openDriverSelectionDialog(job: Job): void {
    const dialogRef = this.dialog.open(DriverSelectionDialogComponent, {
      width: '500px',
      data: {
        jobId: job.id,
        jobTitle: `${job['make'] || ''} ${job['model'] || ''} ${job['registration'] ? '(' + job['registration'] + ')' : ''}`,
      },
    });

    dialogRef.afterClosed().subscribe((driver) => {
      if (driver) {
        this.isLoading = true;

        // Assign driver to job
        this.jobService
          .updateJob(job.id, {
            driverId: driver.id,
            status: 'allocated',
          })
          .pipe(finalize(() => (this.isLoading = false)))
          .subscribe({
            next: () => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'Job Assigned',
                message: `Job ${job.id} has been assigned to ${driver.name}`,
              });

              // Refresh job data
              this.loadJobs();
              this.loadDriversWithJobs();
            },
            error: (error) => {
              console.error('Error assigning job:', error);
              this.notificationService.addNotification({
                type: 'error',
                title: 'Assignment Failed',
                message: 'Failed to assign job to driver.',
              });
            },
          });
      }
    });
  }

  getJobCountClass(count: number): string {
    if (count > 2) return 'high';
    if (count > 0) return 'medium';
    return 'low';
  }

  setDriverStatusFilter(status: string): void {
    this.selectedDriverStatus = status;
    this.filterDrivers();
  }

  // Get initials for driver avatar
  getDriverInitials(driver: EnhancedDriverInfo): string {
    const name = driver.profile.name || '';
    if (!name) return '?';

    const nameParts = name.split(' ');
    if (nameParts.length === 1) {
      return nameParts[0].charAt(0).toUpperCase();
    }

    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
  }
}
