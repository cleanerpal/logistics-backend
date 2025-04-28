import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { Chart, registerables } from 'chart.js';
import { RouterModule } from '@angular/router';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Firebase imports
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  collectionData,
} from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

// Register Chart.js components
Chart.register(...registerables);

// Report data interfaces
interface DriverPerformance {
  id: string;
  name: string;
  jobsCompleted: number;
  onTimeRate: number;
}

interface VehicleUtilization {
  id: string;
  registration: string;
  makeModel: string;
  jobsCompleted: number;
  mileage: string;
}

interface RevenueByCustomer {
  id: string;
  name: string;
  amountInvoiced: number;
}

interface JobStatusSummary {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

interface DriverHandover {
  jobId: string;
  vehicleId: string;
  fromDriver: string;
  toDriver: string;
  timestamp: Timestamp;
  location: string;
  odometer: number;
  notes: string;
}

interface DriverHours {
  id: string;
  name: string;
  totalHours: number;
  period: string;
  status: 'Within Limits' | 'Approaching Limit' | 'Exceeded Limit';
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    RouterModule,
  ],
})
export class ReportsComponent implements OnInit, AfterViewInit, OnDestroy {
  // FormControls
  reportForm = new FormGroup({
    reportType: new FormControl('driver-performance'),
    dateRange: new FormGroup({
      start: new FormControl<Date | null>(null),
      end: new FormControl<Date | null>(null),
    }),
    period: new FormControl('month'),
  });

  // Report types
  reportTypes = [
    { value: 'driver-performance', label: 'Driver Performance' },
    { value: 'vehicle-utilization', label: 'Vehicle Utilization' },
    { value: 'revenue-by-customer', label: 'Revenue by Customer' },
    { value: 'job-status-summary', label: 'Job Status Summary' },
    { value: 'driver-handover', label: 'Driver Handover Report' },
    { value: 'driver-hours', label: 'Driver Hours Report' },
  ];

  // Date periods
  periods = [
    { value: 'day', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'custom', label: 'Custom Range' },
  ];

  // Table data sources
  driverPerformanceDataSource = new MatTableDataSource<DriverPerformance>([]);
  vehicleUtilizationDataSource = new MatTableDataSource<VehicleUtilization>([]);
  revenueByCustomerDataSource = new MatTableDataSource<RevenueByCustomer>([]);
  jobStatusSummaryDataSource = new MatTableDataSource<JobStatusSummary>([]);
  driverHandoverDataSource = new MatTableDataSource<DriverHandover>([]);
  driverHoursDataSource = new MatTableDataSource<DriverHours>([]);

  // Column definitions
  driverPerformanceColumns: string[] = ['name', 'jobsCompleted', 'onTimeRate'];
  vehicleUtilizationColumns: string[] = [
    'registration',
    'makeModel',
    'jobsCompleted',
    'mileage',
  ];
  revenueByCustomerColumns: string[] = ['name', 'amountInvoiced'];
  jobStatusSummaryColumns: string[] = ['status', 'count', 'percentage'];
  driverHandoverColumns: string[] = [
    'jobId',
    'vehicleId',
    'fromDriver',
    'toDriver',
    'timestamp',
    'location',
    'odometer',
    'notes',
  ];
  driverHoursColumns: string[] = ['name', 'totalHours', 'period', 'status'];

  // UI state
  loading = false;
  reportTitle = 'Driver Performance Report';
  chartInstance: Chart | null = null;

  // Subscriptions
  private subscriptions: Subscription[] = [];

  // ViewChild references
  @ViewChild('driverPerformancePaginator')
  driverPerformancePaginator!: MatPaginator;
  @ViewChild('vehicleUtilizationPaginator')
  vehicleUtilizationPaginator!: MatPaginator;
  @ViewChild('revenueByCustomerPaginator')
  revenueByCustomerPaginator!: MatPaginator;
  @ViewChild('jobStatusSummaryPaginator')
  jobStatusSummaryPaginator!: MatPaginator;
  @ViewChild('driverHandoverPaginator') driverHandoverPaginator!: MatPaginator;
  @ViewChild('driverHoursPaginator') driverHoursPaginator!: MatPaginator;

  @ViewChild('driverPerformanceSort') driverPerformanceSort!: MatSort;
  @ViewChild('vehicleUtilizationSort') vehicleUtilizationSort!: MatSort;
  @ViewChild('revenueByCustomerSort') revenueByCustomerSort!: MatSort;
  @ViewChild('jobStatusSummarySort') jobStatusSummarySort!: MatSort;
  @ViewChild('driverHandoverSort') driverHandoverSort!: MatSort;
  @ViewChild('driverHoursSort') driverHoursSort!: MatSort;

  constructor(private firestore: Firestore, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    // Initialize date range based on current period (default: month)
    this.setDateRangeFromPeriod('month');

    // Subscribe to form changes
    this.subscribeToFormChanges();

    // Load initial report
    this.generateReport();
  }

  ngAfterViewInit(): void {
    // Connect paginators and sorters to tables
    setTimeout(() => {
      this.setTablePaginatorsAndSorts();
    });
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());

    // Destroy chart if exists
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }

  private subscribeToFormChanges(): void {
    // Period change handling
    this.reportForm.get('period')?.valueChanges.subscribe((period) => {
      if (period && period !== 'custom') {
        this.setDateRangeFromPeriod(period);
      }
    });

    // Report type change handling
    this.reportForm.get('reportType')?.valueChanges.subscribe((reportType) => {
      if (reportType) {
        this.updateReportTitle(reportType);
        this.generateReport();
      }
    });

    // Date range change handling for custom period
    this.reportForm.get('dateRange')?.valueChanges.subscribe((dateRange) => {
      if (dateRange?.start && dateRange?.end) {
        // Only regenerate if both dates are set
        this.generateReport();
      }
    });
  }

  private setDateRangeFromPeriod(period: string): void {
    const today = new Date();
    let startDate: Date;
    let endDate = new Date();

    switch (period) {
      case 'day':
        startDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );
        break;
      case 'week':
        // Get the first day of the current week (Sunday)
        const dayOfWeek = today.getDay();
        startDate = new Date(today);
        startDate.setDate(today.getDate() - dayOfWeek);
        break;
      case 'month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      default:
        return; // Don't update for custom
    }

    // Update form values without triggering change detection
    this.reportForm
      .get('dateRange.start')
      ?.setValue(startDate, { emitEvent: false });
    this.reportForm
      .get('dateRange.end')
      ?.setValue(endDate, { emitEvent: false });
  }

  private updateReportTitle(reportType: string): void {
    const reportTypeMapped = this.reportTypes.find(
      (type) => type.value === reportType
    );
    if (reportTypeMapped) {
      this.reportTitle = `${reportTypeMapped.label} Report`;
    }
  }

  private setTablePaginatorsAndSorts(): void {
    // Connect paginators and sorters to data sources
    this.driverPerformanceDataSource.paginator =
      this.driverPerformancePaginator;
    this.driverPerformanceDataSource.sort = this.driverPerformanceSort;

    this.vehicleUtilizationDataSource.paginator =
      this.vehicleUtilizationPaginator;
    this.vehicleUtilizationDataSource.sort = this.vehicleUtilizationSort;

    this.revenueByCustomerDataSource.paginator =
      this.revenueByCustomerPaginator;
    this.revenueByCustomerDataSource.sort = this.revenueByCustomerSort;

    this.jobStatusSummaryDataSource.paginator = this.jobStatusSummaryPaginator;
    this.jobStatusSummaryDataSource.sort = this.jobStatusSummarySort;

    this.driverHandoverDataSource.paginator = this.driverHandoverPaginator;
    this.driverHandoverDataSource.sort = this.driverHandoverSort;

    this.driverHoursDataSource.paginator = this.driverHoursPaginator;
    this.driverHoursDataSource.sort = this.driverHoursSort;
  }

  generateReport(): void {
    this.loading = true;

    const reportType = this.reportForm.get('reportType')?.value;
    const startDate = this.reportForm.get('dateRange.start')?.value;
    const endDate = this.reportForm.get('dateRange.end')?.value;

    if (!reportType || !startDate || !endDate) {
      this.loading = false;
      return;
    }

    // Destroy previous chart if exists
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    // Generate the appropriate report
    switch (reportType) {
      case 'driver-performance':
        this.generateDriverPerformanceReport(startDate, endDate);
        break;
      case 'vehicle-utilization':
        this.generateVehicleUtilizationReport(startDate, endDate);
        break;
      case 'revenue-by-customer':
        this.generateRevenueByCustomerReport(startDate, endDate);
        break;
      case 'job-status-summary':
        this.generateJobStatusSummaryReport(startDate, endDate);
        break;
      case 'driver-handover':
        this.generateDriverHandoverReport(startDate, endDate);
        break;
      case 'driver-hours':
        this.generateDriverHoursReport(startDate, endDate);
        break;
    }
  }

  private async generateDriverPerformanceReport(
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // In a real app, this would use Firestore queries to aggregate data
      // For now, we'll use mock data
      const driverPerformanceData: DriverPerformance[] = [
        { id: '1', name: 'John Smith', jobsCompleted: 42, onTimeRate: 92 },
        { id: '2', name: 'Sarah Johnson', jobsCompleted: 38, onTimeRate: 97 },
        { id: '3', name: 'Mike Williams', jobsCompleted: 35, onTimeRate: 89 },
        { id: '4', name: 'Emma Brown', jobsCompleted: 31, onTimeRate: 94 },
        { id: '5', name: 'David Lee', jobsCompleted: 28, onTimeRate: 86 },
        { id: '6', name: 'Lisa Chen', jobsCompleted: 27, onTimeRate: 93 },
        { id: '7', name: 'James Wilson', jobsCompleted: 24, onTimeRate: 91 },
        { id: '8', name: 'Karen Miller', jobsCompleted: 23, onTimeRate: 87 },
        { id: '9', name: 'Robert Jones', jobsCompleted: 21, onTimeRate: 90 },
        { id: '10', name: 'Linda Taylor', jobsCompleted: 19, onTimeRate: 95 },
      ];

      this.driverPerformanceDataSource.data = driverPerformanceData;
      this.loading = false;
    } catch (error) {
      console.error('Error generating Driver Performance report:', error);
      this.snackBar.open('Error generating report', 'Close', {
        duration: 5000,
      });
      this.loading = false;
    }
  }

  private async generateVehicleUtilizationReport(
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // Mock data for vehicle utilization
      const vehicleUtilizationData: VehicleUtilization[] = [
        {
          id: '1',
          registration: 'AB12 CDE',
          makeModel: 'Ford Transit',
          jobsCompleted: 28,
          mileage: '12,450',
        },
        {
          id: '2',
          registration: 'BC23 DEF',
          makeModel: 'Mercedes Sprinter',
          jobsCompleted: 24,
          mileage: '9,875',
        },
        {
          id: '3',
          registration: 'CD34 EFG',
          makeModel: 'Volkswagen Crafter',
          jobsCompleted: 22,
          mileage: '11,320',
        },
        {
          id: '4',
          registration: 'DE45 FGH',
          makeModel: 'Renault Master',
          jobsCompleted: 19,
          mileage: '8,640',
        },
        {
          id: '5',
          registration: 'EF56 GHI',
          makeModel: 'Fiat Ducato',
          jobsCompleted: 18,
          mileage: '7,950',
        },
        {
          id: '6',
          registration: 'FG67 HIJ',
          makeModel: 'Peugeot Boxer',
          jobsCompleted: 16,
          mileage: 'N/A',
        },
        {
          id: '7',
          registration: 'GH78 IJK',
          makeModel: 'Citroen Relay',
          jobsCompleted: 15,
          mileage: '6,780',
        },
        {
          id: '8',
          registration: 'HI89 JKL',
          makeModel: 'Iveco Daily',
          jobsCompleted: 14,
          mileage: '5,920',
        },
        {
          id: '9',
          registration: 'IJ90 KLM',
          makeModel: 'Ford Custom',
          jobsCompleted: 12,
          mileage: '4,780',
        },
        {
          id: '10',
          registration: 'JK01 LMN',
          makeModel: 'Mercedes Vito',
          jobsCompleted: 10,
          mileage: 'N/A',
        },
      ];

      this.vehicleUtilizationDataSource.data = vehicleUtilizationData;
      this.loading = false;
    } catch (error) {
      console.error('Error generating Vehicle Utilization report:', error);
      this.snackBar.open('Error generating report', 'Close', {
        duration: 5000,
      });
      this.loading = false;
    }
  }

  private async generateRevenueByCustomerReport(
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // Mock data for revenue by customer
      const revenueByCustomerData: RevenueByCustomer[] = [
        { id: '1', name: 'ABC Logistics Ltd', amountInvoiced: 12450.75 },
        { id: '2', name: 'Northern Transport Co', amountInvoiced: 9875.5 },
        { id: '3', name: 'Quick Delivery Services', amountInvoiced: 8640.25 },
        { id: '4', name: 'City Freight Ltd', amountInvoiced: 7950.0 },
        { id: '5', name: 'Express Shipping', amountInvoiced: 6780.75 },
        { id: '6', name: 'Green Logistics', amountInvoiced: 5920.5 },
        { id: '7', name: 'Highland Haulage', amountInvoiced: 4780.25 },
        { id: '8', name: 'Rapid Transit Ltd', amountInvoiced: 3650.0 },
        { id: '9', name: 'Premier Transport', amountInvoiced: 2950.75 },
        { id: '10', name: 'Urban Logistics', amountInvoiced: 2450.5 },
      ];

      this.revenueByCustomerDataSource.data = revenueByCustomerData;
      this.loading = false;
    } catch (error) {
      console.error('Error generating Revenue by Customer report:', error);
      this.snackBar.open('Error generating report', 'Close', {
        duration: 5000,
      });
      this.loading = false;
    }
  }

  private async generateJobStatusSummaryReport(
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // Mock data for job status summary
      const jobStatusSummaryData: JobStatusSummary[] = [
        { status: 'Delivered', count: 156, percentage: 48, color: '#4CAF50' },
        { status: 'In Progress', count: 92, percentage: 28, color: '#2196F3' },
        { status: 'Scheduled', count: 45, percentage: 14, color: '#FFC107' },
        { status: 'Cancelled', count: 21, percentage: 6, color: '#F44336' },
        { status: 'On Hold', count: 14, percentage: 4, color: '#9E9E9E' },
      ];

      this.jobStatusSummaryDataSource.data = jobStatusSummaryData;
      this.loading = false;

      // Generate pie chart for job status summary
      setTimeout(() => {
        this.generateJobStatusChart(jobStatusSummaryData);
      });
    } catch (error) {
      console.error('Error generating Job Status Summary report:', error);
      this.snackBar.open('Error generating report', 'Close', {
        duration: 5000,
      });
      this.loading = false;
    }
  }

  private async generateDriverHandoverReport(
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // Mock data for driver handover report
      const driverHandoverData: DriverHandover[] = [
        {
          jobId: 'JOB-1234',
          vehicleId: 'AB12 CDE',
          fromDriver: 'John Smith',
          toDriver: 'Sarah Johnson',
          timestamp: Timestamp.fromDate(new Date('2025-04-15 09:30:00')),
          location: 'Belfast Depot',
          odometer: 12450,
          notes: 'Standard driver change for shift rotation.',
        },
        {
          jobId: 'JOB-1235',
          vehicleId: 'BC23 DEF',
          fromDriver: 'Mike Williams',
          toDriver: 'Emma Brown',
          timestamp: Timestamp.fromDate(new Date('2025-04-16 14:15:00')),
          location: 'Derry Distribution Center',
          odometer: 9875,
          notes: 'Emergency handover due to driver illness.',
        },
        {
          jobId: 'JOB-1236',
          vehicleId: 'CD34 EFG',
          fromDriver: 'Lisa Chen',
          toDriver: 'David Lee',
          timestamp: Timestamp.fromDate(new Date('2025-04-17 11:45:00')),
          location: 'Newry Logistics Hub',
          odometer: 11320,
          notes: 'Planned rotation at midpoint of long journey.',
        },
        {
          jobId: 'JOB-1237',
          vehicleId: 'DE45 FGH',
          fromDriver: 'Robert Jones',
          toDriver: 'Linda Taylor',
          timestamp: Timestamp.fromDate(new Date('2025-04-18 16:30:00')),
          location: 'Lisburn Service Station',
          odometer: 8640,
          notes: 'Handover due to maximum driving hours reached.',
        },
        {
          jobId: 'JOB-1238',
          vehicleId: 'EF56 GHI',
          fromDriver: 'James Wilson',
          toDriver: 'Karen Miller',
          timestamp: Timestamp.fromDate(new Date('2025-04-19 08:45:00')),
          location: 'Antrim Depot',
          odometer: 7950,
          notes: 'Regular shift change handover.',
        },
      ];

      this.driverHandoverDataSource.data = driverHandoverData;
      this.loading = false;
    } catch (error) {
      console.error('Error generating Driver Handover report:', error);
      this.snackBar.open('Error generating report', 'Close', {
        duration: 5000,
      });
      this.loading = false;
    }
  }

  private async generateDriverHoursReport(
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      // Mock data for driver hours report
      const driverHoursData: DriverHours[] = [
        {
          id: '1',
          name: 'John Smith',
          totalHours: 8.5,
          period: 'Daily',
          status: 'Within Limits',
        },
        {
          id: '2',
          name: 'Sarah Johnson',
          totalHours: 9.75,
          period: 'Daily',
          status: 'Approaching Limit',
        },
        {
          id: '3',
          name: 'Mike Williams',
          totalHours: 11.25,
          period: 'Daily',
          status: 'Exceeded Limit',
        },
        {
          id: '4',
          name: 'Emma Brown',
          totalHours: 42,
          period: 'Weekly',
          status: 'Within Limits',
        },
        {
          id: '5',
          name: 'David Lee',
          totalHours: 52,
          period: 'Weekly',
          status: 'Approaching Limit',
        },
        {
          id: '6',
          name: 'Lisa Chen',
          totalHours: 58,
          period: 'Weekly',
          status: 'Exceeded Limit',
        },
        {
          id: '7',
          name: 'James Wilson',
          totalHours: 7.5,
          period: 'Daily',
          status: 'Within Limits',
        },
        {
          id: '8',
          name: 'Karen Miller',
          totalHours: 8.75,
          period: 'Daily',
          status: 'Within Limits',
        },
        {
          id: '9',
          name: 'Robert Jones',
          totalHours: 10.5,
          period: 'Daily',
          status: 'Approaching Limit',
        },
        {
          id: '10',
          name: 'Linda Taylor',
          totalHours: 45,
          period: 'Weekly',
          status: 'Within Limits',
        },
      ];

      this.driverHoursDataSource.data = driverHoursData;
      this.loading = false;

      // Show notification for drivers exceeding or approaching hour limits
      this.checkDriverHoursLimits(driverHoursData);
    } catch (error) {
      console.error('Error generating Driver Hours report:', error);
      this.snackBar.open('Error generating report', 'Close', {
        duration: 5000,
      });
      this.loading = false;
    }
  }

  private generateJobStatusChart(data: JobStatusSummary[]): void {
    const canvas = document.getElementById(
      'jobStatusChart'
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.chartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: data.map((item) => item.status),
        datasets: [
          {
            data: data.map((item) => item.count),
            backgroundColor: data.map((item) => item.color),
            borderWidth: 1,
          },
        ],
      },
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
              label: function (context) {
                const label = context.label || '';
                const value = context.raw as number;
                const dataset = context.dataset;
                const total = (dataset.data as number[]).reduce(
                  (a, b) => a + b,
                  0
                );
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              },
            },
          },
        },
      },
    });
  }

  private checkDriverHoursLimits(driverHours: DriverHours[]): void {
    const exceedingDrivers = driverHours.filter(
      (driver) => driver.status === 'Exceeded Limit'
    );
    const approachingDrivers = driverHours.filter(
      (driver) => driver.status === 'Approaching Limit'
    );

    if (exceedingDrivers.length > 0) {
      const driverNames = exceedingDrivers.map((d) => d.name).join(', ');
      this.snackBar.open(
        `ALERT: ${driverNames} ${
          exceedingDrivers.length > 1 ? 'have' : 'has'
        } exceeded driving hours limits!`,
        'View Report',
        {
          duration: 8000,
          panelClass: ['error-snackbar'],
        }
      );
    } else if (approachingDrivers.length > 0) {
      const driverNames = approachingDrivers.map((d) => d.name).join(', ');
      this.snackBar.open(
        `Warning: ${driverNames} ${
          approachingDrivers.length > 1 ? 'are' : 'is'
        } approaching driving hours limits`,
        'View Report',
        {
          duration: 6000,
          panelClass: ['warning-snackbar'],
        }
      );
    }
  }

  exportCsv(): void {
    const reportType = this.reportForm.get('reportType')?.value;
    if (!reportType) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    let dataToExport: any[] = [];
    let headers: string[] = [];

    // Get data and headers based on report type
    switch (reportType) {
      case 'driver-performance':
        dataToExport = this.driverPerformanceDataSource.data;
        headers = ['Driver Name', 'Jobs Completed', 'On-Time Rate (%)'];
        break;
      case 'vehicle-utilization':
        dataToExport = this.vehicleUtilizationDataSource.data;
        headers = ['Registration', 'Make/Model', 'Jobs Completed', 'Mileage'];
        break;
      case 'revenue-by-customer':
        dataToExport = this.revenueByCustomerDataSource.data;
        headers = ['Customer Name', 'Amount Invoiced (£)'];
        break;
      case 'job-status-summary':
        dataToExport = this.jobStatusSummaryDataSource.data;
        headers = ['Status', 'Count', 'Percentage (%)'];
        break;
      case 'driver-handover':
        dataToExport = this.driverHandoverDataSource.data;
        headers = [
          'Job ID',
          'Vehicle ID',
          'From Driver',
          'To Driver',
          'Timestamp',
          'Location',
          'Odometer',
          'Notes',
        ];
        break;
      case 'driver-hours':
        dataToExport = this.driverHoursDataSource.data;
        headers = ['Driver Name', 'Total Hours', 'Period', 'Status'];
        break;
    }

    // Add headers to CSV
    csvContent += headers.join(',') + '\r\n';

    // Add data rows to CSV
    dataToExport.forEach((item) => {
      let row = '';

      switch (reportType) {
        case 'driver-performance':
          row = `${item.name},${item.jobsCompleted},${item.onTimeRate}`;
          break;
        case 'vehicle-utilization':
          row = `${item.registration},${item.makeModel},${item.jobsCompleted},${item.mileage}`;
          break;
        case 'revenue-by-customer':
          row = `${item.name},${item.amountInvoiced.toFixed(2)}`;
          break;
        case 'job-status-summary':
          row = `${item.status},${item.count},${item.percentage}`;
          break;
        case 'driver-handover':
          const timestamp = item.timestamp.toDate().toLocaleString();
          row = `${item.jobId},${item.vehicleId},${item.fromDriver},${item.toDriver},${timestamp},${item.location},${item.odometer},"${item.notes}"`;
          break;
        case 'driver-hours':
          row = `${item.name},${item.totalHours},${item.period},${item.status}`;
          break;
      }

      csvContent += row + '\r\n';
    });

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${this.reportTitle.replace(/\s+/g, '_')}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportPdf(): void {
    const reportType = this.reportForm.get('reportType')?.value;
    if (!reportType) return;

    // Create a new PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Add logo and report title
    // Note: In a real implementation, you would add the actual logo
    doc.setFillColor(193, 154, 107); // Primary color #C19A6B
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('NI Vehicle Logistics', pageWidth / 2, 15, { align: 'center' });

    // Add report title
    doc.setTextColor(51, 51, 51); // Text color #333333
    doc.setFontSize(16);
    doc.text(this.reportTitle, pageWidth / 2, 40, { align: 'center' });

    // Add date range
    const startDate = this.reportForm.get('dateRange.start')?.value;
    const endDate = this.reportForm.get('dateRange.end')?.value;
    if (startDate && endDate) {
      const dateRangeText = `Date Range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
      doc.setFontSize(12);
      doc.text(dateRangeText, pageWidth / 2, 50, { align: 'center' });
    }

    // Add table data based on report type
    let tableData: any[][] = [];
    let tableColumns: any[] = [];

    switch (reportType) {
      case 'driver-performance':
        tableColumns = [
          { header: 'Driver Name', dataKey: 'name' },
          { header: 'Jobs Completed', dataKey: 'jobsCompleted' },
          { header: 'On-Time Rate (%)', dataKey: 'onTimeRate' },
        ];
        tableData = this.driverPerformanceDataSource.data.map((item) => [
          item.name,
          item.jobsCompleted,
          `${item.onTimeRate}%`,
        ]);
        break;
      case 'vehicle-utilization':
        tableColumns = [
          { header: 'Registration', dataKey: 'registration' },
          { header: 'Make/Model', dataKey: 'makeModel' },
          { header: 'Jobs Completed', dataKey: 'jobsCompleted' },
          { header: 'Mileage', dataKey: 'mileage' },
        ];
        tableData = this.vehicleUtilizationDataSource.data.map((item) => [
          item.registration,
          item.makeModel,
          item.jobsCompleted,
          item.mileage,
        ]);
        break;
      case 'revenue-by-customer':
        tableColumns = [
          { header: 'Customer Name', dataKey: 'name' },
          { header: 'Amount Invoiced (£)', dataKey: 'amountInvoiced' },
        ];
        tableData = this.revenueByCustomerDataSource.data.map((item) => [
          item.name,
          `£${item.amountInvoiced.toFixed(2)}`,
        ]);
        break;
      case 'job-status-summary':
        tableColumns = [
          { header: 'Status', dataKey: 'status' },
          { header: 'Count', dataKey: 'count' },
          { header: 'Percentage (%)', dataKey: 'percentage' },
        ];
        tableData = this.jobStatusSummaryDataSource.data.map((item) => [
          item.status,
          item.count,
          `${item.percentage}%`,
        ]);

        // Add chart image if chart exists
        if (this.chartInstance) {
          const canvas = document.getElementById(
            'jobStatusChart'
          ) as HTMLCanvasElement;
          if (canvas) {
            const imgData = canvas.toDataURL('image/png');
            doc.addPage();
            doc.text('Job Status Distribution', pageWidth / 2, 20, {
              align: 'center',
            });
            doc.addImage(imgData, 'PNG', 15, 40, 180, 160);
          }
        }
        break;
      case 'driver-handover':
        tableColumns = [
          { header: 'Job ID', dataKey: 'jobId' },
          { header: 'Vehicle ID', dataKey: 'vehicleId' },
          { header: 'From Driver', dataKey: 'fromDriver' },
          { header: 'To Driver', dataKey: 'toDriver' },
          { header: 'Timestamp', dataKey: 'timestamp' },
          { header: 'Location', dataKey: 'location' },
          { header: 'Odometer', dataKey: 'odometer' },
          { header: 'Notes', dataKey: 'notes' },
        ];
        tableData = this.driverHandoverDataSource.data.map((item) => [
          item.jobId,
          item.vehicleId,
          item.fromDriver,
          item.toDriver,
          item.timestamp.toDate().toLocaleString(),
          item.location,
          item.odometer,
          item.notes,
        ]);
        break;
      case 'driver-hours':
        tableColumns = [
          { header: 'Driver Name', dataKey: 'name' },
          { header: 'Total Hours', dataKey: 'totalHours' },
          { header: 'Period', dataKey: 'period' },
          { header: 'Status', dataKey: 'status' },
        ];
        tableData = this.driverHoursDataSource.data.map((item) => [
          item.name,
          item.totalHours,
          item.period,
          item.status,
        ]);
        break;
    }

    // Generate table
    autoTable(doc, {
      startY: 60,
      head: [tableColumns.map((col) => col.header)],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [74, 60, 49], // Secondary color #4A3C31
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
      },
      styles: {
        overflow: 'linebreak',
        cellPadding: 3,
      },
      margin: { top: 60 },
    });

    // Add footer with date and page number
    const totalPages = doc.internal.pages.length;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const footerText = `Generated on ${new Date().toLocaleString()} - Page ${i} of ${totalPages}`;
      doc.text(
        footerText,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    doc.save(
      `${this.reportTitle.replace(/\s+/g, '_')}_${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );
  }

  // Helper methods for UI
  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'within limits':
        return 'status-normal';
      case 'approaching limit':
        return 'status-warning';
      case 'exceeded limit':
        return 'status-danger';
      default:
        return '';
    }
  }

  formatDate(timestamp: Timestamp | undefined): string {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleString();
  }
}
