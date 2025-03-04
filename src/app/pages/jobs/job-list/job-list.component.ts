// job-list.component.ts
import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { DatePipe } from '@angular/common';
import { JobStatus } from '../../../shared/models/job-status.enum';

interface Job {
  id: string;
  regNumber: string;
  customerName: string;
  collectionDate: Date;
  collectionTown: string;
  deliveryTown: string;
  status: JobStatus;
  driver: string;
  shippingRef?: string;
  notes?: string;
}

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
    'regNumber',
    'customerName',
    'collectionDate',
    'collectionTown',
    'deliveryTown',
    'status',
    'driver',
    'actions',
  ];

  isLoading = false;
  dataSource = new MatTableDataSource<Job>([]);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  statusOptions = Object.values(JobStatus);
  drivers = ['John Doe', 'Jane Smith', 'Mike Johnson'];

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
        data.status !== this.filters.status
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
        const jobDate = new Date(data.collectionDate);
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
        data.collectionTown.toLowerCase().includes(searchStr) ||
        data.deliveryTown.toLowerCase().includes(searchStr) ||
        data.regNumber.toLowerCase().includes(searchStr)
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
          regNumber: this.generateRandomRegNumber(),
          customerName: `Customer ${index + 1}`,
          collectionDate: new Date(2024, 0, index + 1),
          collectionTown: `Collection Town ${(index % 10) + 1}`,
          deliveryTown: `Delivery Town ${(index % 8) + 1}`,
          status: this.getRandomStatus(),
          driver: this.drivers[Math.floor(Math.random() * this.drivers.length)],
          shippingRef: `SHIP${String(
            Math.floor(Math.random() * 10000)
          ).padStart(4, '0')}`,
          notes: Math.random() > 0.5 ? `Notes for job ${index + 1}` : undefined,
        }));

      this.dataSource.data = mockJobs;
      this.isLoading = false;
    }, 1000);
  }

  private getRandomStatus(): JobStatus {
    const statuses = Object.values(JobStatus);
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private generateRandomRegNumber(): string {
    // Generate UK-style registration number (no spaces, all caps)
    const letters1 = 'ABCDEFGHJKLMNOPRSTUVWXYZ';
    const letters2 = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '0123456789';

    let reg = '';

    // Two letters for area
    reg += letters1[Math.floor(Math.random() * letters1.length)];
    reg += letters1[Math.floor(Math.random() * letters1.length)];

    // Two numbers for year
    reg += numbers[Math.floor(Math.random() * numbers.length)];
    reg += numbers[Math.floor(Math.random() * numbers.length)];

    // Three letters for random
    reg += letters2[Math.floor(Math.random() * letters2.length)];
    reg += letters2[Math.floor(Math.random() * letters2.length)];
    reg += letters2[Math.floor(Math.random() * letters2.length)];

    return reg;
  }

  getStatusClass(status: string): string {
    const statusMap: Record<string, string> = {
      [JobStatus.LOADED]: 'status-loaded',
      [JobStatus.ALLOCATED]: 'status-allocated',
      [JobStatus.COLLECTED]: 'status-collected',
      [JobStatus.DELIVERED]: 'status-delivered',
      [JobStatus.ABORTED]: 'status-aborted',
      [JobStatus.CANCELLED]: 'status-cancelled',
    };
    return statusMap[status] || 'status-default';
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
