import {
  Component,
  OnInit,
  ViewChild,
  AfterViewInit,
  TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SelectionModel } from '@angular/cdk/collections';

interface VehicleModel {
  id: string;
  name: string;
  imageUrl: string;
  yearStart: number;
  yearEnd: number | null;
  type: VehicleType;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  specialRequirements: SpecialRequirement[];
  activeJobs: number;
}

enum VehicleType {
  SEDAN = 'Sedan',
  SUV = 'SUV',
  TRUCK = 'Truck',
  VAN = 'Van',
  SPORTS = 'Sports',
}

enum SpecialRequirement {
  ENCLOSED_TRANSPORT = 'Enclosed Transport',
  LIFT_GATE = 'Lift Gate Required',
  OVERSIZED = 'Oversized Vehicle',
  LOWERED = 'Lowered Vehicle',
}

interface Manufacturer {
  id: string;
  name: string;
  logoUrl: string;
  totalModels: number;
  activeJobs: number;
  popularModel: string;
}

@Component({
  selector: 'app-vehicle-models',
  templateUrl: './vehicle-models.component.html',
  styleUrls: ['./vehicle-models.component.scss'],
  standalone: false,
})
export class VehicleModelsComponent implements OnInit, AfterViewInit {
  // Table configuration
  readonly displayedColumns: string[] = [
    'select',
    'model',
    'yearRange',
    'type',
    'dimensions',
    'specialRequirements',
    'activeJobs',
    'actions',
  ];

  dataSource = new MatTableDataSource<VehicleModel>([]);
  selection = new SelectionModel<VehicleModel>(true, []);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // Data
  manufacturer: Manufacturer | null = null;
  modelToDelete: VehicleModel | null = null;
  currentYear = new Date().getFullYear();

  // Dialog state
  dialogData: VehicleModel | null = null;
  isEditMode = false;

  // State
  isLoading = false;
  isAdmin = false; // Should be controlled by auth service

  // Forms
  filterForm!: FormGroup;
  modelForm!: FormGroup;

  // Options for dropdowns
  readonly vehicleTypes = Object.values(VehicleType);
  readonly specialRequirements = Object.values(SpecialRequirement);

  // Template refs
  @ViewChild('modelDialog') modelDialog!: TemplateRef<any>;
  @ViewChild('archiveDialog') archiveDialog!: TemplateRef<any>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar
  ) {
    this.initializeForms();
  }

  private initializeForms() {
    this.filterForm = this.formBuilder.group({
      search: [''],
      types: [[]],
      requirements: [[]],
      yearStart: [1990],
      yearEnd: [this.currentYear],
    });

    this.modelForm = this.formBuilder.group({
      name: ['', Validators.required],
      type: [VehicleType.SEDAN, Validators.required],
      yearStart: [
        this.currentYear,
        [
          Validators.required,
          Validators.min(1990),
          Validators.max(this.currentYear),
        ],
      ],
      yearEnd: [null],
      length: ['', [Validators.required, Validators.min(0)]],
      width: ['', [Validators.required, Validators.min(0)]],
      height: ['', [Validators.required, Validators.min(0)]],
      specialRequirements: [[]],
      imageUrl: [''],
    });
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const manufacturerId = params['id'];
      this.loadManufacturerDetails(manufacturerId);
      this.loadModels(manufacturerId);
    });

    this.filterForm.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomSort();
  }

  private setupCustomSort() {
    this.dataSource.sortingDataAccessor = (
      item: VehicleModel,
      property: string
    ) => {
      switch (property) {
        case 'model':
          return item.name;
        case 'yearRange':
          return item.yearStart;
        case 'activeJobs':
          return item.activeJobs;
        default:
          return (item as any)[property];
      }
    };
  }

  // CRUD Operations
  addModel() {
    this.isEditMode = false;
    this.dialogData = null;
    this.modelForm.reset({
      yearStart: this.currentYear,
      type: VehicleType.SEDAN,
      specialRequirements: [],
    });

    const dialogRef = this.dialog.open(this.modelDialog, {
      width: '600px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.saveModel();
      }
      this.dialogData = null;
    });
  }

  editModel(model: VehicleModel, event: Event) {
    event.stopPropagation();

    this.isEditMode = true;
    this.dialogData = model;
    this.modelForm.patchValue({
      name: model.name,
      type: model.type,
      yearStart: model.yearStart,
      yearEnd: model.yearEnd,
      length: model.dimensions.length,
      width: model.dimensions.width,
      height: model.dimensions.height,
      specialRequirements: model.specialRequirements,
      imageUrl: model.imageUrl,
    });

    const dialogRef = this.dialog.open(this.modelDialog, {
      width: '600px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.updateModel(model.id);
      }
      this.dialogData = null;
    });
  }

  archiveModel(model: VehicleModel, event: Event) {
    event.stopPropagation();
    this.modelToDelete = model;

    const dialogRef = this.dialog.open(this.archiveDialog, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.confirmArchive();
      }
      this.modelToDelete = null;
    });
  }

  saveModel() {
    if (this.modelForm.valid) {
      const formValue = this.modelForm.value;
      const modelData = {
        ...formValue,
        dimensions: {
          length: formValue.length,
          width: formValue.width,
          height: formValue.height,
        },
      };

      // TODO: Implement save logic
      console.log('Saving model:', modelData);

      this.dialog.closeAll();
      this.showSuccessMessage('Model added successfully');
      this.loadModels(this.manufacturer?.id || '');
    }
  }

  updateModel(id: string) {
    if (this.modelForm.valid) {
      const formValue = this.modelForm.value;
      const modelData = {
        id,
        ...formValue,
        dimensions: {
          length: formValue.length,
          width: formValue.width,
          height: formValue.height,
        },
      };

      // TODO: Implement update logic
      console.log('Updating model:', modelData);

      this.dialog.closeAll();
      this.showSuccessMessage('Model updated successfully');
      this.loadModels(this.manufacturer?.id || '');
    }
  }

  confirmArchive() {
    if (this.modelToDelete) {
      // TODO: Implement archive logic
      console.log('Archiving model:', this.modelToDelete.id);

      this.dialog.closeAll();
      this.showSuccessMessage('Model archived successfully');
      this.loadModels(this.manufacturer?.id || '');
    }
  }

  // Filter handling
  applyFilters() {
    const filterValue = this.filterForm.value;

    this.dataSource.filterPredicate = (data: VehicleModel) => {
      const matchesSearch =
        !filterValue.search ||
        data.name.toLowerCase().includes(filterValue.search.toLowerCase());

      const matchesType =
        !filterValue.types.length || filterValue.types.includes(data.type);

      const matchesRequirements =
        !filterValue.requirements.length ||
        filterValue.requirements.every((req: SpecialRequirement) =>
          data.specialRequirements.includes(req)
        );

      const matchesYear =
        data.yearStart >= filterValue.yearStart &&
        (!data.yearEnd || data.yearEnd <= filterValue.yearEnd);

      return matchesSearch && matchesType && matchesRequirements && matchesYear;
    };

    this.dataSource.filter = filterValue.search;
  }

  // Selection handling
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.dataSource.data);
  }

  checkboxLabel(row?: VehicleModel): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${
      row.id
    }`;
  }

  // Navigation
  navigateBack() {
    this.router.navigate(['/vehicles']);
  }

  viewModelDetails(model: VehicleModel) {
    this.router.navigate(['/vehicles', model.id]);
  }

  // Utility Methods
  getRequirementClass(requirement: SpecialRequirement): string {
    const classMap: Record<SpecialRequirement, string> = {
      [SpecialRequirement.ENCLOSED_TRANSPORT]: 'requirement-enclosed',
      [SpecialRequirement.LIFT_GATE]: 'requirement-lift',
      [SpecialRequirement.OVERSIZED]: 'requirement-oversized',
      [SpecialRequirement.LOWERED]: 'requirement-lowered',
    };
    return classMap[requirement];
  }

  loadManufacturerDetails(manufacturerId: string) {
    // TODO: Replace with actual API call
    this.manufacturer = {
      id: manufacturerId,
      name: 'Toyota',
      logoUrl: '/assets/images/car-logos/toyota.png',
      totalModels: 25,
      activeJobs: 12,
      popularModel: 'Corolla',
    };
  }

  loadModels(manufacturerId: string) {
    this.isLoading = true;

    // Simulate API call
    setTimeout(() => {
      const mockData: VehicleModel[] = [
        {
          id: '1',
          name: 'Corolla',
          imageUrl: '/assets/images/corolla.jpg',
          yearStart: 2018,
          yearEnd: null,
          type: VehicleType.SEDAN,
          dimensions: {
            length: 192.7,
            width: 72.4,
            height: 56.9,
          },
          specialRequirements: [SpecialRequirement.LOWERED],
          activeJobs: 5,
        },
      ];

      this.dataSource.data = mockData;
      this.isLoading = false;
    }, 1000);
  }

  showSuccessMessage(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
