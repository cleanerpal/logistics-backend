import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule, MatTable } from '@angular/material/table';
import {
  MatPaginatorModule,
  MatPaginator,
  PageEvent,
} from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { FormControl, FormGroup } from '@angular/forms';

import {
  where,
  orderBy,
  limit,
  QueryConstraint,
} from '@angular/fire/firestore';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { AuditLogsService } from '../../../services/audit-logs.service';

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: Date;
  details: any;
  ipAddress?: string;
  resource?: string;
  resourceId?: string;
}

@Component({
  selector: 'app-audit-logs-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './audit-logs-list.component.html',
  styleUrls: ['./audit-logs-list.component.scss'],
})
export class AuditLogsListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTable) table!: MatTable<AuditLog>;

  displayedColumns: string[] = [
    'timestamp',
    'action',
    'userName',
    'resource',
    'details',
  ];
  dataSource: AuditLog[] = [];
  filteredData: AuditLog[] = [];

  isLoading = true;
  totalLogs = 0;
  pageSize = 50;
  pageSizeOptions = [10, 25, 50, 100];

  // Action types for filter
  actionTypes: string[] = [
    'UserCreated',
    'UserUpdated',
    'UserDeleted',
    'DriverCreated',
    'DriverUpdated',
    'DriverDeleted',
    'DriverHandover',
    'VehicleCreated',
    'VehicleUpdated',
    'VehicleDeleted',
    'JobCreated',
    'JobUpdated',
    'JobDeleted',
    'JobAssigned',
    'JobCompleted',
    'PaymentProcessed',
    'LoginSuccess',
    'LoginFailed',
  ];

  filterForm = new FormGroup({
    searchTerm: new FormControl(''),
    actionType: new FormControl(''),
    dateRange: new FormGroup({
      start: new FormControl<Date | null>(null),
      end: new FormControl<Date | null>(null),
    }),
  });

  private subscription = new Subscription();

  constructor(private auditLogsService: AuditLogsService) {}

  ngOnInit(): void {
    this.loadAuditLogs();

    // Subscribe to filter changes
    this.subscription.add(
      this.filterForm
        .get('searchTerm')!
        .valueChanges.pipe(debounceTime(300), distinctUntilChanged())
        .subscribe(() => this.applyFilters())
    );

    this.subscription.add(
      this.filterForm
        .get('actionType')!
        .valueChanges.subscribe(() => this.applyFilters())
    );

    this.subscription.add(
      this.filterForm
        .get('dateRange')!
        .valueChanges.subscribe(() => this.applyFilters())
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadAuditLogs(): void {
    this.isLoading = true;

    const constraints: QueryConstraint[] = [
      orderBy('timestamp', 'desc'),
      limit(this.pageSize),
    ];

    // Apply filters to query if they exist
    const actionType = this.filterForm.get('actionType')?.value;
    if (actionType) {
      constraints.push(where('action', '==', actionType));
    }

    const dateRange = this.filterForm.get('dateRange')?.value;
    if (dateRange?.start) {
      constraints.push(where('timestamp', '>=', dateRange.start));
    }
    if (dateRange?.end) {
      // Add one day to include the end date fully
      const endDate = new Date(dateRange.end);
      endDate.setDate(endDate.getDate() + 1);
      constraints.push(where('timestamp', '<', endDate));
    }

    this.subscription.add(
      this.auditLogsService.getAuditLogs(constraints).subscribe((logs) => {
        this.dataSource = logs;
        this.applyFilters();
        this.isLoading = false;
      })
    );
  }

  applyFilters(): void {
    let filtered = [...this.dataSource];
    const searchTerm = this.filterForm.get('searchTerm')?.value?.toLowerCase();

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.userName?.toLowerCase().includes(searchTerm) ||
          log.action?.toLowerCase().includes(searchTerm) ||
          log.resource?.toLowerCase().includes(searchTerm) ||
          (typeof log.details === 'string' &&
            log.details.toLowerCase().includes(searchTerm))
      );
    }

    this.filteredData = filtered;
    this.totalLogs = this.filteredData.length;

    // Reset paginator when filters change
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  resetFilters(): void {
    this.filterForm.reset();
    this.loadAuditLogs();
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.loadAuditLogs();
  }

  formatDetails(details: any): string {
    if (!details) return 'No details available';

    if (typeof details === 'object') {
      try {
        return JSON.stringify(details, null, 2);
      } catch (e) {
        return 'Error formatting details';
      }
    }

    return details.toString();
  }

  exportToCsv(): void {
    const headers = ['Timestamp', 'Action', 'User', 'Resource', 'Details'];

    const csvData = this.filteredData.map((log) => [
      log.timestamp.toLocaleString(),
      log.action,
      log.userName,
      log.resource || '',
      typeof log.details === 'object'
        ? JSON.stringify(log.details)
        : log.details || '',
    ]);

    // Add headers
    csvData.unshift(headers);

    // Convert to CSV format
    const csvContent = csvData
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
