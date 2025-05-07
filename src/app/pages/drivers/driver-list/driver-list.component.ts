import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../services/auth.service';
import { DriverService } from '../../../services/driver.service';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { NotificationService } from '../../../services/notification.service';
import { UserProfile, UserRole } from '../../../interfaces/user-profile.interface';

@Component({
  selector: 'app-driver-list',
  templateUrl: './driver-list.component.html',
  styleUrls: ['./driver-list.component.scss'],
  standalone: false,
})
export class DriverListComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = ['select', 'id', 'name', 'email', 'phone', 'company', 'role', 'type', 'status', 'lastActivity', 'actions'];

  isLoading = false;
  dataSource = new MatTableDataSource<UserProfile>([]);
  selection = new SelectionModel<UserProfile>(true, []);
  hasEditPermission = false;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  typeFilter = 'All';
  roleFilter = 'All';
  statusFilter = 'All';

  typeOptions = ['All', 'Customer', 'Supplier', 'Partner'];
  roleOptions = ['All', ...Object.values(UserRole)];
  statusOptions = ['All', 'Active', 'Inactive', 'Pending'];

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private driverService: DriverService,
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
    this.dataSource.filterPredicate = (data: UserProfile, filter: string) => {
      const searchText = filter.toLowerCase();
      const shouldInclude = (value: string | undefined) => value?.toLowerCase().includes(searchText) || false;

      // Apply type filter
      if (this.typeFilter !== 'All' && data.type?.toLowerCase() !== this.typeFilter.toLowerCase()) {
        return false;
      }

      // Apply role filter
      if (this.roleFilter !== 'All' && data.role !== this.roleFilter) {
        return false;
      }

      // Apply status filter
      if (this.statusFilter !== 'All' && data.status?.toLowerCase() !== this.statusFilter.toLowerCase()) {
        return false;
      }

      // Apply text search
      return (
        shouldInclude(data.firstName) ||
        shouldInclude(data.lastName) ||
        shouldInclude(data.name) ||
        shouldInclude(data.email) ||
        shouldInclude(data.company) ||
        shouldInclude(data.phoneNumber) ||
        shouldInclude(data.phone)
      );
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

    const driversSub = this.driverService
      .getAllDrivers()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (drivers) => {
          this.dataSource.data = drivers;
        },
        error: (error) => {
          console.error('Error loading drivers:', error);
          this.snackBar.open('Error loading drivers', 'Close', { duration: 3000 });
        },
      });

    this.subscriptions.push(driversSub);
  }

  getStatusClass(status: string | undefined): string {
    if (!status) return 'status-gray';

    switch (status.toLowerCase()) {
      case 'active':
        return 'status-green';
      case 'pending':
        return 'status-orange';
      case 'inactive':
      default:
        return 'status-gray';
    }
  }

  getTypeClass(type: string | undefined): string {
    if (!type) return 'type-blue';

    switch (type.toLowerCase()) {
      case 'customer':
        return 'type-blue';
      case 'supplier':
        return 'type-purple';
      case 'partner':
        return 'type-orange';
      default:
        return 'type-blue';
    }
  }

  getRoleClass(role: string | undefined): string {
    if (!role) return 'role-driver';

    switch (role.toLowerCase()) {
      case 'admin':
        return 'role-admin';
      case 'system user':
        return 'role-manager';
      case 'contractor':
        return 'role-dispatcher';
      case 'driver':
        return 'role-driver';
      default:
        return 'role-driver';
    }
  }

  getDriverInitials(driver: UserProfile): string {
    if (!driver) return '??';

    if (driver.name && driver.name.length > 0) {
      const nameParts = driver.name.split(' ');
      if (nameParts.length > 1) {
        return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
      }
      return nameParts[0][0].toUpperCase();
    }

    const firstName = driver.firstName || '';
    const lastName = driver.lastName || '';

    if (!firstName && !lastName) {
      return driver.email[0].toUpperCase();
    }

    return ((firstName[0] || '') + (lastName[0] || '')).toUpperCase();
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

  checkboxLabel(row?: UserProfile): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id}`;
  }

  createNewDriver(): void {
    this.router.navigate(['/drivers/new']);
  }

  editDriver(driver: UserProfile): void {
    this.router.navigate(['/drivers', driver.id]);
  }

  viewDriverJobs(driver: UserProfile, event?: Event): void {
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

  private downloadDriversCsv(drivers: UserProfile[]): void {
    // Convert drivers to CSV format
    const headers = ['ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Role', 'Type', 'Status', 'Last Activity'];
    const rows = drivers.map((driver) => [
      driver.id,
      driver.firstName || '',
      driver.lastName || '',
      driver.email || '',
      driver.phone || driver.phoneNumber || '',
      driver.company || '',
      driver.role || '',
      driver.type || '',
      driver.status || (driver.isActive ? 'active' : 'inactive'),
      driver.lastActivity ? new Date(driver.lastActivity).toLocaleDateString() : '',
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

  deleteDriver(driver: UserProfile, event: Event): void {
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
        this.driverService.deactivateDriver(driver.id).subscribe({
          next: () => {
            // Remove from the data source
            this.dataSource.data = this.dataSource.data.filter((d) => d.id !== driver.id);

            // Show success notification
            this.notificationService.addNotification({
              type: 'success',
              title: 'Driver Deleted',
              message: `${driver.firstName} ${driver.lastName} has been deleted successfully`,
            });
          },
          error: (error) => {
            console.error(`Error deleting driver ${driver.id}:`, error);
            this.snackBar.open('Error deleting driver', 'Close', { duration: 3000 });
          },
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
