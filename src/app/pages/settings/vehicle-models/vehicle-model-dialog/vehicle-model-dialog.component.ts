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

      const makeStillActive = this.availableMakes.some((make) => make.id === this.data.model?.makeId);

      if (!makeStillActive && this.data.model?.makeId) {
        const makeId = this.data.model.makeId;

        this.modelForm.get('makeId')?.disable();
      }
    }
  }

  onSubmit(): void {
    if (this.modelForm.invalid) {
      return;
    }

    const formValue = this.modelForm.value;

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

  getMakeName(makeId: string): string {
    const make = this.availableMakes.find((m) => m.id === makeId);
    return make ? make.displayName : 'Unknown';
  }
}
