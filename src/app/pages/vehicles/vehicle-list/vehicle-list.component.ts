import { Component, OnInit, ViewChild, AfterViewInit, TemplateRef } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatCheckboxChange } from '@angular/material/checkbox';

interface Manufacturer {
  id: string;
  name: string;
  logoUrl: string;
  modelCount: number;
  activeJobs: number;
  lastUpdated: Date;
  isActive: boolean;
}

@Component({
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html',
  styleUrl: './vehicle-list.component.scss',
  standalone: false,
})
export class VehicleListComponent implements OnInit, AfterViewInit {
  // Data source and pagination
  dataSource = new MatTableDataSource<Manufacturer>([]);
  allManufacturers: Manufacturer[] = [];
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // Search and sort
  searchTerm = '';
  sortOption: 'alphabetical' | 'mostUsed' | 'recent' = 'alphabetical';
  showInactive = false;

  // Loading and admin states
  isLoading = false;
  isAdmin = false; // Should be set by auth service

  // Stats
  totalModels = 0;

  // Form
  manufacturerForm: FormGroup;

  // Dialog state
  dialogData: Manufacturer | null = null;
  manufacturerToDelete: Manufacturer | null = null;

  // Template References
  @ViewChild('addManufacturerDialog')
  addManufacturerDialog!: TemplateRef<any>;

  @ViewChild('deleteConfirmDialog')
  deleteConfirmDialog!: TemplateRef<any>;

  constructor(private router: Router, private dialog: MatDialog, private formBuilder: FormBuilder, private snackBar: MatSnackBar) {
    this.manufacturerForm = this.formBuilder.group({
      name: ['', Validators.required],
      logoUrl: [''],
      isActive: [true],
    });
  }

  ngOnInit() {
    this.loadManufacturers();
    this.setupCustomFilter();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private setupCustomFilter() {
    this.dataSource.filterPredicate = (data: Manufacturer, filter: string) => {
      // Check if we should show the item based on active status
      if (!data.isActive && !this.showInactive) {
        return false;
      }

      // If there's no search filter, show the item
      if (!filter) {
        return true;
      }

      // Apply the search filter
      const searchStr = filter.toLowerCase();
      return data.name.toLowerCase().includes(searchStr) || data.modelCount.toString().includes(searchStr) || data.activeJobs.toString().includes(searchStr);
    };
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  toggleShowInactive(event: MatSlideToggleChange) {
    this.showInactive = event.checked;

    // Force a refresh of the filtered data
    const currentFilter = this.dataSource.filter;
    this.dataSource.filter = ''; // Clear filter
    this.dataSource.filter = currentFilter; // Reapply filter

    // If we're showing inactive items, make sure we have all data available
    if (this.showInactive) {
      // Restore any filtered out inactive items
      this.dataSource.data = [...this.allManufacturers];
    }
  }

  toggleManufacturerActive(manufacturer: Manufacturer, event: MatCheckboxChange) {
    manufacturer.isActive = event.checked;

    // Update the manufacturer in the allManufacturers array
    const index = this.allManufacturers.findIndex((m) => m.id === manufacturer.id);
    if (index !== -1) {
      this.allManufacturers[index].isActive = event.checked;
    }

    // If manufacturer is being deactivated and show inactive is false,
    // update the visible data
    if (!manufacturer.isActive && !this.showInactive) {
      this.dataSource.data = this.dataSource.data.filter((m) => m.id !== manufacturer.id);
    }

    // Force filter refresh
    const currentFilter = this.dataSource.filter || '';
    this.dataSource.filter = '';
    this.dataSource.filter = currentFilter;

    // Show success message
    this.showSuccessMessage(`${manufacturer.name} ${manufacturer.isActive ? 'activated' : 'deactivated'} successfully`);

    // Here you would typically make an API call to update the status
  }

  loadManufacturers() {
    this.isLoading = true;

    // Simulate API call
    setTimeout(() => {
      this.allManufacturers = [
        {
          id: '1',
          name: 'Abarth',
          logoUrl: '/assets/images/car-logos/abarth.jpg',
          modelCount: 42,
          activeJobs: 25,
          lastUpdated: new Date('2025-01-30T13:34:46.045172'),
          isActive: true,
        },
      ];

      // Initialize the data source with all manufacturers
      this.dataSource.data = [...this.allManufacturers];

      // Calculate total models
      this.totalModels = this.allManufacturers.reduce((sum, make) => sum + make.modelCount, 0);

      this.isLoading = false;
    }, 1000);
  }

  sortManufacturers(option: 'alphabetical' | 'mostUsed' | 'recent') {
    this.sortOption = option;
    const sortData = [...this.dataSource.data];

    switch (option) {
      case 'alphabetical':
        sortData.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'mostUsed':
        sortData.sort((a, b) => b.activeJobs - a.activeJobs);
        break;
      case 'recent':
        sortData.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
        break;
    }

    this.dataSource.data = sortData;
  }

  // Navigation
  viewModels(manufacturer: Manufacturer) {
    this.router.navigate(['/vehicles/models']);
  }

  // CRUD Operations
  addManufacturer() {
    this.dialogData = null;
    this.manufacturerForm.reset({ isActive: true });

    const dialogRef = this.dialog.open(this.addManufacturerDialog, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.saveManufacturer();
      }
      this.dialogData = null;
    });
  }

  editManufacturer(manufacturer: Manufacturer, event: Event) {
    event.stopPropagation();

    this.dialogData = manufacturer;
    this.manufacturerForm.patchValue({
      name: manufacturer.name,
      logoUrl: manufacturer.logoUrl,
      isActive: manufacturer.isActive,
    });

    const dialogRef = this.dialog.open(this.addManufacturerDialog, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.updateManufacturer(manufacturer.id);
      }
      this.dialogData = null;
    });
  }

  deleteManufacturer(manufacturer: Manufacturer, event: Event) {
    event.stopPropagation();
    this.manufacturerToDelete = manufacturer;

    const dialogRef = this.dialog.open(this.deleteConfirmDialog, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.confirmDelete();
      }
      this.manufacturerToDelete = null;
    });
  }

  saveManufacturer() {
    if (this.manufacturerForm.valid) {
      // Implement save logic
      console.log('Saving manufacturer:', this.manufacturerForm.value);

      this.dialog.closeAll();
      this.showSuccessMessage('Manufacturer added successfully');
      this.loadManufacturers(); // Reload data
    }
  }

  updateManufacturer(id: string) {
    if (this.manufacturerForm.valid) {
      // Implement update logic
      console.log('Updating manufacturer:', id, this.manufacturerForm.value);

      this.dialog.closeAll();
      this.showSuccessMessage('Manufacturer updated successfully');
      this.loadManufacturers(); // Reload data
    }
  }

  confirmDelete() {
    if (this.manufacturerToDelete) {
      // Implement delete logic
      console.log('Deleting manufacturer:', this.manufacturerToDelete.id);

      this.dialog.closeAll();
      this.showSuccessMessage('Manufacturer deleted successfully');
      this.loadManufacturers(); // Reload data
    }
  }

  // Utility Methods
  private showSuccessMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
