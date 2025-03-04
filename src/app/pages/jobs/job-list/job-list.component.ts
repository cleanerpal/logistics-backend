// job-list.component.ts
import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { DatePipe } from '@angular/common';

interface Job {
  id: string;
  creationDate: Date;
  customerName: string;
  vehicle: string;
  collectionAddress: string;
  deliveryAddress: string;
  status: JobStatus;
  driver: string;
}

type JobStatus =
  | 'loaded'
  | 'allocated'
  | 'collected'
  | 'delivered'
  | 'aborted'
  | 'cancelled';

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
  providers: [DatePipe],
})
export class JobListComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'id',
    'creationDate',
    'customerName',
    'vehicle',
    'collectionAddress',
    'deliveryAddress',
    'status',
    'driver',
    'actions',
  ];

  isLoading = false;
  dataSource = new MatTableDataSource<Job>([]);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  statusOptions = [
    'All',
    'Loaded',
    'Allocated',
    'Collected',
    'Delivered',
    'Aborted',
    'Cancelled',
  ];
  drivers = ['All', 'John Doe', 'Jane Smith', 'Mike Johnson'];

  filters: JobFilters = {
    status: 'All',
    driver: 'All',
    dateRange: {
      start: null,
      end: null,
    },
  };

  constructor(private router: Router, private datePipe: DatePipe) {}

  ngOnInit(): void {
    this.loadJobs();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Job, filter: string) => {
      const searchStr = filter.toLowerCase();

      // Apply status filter
      if (
        this.filters.status !== 'All' &&
        data.status !== this.filters.status.toLowerCase().replace(' ', '-')
      ) {
        return false;
      }

      // Apply driver filter
      if (
        this.filters.driver !== 'All' &&
        data.driver !== this.filters.driver
      ) {
        return false;
      }

      // Apply date range filter
      if (this.filters.dateRange.start && this.filters.dateRange.end) {
        const jobDate = new Date(data.creationDate);
        const startDate = new Date(this.filters.dateRange.start);
        const endDate = new Date(this.filters.dateRange.end);

        if (jobDate < startDate || jobDate > endDate) {
          return false;
        }
      }

      // Apply text search
      return (
        data.id.toLowerCase().includes(searchStr) ||
        data.customerName.toLowerCase().includes(searchStr) ||
        data.collectionAddress.toLowerCase().includes(searchStr) ||
        data.deliveryAddress.toLowerCase().includes(searchStr)
      );
    };
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  applyFilters(): void {
    this.dataSource.filter = this.dataSource.filter || ' '; // Trigger filter refresh
  }

  loadJobs(): void {
    this.isLoading = true;

    // Simulate API call with dummy data
    setTimeout(() => {
      const mockJobs: Job[] = Array(25)
        .fill(null)
        .map((_, index) => ({
          id: `JOB${String(index + 1).padStart(4, '0')}`,
          creationDate: new Date(2024, 0, index + 1),
          customerName: `Customer ${index + 1}`,
          vehicle: `Vehicle ${index + 1}`,
          collectionAddress: `${index + 1} Collection St`,
          deliveryAddress: `${index + 1} Delivery Ave`,
          status: this.getRandomStatus(),
          driver:
            this.drivers[
              Math.floor(Math.random() * (this.drivers.length - 1)) + 1
            ],
        }));

      this.dataSource.data = mockJobs;
      this.isLoading = false;
    }, 1000);
  }

  private getRandomStatus(): JobStatus {
    const statuses: JobStatus[] = [
      'loaded',
      'allocated',
      'collected',
      'delivered',
      'aborted',
      'cancelled',
    ];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  createNewJob(): void {
    this.router.navigate(['/jobs/new']);
  }

  viewJobDetails(job: Job): void {
    this.router.navigate(['/jobs', job.id]);
  }

  editJob(job: Job): void {
    this.router.navigate(['/jobs', job.id, 'edit']);
  }
}
