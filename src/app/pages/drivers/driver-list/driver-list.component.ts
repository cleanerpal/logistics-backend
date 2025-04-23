import { SelectionModel } from '@angular/cdk/collections';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { Driver, DriverService } from '../../../services/driver.service';

@Component({
  selector: 'app-driver-list',
  templateUrl: './driver-list.component.html',
  styleUrls: ['./driver-list.component.scss'],
})
export class DriverListComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = [
    'select',
    'id',
    'name',
    'email',
    'phone',
    'company',
    'status',
    'lastLogin',
    'actions',
  ];

  isLoading = true;
  dataSource = new MatTableDataSource<Driver>([]);
  selection = new SelectionModel<Driver>(true, []);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  statusFilter = 'All';
  statusOptions = ['All', 'Active', 'Inactive'];

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private driverService: DriverService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDrivers();

    // Subscribe to loading state
    this.subscriptions.push(
      this.driverService.isLoading$.subscribe((loading) => {
        this.isLoading = loading;
      })
    );
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Driver, filter: string) => {
      const searchText = filter.toLowerCase();
      const shouldInclude = (value: string | undefined) =>
        value?.toLowerCase().includes(searchText) ?? false;

      if (
        this.statusFilter !== 'All' &&
        data.status !== this.statusFilter.toLowerCase()
      )
        return false;

      return (
        shouldInclude(data.firstName) ||
        shouldInclude(data.lastName) ||
        shouldInclude(data.email) ||
        shouldInclude(data.companyName) ||
        shouldInclude(data.phone) ||
        shouldInclude(data.driverId)
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

  loadDrivers(): void {
    // Subscribe to drivers from service - no dummy data
    this.subscriptions.push(
      this.driverService.getAllDrivers().subscribe({
        next: (drivers) => {
          this.dataSource.data = drivers;
        },
        error: (error) => {
          console.error('Error loading drivers:', error);
          this.showSnackBar('Failed to load drivers', 'error');
        },
      })
    );
  }

  getStatusClass(status: string): string {
    return status === 'active' ? 'status-green' : 'status-gray';
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

  resetDriverPassword(driver: Driver, event: Event): void {
    event.stopPropagation();

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '350px',
      data: {
        title: 'Reset Password',
        message: `Are you sure you want to reset the password for ${driver.firstName} ${driver.lastName}? They will receive an email with instructions.`,
        confirmText: 'Reset Password',
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.driverService.resetDriverPassword(driver.email).subscribe({
          next: () => {
            this.showSnackBar('Password reset email sent', 'success');
          },
          error: (error) => {
            console.error('Error resetting password:', error);
            this.showSnackBar('Failed to reset password', 'error');
          },
        });
      }
    });
  }

  toggleDriverStatus(driver: Driver, event: Event): void {
    event.stopPropagation();

    const newStatus = driver.status === 'active' ? 'inactive' : 'active';
    const action = newStatus === 'active' ? 'activate' : 'deactivate';

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '350px',
      data: {
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Driver`,
        message: `Are you sure you want to ${action} ${driver.firstName} ${driver.lastName}?`,
        confirmText: `Yes, ${action}`,
        cancelText: 'Cancel',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.driverService
          .updateDriverStatus(driver.id, newStatus as 'active' | 'inactive')
          .subscribe({
            next: () => {
              // Update the status in the local data for immediate UI update
              const updatedData = this.dataSource.data.map((d) => {
                if (d.id === driver.id) {
                  return { ...d, status: newStatus as 'active' | 'inactive' };
                }
                return d;
              });
              this.dataSource.data = updatedData;
              this.showSnackBar(`Driver ${action}d successfully`, 'success');
            },
            error: (error) => {
              console.error(`Error ${action}ing driver:`, error);
              this.showSnackBar(`Failed to ${action} driver`, 'error');
            },
          });
      }
    });
  }

  deleteDriver(driver: Driver, event: Event): void {
    event.stopPropagation();

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '350px',
      data: {
        title: 'Delete Driver',
        message: `Are you sure you want to delete ${driver.firstName} ${driver.lastName}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.driverService.deleteDriver(driver.id).subscribe({
          next: () => {
            // Remove the deleted driver from the local data
            this.dataSource.data = this.dataSource.data.filter(
              (d) => d.id !== driver.id
            );
            this.showSnackBar('Driver deleted successfully', 'success');
          },
          error: (error) => {
            console.error('Error deleting driver:', error);
            this.showSnackBar('Failed to delete driver', 'error');
          },
        });
      }
    });
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
      this.showSnackBar('No drivers selected', 'error');
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
      'Driver ID',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Company',
      'Status',
      'Last Login',
    ];
    const rows = drivers.map((driver) => [
      driver.id,
      driver.driverId,
      driver.firstName,
      driver.lastName,
      driver.email,
      driver.phone || '',
      driver.companyName || '',
      driver.status,
      driver.lastLogin
        ? new Date(driver.lastLogin.seconds * 1000).toLocaleDateString()
        : 'Never',
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

  private showSnackBar(
    message: string,
    type: 'success' | 'error' | 'info'
  ): void {
    const className = {
      success: 'success-snackbar',
      error: 'error-snackbar',
      info: 'info-snackbar',
    }[type];

    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: [className],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
