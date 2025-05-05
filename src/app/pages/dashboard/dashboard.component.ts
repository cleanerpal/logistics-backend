import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import * as shape from 'd3-shape';
import { JobStatus } from '../../shared/models/job-status.enum';

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

interface Job {
  id: string;
  customerName: string;
  regNumber: string;
  status: string;
  driver: string;
  collectionDate: Date;
  collectionTown: string;
  deliveryTown: string;
  timestamp: Date;
}

interface Driver {
  name: string;
  available: boolean;
  lastActive: Date;
  totalDeliveries?: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: false,
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns: string[] = [
    'id',
    'regNumber',
    'customerName',
    'collectionDate',
    'collectionTown',
    'deliveryTown',
    'status',
    'driver',
    'actions',
  ];

  jobsDataSource: MatTableDataSource<Job>;
  isLoading = false;
  curve = shape.curveLinear;
  jobs: Job[] = [];

  // Color scheme for charts
  colorScheme = 'cool';

  // Dashboard metrics
  metrics: DashboardMetrics = {
    activeJobs: 18,
    unallocatedJobs: 6,
    activeJobsTrend: {
      percentChange: -12,
      increased: false,
    },
    unallocatedJobsTrend: {
      percentChange: 20,
      increased: true,
    },
  };

  deliveryMetrics: DeliveryMetrics = {
    week: {
      current: 24,
      change: 8.5,
      increased: true,
      data: [
        { name: 'Mon', value: 20 },
        { name: 'Tue', value: 22 },
        { name: 'Wed', value: 19 },
        { name: 'Thu', value: 23 },
        { name: 'Fri', value: 21 },
        { name: 'Sat', value: 24 },
      ],
    },
    month: {
      current: 342,
      change: -4.2,
      increased: false,
      data: [
        { name: 'Week 1', value: 340 },
        { name: 'Week 2', value: 345 },
        { name: 'Week 3', value: 335 },
        { name: 'Week 4', value: 350 },
        { name: 'Week 5', value: 338 },
        { name: 'Current', value: 342 },
      ],
    },
    year: {
      current: 4256,
      change: 12.8,
      increased: true,
      data: [
        { name: 'Aug', value: 4100 },
        { name: 'Sep', value: 4150 },
        { name: 'Oct', value: 4200 },
        { name: 'Nov', value: 4180 },
        { name: 'Dec', value: 4220 },
        { name: 'Jan', value: 4256 },
      ],
    },
  };

  drivers: Driver[] = [
    { name: 'Mike Johnson', available: true, lastActive: new Date() },
    { name: 'Sarah Williams', available: true, lastActive: new Date() },
    { name: 'David Brown', available: false, lastActive: new Date() },
    { name: 'Emma Davis', available: true, lastActive: new Date() },
  ];

  constructor(private router: Router) {
    this.jobsDataSource = new MatTableDataSource<Job>();
  }

  ngOnInit(): void {
    this.loadJobs();
    this.setupDataRefresh();
  }

  ngAfterViewInit(): void {
    this.jobsDataSource.sort = this.sort;
    this.jobsDataSource.paginator = this.paginator;
    this.setupCustomSort();
  }

  private setupCustomSort(): void {
    this.jobsDataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'timestamp':
          return new Date(item.timestamp).getTime();
        case 'collectionDate':
          return new Date(item.collectionDate).getTime();
        default:
          return (item as any)[property];
      }
    };
  }

  private setupDataRefresh(): void {
    // Refresh data every 5 minutes
    setInterval(() => {
      this.loadJobs();
    }, 5 * 60 * 1000);
  }

  private loadJobs(): void {
    this.isLoading = true;

    // Simulate API call with mock data for today's jobs
    setTimeout(() => {
      const mockJobs: Job[] = Array(8)
        .fill(null)
        .map((_, index) => ({
          id: `JOB${String(index + 1).padStart(4, '0')}`,
          customerName: `Customer ${index + 1}`,
          regNumber: this.generateRandomRegNumber(),
          status: this.getRandomStatus(),
          driver: `Driver ${index + 1}`,
          collectionDate: new Date(Date.now() - Math.random() * 86400000),
          collectionTown: `Collection Town ${index + 1}`,
          deliveryTown: `Delivery Town ${index + 1}`,
          timestamp: new Date(Date.now() - Math.random() * 86400000),
        }));

      this.jobs = mockJobs;
      this.jobsDataSource.data = mockJobs;
      this.updateMetrics();
      this.isLoading = false;
    }, 1000);
  }

  private getRandomStatus(): string {
    const statuses = Object.values(JobStatus);
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private generateRandomRegNumber(): string {
    // Generate UK-style registration number (no spaces, all caps)
    const letters1 = 'ABCDEFGHJKLMNOPRSTUVWXYZ';
    const letters2 = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '0123456789';

    let reg = '';

    // Two letters for area
    reg += letters1[Math.floor(Math.random() * letters1.length)];
    reg += letters1[Math.floor(Math.random() * letters1.length)];

    // Two numbers for year
    reg += numbers[Math.floor(Math.random() * numbers.length)];
    reg += numbers[Math.floor(Math.random() * numbers.length)];

    // Three letters for random
    reg += letters2[Math.floor(Math.random() * letters2.length)];
    reg += letters2[Math.floor(Math.random() * letters2.length)];
    reg += letters2[Math.floor(Math.random() * letters2.length)];

    return reg;
  }

  private updateMetrics(): void {
    const activeJobs = this.jobs.filter(
      (job) =>
        job.status === JobStatus.ALLOCATED || job.status === JobStatus.COLLECTED
    );
    const unallocatedJobs = this.jobs.filter(
      (job) => job.status === JobStatus.LOADED
    );

    this.metrics = {
      activeJobs: activeJobs.length,
      unallocatedJobs: unallocatedJobs.length,
      activeJobsTrend: {
        percentChange: this.calculatePercentChange(
          activeJobs.length,
          this.metrics.activeJobs
        ),
        increased: activeJobs.length > this.metrics.activeJobs,
      },
      unallocatedJobsTrend: {
        percentChange: this.calculatePercentChange(
          unallocatedJobs.length,
          this.metrics.unallocatedJobs
        ),
        increased: unallocatedJobs.length > this.metrics.unallocatedJobs,
      },
    };
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
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
      [JobStatus.LOADED]: 'status-loaded',
      [JobStatus.ALLOCATED]: 'status-allocated',
      [JobStatus.COLLECTED]: 'status-collected',
      [JobStatus.DELIVERED]: 'status-delivered',
      [JobStatus.ABORTED]: 'status-aborted',
      [JobStatus.CANCELLED]: 'status-cancelled',
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
}
