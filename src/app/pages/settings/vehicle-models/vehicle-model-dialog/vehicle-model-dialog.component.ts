import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VehicleMake, VehicleModel } from '../../../../services/vehicle.service';

interface DialogData {
  isEdit: boolean;
  model?: VehicleModel;
  makes: VehicleMake[];
}

@Component({
  selector: 'app-vehicle-model-dialog',
  templateUrl: './vehicle-model-dialog.component.html',
  styleUrls: ['./vehicle-model-dialog.component.scss'],
  standalone: false,
})
export class VehicleModelDialogComponent implements OnInit {
  modelForm!: FormGroup;
  isEdit: boolean;
  availableMakes: VehicleMake[] = [];

  vehicleTypes: string[] = ['Car', 'Van', 'SUV', 'Truck', 'Motorbike', 'Bus', 'Lorry', 'Trailer'];

  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<VehicleModelDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.isEdit = data.isEdit;
    this.availableMakes = data.makes || [];
  }

  ngOnInit(): void {
    this.createForm();
  }

  createForm(): void {
    this.modelForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      makeId: ['', Validators.required],
      type: ['Car', Validators.required],
      isActive: [true],
    });

    if (this.isEdit && this.data.model) {
      this.modelForm.patchValue({
        name: this.data.model.name,
        makeId: this.data.model.makeId,
        type: this.data.model.type || 'Car',
        isActive: this.data.model.isActive,
      });

      // If editing, disable the make field if the make is inactive
      const makeStillActive = this.availableMakes.some((make) => make.id === this.data.model?.makeId);

      if (!makeStillActive && this.data.model?.makeId) {
        // Make isn't in the active list, but we need to show it anyway
        const makeId = this.data.model.makeId;

        // Display a disabled option for the inactive make
        this.modelForm.get('makeId')?.disable();
      }
    }
  }

  onSubmit(): void {
    if (this.modelForm.invalid) {
      return;
    }

    const formValue = this.modelForm.value;

    // If the makeId control is disabled, we need to get its value manually
    const makeId = this.modelForm.get('makeId')?.disabled ? this.data.model?.makeId : formValue.makeId;

    const modelData: Partial<VehicleModel> = {
      name: formValue.name,
      makeId: makeId,
      type: formValue.type,
      isActive: formValue.isActive,
    };

    this.dialogRef.close(modelData);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  // Get display name for a make by ID
  getMakeName(makeId: string): string {
    const make = this.availableMakes.find((m) => m.id === makeId);
    return make ? make.displayName : 'Unknown';
  }
}
