import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import * as shape from 'd3-shape';
import { JobService } from '../../services/job.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationDialogComponent } from '../../dialogs/confirmation-dialog.component';
import { DriverSelectionDialogComponent } from '../../dialogs/driver-selection-dialog.component';
import { Subject, Subscription, combineLatest, forkJoin, interval, of, BehaviorSubject } from 'rxjs';
import { catchError, map, switchMap, takeUntil, filter, take, finalize } from 'rxjs/operators';
import { UserProfile } from '../../interfaces/user-profile.interface';
import { Job } from '../../interfaces/job.interface';

// Define interfaces for dashboard data
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

  jobsDataSource = new MatTableDataSource<Job>([]);
  isLoading = true;
  isLoadingDrivers = true;
  curve = shape.curveLinear;
  jobs: Job[] = [];

  // Previous job counts for trend calculation
  private previousJobCounts = {
    active: 0,
    unallocated: 0,
  };

  // Refresh rate in milliseconds (5 minutes)
  private readonly REFRESH_INTERVAL = 5 * 60 * 1000;

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

  // Track metric changes over time
  private metricHistory = {
    activeJobs: [] as number[],
    unallocatedJobs: [] as number[],
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

  // Data loading states
  private jobsLoaded$ = new BehaviorSubject<boolean>(false);
  private driversLoaded$ = new BehaviorSubject<boolean>(false);
  private metricsLoaded$ = new BehaviorSubject<boolean>(false);

  constructor(
    private router: Router,
    private jobService: JobService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {
    this.jobsDataSource = new MatTableDataSource<Job>([]);
  }

  ngOnInit(): void {
    this.setupDataSubscriptions();
    this.initDashboardData();
    this.setupRefreshInterval();
  }

  ngAfterViewInit(): void {
    if (this.sort && this.paginator) {
      this.jobsDataSource.sort = this.sort;
      this.jobsDataSource.paginator = this.paginator;
      this.setupCustomSort();
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private setupDataSubscriptions(): void {
    // Monitor loading states
    const dataLoadingSubscription = combineLatest([this.jobsLoaded$, this.driversLoaded$, this.metricsLoaded$]).subscribe(
      ([jobsLoaded, driversLoaded, metricsLoaded]) => {
        this.isLoading = !(jobsLoaded && metricsLoaded);
        this.isLoadingDrivers = !driversLoaded;
      }
    );

    this.subscriptions.push(dataLoadingSubscription);
  }

  private setupCustomSort(): void {
    this.jobsDataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'timestamp':
          return item['timestamp'] ? new Date(item['timestamp']).getTime() : 0;
        case 'collectionDate':
          return item['collectionDate'] ? new Date(item['collectionDate']).getTime() : 0;
        default:
          const value = item[property as keyof Job];
          return typeof value === 'string' ? value.toLowerCase() : value;
      }
    };
  }

  private setupRefreshInterval(): void {
    // Refresh data every 5 minutes
    const refreshSub = interval(this.REFRESH_INTERVAL)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.refreshDashboardData();
      });

    this.subscriptions.push(refreshSub);
  }

  private initDashboardData(): void {
    // Store current metrics as previous for trends
    this.storePreviousMetrics();

    // Load all data in parallel
    this.loadJobs();
    this.loadDriversWithJobs();
    this.loadDeliveryMetrics();
  }

  private refreshDashboardData(): void {
    // Store current metrics for trend calculation
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

    // Reload all data
    this.loadJobs();
    this.loadDriversWithJobs();
    this.loadDeliveryMetrics();
  }

  private storePreviousMetrics(): void {
    this.previousJobCounts = {
      active: this.metrics.activeJobs,
      unallocated: this.metrics.unallocatedJobs,
    };

    // Add current metrics to history for charts
    if (this.metrics.activeJobs > 0) {
      this.metricHistory.activeJobs.push(this.metrics.activeJobs);
      this.metricHistory.unallocatedJobs.push(this.metrics.unallocatedJobs);

      // Keep only the last 14 data points for trends
      if (this.metricHistory.activeJobs.length > 14) {
        this.metricHistory.activeJobs.shift();
        this.metricHistory.unallocatedJobs.shift();
      }
    }
  }

  private loadJobs(): void {
    // Get today's date at midnight for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const jobsSub = this.jobService
      .getRecentJobs(25)
      .pipe(
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
        finalize(() => this.jobsLoaded$.next(true))
      )
      .subscribe((jobs) => {
        this.jobs = jobs.filter((job) => {
          // Filter to show only today's jobs and recent active jobs
          const jobDate = job.createdAt;
          const jobStatus = job.status;

          // Include jobs created today or with active status
          return jobDate >= today || ['allocated', 'collected', 'unallocated'].includes(jobStatus);
        });

        this.jobsDataSource.data = this.jobs;
        this.updateMetrics();
      });

    this.subscriptions.push(jobsSub);
  }

  private loadDriversWithJobs(): void {
    const driversSub = this.authService
      .getUsersByRole('driver')
      .pipe(
        takeUntil(this.destroy$),
        switchMap((drivers) => {
          if (drivers.length === 0) {
            this.driversLoaded$.next(true);
            return of([]);
          }

          // Get all allocated jobs to determine driver status
          return this.jobService.getJobsByStatus('allocated').pipe(
            map((allocatedJobs) => {
              // Map jobs to drivers and determine their status
              return drivers.map((driver) => {
                const driverJobs = allocatedJobs.filter((job) => job.driverId === driver.id);

                // Determine driver status based on assigned jobs and availability
                let status: DriverStatus = this.determineDriverStatus(driver, driverJobs);

                return {
                  profile: driver,
                  status: status,
                  currentJobs: driverJobs.length,
                  lastActivity: this.getLastDriverActivity(driverJobs),
                  activeJobs: driverJobs,
                  isAvailable: status === DriverStatus.AVAILABLE,
                } as EnhancedDriverInfo;
              });
            }),
            catchError((error) => {
              console.error('Error fetching allocated jobs:', error);
              // Return drivers with default status
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
            }),
            finalize(() => this.driversLoaded$.next(true))
          );
        }),
        catchError((error) => {
          console.error('Error fetching drivers:', error);
          this.driversLoaded$.next(true);
          return of([]);
        })
      )
      .subscribe((enhancedDrivers) => {
        this.allDrivers = enhancedDrivers;
        this.filterDrivers();
      });

    this.subscriptions.push(driversSub);
  }

  private determineDriverStatus(driver: UserProfile, driverJobs: Job[]): DriverStatus {
    // Driver must be active to be available
    if (!driver.isActive) return DriverStatus.OFFLINE;

    // Check if driver has more than 2 jobs (considered busy)
    if (driverJobs.length > 2) return DriverStatus.BUSY;

    // Check if driver is on leave based on profile data or other criteria
    if (this.isDriverOnLeave(driver)) return DriverStatus.ON_LEAVE;

    // Default to available
    return DriverStatus.AVAILABLE;
  }

  private isDriverOnLeave(driver: UserProfile): boolean {
    // Check if the driver is on leave based on availability or status fields
    return (
      driver.availability === 'on_leave' ||
      driver.status === 'on_leave' ||
      (typeof driver.availability === 'string' && driver.availability.toLowerCase().includes('leave'))
    );
  }

  private getLastDriverActivity(jobs: Job[]): Date | undefined {
    if (jobs.length === 0) return undefined;

    // Find the most recent timestamp from the jobs
    return jobs.reduce((latest, job) => {
      const jobUpdated = job.updatedAt;
      return !latest || (jobUpdated && jobUpdated > latest) ? jobUpdated : latest;
    }, undefined as Date | undefined);
  }

  private loadDeliveryMetrics(): void {
    // Real implementation fetching actual metrics from Firebase
    const deliveriesSub = this.jobService
      .getJobsByStatus('delivered')
      .pipe(
        takeUntil(this.destroy$),
        switchMap((deliveredJobs) => {
          // Get completed jobs as well
          return this.jobService.getJobsByStatus('completed').pipe(map((completedJobs) => [...deliveredJobs, ...completedJobs]));
        }),
        catchError((error) => {
          console.error('Error fetching delivery data:', error);
          return of([]);
        }),
        finalize(() => this.metricsLoaded$.next(true))
      )
      .subscribe((deliveryJobs) => {
        if (deliveryJobs.length === 0) {
          // No delivery data, use empty metrics
          this.initializeEmptyDeliveryMetrics();
          return;
        }

        this.calculateDeliveryMetrics(deliveryJobs);
      });

    this.subscriptions.push(deliveriesSub);
  }

  private calculateDeliveryMetrics(deliveryJobs: Job[]): void {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const monthStart = new Date(now);
    monthStart.setMonth(now.getMonth() - 1);

    const yearStart = new Date(now);
    yearStart.setFullYear(now.getFullYear() - 1);

    // Get previous week data for comparison
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    // Get previous month data for comparison
    const previousMonthStart = new Date(monthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

    // Current week data
    const currentWeekJobs = deliveryJobs.filter((job) => job.deliveryCompleteTime && job.deliveryCompleteTime >= weekStart);

    // Previous week data
    const previousWeekJobs = deliveryJobs.filter(
      (job) => job.deliveryCompleteTime && job.deliveryCompleteTime >= previousWeekStart && job.deliveryCompleteTime < weekStart
    );

    // Current month data
    const currentMonthJobs = deliveryJobs.filter((job) => job.deliveryCompleteTime && job.deliveryCompleteTime >= monthStart);

    // Previous month data
    const previousMonthJobs = deliveryJobs.filter(
      (job) => job.deliveryCompleteTime && job.deliveryCompleteTime >= previousMonthStart && job.deliveryCompleteTime < monthStart
    );

    // Current year data
    const currentYearJobs = deliveryJobs.filter((job) => job.deliveryCompleteTime && job.deliveryCompleteTime >= yearStart);

    // Calculate week metrics
    const weeklyData = this.calculateWeeklyDeliveryData(currentWeekJobs);
    const weekPercentChange = this.calculatePercentChange(currentWeekJobs.length, previousWeekJobs.length);

    // Calculate month metrics
    const monthlyData = this.calculateMonthlyDeliveryData(currentMonthJobs);
    const monthPercentChange = this.calculatePercentChange(currentMonthJobs.length, previousMonthJobs.length);

    // Calculate year metrics
    const yearlyData = this.calculateYearlyDeliveryData(currentYearJobs);
    const yearPercentChange = this.calculatePercentChange(
      currentYearJobs.length,
      0 // Assuming no baseline for yearly comparison yet
    );

    // Update delivery metrics
    this.deliveryMetrics = {
      week: {
        current: currentWeekJobs.length,
        change: weekPercentChange,
        increased: weekPercentChange > 0,
        data: weeklyData,
      },
      month: {
        current: currentMonthJobs.length,
        change: monthPercentChange,
        increased: monthPercentChange > 0,
        data: monthlyData,
      },
      year: {
        current: currentYearJobs.length,
        change: yearPercentChange,
        increased: yearPercentChange > 0,
        data: yearlyData,
      },
    };
  }

  private calculateWeeklyDeliveryData(jobs: Job[]): TrendData[] {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData: TrendData[] = [];

    // Initialize days with 0 counts
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const dayOfWeek = dayNames[day.getDay()];
      weekData.push({
        name: dayOfWeek,
        value: 0,
      });
    }

    // Count jobs per day
    jobs.forEach((job) => {
      if (job.deliveryCompleteTime) {
        const jobDate = job.deliveryCompleteTime;
        const dayIndex = weekData.findIndex((d) => d.name === dayNames[jobDate.getDay()]);
        if (dayIndex !== -1) {
          weekData[dayIndex].value++;
        }
      }
    });

    return weekData;
  }

  private calculateMonthlyDeliveryData(jobs: Job[]): TrendData[] {
    const now = new Date();
    const monthData: TrendData[] = [];

    // Create 4 weeks of data + current
    for (let i = 4; i >= 0; i--) {
      monthData.push({
        name: i === 0 ? 'Current' : `Week ${5 - i}`,
        value: 0,
      });
    }

    // Count jobs per week
    jobs.forEach((job) => {
      if (job.deliveryCompleteTime) {
        const jobDate = job.deliveryCompleteTime;
        const daysDiff = Math.floor((now.getTime() - jobDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff < 7) {
          // Current week
          monthData[0].value++;
        } else if (daysDiff < 14) {
          // Week 2
          monthData[1].value++;
        } else if (daysDiff < 21) {
          // Week 3
          monthData[2].value++;
        } else if (daysDiff < 28) {
          // Week 4
          monthData[3].value++;
        } else if (daysDiff < 35) {
          // Week 5
          monthData[4].value++;
        }
      }
    });

    return monthData;
  }

  private calculateYearlyDeliveryData(jobs: Job[]): TrendData[] {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const yearData: TrendData[] = [];

    // Create data for the last 6 months
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(today);
      month.setMonth(today.getMonth() - i);

      yearData.push({
        name: monthNames[month.getMonth()],
        value: 0,
      });
    }

    // Count jobs per month
    jobs.forEach((job) => {
      if (job.deliveryCompleteTime) {
        const jobDate = job.deliveryCompleteTime;
        const currentMonth = today.getMonth();
        const jobMonth = jobDate.getMonth();

        let monthDiff = (today.getFullYear() - jobDate.getFullYear()) * 12 + (currentMonth - jobMonth);

        if (monthDiff >= 0 && monthDiff < 6) {
          yearData[5 - monthDiff].value++;
        }
      }
    });

    return yearData;
  }

  private initializeEmptyDeliveryMetrics(): void {
    // Weekly data
    const weeklyData: TrendData[] = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach((day) => {
      weeklyData.push({ name: day, value: 0 });
    });

    // Monthly data
    const monthlyData: TrendData[] = [];
    for (let i = 1; i <= 4; i++) {
      monthlyData.push({ name: `Week ${i}`, value: 0 });
    }
    monthlyData.push({ name: 'Current', value: 0 });

    // Yearly data
    const yearlyData: TrendData[] = [];
    const monthNames = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    monthNames.forEach((month) => {
      yearlyData.push({ name: month, value: 0 });
    });

    this.deliveryMetrics = {
      week: {
        current: 0,
        change: 0,
        increased: false,
        data: weeklyData,
      },
      month: {
        current: 0,
        change: 0,
        increased: false,
        data: monthlyData,
      },
      year: {
        current: 0,
        change: 0,
        increased: false,
        data: yearlyData,
      },
    };
  }

  private updateMetrics(): void {
    // Calculate active and unallocated jobs
    const activeJobs = this.jobs.filter((job) => job.status === 'allocated' || job.status === 'collected');

    const unallocatedJobs = this.jobs.filter((job) => job.status === 'loaded' || job.status === 'unallocated');

    // Calculate trend info based on previous metrics
    const activeJobsTrend: TrendInfo = {
      percentChange: this.calculatePercentChange(activeJobs.length, this.previousJobCounts.active),
      increased: activeJobs.length > this.previousJobCounts.active,
    };

    const unallocatedJobsTrend: TrendInfo = {
      percentChange: this.calculatePercentChange(unallocatedJobs.length, this.previousJobCounts.unallocated),
      increased: unallocatedJobs.length > this.previousJobCounts.unallocated,
    };

    // Update metrics
    this.metrics = {
      activeJobs: activeJobs.length,
      unallocatedJobs: unallocatedJobs.length,
      activeJobsTrend,
      unallocatedJobsTrend,
    };
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
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
      unallocated: 'status-loaded',
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

  // Navigation Methods
  viewJobDetails(job: Job): void {
    this.router.navigate(['/jobs', job.id]);
  }

  editJob(job: Job, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/jobs', job.id, 'edit']);
  }

  createNewJob(): void {
    this.router.navigate(['/jobs/new']);
  }

  // View driver details
  viewDriverDetails(driver: EnhancedDriverInfo): void {
    this.router.navigate(['/drivers', driver.profile.id]);
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
        jobTitle: `${job.make || ''} ${job.model || ''} ${job.registration ? '(' + job.registration + ')' : ''}`,
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
}
