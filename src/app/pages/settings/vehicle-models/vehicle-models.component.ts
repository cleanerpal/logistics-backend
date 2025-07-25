import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { finalize, Observable, forkJoin, of } from 'rxjs';
import { VehicleService, VehicleMake, VehicleModel } from '../../../services/vehicle.service';
import { NotificationService } from '../../../services/notification.service';
import { VehicleModelDialogComponent } from './vehicle-model-dialog/vehicle-model-dialog.component';

interface VehicleModelWithMake extends VehicleModel {
  makeName?: string;
}

@Component({
  selector: 'app-vehicle-models',
  templateUrl: './vehicle-models.component.html',
  styleUrls: ['./vehicle-models.component.scss'],
  standalone: false,
})
export class VehicleModelsComponent implements OnInit {
  displayedColumns: string[] = ['name', 'make', 'type', 'status', 'actions'];
  dataSource = new MatTableDataSource<VehicleModelWithMake>([]);
  isLoading = false;
  makes: VehicleMake[] = [];
  totalModels = 0;
  activeModels = 0;
  inactiveModels = 0;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private vehicleService: VehicleService, private dialog: MatDialog, private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadData(): void {
    this.isLoading = true;

    forkJoin({
      makes: this.vehicleService.getVehicleMakes(),
      models: this.vehicleService.getVehicleModels(),
    })
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: ({ makes, models }) => {
          this.makes = makes;

          const modelsWithMakes = models.map((model) => {
            const make = makes.find((m) => m.id === model.makeId);
            return {
              ...model,
              makeName: make?.displayName || 'Unknown Make',
            };
          });

          this.dataSource.data = modelsWithMakes;
          this.calculateStats(models);
        },
        error: (error) => {
          console.error('Error loading data:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to load vehicle models',
          });
        },
      });
  }

  calculateStats(models: VehicleModel[]): void {
    this.totalModels = models.length;
    this.activeModels = models.filter((model) => model.isActive).length;
    this.inactiveModels = models.filter((model) => !model.isActive).length;
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  addVehicleModel(): void {
    if (this.makes.length === 0) {
      this.notificationService.addNotification({
        type: 'warning',
        title: 'No Makes Available',
        message: 'Please create at least one vehicle make first',
      });
      return;
    }

    const dialogRef = this.dialog.open(VehicleModelDialogComponent, {
      width: '600px',
      data: {
        isEdit: false,
        makes: this.makes.filter((make) => make.isActive),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.isLoading = true;
        this.vehicleService
          .createVehicleModel(result)
          .pipe(finalize(() => (this.isLoading = false)))
          .subscribe({
            next: () => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'Success',
                message: `Vehicle model "${result.name}" created successfully`,
              });
              this.loadData();
            },
            error: (error) => {
              console.error('Error creating vehicle model:', error);
              this.notificationService.addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to create vehicle model',
              });
            },
          });
      }
    });
  }

  editVehicleModel(model: VehicleModelWithMake): void {
    const dialogRef = this.dialog.open(VehicleModelDialogComponent, {
      width: '600px',
      data: {
        isEdit: true,
        model: model,
        makes: this.makes.filter((make) => make.isActive),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.isLoading = true;
        this.vehicleService
          .updateVehicleModel(model.id, result)
          .pipe(finalize(() => (this.isLoading = false)))
          .subscribe({
            next: () => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'Success',
                message: `Vehicle model "${result.name}" updated successfully`,
              });
              this.loadData();
            },
            error: (error) => {
              console.error('Error updating vehicle model:', error);
              this.notificationService.addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to update vehicle model',
              });
            },
          });
      }
    });
  }

  toggleVehicleModelStatus(model: VehicleModelWithMake, event: MatSlideToggleChange): void {
    const newStatus = event.checked;
    const action = newStatus ? 'activated' : 'deactivated';

    this.vehicleService.updateVehicleModel(model.id, { isActive: newStatus }).subscribe({
      next: () => {
        this.notificationService.addNotification({
          type: 'success',
          title: 'Status Updated',
          message: `${model.name} ${action} successfully`,
        });
        this.loadData();
      },
      error: (error) => {
        console.error(`Error updating vehicle model status:`, error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: `Failed to update vehicle model status`,
        });
        // Revert the toggle state
        event.source.checked = !newStatus;
      },
    });
  }
}
