import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { FormControl, FormGroup } from '@angular/forms';
import { JobService } from '../../../services/job.service';
import { AuthService } from '../../../services/auth.service';
import { Job } from '../../../interfaces/job.interface';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface JobFilters {
  status: string;
  driver: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

@Component({
  selector: 'app-job-list',
  templateUrl: './job-list.component.html',
  styleUrls: ['./job-list.component.scss'],
  standalone: false,
})
export class JobListComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = [
    'id',
    'regNumber',
    'make',
    'model',
    'collectionDate',
    'status',
    'driver',
    'actions',
  ];

  isLoading = false;
  dataSource = new MatTableDataSource<Job>([]);

  private subscriptions: Subscription[] = [];
  filterForm: FormGroup;
  searchControl = new FormControl('');

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  statusOptions = [
    'unallocated',
    'allocated',
    'collected',
    'delivered',
    'completed',
  ];
  drivers: string[] = [];
  driverMap: { [key: string]: string } = {};

  filters: JobFilters = {
    status: 'All',
    driver: 'All',
    dateRange: {
      start: null,
      end: null,
    },
  };

  constructor(
    private router: Router,
    private jobService: JobService,
    private authService: AuthService
  ) {
    this.filterForm = new FormGroup({
      status: new FormControl('All'),
      driver: new FormControl('All'),
      startDate: new FormControl(null),
      endDate: new FormControl(null),
    });
  }

  ngOnInit(): void {
    this.isLoading = true;

    // Initialize driver information
    this.loadDrivers();

    // Subscribe to jobs observable
    const jobsSub = this.jobService.jobs$.subscribe((jobs) => {
      this.dataSource.data = jobs;
      this.isLoading = false;
    });
    this.subscriptions.push(jobsSub);

    // Subscribe to loading state
    const loadingSub = this.jobService.loading$.subscribe(
      (loading) => (this.isLoading = loading)
    );
    this.subscriptions.push(loadingSub);

    // Load initial jobs data
    this.jobService.getDriverJobs().subscribe();

    // Setup filter form listeners
    this.setupFilterListeners();
  }

  private setupFilterListeners(): void {
    // Subscribe to search input changes
    const searchSub = this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => {
        this.applyFilter(value || '');
      });
    this.subscriptions.push(searchSub);

    // Subscribe to filter form changes
    const filterSub = this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
    this.subscriptions.push(filterSub);
  }

  private loadDrivers(): void {
    // Get all drivers from the users collection
    this.authService.getDrivers().subscribe((drivers) => {
      this.drivers = drivers.map((driver) => driver.name);

      // Create a map of driver IDs to names for display
      drivers.forEach((driver) => {
        this.driverMap[driver.id] = driver.name;
      });
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Job, filter: string) => {
      const searchStr = filter.toLowerCase();

      // Apply status filter
      if (
        this.filters.status !== 'All' &&
        data.status !== this.filters.status
      ) {
        return false;
      }

      // Apply driver filter
      if (
        this.filters.driver !== 'All' &&
        this.driverMap[data.driverId || ''] !== this.filters.driver
      ) {
        return false;
      }

      // Apply date range filter
      if (this.filters.dateRange.start && this.filters.dateRange.end) {
        const jobDate = new Date(data.createdAt);
        const startDate = new Date(this.filters.dateRange.start);
        const endDate = new Date(this.filters.dateRange.end);

        if (jobDate < startDate || jobDate > endDate) {
          return false;
        }
      }

      // Apply text search
      return (
        data.id?.toLowerCase().includes(searchStr) ||
        data.registration?.toLowerCase().includes(searchStr) ||
        data.make?.toLowerCase().includes(searchStr) ||
        data.model?.toLowerCase().includes(searchStr) ||
        this.driverMap[data.driverId || '']?.toLowerCase().includes(searchStr)
      );
    };
  }

  applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  applyFilters(): void {
    const formValues = this.filterForm.value;

    this.filters.status = formValues.status;
    this.filters.driver = formValues.driver;
    this.filters.dateRange.start = formValues.startDate;
    this.filters.dateRange.end = formValues.endDate;

    // This will trigger the filterPredicate function
    this.dataSource.filter = this.dataSource.filter || ' ';
  }

  getDriverName(driverId: string | null): string {
    if (!driverId) return 'Unassigned';
    return this.driverMap[driverId] || 'Unknown Driver';
  }

  formatCreationDate(date: Date | undefined): string {
    if (!date) return 'N/A';

    if (typeof date === 'string') {
      return new Date(date).toLocaleDateString();
    }

    // Handle Firebase Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
      const timestamp = date as unknown as { toDate: () => Date };
      return timestamp.toDate().toLocaleDateString();
    }

    return date.toLocaleDateString();
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      unallocated: 'status-unallocated',
      allocated: 'status-allocated',
      collected: 'status-collected',
      delivered: 'status-delivered',
      completed: 'status-completed',
    };
    return statusMap[status] || 'status-default';
  }

  createNewJob(): void {
    this.router.navigate(['/jobs/new']);
  }

  viewJobDetails(job: Job): void {
    this.router.navigate(['/jobs', job.id]);
  }

  editJob(job: Job, event: Event): void {
    event.stopPropagation(); // Prevent row click event
    this.router.navigate(['/jobs', job.id, 'edit']);
  }

  allocateJob(job: Job, event: Event): void {
    event.stopPropagation(); // Prevent row click event

    this.isLoading = true;
    this.jobService.allocateJob(job.id).subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error allocating job:', error);
        this.isLoading = false;
        // Handle error (show notification)
      },
    });
  }

  refreshJobs(): void {
    this.isLoading = true;
    this.jobService.getDriverJobs().subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }
}
