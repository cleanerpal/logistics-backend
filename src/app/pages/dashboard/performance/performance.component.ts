import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

// Firebase imports
import { Firestore, Timestamp } from '@angular/fire/firestore';

// Models
interface DriverPerformance {
  id: string;
  name: string;
  completedJobs: number;
  onTimeDeliveries: number;
  onTimePercentage: number;
  averageJobDuration: number; // in minutes
  customerRating: number; // out of 5
  lastActive: Timestamp;
}

@Component({
  selector: 'app-performance',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="performance-container">
      <h1 class="page-title">Performance Metrics</h1>

      <!-- Loading spinner -->
      <div class="loading-container" *ngIf="loading">
        <mat-spinner diameter="50"></mat-spinner>
      </div>

      <!-- Performance cards -->
      <div class="metrics-overview" *ngIf="!loading">
        <mat-card class="metric-card">
          <mat-card-content>
            <div class="metric-value">{{ overallOnTimePercentage }}%</div>
            <div class="metric-label">On-Time Deliveries</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card">
          <mat-card-content>
            <div class="metric-value">
              {{ averageJobCompletionTime | number : '1.0-0' }} min
            </div>
            <div class="metric-label">Avg. Completion Time</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card">
          <mat-card-content>
            <div class="metric-value">
              {{ averageCustomerRating | number : '1.1-1' }}/5
            </div>
            <div class="metric-label">Customer Satisfaction</div>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card">
          <mat-card-content>
            <div class="metric-value">{{ activeDrivers }}</div>
            <div class="metric-label">Active Drivers</div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Driver performance table -->
      <mat-card class="driver-performance-card" *ngIf="!loading">
        <mat-card-header>
          <mat-card-title>Driver Performance</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="table-container">
            <table
              mat-table
              [dataSource]="driverPerformance"
              matSort
              (matSortChange)="announceSortChange($event)"
            >
              <!-- Name Column -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  Driver
                </th>
                <td mat-cell *matCellDef="let driver">{{ driver.name }}</td>
              </ng-container>

              <!-- Completed Jobs Column -->
              <ng-container matColumnDef="completedJobs">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  Jobs Completed
                </th>
                <td mat-cell *matCellDef="let driver">
                  {{ driver.completedJobs }}
                </td>
              </ng-container>

              <!-- On-Time Percentage Column -->
              <ng-container matColumnDef="onTimePercentage">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  On-Time %
                </th>
                <td mat-cell *matCellDef="let driver">
                  <div
                    class="progress-container"
                    [matTooltip]="
                      driver.onTimePercentage + '% on-time deliveries'
                    "
                  >
                    <div
                      class="progress-bar"
                      [style.width.%]="driver.onTimePercentage"
                      [ngClass]="getOnTimeRatingClass(driver.onTimePercentage)"
                    >
                      {{ driver.onTimePercentage }}%
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Average Job Duration Column -->
              <ng-container matColumnDef="averageJobDuration">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  Avg. Duration
                </th>
                <td mat-cell *matCellDef="let driver">
                  {{ driver.averageJobDuration | number : '1.0-0' }} min
                </td>
              </ng-container>

              <!-- Customer Rating Column -->
              <ng-container matColumnDef="customerRating">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  Rating
                </th>
                <td mat-cell *matCellDef="let driver">
                  <div class="rating">
                    <span class="rating-value">{{
                      driver.customerRating | number : '1.1-1'
                    }}</span>
                    <div class="stars">
                      <mat-icon
                        *ngFor="let star of getStars(driver.customerRating)"
                        [ngClass]="
                          star === 1
                            ? 'full-star'
                            : star === 0.5
                            ? 'half-star'
                            : 'empty-star'
                        "
                      >
                        {{
                          star === 0.5
                            ? 'star_half'
                            : star === 1
                            ? 'star'
                            : 'star_border'
                        }}
                      </mat-icon>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Last Active Column -->
              <ng-container matColumnDef="lastActive">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  Last Active
                </th>
                <td mat-cell *matCellDef="let driver">
                  {{ formatDate(driver.lastActive) }}
                </td>
              </ng-container>

              <!-- Row definitions -->
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .performance-container {
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

      .metrics-overview {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .metric-card {
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

        .mat-mdc-card-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
        }

        .metric-value {
          font-size: 32px;
          font-weight: 600;
          color: #c19a6b;
          margin-bottom: 8px;
        }

        .metric-label {
          font-size: 14px;
          color: #4a3c31;
          text-align: center;
        }
      }

      .driver-performance-card {
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

        .mat-mdc-card-header {
          padding: 16px 16px 0;

          .mat-mdc-card-title {
            color: #4a3c31;
            font-size: 18px;
            margin-bottom: 4px;
          }
        }

        .mat-mdc-card-content {
          padding: 16px;
        }
      }

      .table-container {
        width: 100%;
        overflow-x: auto;

        table {
          width: 100%;
        }
      }

      .progress-container {
        width: 100%;
        background-color: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
      }

      .progress-bar {
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: 500;

        &.excellent {
          background-color: #4caf50;
        }

        &.good {
          background-color: #8bc34a;
        }

        &.average {
          background-color: #ffc107;
        }

        &.poor {
          background-color: #f44336;
        }
      }

      .rating {
        display: flex;
        align-items: center;

        .rating-value {
          margin-right: 8px;
          font-weight: 500;
        }

        .stars {
          display: flex;

          .mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          .full-star {
            color: #ffc107;
          }

          .half-star {
            color: #ffc107;
          }

          .empty-star {
            color: #e0e0e0;
          }
        }
      }

      @media (max-width: 768px) {
        .metrics-overview {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 480px) {
        .metrics-overview {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class PerformanceComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private snackBar: MatSnackBar = inject(MatSnackBar);
  private liveAnnouncer: LiveAnnouncer = inject(LiveAnnouncer);

  loading = true;
  driverPerformance: DriverPerformance[] = [];
  displayedColumns: string[] = [
    'name',
    'completedJobs',
    'onTimePercentage',
    'averageJobDuration',
    'customerRating',
    'lastActive',
  ];

  // Summary metrics
  overallOnTimePercentage = 0;
  averageJobCompletionTime = 0;
  averageCustomerRating = 0;
  activeDrivers = 0;

  ngOnInit(): void {
    this.loadPerformanceData();
  }

  async loadPerformanceData(): Promise<void> {
    this.loading = true;

    try {
      // In a real app, this would fetch data from Firestore
      // This is mock data for demonstration
      setTimeout(() => {
        this.driverPerformance = this.generateMockDriverData();
        this.calculateSummaryMetrics();
        this.loading = false;
      }, 1000);
    } catch (error) {
      console.error('Error loading performance data:', error);
      this.snackBar.open(
        'Error loading performance data. Please try again.',
        'Close',
        {
          duration: 5000,
        }
      );
      this.loading = false;
    }
  }

  /**
   * Generate mock driver performance data
   */
  private generateMockDriverData(): DriverPerformance[] {
    const drivers = [
      {
        id: '1',
        name: 'John Smith',
        completedJobs: 45,
        onTimeDeliveries: 41,
        onTimePercentage: 91,
        averageJobDuration: 72,
        customerRating: 4.7,
        lastActive: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 30)), // 30 minutes ago
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        completedJobs: 38,
        onTimeDeliveries: 35,
        onTimePercentage: 92,
        averageJobDuration: 68,
        customerRating: 4.9,
        lastActive: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 15)), // 15 minutes ago
      },
      {
        id: '3',
        name: 'Michael Brown',
        completedJobs: 52,
        onTimeDeliveries: 39,
        onTimePercentage: 75,
        averageJobDuration: 85,
        customerRating: 4.1,
        lastActive: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 120)), // 2 hours ago
      },
      {
        id: '4',
        name: 'Emma Wilson',
        completedJobs: 29,
        onTimeDeliveries: 27,
        onTimePercentage: 93,
        averageJobDuration: 65,
        customerRating: 4.8,
        lastActive: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 45)), // 45 minutes ago
      },
      {
        id: '5',
        name: 'David Lee',
        completedJobs: 15,
        onTimeDeliveries: 10,
        onTimePercentage: 67,
        averageJobDuration: 90,
        customerRating: 3.5,
        lastActive: Timestamp.fromDate(
          new Date(Date.now() - 1000 * 60 * 60 * 24)
        ), // 1 day ago
      },
      {
        id: '6',
        name: 'Lisa Chen',
        completedJobs: 41,
        onTimeDeliveries: 36,
        onTimePercentage: 88,
        averageJobDuration: 75,
        customerRating: 4.5,
        lastActive: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 180)), // 3 hours ago
      },
      {
        id: '7',
        name: 'Robert Taylor',
        completedJobs: 33,
        onTimeDeliveries: 30,
        onTimePercentage: 91,
        averageJobDuration: 70,
        customerRating: 4.6,
        lastActive: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 240)), // 4 hours ago
      },
    ];

    return drivers;
  }

  /**
   * Calculate summary metrics from driver data
   */
  private calculateSummaryMetrics(): void {
    if (this.driverPerformance.length === 0) {
      return;
    }

    let totalOnTimePercentage = 0;
    let totalJobDuration = 0;
    let totalRating = 0;

    this.driverPerformance.forEach((driver) => {
      totalOnTimePercentage += driver.onTimePercentage;
      totalJobDuration += driver.averageJobDuration;
      totalRating += driver.customerRating;
    });

    this.overallOnTimePercentage = Math.round(
      totalOnTimePercentage / this.driverPerformance.length
    );
    this.averageJobCompletionTime =
      totalJobDuration / this.driverPerformance.length;
    this.averageCustomerRating = totalRating / this.driverPerformance.length;

    // Count active drivers (active in the last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    this.activeDrivers = this.driverPerformance.filter(
      (driver) => driver.lastActive.toDate() > oneDayAgo
    ).length;
  }

  /**
   * Get the CSS class for on-time percentage rating
   */
  getOnTimeRatingClass(percentage: number): string {
    if (percentage >= 90) {
      return 'excellent';
    } else if (percentage >= 80) {
      return 'good';
    } else if (percentage >= 70) {
      return 'average';
    } else {
      return 'poor';
    }
  }

  /**
   * Get star array for rating display
   */
  getStars(rating: number): number[] {
    const starsArray: number[] = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    // Add full stars
    for (let i = 0; i < fullStars; i++) {
      starsArray.push(1);
    }

    // Add half star if needed
    if (hasHalfStar) {
      starsArray.push(0.5);
    }

    // Fill remaining with empty stars (up to 5)
    while (starsArray.length < 5) {
      starsArray.push(0);
    }

    return starsArray;
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: Timestamp): string {
    const now = new Date();
    const date = timestamp.toDate();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffMins < 1440) {
      // Less than 24 hours
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  }

  /**
   * Announce sort change for accessibility
   */
  announceSortChange(sortState: Sort): void {
    if (sortState.direction) {
      this.liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this.liveAnnouncer.announce('Sorting cleared');
    }
  }
}
