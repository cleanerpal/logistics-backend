import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { Subject, combineLatest } from 'rxjs';
import { debounceTime, startWith, takeUntil } from 'rxjs/operators';

import { Job } from '../../../interfaces/job-new.interface';
import { UserProfile } from '../../../interfaces/user-profile.interface';
import { AuthService } from '../../../services/auth.service';
import { JobNewService } from '../../../services/job-new.service';

@Component({
  selector: 'app-job-list',
  templateUrl: './job-list.component.html',
  styleUrls: ['./job-list.component.scss'],
  standalone: false,
})
export class JobListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = [
    'shippingReference',
    'vehicleRegistration',
    'vehicleMake',
    'vehicleModel',
    'customerName',
    'status',
    'collectionScheduledTime',
    'driverName',
  ];

  dataSource = new MatTableDataSource<Job>();
  loading = false;
  error: string | null = null;

  currentUser: UserProfile | null = null;
  canCreateJobs = false;
  canEditJobs = false;
  canManageJobs = false;

  searchControl = new FormControl('');
  statusFilter = new FormControl('all');
  dateRangeFilter = new FormControl('all');
  driverFilter = new FormControl('all');

  statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'unallocated', label: 'Unallocated' },
    { value: 'allocated', label: 'Allocated' },
    { value: 'collection-in-progress', label: 'Collection In Progress' },
    { value: 'collected', label: 'Collected' },
    { value: 'loaded', label: 'Loaded' },
    { value: 'in-transit', label: 'In Transit' },
    { value: 'delivery-in-progress', label: 'Delivery In Progress' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'aborted', label: 'Aborted' },
  ];

  dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
  ];

  private destroy$ = new Subject<void>();

  constructor(private jobService: JobNewService, private authService: AuthService, private router: Router, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.initializePermissions();
    this.setupFilters();
    this.loadJobs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializePermissions(): void {
    this.authService
      .getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        this.canCreateJobs = user?.permissions?.canCreateJobs || user?.permissions?.isAdmin || false;
        this.canEditJobs = user?.permissions?.canEditJobs || user?.permissions?.isAdmin || false;
        this.canManageJobs = user?.permissions?.canManageUsers || user?.permissions?.isAdmin || false;
      });
  }

  private setupFilters(): void {
    combineLatest([
      this.searchControl.valueChanges.pipe(startWith('')),
      this.statusFilter.valueChanges.pipe(startWith('all')),
      this.dateRangeFilter.valueChanges.pipe(startWith('all')),
      this.driverFilter.valueChanges.pipe(startWith('all')),
    ])
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  private loadJobs(): void {
    this.loading = true;
    this.error = null;

    this.jobService
      .getRecentJobs(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (jobs) => {
          this.dataSource.data = jobs;
          this.dataSource.paginator = this.paginator;
          this.dataSource.sort = this.sort;
          this.setupCustomSorting();
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading jobs:', error);
          this.error = 'Failed to load jobs. Please try again.';
          this.loading = false;
        },
      });
  }

  private setupCustomSorting(): void {
    this.dataSource.sortingDataAccessor = (item: Job, property: string) => {
      switch (property) {
        case 'createdAt':
          return item.createdAt?.toDate() || new Date(0);
        case 'collectionScheduledTime':
          return item.collectionScheduledTime?.toDate() || new Date(0);
        case 'deliveryScheduledTime':
          return item.deliveryScheduledTime?.toDate() || new Date(0);
        case 'vehicleRegistration':
          return item.vehicleRegistration || '';
        case 'vehicleMake':
          return item.vehicleMake || '';
        case 'vehicleModel':
          return item.vehicleModel || '';
        case 'customerName':
          return item.customerName || '';
        case 'status':
          return item.status || '';
        default:
          return (item as any)[property] || '';
      }
    };
  }

  private applyFilters(): void {
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    const statusFilter = this.statusFilter.value || 'all';
    const dateFilter = this.dateRangeFilter.value || 'all';
    const driverFilter = this.driverFilter.value || 'all';

    this.dataSource.filterPredicate = (data: Job) => {
      const matchesSearch =
        !searchTerm ||
        data.vehicleRegistration?.toLowerCase().includes(searchTerm) ||
        data.vehicleMake?.toLowerCase().includes(searchTerm) ||
        data.vehicleModel?.toLowerCase().includes(searchTerm) ||
        data.customerName?.toLowerCase().includes(searchTerm) ||
        data.collectionAddress?.toLowerCase().includes(searchTerm) ||
        data.deliveryAddress?.toLowerCase().includes(searchTerm) ||
        data.id.toLowerCase().includes(searchTerm);

      const matchesStatus = statusFilter === 'all' || data.status === statusFilter;

      const matchesDriver = driverFilter === 'all' || (driverFilter === 'unassigned' && !data.driverId) || data.driverId === driverFilter;

      const matchesDate = this.matchesDateFilter(data, dateFilter);

      return matchesSearch && matchesStatus && matchesDriver && matchesDate;
    };

    this.dataSource.filter = 'trigger'; // Trigger filter
  }

  private matchesDateFilter(job: Job, dateFilter: string): boolean {
    if (dateFilter === 'all') return true;

    const jobDate = job.collectionScheduledTime?.toDate() || job.createdAt?.toDate();
    if (!jobDate) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    switch (dateFilter) {
      case 'today':
        return jobDate >= today;
      case 'yesterday':
        return jobDate >= yesterday && jobDate < today;
      case 'thisWeek':
        const startOfWeek = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
        return jobDate >= startOfWeek;
      case 'lastWeek':
        const startOfLastWeek = new Date(today.getTime() - (today.getDay() + 7) * 24 * 60 * 60 * 1000);
        const endOfLastWeek = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
        return jobDate >= startOfLastWeek && jobDate < endOfLastWeek;
      case 'thisMonth':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return jobDate >= startOfMonth;
      case 'lastMonth':
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return jobDate >= startOfLastMonth && jobDate < endOfLastMonth;
      default:
        return true;
    }
  }

  createJob(): void {
    if (this.canCreateJobs) {
      this.router.navigate(['/jobs/new']);
    }
  }

  viewJob(job: Job): void {
    this.router.navigate(['/jobs', job.id]);
  }

  editJob(job: Job): void {
    if (this.canEditJobs) {
      this.router.navigate(['/jobs', job.id, 'edit']);
    }
  }

  refresh(): void {
    this.loadJobs();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusFilter.setValue('all');
    this.dateRangeFilter.setValue('all');
    this.driverFilter.setValue('all');
  }

  exportJobs(): void {}

  getStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      unallocated: 'warning',
      allocated: 'secondary',
      'collection-in-progress': 'tertiary',
      collected: 'success',
      loaded: 'primary',
      'in-transit': 'primary',
      'delivery-in-progress': 'tertiary',
      delivered: 'success',
      completed: 'success',
      cancelled: 'danger',
      aborted: 'danger',
    };
    return statusColors[status] || 'medium';
  }

  getStatusIcon(status: string): string {
    const statusIcons: { [key: string]: string } = {
      unallocated: 'help-circle',
      allocated: 'person',
      'collection-in-progress': 'car',
      collected: 'checkmark-circle',
      loaded: 'cube',
      'in-transit': 'airplane',
      'delivery-in-progress': 'car',
      delivered: 'checkmark-circle-outline',
      completed: 'checkmark-done',
      cancelled: 'close-circle',
      aborted: 'warning',
    };
    return statusIcons[status] || 'ellipse';
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatAddress(address: string | null | undefined): string {
    if (!address) return '-';
    return address.length > 30 ? address.substring(0, 30) + '...' : address;
  }
}
