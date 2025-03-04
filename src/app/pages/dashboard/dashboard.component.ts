import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import * as shape from 'd3-shape';

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

interface MetricCard {
  title: string;
  value: number;
  type: 'unallocated' | 'deliveries' | 'active';
  percentChange: number;
  increased: boolean;
}

interface UnallocatedMetrics {
  collected: {
    value: number;
    percentChange: number;
    increased: boolean;
  };
  notCollected: {
    value: number;
    percentChange: number;
    increased: boolean;
  };
}

interface Job {
  id: string;
  customerName: string;
  vehicleDetails: string;
  status: 'unallocated' | 'in-progress' | 'completed';
  driver: string;
  timestamp: Date;
  collected: boolean;
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
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns: string[] = [
    'id',
    'customerName',
    'vehicleDetails',
    'status',
    'driver',
    'actions',
  ];

  jobsDataSource: MatTableDataSource<Job>;
  isLoading = false;
  curve = shape.curveLinear;
  jobs: Job[] = [];

  // Color scheme for charts
  colorScheme: string = 'cool';

  // New unallocated metrics structure
  unallocatedMetrics: UnallocatedMetrics = {
    collected: {
      value: 4,
      percentChange: 15,
      increased: true,
    },
    notCollected: {
      value: 2,
      percentChange: 5,
      increased: false,
    },
  };

  // Metrics array
  metrics: MetricCard[] = [
    {
      title: 'Active Jobs',
      value: 18,
      type: 'active',
      percentChange: -12,
      increased: false,
    },
    {
      title: 'Unallocated Jobs',
      value: 6, // Total of collected and not collected
      type: 'unallocated',
      percentChange: 20,
      increased: true,
    },
  ];

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

  // Chart data
  deliveryStatusData = [
    { name: 'On Time', value: 65 },
    { name: 'Delayed', value: 20 },
    { name: 'Early', value: 15 },
  ];

  vehicleData = [
    { name: 'Vans', value: 40 },
    { name: 'Trucks', value: 30 },
    { name: 'Cars', value: 20 },
    { name: 'Bikes', value: 10 },
  ];

  peakHourData = [
    {
      name: 'Deliveries',
      series: [
        { name: '6AM', value: 10 },
        { name: '8AM', value: 25 },
        { name: '10AM', value: 35 },
        { name: '12PM', value: 40 },
        { name: '2PM', value: 30 },
        { name: '4PM', value: 20 },
        { name: '6PM', value: 15 },
      ],
    },
  ];

  driverPerformanceData = [
    { name: 'Mike Johnson', value: 45 },
    { name: 'Sarah Williams', value: 38 },
    { name: 'David Brown', value: 42 },
    { name: 'Emma Davis', value: 35 },
    { name: 'James Wilson', value: 40 },
  ];

  customerSatisfactionData = [
    { name: '5 Stars', value: 150 },
    { name: '4 Stars', value: 100 },
    { name: '3 Stars', value: 30 },
    { name: '2 Stars', value: 15 },
    { name: '1 Star', value: 5 },
  ];

  drivers: Driver[] = [
    { name: 'Mike Johnson', available: true, lastActive: new Date() },
    { name: 'Sarah Williams', available: true, lastActive: new Date() },
    { name: 'David Brown', available: false, lastActive: new Date() },
    { name: 'Emma Davis', available: true, lastActive: new Date() },
  ];

  hourlyJobsData = [
    { hour: '9AM', completed: 3 },
    { hour: '10AM', completed: 5 },
    { hour: '11AM', completed: 4 },
    { hour: '12PM', completed: 6 },
    { hour: '1PM', completed: 3 },
    { hour: '2PM', completed: 4 },
    { hour: '3PM', completed: 5 },
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

    // Simulate API call with mock data
    setTimeout(() => {
      const mockJobs: Job[] = Array(8)
        .fill(null)
        .map((_, index) => ({
          id: `JOB${String(index + 1).padStart(4, '0')}`,
          customerName: `Customer ${index + 1}`,
          vehicleDetails: `Vehicle ${String.fromCharCode(65 + (index % 4))}`,
          status: this.getRandomStatus(),
          driver: `Driver ${index + 1}`,
          timestamp: new Date(Date.now() - Math.random() * 86400000),
          collected: Math.random() > 0.5,
        }));

      this.jobs = mockJobs;
      this.jobsDataSource.data = mockJobs;
      this.updateUnallocatedMetrics();
      this.isLoading = false;
    }, 1000);
  }

  private getRandomStatus(): 'unallocated' | 'in-progress' | 'completed' {
    const statuses: ('unallocated' | 'in-progress' | 'completed')[] = [
      'unallocated',
      'in-progress',
      'completed',
    ];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private updateUnallocatedMetrics(): void {
    const unallocatedJobs = this.jobs.filter(
      (job) => job.status === 'unallocated'
    );
    const collected = unallocatedJobs.filter((job) => job.collected);
    const notCollected = unallocatedJobs.filter((job) => !job.collected);

    this.unallocatedMetrics = {
      collected: {
        value: collected.length,
        percentChange: this.calculatePercentChange(collected.length, 4), // Previous value hardcoded for demo
        increased: collected.length > 4,
      },
      notCollected: {
        value: notCollected.length,
        percentChange: this.calculatePercentChange(notCollected.length, 2), // Previous value hardcoded for demo
        increased: notCollected.length > 2,
      },
    };

    // Update total in metrics array
    this.metrics[0].value = unallocatedJobs.length;
  }

  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  // Utility Methods
  getMetricClass(metric: MetricCard): string {
    if (metric.type === 'unallocated' && metric.value > 5) {
      return `metric-${metric.type} metric-red`;
    }
    return `metric-${metric.type}`;
  }

  getTrendClass(increased: boolean): string {
    return increased ? 'trend-positive' : 'trend-negative';
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
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
