// driver-list.component.ts
import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { NotificationService } from '../../../services/notification.service';

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  type: DriverType;
  role: string;
  status: DriverStatus;
  lastDriver: Date;
  permissions?: {
    canAllocateJobs?: boolean;
    canApproveExpenses?: boolean;
    canCreateJobs?: boolean;
    canEditJobs?: boolean;
    canManageUsers?: boolean;
    canViewReports?: boolean;
    canViewUnallocated?: boolean;
    isAdmin?: boolean;
  };
}

type DriverType = 'customer' | 'supplier' | 'partner';
type DriverStatus = 'active' | 'inactive' | 'pending';

@Component({
  selector: 'app-driver-list',
  templateUrl: './driver-list.component.html',
  styleUrls: ['./driver-list.component.scss'],
  standalone: false,
})
export class DriverListComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = ['select', 'id', 'name', 'email', 'phone', 'company', 'role', 'type', 'status', 'lastActivity', 'actions'];

  isLoading = false;
  dataSource = new MatTableDataSource<Driver>([]);
  selection = new SelectionModel<Driver>(true, []);
  hasEditPermission = false;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  typeFilter = 'All';
  roleFilter = 'All';
  statusFilter = 'All';

  typeOptions = ['All', 'Customer', 'Supplier', 'Partner'];
  roleOptions = ['All', 'Admin', 'Manager', 'Dispatcher', 'Driver', 'User'];
  statusOptions = ['All', 'Active', 'Inactive', 'Pending'];

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.checkPermissions();
    this.loadDrivers();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private checkPermissions(): void {
    const permissionSub = this.authService.hasPermission('canManageUsers').subscribe((hasPermission) => {
      this.hasEditPermission = hasPermission;
    });
    this.subscriptions.push(permissionSub);
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Driver, filter: string) => {
      const searchText = filter.toLowerCase();
      const shouldInclude = (value: string) => value.toLowerCase().includes(searchText);

      // Apply type filter
      if (this.typeFilter !== 'All' && data.type !== this.typeFilter.toLowerCase()) {
        return false;
      }

      // Apply role filter
      if (this.roleFilter !== 'All' && data.role !== this.roleFilter) {
        return false;
      }

      // Apply status filter
      if (this.statusFilter !== 'All' && data.status !== this.statusFilter.toLowerCase()) {
        return false;
      }

      // Apply text search
      return shouldInclude(data.firstName) || shouldInclude(data.lastName) || shouldInclude(data.email) || shouldInclude(data.company) || shouldInclude(data.phone);
    };
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onFilterChange(): void {
    // Force the filter to re-evaluate
    this.dataSource.filter = this.dataSource.filter || ' ';
  }

  loadDrivers(): void {
    this.isLoading = true;

    // Simulate API call with dummy data
    setTimeout(() => {
      const mockDrivers = Array(25)
        .fill(null)
        .map((_, index) => ({
          id: `DRV${String(index + 1).padStart(4, '0')}`,
          firstName: `John${index + 1}`,
          lastName: `Doe${index + 1}`,
          email: `driver${index + 1}@example.com`,
          phone: this.generatePhoneNumber(),
          company: `Company ${String.fromCharCode(65 + (index % 5))}`,
          role: this.getRandomRole(),
          type: this.getRandomType(),
          status: this.getRandomStatus(),
          lastDriver: new Date(2024, 0, index + 1),
          permissions: {
            canAllocateJobs: Math.random() > 0.5,
            canApproveExpenses: Math.random() > 0.5,
            canCreateJobs: Math.random() > 0.5,
            canEditJobs: Math.random() > 0.5,
            canManageUsers: Math.random() > 0.8,
            canViewReports: Math.random() > 0.5,
            canViewUnallocated: Math.random() > 0.5,
            isAdmin: Math.random() > 0.9,
          },
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

  private getRandomStatus(): DriverStatus {
    const statuses: DriverStatus[] = ['active', 'inactive', 'pending'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private getRandomRole(): string {
    const roles = ['Admin', 'Manager', 'Dispatcher', 'Driver', 'User'];
    return roles[Math.floor(Math.random() * roles.length)];
  }

  getStatusClass(status: DriverStatus): string {
    return status === 'active' ? 'status-green' : status === 'pending' ? 'status-orange' : 'status-gray';
  }

  getTypeClass(type: DriverType): string {
    const typeMap: Record<DriverType, string> = {
      customer: 'type-blue',
      supplier: 'type-purple',
      partner: 'type-orange',
    };
    return typeMap[type];
  }

  getRoleClass(role: string): string {
    const roleMap: Record<string, string> = {
      Admin: 'role-admin',
      Manager: 'role-manager',
      Dispatcher: 'role-dispatcher',
      Driver: 'role-driver',
      User: 'role-user',
    };
    return roleMap[role] || 'role-driver';
  }

  getDriverInitials(driver: Driver): string {
    return (driver.firstName.charAt(0) + driver.lastName.charAt(0)).toUpperCase();
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
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id}`;
  }

  createNewDriver(): void {
    this.router.navigate(['/drivers/new']);
  }

  editDriver(driver: Driver): void {
    this.router.navigate(['/drivers', driver.id]);
  }

  viewDriverJobs(driver: Driver, event?: Event): void {
    if (event) {
      event.stopPropagation(); // Prevent row click event
    }
    this.router.navigate(['/jobs'], {
      queryParams: {
        driverId: driver.id,
        driverName: `${driver.firstName} ${driver.lastName}`,
      },
    });
  }

  exportAllDrivers(): void {
    const allDrivers = this.dataSource.filteredData;
    this.downloadDriversCsv(allDrivers);
  }

  exportSelectedDrivers(): void {
    const selectedDrivers = this.selection.selected;
    if (selectedDrivers.length === 0) {
      this.showSnackbar('No drivers selected');
      return;
    }
    this.downloadDriversCsv(selectedDrivers);
  }

  private downloadDriversCsv(drivers: Driver[]): void {
    // Convert drivers to CSV format
    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Role', 'Type', 'Status', 'Last Activity'];
    const rows = drivers.map((driver) => [
      driver.id,
      driver.firstName,
      driver.lastName,
      driver.email,
      driver.phone,
      driver.company,
      driver.role,
      driver.type,
      driver.status,
      new Date(driver.lastDriver).toLocaleDateString(),
    ]);

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

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

    // Show success notification
    this.notificationService.addNotification({
      type: 'success',
      title: 'Export Complete',
      message: `${drivers.length} drivers exported successfully`,
    });
  }

  deleteDriver(driver: Driver, event: Event): void {
    event.stopPropagation();

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Driver',
        message: `Are you sure you want to delete driver ${driver.firstName} ${driver.lastName}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
        icon: 'delete_forever',
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // In a real app, you would call a service to delete the driver
        // For this demo, we'll just remove it from the table
        this.dataSource.data = this.dataSource.data.filter((d) => d.id !== driver.id);

        // Show success notification
        this.notificationService.addNotification({
          type: 'success',
          title: 'Driver Deleted',
          message: `${driver.firstName} ${driver.lastName} has been deleted successfully`,
        });
      }
    });
  }

  private showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
