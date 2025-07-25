import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, forkJoin, of } from 'rxjs';
import { switchMap, catchError, finalize } from 'rxjs/operators';
import { VehicleService, VehicleMake, VehicleModel } from '../../../services/vehicle.service';
import { AuthService } from '../../../services/auth.service';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';

@Component({
  selector: 'app-vehicle-create',
  templateUrl: './vehicle-create.component.html',
  styleUrls: ['./vehicle-create.component.scss'],
  standalone: false,
})
export class VehicleCreateComponent implements OnInit, OnDestroy {
  vehicleForm!: FormGroup;
  isEditMode = false;
  isLoading = false;
  isSubmitting = false;
  vehicleId: string = '';
  currentYear = new Date().getFullYear();

  vehicleMakes: VehicleMake[] = [];
  availableModels: VehicleModel[] = [];
  allModels: VehicleModel[] = [];

  colors: string[] = ['Black', 'White', 'Silver', 'Grey', 'Blue', 'Red', 'Green', 'Yellow', 'Brown', 'Orange', 'Purple', 'Gold', 'Beige'];

  fuelTypes: string[] = ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG', 'Hydrogen', 'Other'];

  transmissionTypes: string[] = ['Manual', 'Automatic', 'Semi-Automatic', 'CVT'];

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

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private vehicleService: VehicleService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.loadReferenceData();

    const routeSub = this.route.params.subscribe((params) => {
      if (params['id']) {
        this.isEditMode = true;
        this.vehicleId = params['id'];
        this.loadVehicleDetails(this.vehicleId);
      }
    });

    this.subscriptions.push(routeSub);
    this.checkPermissions();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private createForm(): void {
    this.vehicleForm = this.formBuilder.group({
      registration: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]+$/)]],
      chassisNumber: ['', [Validators.pattern(/^[A-Z0-9]+$/)]],
      makeId: ['', Validators.required],
      modelId: ['', Validators.required],
      type: [{ value: '', disabled: true }],
      color: ['', Validators.required],
      year: ['', [Validators.required, Validators.min(1900), Validators.max(this.currentYear)]],
      vin: [''],
      engineSize: [''],
      fuelType: [''],
      transmission: [''],
      mileage: [null, Validators.min(0)],
      notes: [''],
    });
  }

  private checkPermissions(): void {
    const authSub = this.authService.hasPermission('canManageUsers').subscribe((hasPermission) => {
      if (!hasPermission) {
        this.showSnackbar('You do not have permission to manage vehicles');
        this.router.navigate(['/vehicles']);
      }
    });

    this.subscriptions.push(authSub);
  }

  private loadReferenceData(): void {
    this.isLoading = true;

    const dataSub = forkJoin({
      makes: this.vehicleService.getVehicleMakes(),
      models: this.vehicleService.getVehicleModels(),
    }).subscribe({
      next: (data) => {
        this.vehicleMakes = data.makes;
        this.allModels = data.models;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading reference data:', error);
        this.showSnackbar('Error loading data. Please try again.');
        this.isLoading = false;
      },
    });

    this.subscriptions.push(dataSub);
  }

  private loadVehicleDetails(vehicleId: string): void {
    this.isLoading = true;

    const vehicleSub = this.vehicleService
      .getVehicleById(vehicleId)
      .pipe(
        catchError((error) => {
          console.error('Error loading vehicle details:', error);
          this.showSnackbar('Error loading vehicle details');
          this.router.navigate(['/vehicles']);
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe((vehicle) => {
        if (vehicle) {
          if (vehicle.makeId) {
            this.updateAvailableModels(vehicle.makeId);
          }

          this.vehicleForm.patchValue({
            registration: vehicle.registration,
            chassisNumber: vehicle.chassisNumber || '',
            makeId: vehicle.makeId,
            modelId: vehicle.modelId,
            type: vehicle.type,
            color: vehicle.color,
            year: vehicle.year,
            vin: vehicle.vin || '',
            engineSize: vehicle.engineSize || '',
            fuelType: vehicle.fuelType || '',
            transmission: vehicle.transmission || '',
            mileage: vehicle.mileage || 0,
            notes: vehicle.notes || '',
          });
        }
      });

    this.subscriptions.push(vehicleSub);
  }

  onMakeChange(): void {
    const makeId = this.vehicleForm.get('makeId')?.value;
    if (makeId) {
      this.updateAvailableModels(makeId);

      this.vehicleForm.get('modelId')?.setValue('');
      this.vehicleForm.get('type')?.setValue('');
    }
  }

  onModelChange(): void {
    const modelId = this.vehicleForm.get('modelId')?.value;
    if (modelId) {
      const selectedModel = this.availableModels.find((model) => model.id === modelId);
      if (selectedModel) {
        this.vehicleForm.get('type')?.setValue(selectedModel.type);
      }
    }
  }

  private updateAvailableModels(makeId: string): void {
    if (!makeId) {
      this.availableModels = [];
      return;
    }

    this.availableModels = this.allModels.filter((model) => model.makeId === makeId && model.isActive);
  }

  save(): void {
    if (this.vehicleForm.invalid || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;

    const formValues = this.vehicleForm.getRawValue();

    const selectedMake = this.vehicleMakes.find((make) => make.id === formValues.makeId);
    const selectedModel = this.availableModels.find((model) => model.id === formValues.modelId);

    if (this.isEditMode) {
      const updateData = {
        registration: formValues.registration.toUpperCase(),
        chassisNumber: formValues.chassisNumber ? formValues.chassisNumber.toUpperCase() : '',
        makeId: formValues.makeId,
        makeName: selectedMake?.displayName || '',
        modelId: formValues.modelId,
        modelName: selectedModel?.name || '',
        type: formValues.type,
        color: formValues.color,
        year: formValues.year,
        vin: formValues.vin ? formValues.vin.toUpperCase() : '',
        engineSize: formValues.engineSize,
        fuelType: formValues.fuelType,
        transmission: formValues.transmission,
        mileage: formValues.mileage || 0,
        notes: formValues.notes,
      };

      this.vehicleService
        .updateVehicle(this.vehicleId, updateData)
        .pipe(finalize(() => (this.isSubmitting = false)))
        .subscribe({
          next: () => {
            this.showSnackbar('Vehicle updated successfully');
            this.router.navigate(['/vehicles', this.vehicleId]);
          },
          error: (error) => {
            console.error('Error updating vehicle:', error);
            this.showSnackbar('Error updating vehicle. Please try again.');
          },
        });
    } else {
      const newVehicleData = {
        registration: formValues.registration.toUpperCase(),
        chassisNumber: formValues.chassisNumber ? formValues.chassisNumber.toUpperCase() : '',
        makeId: formValues.makeId,
        makeName: selectedMake?.displayName || '',
        modelId: formValues.modelId,
        modelName: selectedModel?.name || '',
        type: formValues.type,
        color: formValues.color,
        year: formValues.year,
        vin: formValues.vin ? formValues.vin.toUpperCase() : '',
        engineSize: formValues.engineSize,
        fuelType: formValues.fuelType,
        transmission: formValues.transmission,
        mileage: formValues.mileage || 0,
        notes: formValues.notes,

        firstProcessedDate: new Date(),
        lastProcessedDate: new Date(),
        jobCount: 0,
        jobHistory: [],
      };

      this.vehicleService
        .createVehicle(newVehicleData)
        .pipe(finalize(() => (this.isSubmitting = false)))
        .subscribe({
          next: (id) => {
            this.showSnackbar('Vehicle created successfully');
            this.router.navigate(['/vehicles', id]);
          },
          error: (error) => {
            console.error('Error creating vehicle:', error);
            this.showSnackbar('Error creating vehicle. Please try again.');
          },
        });
    }
  }

  cancel(): void {
    if (this.vehicleForm.dirty) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: {
          title: 'Discard Changes',
          message: 'Are you sure you want to discard your changes?',
          confirmText: 'Discard',
          cancelText: 'Continue Editing',
          confirmColor: 'warn',
        },
        width: '400px',
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          this.navigateBack();
        }
      });
    } else {
      this.navigateBack();
    }
  }

  private navigateBack(): void {
    if (this.isEditMode) {
      this.router.navigate(['/vehicles', this.vehicleId]);
    } else {
      this.router.navigate(['/vehicles']);
    }
  }

  getColorHex(colorName: string): string {
    return this.colorMap[colorName] || '#CCCCCC'; // Default grey if not found
  }

  showSnackbar(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
