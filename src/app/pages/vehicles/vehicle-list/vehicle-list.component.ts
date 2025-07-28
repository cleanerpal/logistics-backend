import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Router } from '@angular/router';
import { Subscription, combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';
import { VehicleService, Vehicle } from '../../../services/vehicle.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

interface Driver {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
}

@Component({
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html',
  styleUrls: ['./vehicle-list.component.scss'],
  standalone: false,
})
export class VehicleListComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['registration', 'details', 'currentDriver', 'assignmentStatus', 'lastActivity', 'actions'];
  dataSource = new MatTableDataSource<Vehicle>();

  searchControl = new FormControl('');
  filterForm: FormGroup;

  makes: string[] = [];
  types: string[] = [];

  // Driver assignment data (mock for now)
  driverAssignments: { [vehicleId: string]: { driver: Driver; assignedDate: Date } } = {};

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private subscriptions: Subscription[] = [];

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

  constructor(
    private vehicleService: VehicleService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      make: ['All'],
      type: ['All'],
      assignmentStatus: ['All'],
    });
  }

  ngOnInit() {
    this.setupDataSource();
    this.setupFilters();
    this.loadVehicles();
    this.loadFilterOptions();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  setupDataSource() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    this.dataSource.filterPredicate = (data: Vehicle, filter: string) => {
      const searchTerm = filter.toLowerCase();
      return (
        data.registration.toLowerCase().includes(searchTerm) ||
        data.makeName.toLowerCase().includes(searchTerm) ||
        data.modelName.toLowerCase().includes(searchTerm) ||
        data.chassisNumber.toLowerCase().includes(searchTerm)
      );
    };
  }

  setupFilters() {
    const searchSub = this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
      this.dataSource.filter = value?.trim().toLowerCase() || '';
    });

    const filterSub = this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.subscriptions.push(searchSub, filterSub);
  }

  loadVehicles() {
    this.vehicleService.getVehicles().subscribe({
      next: (vehicles) => {
        this.dataSource.data = vehicles;
        this.loadMockDriverAssignments(vehicles);
      },
      error: (error) => {
        console.error('Error loading vehicles:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load vehicles',
        });
      },
    });
  }

  loadFilterOptions() {
    // Extract unique makes and types from loaded vehicles
    const vehicles = this.dataSource.data;
    this.makes = [...new Set(vehicles.map((v) => v.makeName))];
    this.types = [...new Set(vehicles.map((v) => v.type))];
  }

  loadMockDriverAssignments(vehicles: Vehicle[]) {
    // Mock driver assignments - replace with real data loading
    vehicles.forEach((vehicle, index) => {
      if (index % 3 === 0) {
        // Assign every 3rd vehicle
        this.driverAssignments[vehicle.id] = {
          driver: {
            id: `driver-${index}`,
            name: `Driver ${index + 1}`,
            email: `driver${index + 1}@company.com`,
            phoneNumber: `+44 ${1000 + index} ${123456 + index}`,
          },
          assignedDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000), // Random date within last 90 days
        };
      }
    });
  }

  applyFilters() {
    const filters = this.filterForm.value;

    this.dataSource.filterPredicate = (data: Vehicle, filter: string) => {
      const searchTerm = filter.toLowerCase();
      const matchesSearch =
        data.registration.toLowerCase().includes(searchTerm) || data.makeName.toLowerCase().includes(searchTerm) || data.modelName.toLowerCase().includes(searchTerm);

      const matchesMake = filters.make === 'All' || data.makeName === filters.make;
      const matchesType = filters.type === 'All' || data.type === filters.type;

      const hasDriver = this.getAssignedDriver(data) !== null;
      const matchesAssignment =
        filters.assignmentStatus === 'All' || (filters.assignmentStatus === 'Assigned' && hasDriver) || (filters.assignmentStatus === 'Available' && !hasDriver);

      return matchesSearch && matchesMake && matchesType && matchesAssignment;
    };

    // Trigger filter update
    this.dataSource.filter = this.searchControl.value?.trim().toLowerCase() || '';
  }

  // Driver assignment methods
  getAssignedDriver(vehicle: Vehicle): Driver | null {
    return this.driverAssignments[vehicle.id]?.driver || null;
  }

  getAssignmentDate(vehicle: Vehicle): Date | null {
    return this.driverAssignments[vehicle.id]?.assignedDate || null;
  }

  getAssignmentStatus(vehicle: Vehicle): string {
    return this.getAssignedDriver(vehicle) ? 'Assigned' : 'Available';
  }

  getAssignmentStatusClass(vehicle: Vehicle): string {
    return this.getAssignedDriver(vehicle) ? 'status-assigned' : 'status-available';
  }

  // Vehicle actions
  viewVehicleDetails(vehicle: Vehicle) {
    this.router.navigate(['/vehicles', vehicle.id]);
  }

  editVehicle(vehicle: Vehicle, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/vehicles', vehicle.id, 'edit']);
  }

  // Driver assignment actions
  assignDriver(vehicle: Vehicle) {
    console.log('Assign driver to vehicle:', vehicle.registration);
    // Implement driver assignment dialog
    this.notificationService.addNotification({
      type: 'info',
      title: 'Feature Coming Soon',
      message: 'Driver assignment feature coming soon',
    });
  }

  changeDriver(vehicle: Vehicle) {
    console.log('Change driver for vehicle:', vehicle.registration);
    // Implement driver change dialog
    this.notificationService.addNotification({
      type: 'info',
      title: 'Feature Coming Soon',
      message: 'Driver change feature coming soon',
    });
  }

  unassignDriver(vehicle: Vehicle) {
    console.log('Unassign driver from vehicle:', vehicle.registration);
    // Implement driver unassignment
    delete this.driverAssignments[vehicle.id];
    this.notificationService.addNotification({
      type: 'success',
      title: 'Success',
      message: 'Driver unassigned successfully',
    });
  }

  exportVehicles() {
    console.log('Export fleet data');
    // Implement CSV export
    this.notificationService.addNotification({
      type: 'info',
      title: 'Feature Coming Soon',
      message: 'Export feature coming soon',
    });
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

  getColorHex(colorName: string): string {
    return this.colorMap[colorName] || '#CCCCCC'; // Default grey
  }
}
