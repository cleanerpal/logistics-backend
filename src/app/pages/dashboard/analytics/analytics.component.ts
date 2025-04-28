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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Chart, ChartConfiguration } from 'chart.js';

// Firebase imports
import { Firestore } from '@angular/fire/firestore';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  template: `
    <div class="analytics-container">
      <h1 class="page-title">Analytics Dashboard</h1>

      <!-- Date filters -->
      <mat-card class="filter-card">
        <mat-card-content>
          <form [formGroup]="filterForm" class="filter-form">
            <mat-form-field appearance="outline">
              <mat-label>Date Range</mat-label>
              <mat-select
                formControlName="dateRange"
                (selectionChange)="onDateRangeChange()"
              >
                <mat-option value="last7days">Last 7 Days</mat-option>
                <mat-option value="last30days">Last 30 Days</mat-option>
                <mat-option value="lastQuarter">Last Quarter</mat-option>
                <mat-option value="custom">Custom Range</mat-option>
              </mat-select>
            </mat-form-field>

            <ng-container
              *ngIf="filterForm.get('dateRange')?.value === 'custom'"
            >
              <mat-form-field appearance="outline">
                <mat-label>Start Date</mat-label>
                <input
                  matInput
                  [matDatepicker]="startPicker"
                  formControlName="startDate"
                />
                <mat-datepicker-toggle
                  matSuffix
                  [for]="startPicker"
                ></mat-datepicker-toggle>
                <mat-datepicker #startPicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>End Date</mat-label>
                <input
                  matInput
                  [matDatepicker]="endPicker"
                  formControlName="endDate"
                />
                <mat-datepicker-toggle
                  matSuffix
                  [for]="endPicker"
                ></mat-datepicker-toggle>
                <mat-datepicker #endPicker></mat-datepicker>
              </mat-form-field>

              <button
                mat-raised-button
                color="primary"
                (click)="applyCustomDateRange()"
              >
                Apply
              </button>
            </ng-container>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Loading spinner -->
      <div class="loading-container" *ngIf="loading">
        <mat-spinner diameter="50"></mat-spinner>
      </div>

      <!-- Analytics content -->
      <div class="analytics-content" *ngIf="!loading">
        <!-- Job Trends Chart -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>Job Volume Trends</mat-card-title>
            <mat-card-subtitle>Total jobs by day</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container">
              <canvas #jobTrendsChart></canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Delivery Performance Chart -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>Delivery Performance</mat-card-title>
            <mat-card-subtitle>On-time vs delayed deliveries</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container">
              <canvas #deliveryPerformanceChart></canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Driver Performance -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>Driver Performance</mat-card-title>
            <mat-card-subtitle>Average jobs per driver</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container">
              <canvas #driverPerformanceChart></canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Vehicle Utilization -->
        <mat-card class="chart-card">
          <mat-card-header>
            <mat-card-title>Vehicle Utilization</mat-card-title>
            <mat-card-subtitle>Job counts by vehicle type</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="chart-container">
              <canvas #vehicleUtilizationChart></canvas>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .analytics-container {
        padding: 20px;
        background-color: #f5f5f5;
        min-height: 100%;
      }

      .page-title {
        font-size: 24px;
        font-weight: 500;
        color: #4a3c31;
        margin-bottom: 24px;
      }

      .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
      }

      .filter-card {
        margin-bottom: 24px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }

      .filter-form {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 16px;

        .mat-mdc-form-field {
          min-width: 200px;
        }
      }

      .analytics-content {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
        gap: 24px;

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
        }
      }

      .chart-card {
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        height: 100%;

        .mat-mdc-card-header {
          padding: 16px 16px 0;

          .mat-mdc-card-title {
            color: #4a3c31;
            font-size: 18px;
            margin-bottom: 4px;
          }

          .mat-mdc-card-subtitle {
            color: #666666;
            font-size: 14px;
          }
        }

        .chart-container {
          height: 300px;
          position: relative;
        }
      }
    `,
  ],
})
export class AnalyticsComponent implements OnInit, AfterViewInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private snackBar: MatSnackBar = inject(MatSnackBar);

  @ViewChild('jobTrendsChart')
  jobTrendsChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('deliveryPerformanceChart')
  deliveryPerformanceChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('driverPerformanceChart')
  driverPerformanceChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('vehicleUtilizationChart')
  vehicleUtilizationChartRef!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];
  loading = true;

  filterForm = new FormGroup({
    dateRange: new FormControl('last30days'),
    startDate: new FormControl<Date | null>(null),
    endDate: new FormControl<Date | null>(null),
  });

  startDate: Date = new Date();
  endDate: Date = new Date();

  constructor() {
    // Initialize default date range (last 30 days)
    this.endDate = new Date();
    this.startDate = new Date();
    this.startDate.setDate(this.startDate.getDate() - 30);
  }

  ngOnInit(): void {
    this.loadAnalyticsData();
  }

  ngAfterViewInit(): void {
    this.initializeCharts();
  }

  ngOnDestroy(): void {
    // Clean up charts when component is destroyed
    this.charts.forEach((chart) => chart.destroy());
  }

  onDateRangeChange(): void {
    const range = this.filterForm.get('dateRange')?.value;

    if (range === 'custom') {
      return; // Wait for custom date selection
    }

    // Calculate date range based on selection
    const endDate = new Date();
    let startDate = new Date();

    switch (range) {
      case 'last7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'lastQuarter':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
    }

    this.startDate = startDate;
    this.endDate = endDate;

    // Update form control values
    this.filterForm.get('startDate')?.setValue(startDate);
    this.filterForm.get('endDate')?.setValue(endDate);

    // Reload data with new date range
    this.loadAnalyticsData();
  }

  applyCustomDateRange(): void {
    const startDate = this.filterForm.get('startDate')?.value;
    const endDate = this.filterForm.get('endDate')?.value;

    if (startDate && endDate) {
      this.startDate = startDate;
      this.endDate = endDate;
      this.loadAnalyticsData();
    } else {
      this.snackBar.open('Please select both start and end dates', 'Close', {
        duration: 3000,
      });
    }
  }

  async loadAnalyticsData(): Promise<void> {
    this.loading = true;

    try {
      // Here you would load data from Firestore based on date range
      // This is a simulation with mock data

      setTimeout(() => {
        this.updateCharts();
        this.loading = false;
      }, 1000);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      this.snackBar.open(
        'Error loading analytics data. Please try again.',
        'Close',
        {
          duration: 5000,
        }
      );
      this.loading = false;
    }
  }

  initializeCharts(): void {
    setTimeout(() => {
      this.initJobTrendsChart();
      this.initDeliveryPerformanceChart();
      this.initDriverPerformanceChart();
      this.initVehicleUtilizationChart();
    }, 100);
  }

  updateCharts(): void {
    // Update charts with new data
    this.charts.forEach((chart) => chart.update());
  }

  initJobTrendsChart(): void {
    if (!this.jobTrendsChartRef) return;

    const ctx = this.jobTrendsChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Mock data - in a real app, this would come from Firestore
    const labels = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - 6 + i);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
      });
    });

    const data = {
      labels: labels,
      datasets: [
        {
          label: 'Job Volumes',
          data: [12, 19, 15, 20, 25, 18, 22],
          backgroundColor: '#C19A6B',
          borderColor: '#C19A6B',
          borderWidth: 2,
          tension: 0.4,
          fill: false,
        },
      ],
    };

    const config: ChartConfiguration = {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Jobs',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Date',
            },
          },
        },
      },
    };

    const chart = new Chart(ctx, config);
    this.charts.push(chart);
  }

  initDeliveryPerformanceChart(): void {
    if (!this.deliveryPerformanceChartRef) return;

    const ctx = this.deliveryPerformanceChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Mock data
    const data = {
      labels: ['On Time', 'Delayed'],
      datasets: [
        {
          data: [85, 15],
          backgroundColor: ['#4CAF50', '#F44336'],
          borderWidth: 1,
        },
      ],
    };

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw as number;
                return `${label}: ${value}%`;
              },
            },
          },
        },
      },
    };

    const chart = new Chart(ctx, config);
    this.charts.push(chart);
  }

  initDriverPerformanceChart(): void {
    if (!this.driverPerformanceChartRef) return;

    const ctx = this.driverPerformanceChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Mock data
    const data = {
      labels: ['John D.', 'Sarah M.', 'Robert L.', 'Emma W.', 'Michael T.'],
      datasets: [
        {
          label: 'Jobs Completed',
          data: [18, 15, 12, 20, 16],
          backgroundColor: '#4A3C31',
          barThickness: 30,
        },
      ],
    };

    const config: ChartConfiguration = {
      type: 'bar',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Jobs Completed',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Driver',
            },
          },
        },
      },
    };

    const chart = new Chart(ctx, config);
    this.charts.push(chart);
  }

  initVehicleUtilizationChart(): void {
    if (!this.vehicleUtilizationChartRef) return;

    const ctx = this.vehicleUtilizationChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Mock data
    const data = {
      labels: ['Sedan', 'SUV', 'Van', 'Truck', 'Special'],
      datasets: [
        {
          label: 'Jobs by Vehicle Type',
          data: [25, 40, 30, 15, 5],
          backgroundColor: [
            '#C19A6B',
            '#4A3C31',
            '#333333',
            '#795548',
            '#9E9E9E',
          ],
          borderWidth: 1,
        },
      ],
    };

    const config: ChartConfiguration = {
      type: 'pie',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
          },
        },
      },
    };

    const chart = new Chart(ctx, config);
    this.charts.push(chart);
  }
}
