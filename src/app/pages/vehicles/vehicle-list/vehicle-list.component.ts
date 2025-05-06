import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { FormControl, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth.service';
import { VehicleService, Vehicle } from '../../../services/vehicle.service';

@Component({
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html',
  styleUrls: ['./vehicle-list.component.scss'],
  standalone: false,
})
export class VehicleListComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = ['registration', 'make', 'model', 'type', 'color', 'lastProcessedDate', 'jobCount', 'actions'];

  isLoading = false;
  dataSource = new MatTableDataSource<Vehicle>([]);
  hasCreatePermission = false;
  hasEditPermission = false;

  // Form controls
  searchControl = new FormControl('');
  filterForm: FormGroup;

  // Dropdown options
  makes: string[] = [];
  vehicleTypes: string[] = [];
  colors: string[] = [];

  // Color mapping for visualization
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
    Gold: '#FFD700',
    Beige: '#F5F5DC',
  };

  private subscriptions: Subscription[] = [];

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private router: Router, private vehicleService: VehicleService, private authService: AuthService, private snackBar: MatSnackBar) {
    this.filterForm = new FormGroup({
      make: new FormControl('All'),
      type: new FormControl('All'),
      color: new FormControl('All'),
    });
  }

  ngOnInit(): void {
    this.checkPermissions();
    this.loadVehicles();
    this.setupFilterListeners();
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
    const authSub = this.authService.getUserProfile().subscribe((user) => {
      this.hasCreatePermission = user?.permissions?.canManageUsers || user?.permissions?.isAdmin || false;
      this.hasEditPermission = user?.permissions?.canManageUsers || user?.permissions?.isAdmin || false;
    });
    this.subscriptions.push(authSub);
  }

  private setupFilterListeners(): void {
    // Subscribe to search input changes
    const searchSub = this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe((value) => {
      this.applyFilter(value || '');
    });
    this.subscriptions.push(searchSub);

    // Subscribe to filter form changes
    const filterSub = this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
    this.subscriptions.push(filterSub);
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Vehicle, filter: string) => {
      const searchStr = filter.toLowerCase();

      // Apply dropdown filters first
      const makeFilter = this.filterForm.get('make')?.value;
      if (makeFilter !== 'All' && data.makeName !== makeFilter) {
        return false;
      }

      const typeFilter = this.filterForm.get('type')?.value;
      if (typeFilter !== 'All' && data.type !== typeFilter) {
        return false;
      }

      const colorFilter = this.filterForm.get('color')?.value;
      if (colorFilter !== 'All' && data.color !== colorFilter) {
        return false;
      }

      // Then apply search text filter
      return (
        data.registration?.toLowerCase().includes(searchStr) ||
        data.chassisNumber?.toLowerCase().includes(searchStr) ||
        data.makeName?.toLowerCase().includes(searchStr) ||
        data.modelName?.toLowerCase().includes(searchStr) ||
        data.vin?.toLowerCase().includes(searchStr) ||
        data.color?.toLowerCase().includes(searchStr) ||
        (data.year?.toString() || '').includes(searchStr)
      );
    };
  }

  applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  applyFilters(): void {
    // This will trigger the filterPredicate function with the current search value
    const currentFilter = this.dataSource.filter || ' ';
    this.dataSource.filter = '';
    this.dataSource.filter = currentFilter;
  }

  loadVehicles(): void {
    this.isLoading = true;

    const vehiclesSub = this.vehicleService.getVehicles().subscribe({
      next: (vehicles) => {
        this.dataSource.data = vehicles;
        this.extractFilterOptions(vehicles);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading vehicles:', error);
        this.showSnackbar('Error loading vehicles. Please try again.');
        this.isLoading = false;
      },
    });

    this.subscriptions.push(vehiclesSub);
  }

  private extractFilterOptions(vehicles: Vehicle[]): void {
    // Extract unique makes, types, and colors for filters
    const makesSet = new Set<string>();
    const typesSet = new Set<string>();
    const colorsSet = new Set<string>();

    vehicles.forEach((vehicle) => {
      if (vehicle.makeName) makesSet.add(vehicle.makeName);
      if (vehicle.type) typesSet.add(vehicle.type);
      if (vehicle.color) colorsSet.add(vehicle.color);
    });

    this.makes = Array.from(makesSet).sort();
    this.vehicleTypes = Array.from(typesSet).sort();
    this.colors = Array.from(colorsSet).sort();
  }

  refreshVehicles(): void {
    this.loadVehicles();
  }

  createNewVehicle(): void {
    this.router.navigate(['/vehicles/new']);
  }

  viewVehicleDetails(vehicle: Vehicle): void {
    this.router.navigate(['/vehicles', vehicle.registration]);
  }

  editVehicle(vehicle: Vehicle, event: Event): void {
    event.stopPropagation(); // Prevent row click event
    this.router.navigate(['/vehicles', vehicle.registration, 'edit']);
  }

  viewVehicleJobs(vehicle: Vehicle, event: Event): void {
    event.stopPropagation(); // Prevent row click event
    this.router.navigate(['/jobs'], {
      queryParams: {
        registration: vehicle.registration,
      },
    });
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';

    if (typeof date === 'string') {
      date = new Date(date);
    }

    // Handle Firebase Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
      const timestamp = date as unknown as { toDate: () => Date };
      date = timestamp.toDate();
    }

    return date.toLocaleDateString();
  }

  getColorHex(colorName: string): string {
    return this.colorMap[colorName] || '#CCCCCC'; // Default gray if not found
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
