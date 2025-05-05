// driver-list.component.ts
import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  type: DriverType;
  status: DriverStatus;
  lastDriver: Date;
}

type DriverType = 'customer' | 'supplier' | 'partner';
type DriverStatus = 'active' | 'inactive';

@Component({
  selector: 'app-driver-list',
  templateUrl: './driver-list.component.html',
  styleUrls: ['./driver-list.component.scss'],
  standalone: false,
})
export class DriverListComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'select',
    'id',
    'name',
    'email',
    'phone',
    'company',
    'type',
    'status',
    'lastDriver',
    'actions',
  ];

  isLoading = false;
  dataSource = new MatTableDataSource<Driver>([]);
  selection = new SelectionModel<Driver>(true, []);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  typeFilter = 'All';
  statusFilter = 'All';

  typeOptions = ['All', 'Customer', 'Supplier', 'Partner'];
  statusOptions = ['All', 'Active', 'Inactive'];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadDrivers();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Driver, filter: string) => {
      const searchText = filter.toLowerCase();
      const shouldInclude = (value: string) =>
        value.toLowerCase().includes(searchText);

      if (
        this.typeFilter !== 'All' &&
        data.type !== this.typeFilter.toLowerCase()
      )
        return false;
      if (
        this.statusFilter !== 'All' &&
        data.status !== this.statusFilter.toLowerCase()
      )
        return false;

      return (
        shouldInclude(data.firstName) ||
        shouldInclude(data.lastName) ||
        shouldInclude(data.email) ||
        shouldInclude(data.company) ||
        shouldInclude(data.phone)
      );
    };
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  loadDrivers(): void {
    this.isLoading = true;

    // Simulate API call with dummy data
    setTimeout(() => {
      const mockDrivers = Array(25)
        .fill(null)
        .map((_, index) => ({
          id: `CON${String(index + 1).padStart(4, '0')}`,
          firstName: `John${index + 1}`,
          lastName: `Doe${index + 1}`,
          email: `driver${index + 1}@example.com`,
          phone: this.generatePhoneNumber(),
          company: `Company ${String.fromCharCode(65 + (index % 5))}`,
          type: this.getRandomType(),
          status:
            Math.random() > 0.3
              ? ('active' as DriverStatus)
              : ('inactive' as DriverStatus),
          lastDriver: new Date(2024, 0, index + 1),
        }));

      this.dataSource.data = mockDrivers;
      this.isLoading = false;
    }, 1000); // Simulate network delay
  }

  private generatePhoneNumber(): string {
    const areaCode = Math.floor(Math.random() * 900 + 100);
    const prefix = Math.floor(Math.random() * 900 + 100);
    const lineNumber = Math.floor(Math.random() * 9000 + 1000);
    return `+1 ${areaCode}-${prefix}-${lineNumber}`;
  }

  private getRandomType(): DriverType {
    const types: DriverType[] = ['customer', 'supplier', 'partner'];
    return types[Math.floor(Math.random() * types.length)];
  }

  getStatusClass(status: DriverStatus): string {
    return status === 'active' ? 'status-green' : 'status-gray';
  }

  getTypeClass(type: DriverType): string {
    const typeMap: Record<DriverType, string> = {
      customer: 'type-blue',
      supplier: 'type-purple',
      partner: 'type-orange',
    };
    return typeMap[type];
  }

  onFilterChange(): void {
    this.dataSource.filter = this.dataSource.filter || ' ';
  }

  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.dataSource.data);
  }

  checkboxLabel(row?: Driver): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${
      row.id
    }`;
  }

  createNewDriver(): void {
    this.router.navigate(['/drivers/new']);
  }

  editDriver(driver: Driver): void {
    this.router.navigate(['/drivers', driver.id]);
  }

  exportDrivers(): void {
    // Create export options menu instead of direct export
    const exportMenu = document.createElement('div');
    const exportButton = document.createElement('button');
    exportButton.onclick = () => this.exportSelectedDrivers();
    const allButton = document.createElement('button');
    allButton.onclick = () => this.exportAllDrivers();
  }

  exportSelectedDrivers(): void {
    const selectedDrivers = this.selection.selected;
    if (selectedDrivers.length === 0) {
      // Could use MatSnackBar here to show a message
      console.log('No drivers selected');
      return;
    }
    this.downloadDriversCsv(selectedDrivers);
  }

  exportAllDrivers(): void {
    const allDrivers = this.dataSource.filteredData;
    this.downloadDriversCsv(allDrivers);
  }

  private downloadDriversCsv(drivers: Driver[]): void {
    // Convert drivers to CSV format
    const headers = [
      'ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Company',
      'Type',
      'Status',
      'Last Driver',
    ];
    const rows = drivers.map((driver) => [
      driver.id,
      driver.firstName,
      driver.lastName,
      driver.email,
      driver.phone,
      driver.company,
      driver.type,
      driver.status,
      new Date(driver.lastDriver).toLocaleDateString(),
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'drivers.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  deleteDriver(driver: Driver, event: Event): void {
    event.stopPropagation();
    console.log('Deleting driver:', driver.id);
  }
}
