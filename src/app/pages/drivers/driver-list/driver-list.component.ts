import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
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
  displayedColumns: string[] = ['name', 'email', 'phone', 'lastActivity', 'status'];

  isLoading = false;
  dataSource = new MatTableDataSource<UserProfile>([]);
  hasEditPermission = false;

  error: string | null = null;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  statusFilter = 'All';
  statusOptions = ['All', 'Active', 'Inactive'];

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

      const currentStatus = data.status || (data.isActive ? 'Active' : 'Inactive');
      if (this.statusFilter !== 'All' && currentStatus.toLowerCase() !== this.statusFilter.toLowerCase()) {
        return false;
      }

      return (
        shouldInclude(data.firstName) ||
        shouldInclude(data.lastName) ||
        shouldInclude(data.name) ||
        shouldInclude(data.email) ||
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

  refresh(): void {
    this.loadDrivers();
  }

  clearFilters(): void {
    this.statusFilter = 'All';
    this.dataSource.filter = '';
    this.loadDrivers();
  }

  getStatusClass(status: string | undefined): string {
    if (!status) return 'status-grey';

    switch (status.toLowerCase()) {
      case 'active':
        return 'status-green';
      case 'pending':
        return 'status-orange';
      case 'inactive':
      default:
        return 'status-grey';
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

  createNewDriver(): void {
    this.router.navigate(['/drivers/new']);
  }

  viewDriverDetails(driver: UserProfile): void {
    this.router.navigate(['/drivers', driver.id]);
  }

  toggleDriverStatus(driver: UserProfile, event: MatSlideToggleChange): void {
    const newStatus = event.checked;

    if (driver.isActive === newStatus) {
      return; // No change needed
    }

    this.isLoading = true;

    const updateSub = this.driverService.updateDriver(driver.id, { isActive: newStatus }).subscribe({
      next: () => {
        driver.isActive = newStatus; // Update local data
        driver.status = newStatus ? 'active' : 'inactive'; // Update status display
        this.notificationService.addNotification({
          type: 'success',
          title: 'Status Updated',
          message: `${driver.firstName} ${driver.lastName} is now ${newStatus ? 'active' : 'inactive'}`,
        });
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error updating driver status:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: `Failed to update driver status: ${error.message}`,
        });
        // Revert the toggle
        event.source.checked = driver.isActive || false;
        this.isLoading = false;
      },
    });

    this.subscriptions.push(updateSub);
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

  private downloadDriversCsv(drivers: UserProfile[]): void {
    const headers = ['Name', 'Email', 'Phone', 'Last Activity', 'Status'];
    const rows = drivers.map((driver) => [
      `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || driver.name || '',
      driver.email || '',
      driver.phone || driver.phoneNumber || '',
      driver.lastActivity ? new Date(driver.lastActivity).toLocaleDateString() : '',
      driver.status || (driver.isActive ? 'active' : 'inactive'),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'drivers.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

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
            this.dataSource.data = this.dataSource.data.filter((d) => d.id !== driver.id);

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
