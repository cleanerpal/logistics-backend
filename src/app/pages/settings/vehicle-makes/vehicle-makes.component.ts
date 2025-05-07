import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { VehicleMakeDialogComponent } from './vehicle-make-dialog/vehicle-make-dialog.component';
import { VehicleMake, VehicleService } from '../../../services/vehicle.service';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { NotificationService } from '../../../services/notification.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-vehicle-makes',
  templateUrl: './vehicle-makes.component.html',
  styleUrls: ['./vehicle-makes.component.scss'],
  standalone: false,
})
export class VehicleMakesComponent implements OnInit {
  displayedColumns: string[] = ['logo', 'name', 'displayName', 'vehicleTypes', 'status', 'actions'];
  dataSource = new MatTableDataSource<VehicleMake>([]);
  isLoading = false;
  totalMakes = 0;
  activeMakes = 0;
  inactiveMakes = 0;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private vehicleService: VehicleService, private dialog: MatDialog, private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.loadVehicleMakes();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadVehicleMakes(): void {
    this.isLoading = true;
    this.vehicleService
      .getVehicleMakes()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (makes) => {
          this.dataSource.data = makes;
          this.calculateStats(makes);
        },
        error: (error) => {
          console.error('Error loading vehicle makes:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to load vehicle makes',
          });
        },
      });
  }

  calculateStats(makes: VehicleMake[]): void {
    this.totalMakes = makes.length;
    this.activeMakes = makes.filter((make) => make.isActive).length;
    this.inactiveMakes = makes.filter((make) => !make.isActive).length;
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  addVehicleMake(): void {
    const dialogRef = this.dialog.open(VehicleMakeDialogComponent, {
      width: '600px',
      data: { isEdit: false },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.isLoading = true;
        this.vehicleService
          .createVehicleMake(result)
          .pipe(finalize(() => (this.isLoading = false)))
          .subscribe({
            next: () => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'Success',
                message: `Vehicle make "${result.displayName}" created successfully`,
              });
              this.loadVehicleMakes();
            },
            error: (error) => {
              console.error('Error creating vehicle make:', error);
              this.notificationService.addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to create vehicle make',
              });
            },
          });
      }
    });
  }

  editVehicleMake(make: VehicleMake): void {
    const dialogRef = this.dialog.open(VehicleMakeDialogComponent, {
      width: '600px',
      data: { isEdit: true, make: make },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.isLoading = true;
        this.vehicleService
          .updateVehicleMake(make.id, result)
          .pipe(finalize(() => (this.isLoading = false)))
          .subscribe({
            next: () => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'Success',
                message: `Vehicle make "${result.displayName}" updated successfully`,
              });
              this.loadVehicleMakes();
            },
            error: (error) => {
              console.error('Error updating vehicle make:', error);
              this.notificationService.addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to update vehicle make',
              });
            },
          });
      }
    });
  }

  toggleVehicleMakeStatus(make: VehicleMake): void {
    const newStatus = !make.isActive;
    const action = newStatus ? 'activate' : 'deactivate';

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: `${newStatus ? 'Activate' : 'Deactivate'} Vehicle Make`,
        message: `Are you sure you want to ${action} the vehicle make "${make.displayName}"?`,
        confirmText: 'Yes',
        cancelText: 'No',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.isLoading = true;
        this.vehicleService
          .updateVehicleMake(make.id, { isActive: newStatus })
          .pipe(finalize(() => (this.isLoading = false)))
          .subscribe({
            next: () => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'Success',
                message: `Vehicle make "${make.displayName}" ${newStatus ? 'activated' : 'deactivated'} successfully`,
              });
              this.loadVehicleMakes();
            },
            error: (error) => {
              console.error(`Error ${action}ing vehicle make:`, error);
              this.notificationService.addNotification({
                type: 'error',
                title: 'Error',
                message: `Failed to ${action} vehicle make`,
              });
            },
          });
      }
    });
  }

  getVehicleTypesList(vehicleTypes: string[]): string {
    return vehicleTypes ? vehicleTypes.join(', ') : 'None';
  }
}
