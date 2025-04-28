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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterModule } from '@angular/router';
import { Chart, ChartConfiguration } from 'chart.js';

// Firebase imports
import { Firestore, Timestamp } from '@angular/fire/firestore';

// Models
interface Revenue {
  id: string;
  amount: number;
  date: Timestamp;
  source: string;
  jobId?: string;
  description: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

interface Expense {
  id: string;
  amount: number;
  date: Timestamp;
  category: string;
  description: string;
  payee: string;
  status: 'Pending' | 'Paid';
}

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  pendingRevenue: number;
  overdueRevenue: number;
  pendingExpenses: number;
}

@Component({
  selector: 'app-financial',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatSortModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  template: `
    <div class="financial-container">
      <h1 class="page-title">Financial Dashboard</h1>

      <!-- Period selector -->
      <mat-card class="period-selector-card">
        <mat-card-content>
          <mat-form-field appearance="outline">
            <mat-label>Period</mat-label>
            <mat-select
              [formControl]="periodControl"
              (selectionChange)="onPeriodChanged()"
            >
              <mat-option value="thisMonth">This Month</mat-option>
              <mat-option value="lastMonth">Last Month</mat-option>
              <mat-option value="thisQuarter">This Quarter</mat-option>
              <mat-option value="lastQuarter">Last Quarter</mat-option>
              <mat-option value="thisYear">This Year</mat-option>
              <mat-option value="lastYear">Last Year</mat-option>
            </mat-select>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <!-- Loading spinner -->
      <div class="loading-container" *ngIf="loading">
        <mat-spinner diameter="50"></mat-spinner>
      </div>

      <!-- Financial content -->
      <div class="financial-content" *ngIf="!loading">
        <!-- Financial summary cards -->
        <div class="summary-cards">
          <mat-card class="summary-card">
            <mat-card-content>
              <div class="summary-icon revenue">
                <mat-icon>trending_up</mat-icon>
              </div>
              <div class="summary-details">
                <div class="summary-label">Total Revenue</div>
                <div class="summary-value">
                  £{{ summary.totalRevenue | number : '1.2-2' }}
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-content>
              <div class="summary-icon expenses">
                <mat-icon>trending_down</mat-icon>
              </div>
              <div class="summary-details">
                <div class="summary-label">Total Expenses</div>
                <div class="summary-value">
                  £{{ summary.totalExpenses | number : '1.2-2' }}
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-content>
              <div
                class="summary-icon"
                [ngClass]="summary.netIncome >= 0 ? 'profit' : 'loss'"
              >
                <mat-icon>{{
                  summary.netIncome >= 0 ? 'account_balance' : 'warning'
                }}</mat-icon>
              </div>
              <div class="summary-details">
                <div class="summary-label">Net Income</div>
                <div
                  class="summary-value"
                  [ngClass]="
                    summary.netIncome >= 0 ? 'profit-text' : 'loss-text'
                  "
                >
                  £{{ summary.netIncome | number : '1.2-2' }}
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-content>
              <div class="summary-icon pending">
                <mat-icon>schedule</mat-icon>
              </div>
              <div class="summary-details">
                <div class="summary-label">Pending Revenue</div>
                <div class="summary-value">
                  £{{ summary.pendingRevenue | number : '1.2-2' }}
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-content>
              <div class="summary-icon overdue">
                <mat-icon>error_outline</mat-icon>
              </div>
              <div class="summary-details">
                <div class="summary-label">Overdue Revenue</div>
                <div class="summary-value">
                  £{{ summary.overdueRevenue | number : '1.2-2' }}
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="summary-card">
            <mat-card-content>
              <div class="summary-icon pending-expense">
                <mat-icon>watch_later</mat-icon>
              </div>
              <div class="summary-details">
                <div class="summary-label">Pending Expenses</div>
                <div class="summary-value">
                  £{{ summary.pendingExpenses | number : '1.2-2' }}
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Financial Charts -->
        <div class="charts-row">
          <mat-card class="chart-card">
            <mat-card-header>
              <mat-card-title>Revenue vs Expenses</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="chart-container">
                <canvas #revenueExpensesChart></canvas>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="chart-card">
            <mat-card-header>
              <mat-card-title>Revenue by Source</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="chart-container">
                <canvas #revenueSourceChart></canvas>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="chart-card">
            <mat-card-header>
              <mat-card-title>Expenses by Category</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="chart-container">
                <canvas #expenseCategoryChart></canvas>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Recent Transactions -->
        <mat-card class="transactions-card">
          <mat-card-header>
            <mat-card-title>Recent Transactions</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-tab-group animationDuration="200ms">
              <!-- Recent Revenue Tab -->
              <mat-tab label="Revenue">
                <div class="table-container">
                  <table mat-table [dataSource]="recentRevenue" matSort>
                    <!-- Date Column -->
                    <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Date
                      </th>
                      <td mat-cell *matCellDef="let item">
                        {{ formatDate(item.date) }}
                      </td>
                    </ng-container>

                    <!-- Description Column -->
                    <ng-container matColumnDef="description">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Description
                      </th>
                      <td mat-cell *matCellDef="let item">
                        {{ item.description }}
                      </td>
                    </ng-container>

                    <!-- Source Column -->
                    <ng-container matColumnDef="source">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Source
                      </th>
                      <td mat-cell *matCellDef="let item">{{ item.source }}</td>
                    </ng-container>

                    <!-- Status Column -->
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Status
                      </th>
                      <td mat-cell *matCellDef="let item">
                        <span
                          class="status-badge"
                          [ngClass]="item.status.toLowerCase()"
                        >
                          {{ item.status }}
                        </span>
                      </td>
                    </ng-container>

                    <!-- Amount Column -->
                    <ng-container matColumnDef="amount">
                      <th
                        mat-header-cell
                        *matHeaderCellDef
                        mat-sort-header
                        class="amount-column"
                      >
                        Amount
                      </th>
                      <td mat-cell *matCellDef="let item" class="amount-column">
                        £{{ item.amount | number : '1.2-2' }}
                      </td>
                    </ng-container>

                    <!-- Actions Column -->
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let item">
                        <button mat-icon-button [matMenuTriggerFor]="menu">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #menu="matMenu">
                          <button mat-menu-item (click)="viewInvoice(item.id)">
                            <mat-icon>visibility</mat-icon>
                            <span>View Invoice</span>
                          </button>
                          <button
                            mat-menu-item
                            *ngIf="item.status !== 'Paid'"
                            (click)="markAsPaid(item.id, 'revenue')"
                          >
                            <mat-icon>check_circle</mat-icon>
                            <span>Mark as Paid</span>
                          </button>
                          <button
                            mat-menu-item
                            *ngIf="item.jobId"
                            [routerLink]="['/jobs', item.jobId]"
                          >
                            <mat-icon>work</mat-icon>
                            <span>View Related Job</span>
                          </button>
                        </mat-menu>
                      </td>
                    </ng-container>

                    <!-- Row definitions -->
                    <tr mat-header-row *matHeaderRowDef="revenueColumns"></tr>
                    <tr
                      mat-row
                      *matRowDef="let row; columns: revenueColumns"
                    ></tr>
                  </table>
                </div>
              </mat-tab>

              <!-- Recent Expenses Tab -->
              <mat-tab label="Expenses">
                <div class="table-container">
                  <table mat-table [dataSource]="recentExpenses" matSort>
                    <!-- Date Column -->
                    <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Date
                      </th>
                      <td mat-cell *matCellDef="let item">
                        {{ formatDate(item.date) }}
                      </td>
                    </ng-container>

                    <!-- Description Column -->
                    <ng-container matColumnDef="description">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Description
                      </th>
                      <td mat-cell *matCellDef="let item">
                        {{ item.description }}
                      </td>
                    </ng-container>

                    <!-- Category Column -->
                    <ng-container matColumnDef="category">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Category
                      </th>
                      <td mat-cell *matCellDef="let item">
                        {{ item.category }}
                      </td>
                    </ng-container>

                    <!-- Payee Column -->
                    <ng-container matColumnDef="payee">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Payee
                      </th>
                      <td mat-cell *matCellDef="let item">{{ item.payee }}</td>
                    </ng-container>

                    <!-- Status Column -->
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef mat-sort-header>
                        Status
                      </th>
                      <td mat-cell *matCellDef="let item">
                        <span
                          class="status-badge"
                          [ngClass]="item.status.toLowerCase()"
                        >
                          {{ item.status }}
                        </span>
                      </td>
                    </ng-container>

                    <!-- Amount Column -->
                    <ng-container matColumnDef="amount">
                      <th
                        mat-header-cell
                        *matHeaderCellDef
                        mat-sort-header
                        class="amount-column"
                      >
                        Amount
                      </th>
                      <td mat-cell *matCellDef="let item" class="amount-column">
                        £{{ item.amount | number : '1.2-2' }}
                      </td>
                    </ng-container>

                    <!-- Actions Column -->
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let item">
                        <button mat-icon-button [matMenuTriggerFor]="menu">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #menu="matMenu">
                          <button mat-menu-item (click)="viewExpense(item.id)">
                            <mat-icon>visibility</mat-icon>
                            <span>View Details</span>
                          </button>
                          <button
                            mat-menu-item
                            *ngIf="item.status !== 'Paid'"
                            (click)="markAsPaid(item.id, 'expense')"
                          >
                            <mat-icon>check_circle</mat-icon>
                            <span>Mark as Paid</span>
                          </button>
                        </mat-menu>
                      </td>
                    </ng-container>

                    <!-- Row definitions -->
                    <tr mat-header-row *matHeaderRowDef="expenseColumns"></tr>
                    <tr
                      mat-row
                      *matRowDef="let row; columns: expenseColumns"
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
      .financial-container {
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

      .period-selector-card {
        margin-bottom: 24px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

        .mat-mdc-card-content {
          padding: 16px;
          display: flex;
          justify-content: flex-end;
        }

        .mat-mdc-form-field {
          width: 200px;
        }
      }

      .financial-content {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 16px;
      }

      .summary-card {
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);

        .mat-mdc-card-content {
          padding: 16px;
          display: flex;
          align-items: center;
        }
      }

      .summary-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 16px;

        .mat-icon {
          color: white;
        }

        &.revenue {
          background-color: #4caf50;
        }

        &.expenses {
          background-color: #f44336;
        }

        &.profit {
          background-color: #4caf50;
        }

        &.loss {
          background-color: #f44336;
        }

        &.pending {
          background-color: #ffc107;
        }

        &.overdue {
          background-color: #ff5722;
        }

        &.pending-expense {
          background-color: #2196f3;
        }
      }

      .summary-details {
        flex: 1;
      }

      .summary-label {
        font-size: 14px;
        color: #666666;
        margin-bottom: 4px;
      }

      .summary-value {
        font-size: 24px;
        font-weight: 500;
        color: #4a3c31;

        &.profit-text {
          color: #4caf50;
        }

        &.loss-text {
          color: #f44336;
        }
      }

      .charts-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 24px;

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
        }
      }

      .chart-card {
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

        .chart-container {
          height: 300px;
          position: relative;
        }
      }

      .transactions-card {
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
        margin-top: 16px;

        table {
          width: 100%;
        }

        .mat-mdc-header-cell {
          font-weight: 500;
          color: #4a3c31;
        }

        .amount-column {
          text-align: right;
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

        &.paid {
          background-color: #4caf50;
          color: white;
        }

        &.pending {
          background-color: #ffc107;
          color: #333333;
        }

        &.overdue {
          background-color: #f44336;
          color: white;
        }
      }
    `,
  ],
})
export class FinancialComponent implements OnInit, AfterViewInit, OnDestroy {
  private firestore: Firestore = inject(Firestore);
  private snackBar: MatSnackBar = inject(MatSnackBar);

  @ViewChild('revenueExpensesChart')
  revenueExpensesChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('revenueSourceChart')
  revenueSourceChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('expenseCategoryChart')
  expenseCategoryChartRef!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];
  loading = true;

  // Data collections
  recentRevenue: Revenue[] = [];
  recentExpenses: Expense[] = [];

  // Period control
  periodControl = new FormControl('thisMonth');

  // Table columns
  revenueColumns: string[] = [
    'date',
    'description',
    'source',
    'status',
    'amount',
    'actions',
  ];
  expenseColumns: string[] = [
    'date',
    'description',
    'category',
    'payee',
    'status',
    'amount',
    'actions',
  ];

  // Financial summary
  summary: FinancialSummary = {
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    pendingRevenue: 0,
    overdueRevenue: 0,
    pendingExpenses: 0,
  };

  ngOnInit(): void {
    this.loadFinancialData();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initializeCharts();
    }, 100);
  }

  ngOnDestroy(): void {
    // Clean up charts when component is destroyed
    this.charts.forEach((chart) => chart.destroy());
  }

  onPeriodChanged(): void {
    this.loadFinancialData();
  }

  async loadFinancialData(): Promise<void> {
    this.loading = true;

    try {
      // For demonstration purposes, using mock data
      // In a real app, you would fetch this from Firestore based on the selected period
      this.recentRevenue = this.generateMockRevenueData();
      this.recentExpenses = this.generateMockExpenseData();

      this.calculateFinancialSummary();
      this.updateCharts();

      this.loading = false;
    } catch (error) {
      console.error('Error loading financial data:', error);
      this.snackBar.open(
        'Error loading financial data. Please try again.',
        'Close',
        {
          duration: 5000,
        }
      );
      this.loading = false;
    }
  }

  /**
   * Generate mock revenue data
   */
  private generateMockRevenueData(): Revenue[] {
    return [
      {
        id: 'r1',
        amount: 1250.5,
        date: Timestamp.fromDate(new Date('2025-04-15')),
        source: 'Corporate',
        jobId: 'j1',
        description: 'Vehicle delivery service - ABC Enterprises',
        status: 'Paid',
      },
      {
        id: 'r2',
        amount: 780.0,
        date: Timestamp.fromDate(new Date('2025-04-18')),
        source: 'Small Business',
        jobId: 'j2',
        description: 'Transport service - XYZ Industries',
        status: 'Pending',
      },
      {
        id: 'r3',
        amount: 950.75,
        date: Timestamp.fromDate(new Date('2025-04-10')),
        source: 'Corporate',
        jobId: 'j3',
        description: 'Logistics service - Global Logistics',
        status: 'Paid',
      },
      {
        id: 'r4',
        amount: 550.25,
        date: Timestamp.fromDate(new Date('2025-04-05')),
        source: 'Small Business',
        jobId: 'j4',
        description: 'Vehicle delivery - Premier Supplies',
        status: 'Overdue',
      },
      {
        id: 'r5',
        amount: 1800.0,
        date: Timestamp.fromDate(new Date('2025-04-20')),
        source: 'Corporate',
        description: 'Monthly service contract - Tech Solutions Ltd',
        status: 'Pending',
      },
      {
        id: 'r6',
        amount: 450.5,
        date: Timestamp.fromDate(new Date('2025-04-22')),
        source: 'Individual',
        jobId: 'j5',
        description: 'Vehicle relocation service',
        status: 'Paid',
      },
    ];
  }

  /**
   * Generate mock expense data
   */
  private generateMockExpenseData(): Expense[] {
    return [
      {
        id: 'e1',
        amount: 850.0,
        date: Timestamp.fromDate(new Date('2025-04-05')),
        category: 'Fuel',
        description: 'Monthly fuel expenses for fleet',
        payee: 'Northern Fuel Services',
        status: 'Paid',
      },
      {
        id: 'e2',
        amount: 350.25,
        date: Timestamp.fromDate(new Date('2025-04-12')),
        category: 'Maintenance',
        description: 'Regular vehicle maintenance',
        payee: 'Auto Repair Center',
        status: 'Paid',
      },
      {
        id: 'e3',
        amount: 1200.0,
        date: Timestamp.fromDate(new Date('2025-04-15')),
        category: 'Insurance',
        description: 'Monthly fleet insurance premium',
        payee: 'SafeGuard Insurance',
        status: 'Paid',
      },
      {
        id: 'e4',
        amount: 275.5,
        date: Timestamp.fromDate(new Date('2025-04-18')),
        category: 'Office Supplies',
        description: 'Office supplies and stationery',
        payee: 'Office World',
        status: 'Pending',
      },
      {
        id: 'e5',
        amount: 620.75,
        date: Timestamp.fromDate(new Date('2025-04-25')),
        category: 'Maintenance',
        description: 'Emergency repair - Ford Transit',
        payee: 'Auto Repair Center',
        status: 'Pending',
      },
    ];
  }

  /**
   * Calculate financial summary
   */
  private calculateFinancialSummary(): void {
    // Calculate total revenue
    this.summary.totalRevenue = this.recentRevenue.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    // Calculate total expenses
    this.summary.totalExpenses = this.recentExpenses.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    // Calculate net income
    this.summary.netIncome =
      this.summary.totalRevenue - this.summary.totalExpenses;

    // Calculate pending revenue
    this.summary.pendingRevenue = this.recentRevenue
      .filter((item) => item.status === 'Pending')
      .reduce((sum, item) => sum + item.amount, 0);

    // Calculate overdue revenue
    this.summary.overdueRevenue = this.recentRevenue
      .filter((item) => item.status === 'Overdue')
      .reduce((sum, item) => sum + item.amount, 0);

    // Calculate pending expenses
    this.summary.pendingExpenses = this.recentExpenses
      .filter((item) => item.status === 'Pending')
      .reduce((sum, item) => sum + item.amount, 0);
  }

  /**
   * Initialize charts
   */
  private initializeCharts(): void {
    this.initRevenueExpensesChart();
    this.initRevenueSourceChart();
    this.initExpenseCategoryChart();
  }

  /**
   * Initialize revenue vs expenses chart
   */
  private initRevenueExpensesChart(): void {
    if (!this.revenueExpensesChartRef) return;

    const ctx = this.revenueExpensesChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Group data by month
    const monthLabels = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const currentMonth = new Date().getMonth();

    // Use last 6 months
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      labels.push(monthLabels[monthIndex]);
    }

    // Mock data for demonstration
    const data = {
      labels: labels,
      datasets: [
        {
          label: 'Revenue',
          data: [4500, 5200, 4800, 6000, 5500, 5800],
          backgroundColor: 'rgba(76, 175, 80, 0.5)',
          borderColor: '#4CAF50',
          borderWidth: 2,
        },
        {
          label: 'Expenses',
          data: [3200, 3800, 3500, 4200, 3900, 4100],
          backgroundColor: 'rgba(244, 67, 54, 0.5)',
          borderColor: '#F44336',
          borderWidth: 2,
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
              text: 'Amount (£)',
            },
          },
          x: {
            title: {
              display: true,
              text: 'Month',
            },
          },
        },
      },
    };

    const chart = new Chart(ctx, config);
    this.charts.push(chart);
  }

  /**
   * Initialize revenue by source chart
   */
  private initRevenueSourceChart(): void {
    if (!this.revenueSourceChartRef) return;

    const ctx = this.revenueSourceChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Group revenue by source
    const sourceGroups = new Map<string, number>();

    this.recentRevenue.forEach((item) => {
      const currentAmount = sourceGroups.get(item.source) || 0;
      sourceGroups.set(item.source, currentAmount + item.amount);
    });

    const data = {
      labels: Array.from(sourceGroups.keys()),
      datasets: [
        {
          data: Array.from(sourceGroups.values()),
          backgroundColor: ['#C19A6B', '#4A3C31', '#333333', '#795548'],
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
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw as number;
                const total = context.dataset.data.reduce(
                  (a: any, b: any) => a + b,
                  0
                );
                const percentage = Math.round((value / total) * 100);
                return `${label}: £${value.toFixed(2)} (${percentage}%)`;
              },
            },
          },
        },
      },
    };

    const chart = new Chart(ctx, config);
    this.charts.push(chart);
  }

  /**
   * Initialize expense by category chart
   */
  private initExpenseCategoryChart(): void {
    if (!this.expenseCategoryChartRef) return;

    const ctx = this.expenseCategoryChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Group expenses by category
    const categoryGroups = new Map<string, number>();

    this.recentExpenses.forEach((item) => {
      const currentAmount = categoryGroups.get(item.category) || 0;
      categoryGroups.set(item.category, currentAmount + item.amount);
    });

    const data = {
      labels: Array.from(categoryGroups.keys()),
      datasets: [
        {
          data: Array.from(categoryGroups.values()),
          backgroundColor: [
            '#F44336',
            '#2196F3',
            '#FFC107',
            '#4CAF50',
            '#9C27B0',
          ],
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
                const total = context.dataset.data.reduce(
                  (a: any, b: any) => a + b,
                  0
                );
                const percentage = Math.round((value / total) * 100);
                return `${label}: £${value.toFixed(2)} (${percentage}%)`;
              },
            },
          },
        },
      },
    };

    const chart = new Chart(ctx, config);
    this.charts.push(chart);
  }

  /**
   * Update charts with new data
   */
  private updateCharts(): void {
    // In a real app, you would update the chart data here
    this.charts.forEach((chart) => chart.update());
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
   * View invoice details
   */
  viewInvoice(id: string): void {
    // In a real app, you would navigate to invoice details page
    this.snackBar.open(`Viewing invoice ${id}`, 'Close', {
      duration: 3000,
    });
  }

  /**
   * View expense details
   */
  viewExpense(id: string): void {
    // In a real app, you would navigate to expense details page
    this.snackBar.open(`Viewing expense ${id}`, 'Close', {
      duration: 3000,
    });
  }

  /**
   * Mark item as paid
   */
  markAsPaid(id: string, type: 'revenue' | 'expense'): void {
    // In a real app, you would update the item status in Firestore
    if (type === 'revenue') {
      this.recentRevenue = this.recentRevenue.map((item) => {
        if (item.id === id) {
          return { ...item, status: 'Paid' };
        }
        return item;
      });

      this.snackBar.open(`Revenue item ${id} marked as paid`, 'Close', {
        duration: 3000,
      });
    } else {
      this.recentExpenses = this.recentExpenses.map((item) => {
        if (item.id === id) {
          return { ...item, status: 'Paid' };
        }
        return item;
      });

      this.snackBar.open(`Expense item ${id} marked as paid`, 'Close', {
        duration: 3000,
      });
    }

    // Recalculate summary
    this.calculateFinancialSummary();
  }
}
