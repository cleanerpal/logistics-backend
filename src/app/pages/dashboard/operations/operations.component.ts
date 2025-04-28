import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterModule } from '@angular/router';

// Firebase imports
import { Firestore, Timestamp } from '@angular/fire/firestore';

// Models
interface Vehicle {
  id: string;
  make: string;
  model: string;
  registration: string;
  status: 'Available' | 'In Use' | 'Maintenance' | 'Out of Service';
  lastServiceDate: Timestamp;
  nextServiceDue: Timestamp;
  currentDriver?: string;
  currentJobId?: string;
  mileage: number;
  fuelLevel: number;
}

interface ActiveJob {
  id: string;
  reference: string;
  status: 'Allocated' | 'Collected';
  customer: string;
  address: string;
  driver: string;
  vehicle: string;
  startTime: Timestamp;
  estimatedCompletion: Timestamp;
  progress: number;
}

interface Alert {
  id: string;
  type: 'Warning' | 'Info' | 'Urgent';
  message: string;
  time: Timestamp;
  relatedTo?: string;
  acknowledged: boolean;
}

@Component({
  selector: 'app-operations',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatBadgeModule,
    RouterModule,
  ],
  template: `
    <div class="operations-container">
      <h1 class="page-title">Operations Dashboard</h1>

      <!-- Alerts section -->
      <mat-card class="alerts-card" *ngIf="alerts.length > 0">
        <mat-card-header>
          <mat-card-title>
            Alerts
            <mat-icon
              [matBadge]="getUrgentAlertCount()"
              [matBadgeHidden]="getUrgentAlertCount() === 0"
              matBadgeColor="warn"
              matBadgeSize="small"
            >
              notification_important
            </mat-icon>
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="alerts-container">
            <div
              *ngFor="let alert of alerts"
              class="alert-item"
              [ngClass]="alert.type.toLowerCase()"
            >
              <div class="alert-content">
                <div class="alert-header">
                  <span class="alert-type">{{ alert.type }}</span>
                  <span class="alert-time">{{
                    formatAlertTime(alert.time)
                  }}</span>
                </div>
                <div class="alert-message">{{ alert.message }}</div>
              </div>
              <button
                mat-icon-button
                (click)="acknowledgeAlert(alert.id)"
                *ngIf="!alert.acknowledged"
              >
                <mat-icon>check_circle</mat-icon>
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Loading spinner -->
      <div class="loading-container" *ngIf="loading">
        <mat-spinner diameter="50"></mat-spinner>
      </div>

      <!-- Operations content -->
      <div class="operations-content" *ngIf="!loading">
        <!-- Fleet Status -->
        <mat-card class="status-card fleet-status">
          <mat-card-header>
            <mat-card-title>Fleet Status</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="status-grid">
              <div class="status-item">
                <div class="status-value">
                  {{ getVehicleCountByStatus('Available') }}
                </div>
                <div class="status-label available">Available</div>
              </div>
              <div class="status-item">
                <div class="status-value">
                  {{ getVehicleCountByStatus('In Use') }}
                </div>
                <div class="status-label in-use">In Use</div>
              </div>
              <div class="status-item">
                <div class="status-value">
                  {{ getVehicleCountByStatus('Maintenance') }}
                </div>
                <div class="status-label maintenance">Maintenance</div>
              </div>
              <div class="status-item">
                <div class="status-value">
                  {{ getVehicleCountByStatus('Out of Service') }}
                </div>
                <div class="status-label out-of-service">Out of Service</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Active Jobs -->
        <mat-card class="status-card active-jobs">
          <mat-card-header>
            <mat-card-title>Active Jobs</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="status-grid">
              <div class="status-item">
                <div class="status-value">
                  {{ getJobCountByStatus('Allocated') }}
                </div>
                <div class="status-label allocated">Allocated</div>
              </div>
              <div class="status-item">
                <div class="status-value">
                  {{ getJobCountByStatus('Collected') }}
                </div>
                <div class="status-label collected">Collected</div>
              </div>
              <div class="status-item">
                <div class="status-value">{{ getTotalActiveJobs() }}</div>
                <div class="status-label">Total Active</div>
              </div>
              <div class="status-item">
                <div class="status-value">{{ getDelayedJobsCount() }}</div>
                <div class="status-label delayed">Delayed</div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Operations Tabs -->
        <mat-card class="operations-tabs-card">
          <mat-card-content>
            <mat-tab-group animationDuration="200ms">
              <!-- Active Jobs Tab -->
              <mat-tab label="Active Jobs">
                <div class="table-container">
                  <table mat-table [dataSource]="activeJobs" matSort>
                    <!-- Reference Column -->
                    <ng-container matColumnDef="reference">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Reference
                      </th>
                      <td mat-cell *matCellDef="let job">
                        {{ job.reference }}
                      </td>
                    </ng-container>

                    <!-- Status Column -->
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Status
                      </th>
                      <td mat-cell *matCellDef="let job">
                        <span
                          class="status-badge"
                          [ngClass]="job.status.toLowerCase()"
                        >
                          {{ job.status }}
                        </span>
                      </td>
                    </ng-container>

                    <!-- Customer Column -->
                    <ng-container matColumnDef="customer">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Customer
                      </th>
                      <td mat-cell *matCellDef="let job">{{ job.customer }}</td>
                    </ng-container>

                    <!-- Driver Column -->
                    <ng-container matColumnDef="driver">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Driver
                      </th>
                      <td mat-cell *matCellDef="let job">{{ job.driver }}</td>
                    </ng-container>

                    <!-- Vehicle Column -->
                    <ng-container matColumnDef="vehicle">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Vehicle
                      </th>
                      <td mat-cell *matCellDef="let job">{{ job.vehicle }}</td>
                    </ng-container>

                    <!-- Progress Column -->
                    <ng-container matColumnDef="progress">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Progress
                      </th>
                      <td mat-cell *matCellDef="let job">
                        <div class="progress-container">
                          <div
                            class="progress-bar"
                            [style.width.%]="job.progress"
                          ></div>
                          <span class="progress-text">{{ job.progress }}%</span>
                        </div>
                      </td>
                    </ng-container>

                    <!-- Actions Column -->
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let job">
                        <button mat-icon-button [matMenuTriggerFor]="menu">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #menu="matMenu">
                          <button
                            mat-menu-item
                            [routerLink]="['/jobs', job.id]"
                          >
                            <mat-icon>visibility</mat-icon>
                            <span>View Details</span>
                          </button>
                          <button
                            mat-menu-item
                            (click)="updateJobStatus(job.id, 'Collected')"
                            *ngIf="job.status === 'Allocated'"
                          >
                            <mat-icon>local_shipping</mat-icon>
                            <span>Mark as Collected</span>
                          </button>
                          <button
                            mat-menu-item
                            (click)="updateJobStatus(job.id, 'Delivered')"
                            *ngIf="job.status === 'Collected'"
                          >
                            <mat-icon>check_circle</mat-icon>
                            <span>Mark as Delivered</span>
                          </button>
                          <button
                            mat-menu-item
                            [routerLink]="['/jobs/edit', job.id]"
                          >
                            <mat-icon>edit</mat-icon>
                            <span>Edit Job</span>
                          </button>
                        </mat-menu>
                      </td>
                    </ng-container>

                    <!-- Row definitions -->
                    <tr
                      mat-header-row
                      *matHeaderRowDef="activeJobsColumns"
                    ></tr>
                    <tr
                      mat-row
                      *matRowDef="let row; columns: activeJobsColumns"
                    ></tr>
                  </table>
                </div>
              </mat-tab>

              <!-- Vehicles Tab -->
              <mat-tab label="Vehicles">
                <div class="table-container">
                  <table mat-table [dataSource]="vehicles" matSort>
                    <!-- Registration Column -->
                    <ng-container matColumnDef="registration">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Registration
                      </th>
                      <td mat-cell *matCellDef="let vehicle">
                        {{ vehicle.registration }}
                      </td>
                    </ng-container>

                    <!-- Vehicle Column -->
                    <ng-container matColumnDef="vehicle">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Vehicle
                      </th>
                      <td mat-cell *matCellDef="let vehicle">
                        {{ vehicle.make }} {{ vehicle.model }}
                      </td>
                    </ng-container>

                    <!-- Status Column -->
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Status
                      </th>
                      <td mat-cell *matCellDef="let vehicle">
                        <span
                          class="status-badge"
                          [ngClass]="getVehicleStatusClass(vehicle.status)"
                        >
                          {{ vehicle.status }}
                        </span>
                      </td>
                    </ng-container>

                    <!-- Current Driver Column -->
                    <ng-container matColumnDef="currentDriver">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Current Driver
                      </th>
                      <td mat-cell *matCellDef="let vehicle">
                        {{ vehicle.currentDriver || 'None' }}
                      </td>
                    </ng-container>

                    <!-- Mileage Column -->
                    <ng-container matColumnDef="mileage">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Mileage
                      </th>
                      <td mat-cell *matCellDef="let vehicle">
                        {{ vehicle.mileage | number }} mi
                      </td>
                    </ng-container>

                    <!-- Fuel Level Column -->
                    <ng-container matColumnDef="fuelLevel">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Fuel
                      </th>
                      <td mat-cell *matCellDef="let vehicle">
                        <div
                          class="fuel-gauge"
                          [ngClass]="getFuelLevelClass(vehicle.fuelLevel)"
                        >
                          {{ vehicle.fuelLevel }}%
                        </div>
                      </td>
                    </ng-container>

                    <!-- Service Due Column -->
                    <ng-container matColumnDef="serviceDue">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Service Due
                      </th>
                      <td
                        mat-cell
                        *matCellDef="let vehicle"
                        [ngClass]="
                          isServiceDueSoon(vehicle.nextServiceDue)
                            ? 'service-due-soon'
                            : ''
                        "
                      >
                        {{ formatDate(vehicle.nextServiceDue) }}
                      </td>
                    </ng-container>

                    <!-- Actions Column -->
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let vehicle">
                        <button
                          mat-icon-button
                          [routerLink]="['/vehicles', vehicle.id]"
                        >
                          <mat-icon>visibility</mat-icon>
                        </button>
                      </td>
                    </ng-container>

                    <!-- Row definitions -->
                    <tr mat-header-row *matHeaderRowDef="vehiclesColumns"></tr>
                    <tr
                      mat-row
                      *matRowDef="let row; columns: vehiclesColumns"
                    ></tr>
                  </table>
                </div>
              </mat-tab>
            </mat-tab-group>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .operations-container {
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

      .alerts-card {
        margin-bottom: 24px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

        .mat-mdc-card-header {
          padding: 16px 16px 0;

          .mat-mdc-card-title {
            color: #4a3c31;
            font-size: 18px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;

            .mat-icon {
              margin-left: 8px;
            }
          }
        }

        .mat-mdc-card-content {
          padding: 16px;
        }
      }

      .alerts-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .alert-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-radius: 4px;
        border-left: 4px solid;

        &.urgent {
          background-color: rgba(244, 67, 54, 0.1);
          border-left-color: #f44336;
        }

        &.warning {
          background-color: rgba(255, 152, 0, 0.1);
          border-left-color: #ff9800;
        }

        &.info {
          background-color: rgba(33, 150, 243, 0.1);
          border-left-color: #2196f3;
        }
      }

      .alert-content {
        flex: 1;
      }

      .alert-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .alert-type {
        font-weight: 500;

        .urgent & {
          color: #f44336;
        }

        .warning & {
          color: #ff9800;
        }

        .info & {
          color: #2196f3;
        }
      }

      .alert-time {
        font-size: 12px;
        color: #666666;
      }

      .alert-message {
        font-size: 14px;
      }

      .operations-content {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
        }
      }

      .status-card {
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

      .status-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .status-item {
        text-align: center;
        padding: 16px;
        border-radius: 8px;
        background-color: white;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);

        .status-value {
          font-size: 24px;
          font-weight: 600;
          color: #4a3c31;
          margin-bottom: 4px;
        }

        .status-label {
          font-size: 14px;
          color: #666666;

          &.available {
            color: #4caf50;
          }

          &.in-use {
            color: #2196f3;
          }

          &.maintenance {
            color: #ff9800;
          }

          &.out-of-service {
            color: #f44336;
          }

          &.allocated {
            color: #ffc107;
          }

          &.collected {
            color: #2196f3;
          }

          &.delayed {
            color: #f44336;
          }
        }
      }

      .operations-tabs-card {
        grid-column: 1 / -1;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

        .mat-mdc-card-content {
          padding: 16px;
        }
      }

      .table-container {
        width: 100%;
        overflow-x: auto;
        margin-top: 16px;

        table {
          width: 100%;
        }

        .mat-mdc-header-cell {
          font-weight: 500;
          color: #4a3c31;
        }
      }

      .status-badge {
        padding: 4px 8px;
        border-radius: 16px;
        font-size: 12px;
        font-weight: 500;
        display: inline-block;
        min-width: 80px;
        text-align: center;

        &.allocated {
          background-color: #ffc107;
          color: #333333;
        }

        &.collected {
          background-color: #2196f3;
          color: white;
        }

        &.available {
          background-color: #4caf50;
          color: white;
        }

        &.in-use {
          background-color: #2196f3;
          color: white;
        }

        &.maintenance {
          background-color: #ff9800;
          color: white;
        }

        &.out-of-service {
          background-color: #f44336;
          color: white;
        }
      }

      .progress-container {
        width: 100%;
        height: 16px;
        background-color: #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        position: relative;
      }

      .progress-bar {
        height: 100%;
        background-color: #c19a6b;
      }

      .progress-text {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 500;
      }

      .fuel-gauge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;

        &.low {
          background-color: #f44336;
          color: white;
        }

        &.medium {
          background-color: #ff9800;
          color: white;
        }

        &.high {
          background-color: #4caf50;
          color: white;
        }
      }

      .service-due-soon {
        color: #f44336;
        font-weight: 500;
      }
    `,
  ],
})
export class OperationsComponent implements OnInit {
  private firestore: Firestore = inject(Firestore);
  private snackBar: MatSnackBar = inject(MatSnackBar);

  loading = true;

  // Data collections
  vehicles: Vehicle[] = [];
  activeJobs: ActiveJob[] = [];
  alerts: Alert[] = [];

  // Table columns
  activeJobsColumns: string[] = [
    'reference',
    'status',
    'customer',
    'driver',
    'vehicle',
    'progress',
    'actions',
  ];
  vehiclesColumns: string[] = [
    'registration',
    'vehicle',
    'status',
    'currentDriver',
    'mileage',
    'fuelLevel',
    'serviceDue',
    'actions',
  ];

  ngOnInit(): void {
    this.loadOperationsData();
  }

  async loadOperationsData(): Promise<void> {
    this.loading = true;

    try {
      // For demonstration purposes, using mock data
      // In a real app, you would fetch this from Firestore
      this.vehicles = this.generateMockVehicleData();
      this.activeJobs = this.generateMockActiveJobsData();
      this.alerts = this.generateMockAlertsData();

      this.loading = false;
    } catch (error) {
      console.error('Error loading operations data:', error);
      this.snackBar.open(
        'Error loading operations data. Please try again.',
        'Close',
        {
          duration: 5000,
        }
      );
      this.loading = false;
    }
  }

  /**
   * Generate mock vehicle data
   */
  private generateMockVehicleData(): Vehicle[] {
    return [
      {
        id: 'v1',
        make: 'Ford',
        model: 'Transit',
        registration: 'AB12 CDE',
        status: 'In Use',
        lastServiceDate: Timestamp.fromDate(new Date('2025-01-15')),
        nextServiceDue: Timestamp.fromDate(new Date('2025-07-15')),
        currentDriver: 'John Smith',
        currentJobId: 'j1',
        mileage: 45280,
        fuelLevel: 65,
      },
      {
        id: 'v2',
        make: 'Mercedes',
        model: 'Sprinter',
        registration: 'FG34 HIJ',
        status: 'Available',
        lastServiceDate: Timestamp.fromDate(new Date('2025-02-20')),
        nextServiceDue: Timestamp.fromDate(new Date('2025-08-20')),
        mileage: 28750,
        fuelLevel: 85,
      },
      {
        id: 'v3',
        make: 'Volkswagen',
        model: 'Crafter',
        registration: 'KL56 MNO',
        status: 'Maintenance',
        lastServiceDate: Timestamp.fromDate(new Date('2024-11-10')),
        nextServiceDue: Timestamp.fromDate(new Date('2025-05-10')),
        mileage: 63420,
        fuelLevel: 30,
      },
      {
        id: 'v4',
        make: 'Iveco',
        model: 'Daily',
        registration: 'PQ78 RST',
        status: 'In Use',
        lastServiceDate: Timestamp.fromDate(new Date('2025-03-05')),
        nextServiceDue: Timestamp.fromDate(new Date('2025-09-05')),
        currentDriver: 'Sarah Johnson',
        currentJobId: 'j2',
        mileage: 37840,
        fuelLevel: 45,
      },
      {
        id: 'v5',
        make: 'Renault',
        model: 'Master',
        registration: 'UV90 WXY',
        status: 'Out of Service',
        lastServiceDate: Timestamp.fromDate(new Date('2024-12-18')),
        nextServiceDue: Timestamp.fromDate(new Date('2025-06-18')),
        mileage: 89650,
        fuelLevel: 10,
      },
      {
        id: 'v6',
        make: 'Peugeot',
        model: 'Boxer',
        registration: 'AB21 CDF',
        status: 'Available',
        lastServiceDate: Timestamp.fromDate(new Date('2025-02-10')),
        nextServiceDue: Timestamp.fromDate(new Date('2025-05-01')),
        mileage: 32450,
        fuelLevel: 90,
      },
      {
        id: 'v7',
        make: 'Citroen',
        model: 'Relay',
        registration: 'GH43 IJK',
        status: 'In Use',
        lastServiceDate: Timestamp.fromDate(new Date('2025-01-30')),
        nextServiceDue: Timestamp.fromDate(new Date('2025-07-30')),
        currentDriver: 'Michael Brown',
        currentJobId: 'j3',
        mileage: 41780,
        fuelLevel: 55,
      },
    ];
  }

  /**
   * Generate mock active jobs data
   */
  private generateMockActiveJobsData(): ActiveJob[] {
    return [
      {
        id: 'j1',
        reference: 'JOB-1234',
        status: 'Collected',
        customer: 'ABC Enterprises',
        address: '123 Main St, Belfast',
        driver: 'John Smith',
        vehicle: 'Ford Transit (AB12 CDE)',
        startTime: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 120)), // 2 hours ago
        estimatedCompletion: Timestamp.fromDate(
          new Date(Date.now() + 1000 * 60 * 60)
        ), // 1 hour from now
        progress: 70,
      },
      {
        id: 'j2',
        reference: 'JOB-1235',
        status: 'Allocated',
        customer: 'XYZ Industries',
        address: '456 Park Lane, Derry',
        driver: 'Sarah Johnson',
        vehicle: 'Iveco Daily (PQ78 RST)',
        startTime: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 30)), // 30 mins ago
        estimatedCompletion: Timestamp.fromDate(
          new Date(Date.now() + 1000 * 60 * 180)
        ), // 3 hours from now
        progress: 20,
      },
      {
        id: 'j3',
        reference: 'JOB-1236',
        status: 'Collected',
        customer: 'Global Logistics',
        address: '789 Oak Drive, Lisburn',
        driver: 'Michael Brown',
        vehicle: 'Citroen Relay (GH43 IJK)',
        startTime: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 90)), // 1.5 hours ago
        estimatedCompletion: Timestamp.fromDate(
          new Date(Date.now() + 1000 * 60 * 30)
        ), // 30 mins from now
        progress: 85,
      },
      {
        id: 'j4',
        reference: 'JOB-1237',
        status: 'Allocated',
        customer: 'Premier Supplies',
        address: '101 West Street, Bangor',
        driver: 'Emma Wilson',
        vehicle: 'Mercedes Sprinter (FG34 HIJ)',
        startTime: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 15)), // 15 mins ago
        estimatedCompletion: Timestamp.fromDate(
          new Date(Date.now() + 1000 * 60 * 120)
        ), // 2 hours from now
        progress: 5,
      },
    ];
  }

  /**
   * Generate mock alerts data
   */
  private generateMockAlertsData(): Alert[] {
    return [
      {
        id: 'a1',
        type: 'Urgent',
        message:
          'Vehicle KL56 MNO requires immediate maintenance - Engine fault detected',
        time: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 45)), // 45 mins ago
        relatedTo: 'v3',
        acknowledged: false,
      },
      {
        id: 'a2',
        type: 'Warning',
        message:
          'Job JOB-1234 is running behind schedule - ETA exceeded by 15 minutes',
        time: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 30)), // 30 mins ago
        relatedTo: 'j1',
        acknowledged: false,
      },
      {
        id: 'a3',
        type: 'Info',
        message: 'Driver Sarah Johnson has started job JOB-1235',
        time: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 20)), // 20 mins ago
        relatedTo: 'j2',
        acknowledged: true,
      },
      {
        id: 'a4',
        type: 'Warning',
        message: 'Vehicle UV90 WXY fuel level critically low (10%)',
        time: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60)), // 1 hour ago
        relatedTo: 'v5',
        acknowledged: false,
      },
    ];
  }

  /**
   * Get count of vehicles by status
   */
  getVehicleCountByStatus(status: string): number {
    return this.vehicles.filter((v) => v.status === status).length;
  }

  /**
   * Get count of jobs by status
   */
  getJobCountByStatus(status: string): number {
    return this.activeJobs.filter((j) => j.status === status).length;
  }

  /**
   * Get total active jobs
   */
  getTotalActiveJobs(): number {
    return this.activeJobs.length;
  }

  /**
   * Get count of delayed jobs
   */
  getDelayedJobsCount(): number {
    const now = new Date();
    return this.activeJobs.filter((job) => {
      // Check if current time is past the estimated completion time
      return now > job.estimatedCompletion.toDate() && job.progress < 100;
    }).length;
  }

  /**
   * Get CSS class for vehicle status
   */
  getVehicleStatusClass(status: string): string {
    return status.toLowerCase().replace(/\s+/g, '-');
  }

  /**
   * Get CSS class for fuel level
   */
  getFuelLevelClass(level: number): string {
    if (level < 20) {
      return 'low';
    } else if (level < 50) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Check if service is due soon (within 30 days)
   */
  isServiceDueSoon(nextServiceDue: Timestamp): boolean {
    const now = new Date();
    const serviceDueDate = nextServiceDue.toDate();
    const daysUntilService = Math.ceil(
      (serviceDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilService <= 30;
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: Timestamp): string {
    return timestamp.toDate().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Format alert time for display
   */
  formatAlertTime(timestamp: Timestamp): string {
    const now = new Date();
    const alertTime = timestamp.toDate();
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffMins < 1440) {
      // less than 24 hours
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      return alertTime.toLocaleDateString('en-GB');
    }
  }

  /**
   * Get count of urgent unacknowledged alerts
   */
  getUrgentAlertCount(): number {
    return this.alerts.filter((a) => a.type === 'Urgent' && !a.acknowledged)
      .length;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    // In a real app, this would update Firestore
    this.alerts = this.alerts.map((alert) => {
      if (alert.id === alertId) {
        return { ...alert, acknowledged: true };
      }
      return alert;
    });

    this.snackBar.open('Alert acknowledged', 'Close', {
      duration: 3000,
    });
  }

  /**
   * Update job status
   */
  updateJobStatus(jobId: string, newStatus: string): void {
    // In a real app, this would update Firestore
    this.activeJobs = this.activeJobs.map((job) => {
      if (job.id === jobId) {
        return { ...job, status: newStatus as any };
      }
      return job;
    });

    this.snackBar.open(`Job ${jobId} updated to ${newStatus}`, 'Close', {
      duration: 3000,
    });

    // If job is marked as delivered, remove it from active jobs
    if (newStatus === 'Delivered') {
      this.activeJobs = this.activeJobs.filter((job) => job.id !== jobId);
    }
  }
}
