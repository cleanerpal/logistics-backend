import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { Router, RouterModule } from '@angular/router';
import { Chart, ChartConfiguration } from 'chart.js';

// Firebase imports
import {
  collection,
  DocumentData,
  Firestore,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from '@angular/fire/firestore';

// Models
interface Job {
  id: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  status: 'Unallocated' | 'Allocated' | 'Collected' | 'Delivered';
  driverName: string;
  plannedDeliveryTime: Timestamp;
  actualDeliveryTime?: Timestamp;
  completedAt?: Timestamp;
  createdAt: Timestamp;
}

interface JobStatusCount {
  Unallocated: number;
  Allocated: number;
  Collected: number;
  Delivered: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    RouterModule,
  ],
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  // Inject services
  private firestore: Firestore = inject(Firestore);
  private snackBar: MatSnackBar = inject(MatSnackBar);
  private router: Router = inject(Router);

  // Chart references
  @ViewChild('jobStatusChart')
  jobStatusChartRef!: ElementRef<HTMLCanvasElement>;
  private jobStatusChart: Chart | undefined;

  // Table references
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Data properties
  loading = true;
  dataSource = new MatTableDataSource<Job>();
  displayedColumns: string[] = [
    'id',
    'vehicle',
    'status',
    'driver',
    'deliveryDate',
    'actions',
  ];

  jobStatusCounts: JobStatusCount = {
    Unallocated: 0,
    Allocated: 0,
    Collected: 0,
    Delivered: 0,
  };

  onTimePercentage = 0;
  completedJobsCount = 0;
  deliveryRatingClass = 'poor';

  constructor() {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnDestroy(): void {
    if (this.jobStatusChart) {
      this.jobStatusChart.destroy();
    }
  }

  /**
   * Load all dashboard data from Firestore
   */
  async loadDashboardData(): Promise<void> {
    this.loading = true;

    try {
      // Load recent jobs for the table
      await this.loadRecentJobs();

      // Load job status counts for the pie chart
      await this.loadJobStatusCounts();

      // Load delivery stats
      await this.loadDeliveryStats();

      // Initialize the job status chart
      this.initializeJobStatusChart();

      this.loading = false;
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.snackBar.open(
        'Error loading dashboard data. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
      this.loading = false;
    }
  }

  /**
   * Load recent jobs for the table
   */
  private async loadRecentJobs(): Promise<void> {
    try {
      const jobsRef = collection(this.firestore, 'Jobs');
      const q = query(jobsRef, orderBy('createdAt', 'desc'), limit(10));
      const querySnapshot = await getDocs(q);

      const jobs: Job[] = [];
      querySnapshot.forEach((doc) => {
        const jobData = doc.data() as DocumentData;
        jobs.push({
          id: doc.id,
          vehicleMake: jobData['vehicleMake'] || '',
          vehicleModel: jobData['vehicleModel'] || '',
          vehicleRegistration: jobData['vehicleRegistration'] || '',
          status: jobData['status'] || 'Unallocated',
          driverName: jobData['driverName'] || 'Unassigned',
          plannedDeliveryTime: jobData['plannedDeliveryTime'] as Timestamp,
          actualDeliveryTime: jobData['actualDeliveryTime'] as Timestamp,
          completedAt: jobData['completedAt'] as Timestamp,
          createdAt: jobData['createdAt'] as Timestamp,
        });
      });

      this.dataSource.data = jobs;
    } catch (error) {
      console.error('Error loading recent jobs:', error);
      this.snackBar.open(
        'Error loading recent jobs. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    }
  }

  /**
   * Load job status counts for the pie chart
   */
  private async loadJobStatusCounts(): Promise<void> {
    try {
      const jobsRef = collection(this.firestore, 'Jobs');
      const querySnapshot = await getDocs(jobsRef);

      // Reset counts
      this.jobStatusCounts = {
        Unallocated: 0,
        Allocated: 0,
        Collected: 0,
        Delivered: 0,
      };

      // Count jobs by status
      querySnapshot.forEach((doc) => {
        const status = doc.data()['status'] as keyof JobStatusCount;
        if (status && this.jobStatusCounts[status] !== undefined) {
          this.jobStatusCounts[status]++;
        }
      });
    } catch (error) {
      console.error('Error loading job status counts:', error);
      this.snackBar.open(
        'Error loading job statistics. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    }
  }

  /**
   * Load delivery statistics (on-time percentages, etc.)
   */
  private async loadDeliveryStats(): Promise<void> {
    try {
      // Get current month start and end dates
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      // Query for completed jobs in the current month
      const jobsRef = collection(this.firestore, 'Jobs');
      const q = query(
        jobsRef,
        where('completedAt', '>=', Timestamp.fromDate(startOfMonth)),
        where('completedAt', '<=', Timestamp.fromDate(endOfMonth)),
        where('status', '==', 'Delivered')
      );

      const querySnapshot = await getDocs(q);

      // Calculate on-time percentages
      let onTimeCount = 0;
      let totalCount = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        totalCount++;

        // Check if delivery was on time (within ±30 minutes of planned time)
        if (data['plannedDeliveryTime'] && data['actualDeliveryTime']) {
          const plannedTime = (data['plannedDeliveryTime'] as Timestamp)
            .toDate()
            .getTime();
          const actualTime = (data['actualDeliveryTime'] as Timestamp)
            .toDate()
            .getTime();
          const timeDifferenceMinutes =
            Math.abs(actualTime - plannedTime) / (1000 * 60);

          if (timeDifferenceMinutes <= 30) {
            onTimeCount++;
          }
        }
      });

      this.completedJobsCount = totalCount;
      this.onTimePercentage =
        totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) : 0;

      // Set rating class based on on-time percentage
      if (this.onTimePercentage >= 80) {
        this.deliveryRatingClass = 'excellent';
      } else if (this.onTimePercentage >= 60) {
        this.deliveryRatingClass = 'average';
      } else {
        this.deliveryRatingClass = 'poor';
      }
    } catch (error) {
      console.error('Error loading delivery stats:', error);
      this.snackBar.open(
        'Error loading delivery statistics. Please try again.',
        'Close',
        {
          duration: 5000,
          panelClass: ['error-snackbar'],
        }
      );
    }
  }

  /**
   * Initialize the job status pie chart
   */
  private initializeJobStatusChart(): void {
    if (!this.jobStatusChartRef) return;

    const ctx = this.jobStatusChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Calculate total for percentages
    const total = Object.values(this.jobStatusCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    // Prepare chart data
    const data = {
      labels: Object.keys(this.jobStatusCounts),
      datasets: [
        {
          data: Object.values(this.jobStatusCounts),
          backgroundColor: [
            '#C19A6B', // Primary - Unallocated
            '#4A3C31', // Secondary - Allocated
            '#333333', // Text - Collected
            '#5D4037', // Additional - Delivered
          ],
          borderWidth: 1,
          borderColor: '#F5F5F5',
        },
      ],
    };

    // Create chart configuration
    const config: ChartConfiguration = {
      type: 'pie',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 20,
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw as number;
                const percentage =
                  total > 0 ? Math.round((value / total) * 100) : 0;
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    };

    // Create the chart
    this.jobStatusChart = new Chart(ctx, config);
  }

  /**
   * Handles row click to navigate to job details
   */
  viewJobDetails(jobId: string): void {
    this.router.navigate(['/jobs/edit', jobId]);
  }

  /**
   * Get status color based on job status
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'Unallocated':
        return '#F44336'; // Red
      case 'Allocated':
        return '#FFC107'; // Yellow/Amber
      case 'Collected':
        return '#2196F3'; // Blue
      case 'Delivered':
        return '#4CAF50'; // Green
      default:
        return '#9E9E9E'; // Grey
    }
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: Timestamp | undefined): string {
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
}
