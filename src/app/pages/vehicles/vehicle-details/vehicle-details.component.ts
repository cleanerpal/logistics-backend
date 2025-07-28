import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription, forkJoin, of } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { VehicleService, Vehicle } from '../../../services/vehicle.service';
import { DriverService } from '../../../services/driver.service';

interface Driver {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
}

interface DriverAssignment {
  id: string;
  driverId: string;
  driverName: string;
  startDate: Date;
  endDate?: Date;
}

@Component({
  selector: 'app-vehicle-details',
  templateUrl: './vehicle-details.component.html',
  styleUrls: ['./vehicle-details.component.scss'],
  standalone: false,
})
export class VehicleDetailsComponent implements OnInit, OnDestroy {
  vehicleId: string = '';
  vehicle: Vehicle | null = null;
  loading = false;
  error: string | null = null;
  hasEditPermission = false;

  // Driver assignment properties
  currentDriver: Driver | null = null;
  currentAssignmentDate: Date | null = null;
  driverAssignments: DriverAssignment[] = [];
  driverAssignmentCount = 0;

  colorMap: { [key: string]: string } = {
    Black: '#333333',
    White: '#FFFFFF',
    Silver: '#C0C0C0',
    Grey: '#808080',
    Blue: '#0000FF',
    Red: '#FF0000',
    Green: '#008000',
    Yellow: '#FFFF00',
    Brown: '#A52A2A',
    Orange: '#FFA500',
    Purple: '#800080',
  };

  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vehicleService: VehicleService,
    private driverService: DriverService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.checkPermissions();
    this.route.params.subscribe((params) => {
      this.vehicleId = params['id'];
      if (this.vehicleId) {
        this.loadVehicleDetails(this.vehicleId);
      }
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  checkPermissions() {
    this.authService.hasPermission('canManageCompanies').subscribe((hasPermission) => {
      this.hasEditPermission = hasPermission;
    });
  }

  loadVehicleDetails(id: string) {
    this.loading = true;
    this.error = null;

    const vehicle$ = this.vehicleService.getVehicleById(id);
    const assignments$ = this.loadDriverAssignments(id);

    forkJoin({
      vehicle: vehicle$,
      assignments: assignments$,
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data) => {
          this.vehicle = data.vehicle;
          this.driverAssignments = data.assignments;
          this.driverAssignmentCount = data.assignments.length;

          // Check if vehicle has assignedDriverId (from interface)
          const vehicleWithDriver = this.vehicle as any;
          if (vehicleWithDriver?.assignedDriverId) {
            this.loadCurrentDriver(vehicleWithDriver.assignedDriverId);
          }
        },
        error: (error: any) => {
          this.error = 'Failed to load vehicle details';
          console.error('Error loading vehicle details:', error);
        },
      });
  }

  loadCurrentDriver(driverId: string) {
    this.driverService.getDriverById(driverId).subscribe({
      next: (driver: any) => {
        this.currentDriver = driver;
        // Find current assignment date
        const currentAssignment = this.driverAssignments.find((a) => !a.endDate);
        this.currentAssignmentDate = currentAssignment?.startDate || null;
      },
      error: (error: any) => {
        console.error('Error loading current driver:', error);
      },
    });
  }

  loadDriverAssignments(vehicleId: string) {
    // This would typically load from a driver assignments collection
    // For now, return empty array - implement based on your data structure
    return of([]);
  }

  goBack() {
    this.router.navigate(['/vehicles']);
  }

  editVehicle() {
    if (this.vehicle) {
      this.router.navigate(['/vehicles', this.vehicle.id, 'edit']);
    }
  }

  // Driver assignment methods
  assignDriver() {
    this.showSnackbar('Driver assignment feature will be implemented');
    console.log('Assign driver to vehicle');
  }

  changeDriverAssignment() {
    this.showSnackbar('Driver change feature will be implemented');
    console.log('Change driver assignment');
  }

  unassignDriver() {
    this.showSnackbar('Driver unassignment feature will be implemented');
    console.log('Unassign driver from vehicle');
  }

  viewDriver(driverId: string) {
    this.router.navigate(['/drivers', driverId]);
  }

  // Utility methods
  formatDate(date: any): string {
    if (!date) return 'N/A';

    let dateObj: Date;
    if (date.toDate && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }

    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  calculateDuration(startDate: Date, endDate: Date): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      return `${years} year${years > 1 ? 's' : ''}${remainingMonths > 0 ? ` ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}` : ''}`;
    }
  }

  getColorHex(colorName: string): string {
    return this.colorMap[colorName] || '#CCCCCC'; // Default grey
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
