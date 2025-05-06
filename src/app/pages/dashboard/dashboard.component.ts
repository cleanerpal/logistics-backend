import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import * as shape from 'd3-shape';
import { JobService } from '../../services/job.service';
import { AuthService } from '../../services/auth.service';
import { CustomerService } from '../../services/customer.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationDialogComponent } from '../../dialogs/confirmation-dialog.component';
import { Subject, Subscription, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil } from 'rxjs/operators';
import { UserProfile } from '../../interfaces/user-profile.interface';
import { Job } from '../../interfaces/job.interface';

// Define interfaces for dashboard stats and metrics
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
  activeJobsTrend: TrendInfo;
  unallocatedJobsTrend: TrendInfo;
}

// Define driver status options
enum DriverStatus {
  AVAILABLE = 'Available',
  BUSY = 'Busy',
  ON_LEAVE = 'On Leave',
  OFFLINE = 'Offline',
}

// Interface for enhanced driver information
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

  displayedColumns: string[] = ['id', 'regNumber', 'customerName', 'collectionDate', 'collectionTown', 'deliveryTown', 'status', 'driver', 'actions'];

  jobsDataSource: MatTableDataSource<Job>;
  isLoading = true;
  isLoadingDrivers = true;
  curve = shape.curveLinear;
  jobs: Job[] = [];

  // Color scheme for charts
  colorScheme = 'cool';

  // Dashboard metrics
  metrics: DashboardMetrics = {
    activeJobs: 0,
    unallocatedJobs: 0,
    activeJobsTrend: {
      percentChange: 0,
      increased: false,
    },
    unallocatedJobsTrend: {
      percentChange: 0,
      increased: false,
    },
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

  // Driver-related properties
  allDrivers: EnhancedDriverInfo[] = [];
  filteredDrivers: EnhancedDriverInfo[] = [];
  selectedDriverStatus: string = 'All';
  driverStatusOptions = ['All', 'Available', 'Busy', 'On Leave', 'Offline'];

  // For cleanup
  private destroy$ = new Subject<void>();
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private jobService: JobService,
    private authService: AuthService,
    private customerService: CustomerService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {
    this.jobsDataSource = new MatTableDataSource<Job>();
  }

  ngOnInit(): void {
    this.loadDashboardData();
    this.setupDataRefresh();
  }

  ngAfterViewInit(): void {
    this.jobsDataSource.sort = this.sort;
    this.jobsDataSource.paginator = this.paginator;
    this.setupCustomSort();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();

    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private setupCustomSort(): void {
    this.jobsDataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'timestamp':
          return new Date(item['timestamp']).getTime();
        case 'collectionDate':
          return item['collectionDate'] ? new Date(item['collectionDate']).getTime() : 0;
        default:
          return (item as any)[property];
      }
    };
  }

  private setupDataRefresh(): void {
    // Refresh data every 5 minutes
    const interval = setInterval(() => {
      this.loadDashboardData();
    }, 5 * 60 * 1000);

    // Clean up on destroy
    this.subscriptions.push(
      new Subscription(() => {
        clearInterval(interval);
      })
    );
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    this.isLoadingDrivers = true;

    // Load jobs, drivers, and stats in parallel
    const dashboardDataSub = combineLatest([this.loadJobs(), this.loadDriversWithStatus(), this.loadDeliveryMetrics()]).subscribe({
      next: ([jobsLoaded, driversLoaded, metricsLoaded]) => {
        this.isLoading = false;
        this.isLoadingDrivers = false;
        console.log('Dashboard data loaded');
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.isLoading = false;
        this.isLoadingDrivers = false;
        this.notificationService.addNotification({
          type: 'error',
          title: 'Dashboard Error',
          message: 'There was an error loading dashboard data. Please try refreshing the page.',
        });
      },
    });

    this.subscriptions.push(dashboardDataSub);
  }

  private loadJobs(): Promise<boolean> {
    return new Promise((resolve) => {
      // Load today's jobs
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const loadJobsSub = this.jobService
        .getRecentJobs(25)
        .pipe(
          takeUntil(this.destroy$),
          catchError((error) => {
            console.error('Error loading jobs:', error);
            return of([]);
          })
        )
        .subscribe((jobs) => {
          this.jobs = jobs.filter((job) => {
            // Filter to show only today's jobs and recent active jobs
            const jobDate = job.createdAt;
            const jobStatus = job.status;
            return jobDate >= todayStart || (['allocated', 'collected', 'unallocated'] as string[]).includes(jobStatus);
          });

          this.jobsDataSource.data = this.jobs;
          this.updateMetrics();
          resolve(true);
        });

      this.subscriptions.push(loadJobsSub);
    });
  }

  private loadDriversWithStatus(): Promise<boolean> {
    return new Promise((resolve) => {
      // Get all drivers
      const driversSub = this.authService
        .getUsersByRole('driver')
        .pipe(
          takeUntil(this.destroy$),
          switchMap((drivers) => {
            if (drivers.length === 0) {
              return of([]);
            }

            // Get all active jobs to determine driver status
            return this.jobService.getJobsByStatus('allocated').pipe(
              map((allocatedJobs) => {
                // Map jobs to drivers
                return drivers.map((driver) => {
                  const driverJobs = allocatedJobs.filter((job) => job.driverId === driver.id);

                  // Determine driver status based on job count and other factors
                  let status = DriverStatus.AVAILABLE;
                  if (!driver.isActive) {
                    status = DriverStatus.OFFLINE;
                  } else if (driverJobs.length > 2) {
                    status = DriverStatus.BUSY;
                  } else if (driverJobs.length === 0 && this.isDriverOnLeave(driver)) {
                    status = DriverStatus.ON_LEAVE;
                  }

                  return {
                    profile: driver,
                    status: status,
                    currentJobs: driverJobs.length,
                    lastActivity: this.getLastActivity(driverJobs),
                    activeJobs: driverJobs,
                    isAvailable: status === DriverStatus.AVAILABLE,
                  } as EnhancedDriverInfo;
                });
              }),
              catchError((error) => {
                console.error('Error fetching allocated jobs:', error);
                // Still return drivers with default status
                return of(
                  drivers.map(
                    (driver) =>
                      ({
                        profile: driver,
                        status: driver.isActive ? DriverStatus.AVAILABLE : DriverStatus.OFFLINE,
                        currentJobs: 0,
                        isAvailable: driver.isActive,
                      } as EnhancedDriverInfo)
                  )
                );
              })
            );
          }),
          catchError((error) => {
            console.error('Error fetching drivers:', error);
            return of([]);
          })
        )
        .subscribe((enhancedDrivers) => {
          this.allDrivers = enhancedDrivers;
          this.filterDrivers();
          this.isLoadingDrivers = false;
          resolve(true);
        });

      this.subscriptions.push(driversSub);
    });
  }

  private loadDeliveryMetrics(): Promise<boolean> {
    return new Promise((resolve) => {
      // In a real app, you'd load this from an analytics service
      // For this demo, we'll generate random data that looks realistic

      // Weekly data - last 7 days
      const weekData: TrendData[] = [];
      const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const currentWeekTotal = Math.floor(Math.random() * 20) + 15;
      const lastWeekTotal = Math.floor(Math.random() * 20) + 15;
      const weekPercentChange = this.calculatePercentChange(currentWeekTotal, lastWeekTotal);

      weekDays.forEach((day) => {
        weekData.push({
          name: day,
          value: Math.floor(Math.random() * 5) + 2,
        });
      });

      // Monthly data - last 4 weeks
      const monthData: TrendData[] = [];
      const currentMonthTotal = Math.floor(Math.random() * 100) + 250;
      const lastMonthTotal = Math.floor(Math.random() * 100) + 250;
      const monthPercentChange = this.calculatePercentChange(currentMonthTotal, lastMonthTotal);

      for (let i = 1; i <= 4; i++) {
        monthData.push({
          name: `Week ${i}`,
          value: Math.floor(Math.random() * 30) + 70,
        });
      }

      // Add current week
      monthData.push({
        name: 'Current',
        value: Math.floor(Math.random() * 30) + 70,
      });

      // Yearly data - last 6 months
      const yearData: TrendData[] = [];
      const monthNames = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
      const currentYearTotal = Math.floor(Math.random() * 500) + 4000;
      const lastYearTotal = Math.floor(Math.random() * 500) + 4000;
      const yearPercentChange = this.calculatePercentChange(currentYearTotal, lastYearTotal);

      monthNames.forEach((month) => {
        yearData.push({
          name: month,
          value: Math.floor(Math.random() * 200) + 650,
        });
      });

      // Update delivery metrics
      this.deliveryMetrics = {
        week: {
          current: currentWeekTotal,
          change: weekPercentChange,
          increased: weekPercentChange > 0,
          data: weekData,
        },
        month: {
          current: currentMonthTotal,
          change: monthPercentChange,
          increased: monthPercentChange > 0,
          data: monthData,
        },
        year: {
          current: currentYearTotal,
          change: yearPercentChange,
          increased: yearPercentChange > 0,
          data: yearData,
        },
      };

      resolve(true);
    });
  }

  private updateMetrics(): void {
    const activeJobs = this.jobs.filter((job) => job.status === 'allocated' || job.status === 'collected');
    const unallocatedJobs = this.jobs.filter((job) => job.status === 'loaded');

    // Update metrics with current counts
    const newMetrics = {
      activeJobs: activeJobs.length,
      unallocatedJobs: unallocatedJobs.length,
      activeJobsTrend: {
        percentChange: this.calculatePercentChange(activeJobs.length, this.metrics.activeJobs),
        increased: activeJobs.length > this.metrics.activeJobs,
      },
      unallocatedJobsTrend: {
        percentChange: this.calculatePercentChange(unallocatedJobs.length, this.metrics.unallocatedJobs),
        increased: unallocatedJobs.length > this.metrics.unallocatedJobs,
      },
    };

    this.metrics = newMetrics;
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private isDriverOnLeave(driver: UserProfile): boolean {
    // In a real app, you'd check against a leave management system
    // For this demo, we'll randomly mark some drivers as on leave
    return Math.random() < 0.1; // 10% chance a driver is on leave
  }

  private getLastActivity(jobs: Job[]): Date | undefined {
    if (jobs.length === 0) return undefined;

    // Find the most recent timestamp from the jobs
    return jobs.reduce((latest, job) => {
      const jobUpdated = job.updatedAt;
      return !latest || jobUpdated > latest ? jobUpdated : latest;
    }, undefined as Date | undefined);
  }

  // Filter drivers based on selected status
  filterDrivers(): void {
    if (this.selectedDriverStatus === 'All') {
      this.filteredDrivers = [...this.allDrivers];
    } else {
      this.filteredDrivers = this.allDrivers.filter((driver) => driver.status === this.selectedDriverStatus);
    }
  }

  // Change driver status filter
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

  // View driver details
  viewDriverDetails(driver: EnhancedDriverInfo): void {
    this.router.navigate(['/drivers', driver.profile.id]);
  }

  // Utility Methods
  getMetricClass(metricType: string): string {
    if (metricType === 'unallocated' && this.metrics.unallocatedJobs > 5) {
      return 'metric-red';
    }
    return '';
  }

  getTrendClass(increased: boolean): string {
    return increased ? 'trend-positive' : 'trend-negative';
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      loaded: 'status-loaded',
      allocated: 'status-allocated',
      collected: 'status-collected',
      delivered: 'status-delivered',
      aborted: 'status-aborted',
      cancelled: 'status-cancelled',
    };
    return statusMap[status] || 'status-default';
  }

  getChartData(data: TrendData[]): any[] {
    return [
      {
        name: 'Trend',
        series: data.map((item) => ({
          name: item.name,
          value: item.value,
        })),
      },
    ];
  }

  // Get job count class based on number of jobs
  getJobCountClass(count: number): string {
    if (count > 2) return 'high';
    if (count > 0) return 'medium';
    return 'low';
  }

  // Navigation Methods
  viewJobDetails(job: Job): void {
    this.router.navigate(['/jobs', job.id]);
  }

  editJob(job: Job): void {
    this.router.navigate(['/jobs', job.id, 'edit']);
  }

  createNewJob(): void {
    this.router.navigate(['/jobs/new']);
  }

  // Assign job to driver dialog
  assignJob(job: Job): void {
    // Implementation would open driver selection dialog
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Assign Job',
        message: `Are you sure you want to allocate job ${job.id}?`,
        confirmText: 'Assign',
        cancelText: 'Cancel',
        icon: 'assignment_ind',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Navigate to job assignment page
        this.router.navigate(['/jobs', job.id, 'assign']);
      }
    });
  }
}
