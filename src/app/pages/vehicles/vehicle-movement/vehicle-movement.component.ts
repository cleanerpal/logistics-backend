import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  TmsApiService,
  FuelLevel,
  ApiResponse,
} from '../../../services/tms-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';

enum MovementType {
  COLLECT = 'collect',
  DELIVER = 'deliver',
  ARRIVE = 'arrive',
  DEPART = 'depart',
}

@Component({
    selector: 'app-vehicle-movement',
    templateUrl: './vehicle-movement.component.html',
    styleUrls: ['./vehicle-movement.component.scss'],
    standalone: false
})
export class VehicleMovementComponent implements OnInit {
  movementForm: FormGroup;
  movementType: MovementType = MovementType.COLLECT;
  isLoading = false;
  isAuthenticated = false;

  fuelLevels = [
    { value: FuelLevel.Empty, label: 'Empty' },
    { value: FuelLevel.Quarter, label: 'Quarter' },
    { value: FuelLevel.Half, label: 'Half' },
    { value: FuelLevel.ThreeQuarters, label: 'Three Quarters' },
    { value: FuelLevel.Full, label: 'Full' },
  ];

  movementTypes = [
    { value: MovementType.COLLECT, label: 'Collect Vehicle' },
    { value: MovementType.DELIVER, label: 'Deliver Vehicle' },
    { value: MovementType.ARRIVE, label: 'Vehicle Arrived' },
    { value: MovementType.DEPART, label: 'Vehicle Departed' },
  ];

  constructor(
    private formBuilder: FormBuilder,
    private tmsApiService: TmsApiService,
    private snackBar: MatSnackBar
  ) {
    this.movementForm = this.createForm();
  }

  ngOnInit() {
    this.checkAuthentication();
  }

  /**
   * Check if we're authenticated with the API
   */
  checkAuthentication() {
    this.isAuthenticated = this.tmsApiService.isAuthenticated();
    if (!this.isAuthenticated) {
      this.authenticate();
    }
  }

  /**
   * Authenticate with the API
   */
  authenticate() {
    this.isLoading = true;
    this.tmsApiService.authenticate().subscribe({
      next: (response: { Success: any }) => {
        this.isLoading = false;
        if (response.Success) {
          this.isAuthenticated = true;
          this.presentToast(
            'Successfully authenticated with TMS API',
            'success'
          );
        } else {
          this.presentToast('Authentication failed', 'danger');
        }
      },
      error: (error: { message: string }) => {
        this.isLoading = false;
        this.presentToast('Authentication failed: ' + error.message, 'danger');
      },
    });
  }

  /**
   * Create the form
   */
  createForm(): FormGroup {
    return this.formBuilder.group({
      regno: ['', [Validators.required, Validators.pattern(/^[A-Z0-9]+$/)]],
      date: ['', Validators.required],
      comment: ['', Validators.required],
      mileage: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      fuelorevlevel: [FuelLevel.Half, Validators.required],
      movementType: [MovementType.COLLECT],
    });
  }

  /**
   * Submit the form
   */
  onSubmit() {
    if (this.movementForm.invalid) {
      return;
    }

    this.isLoading = true;
    const formValue = this.movementForm.value;

    // Format the date for the API
    const selectedDate = new Date(formValue.date);
    const formattedDate = this.tmsApiService.formatApiDate(selectedDate);

    // Prepare the base request data
    const baseRequestData = {
      regno: formValue.regno,
      comment: formValue.comment,
      mileage: formValue.mileage,
      fuelorevlevel: formValue.fuelorevlevel,
    };

    // Choose the API method based on the movement type
    let apiCall;

    switch (this.movementType) {
      case MovementType.COLLECT:
        apiCall = this.tmsApiService.vehicleCollected({
          ...baseRequestData,
          collectdate: formattedDate,
        });
        break;

      case MovementType.DELIVER:
        apiCall = this.tmsApiService.vehicleDelivered({
          ...baseRequestData,
          delivereddate: formattedDate,
        });
        break;

      case MovementType.ARRIVE:
        apiCall = this.tmsApiService.vehicleArrived({
          ...baseRequestData,
          delivereddate: formattedDate,
        });
        break;

      case MovementType.DEPART:
        apiCall = this.tmsApiService.vehicleDeparted({
          ...baseRequestData,
          collectdate: formattedDate,
        });
        break;

      default:
        this.isLoading = false;
        this.presentToast('Invalid movement type', 'danger');
        return;
    }

    apiCall.subscribe({
      next: (response: ApiResponse) => {
        this.isLoading = false;
        if (response.Success) {
          this.presentToast(
            'Vehicle movement recorded successfully',
            'success'
          );
          this.movementForm.reset({
            fuelorevlevel: FuelLevel.Half,
            movementType: this.movementType,
          });
        } else {
          // Handle API error response
          const errorMessages = response.Errors?.map(
            (err) => err.ErrorMessage
          ).join(', ');
          this.presentToast(
            `Failed to record vehicle movement: ${errorMessages}`,
            'danger'
          );
        }
      },
      error: (error: { message: string }) => {
        this.isLoading = false;
        this.presentToast(
          'Error recording vehicle movement: ' + error.message,
          'danger'
        );
      },
    });
  }

  /**
   * Handle movement type changes
   */
  onMovementTypeChange(event: { value: MovementType }) {
    this.movementType = event.value;
  }

  /**
   * Show a snackbar message
   */
  presentToast(message: string, color: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass:
        color === 'danger' ? ['error-snackbar'] : ['success-snackbar'],
    });
  }
}
