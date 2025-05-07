import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VehicleMake } from '../../../../services/vehicle.service';
import { MatChipInputEvent } from '@angular/material/chips';
import { COMMA, ENTER } from '@angular/cdk/keycodes';

interface DialogData {
  isEdit: boolean;
  make?: VehicleMake;
}

@Component({
  selector: 'app-vehicle-make-dialog',
  templateUrl: './vehicle-make-dialog.component.html',
  styleUrls: ['./vehicle-make-dialog.component.scss'],
  standalone: false,
})
export class VehicleMakeDialogComponent implements OnInit {
  vehicleMakeForm!: FormGroup;
  isEdit: boolean;
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  vehicleTypes: string[] = [];
  materialIcons: string[] = [
    'directions_car',
    'motorcycle',
    'local_shipping',
    'airport_shuttle',
    'commute',
    'electric_car',
    'electric_bike',
    'electric_moped',
    'emoji_transportation',
    'delivery_dining',
    'pedal_bike',
    'two_wheeler',
  ];

  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<VehicleMakeDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.isEdit = data.isEdit;

    if (this.isEdit && data.make) {
      this.vehicleTypes = [...(data.make.vehicleTypes || [])];
    }
  }

  ngOnInit(): void {
    this.createForm();
  }

  createForm(): void {
    this.vehicleMakeForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern('[a-zA-Z0-9-_]+')]],
      displayName: ['', Validators.required],
      icon: ['directions_car'],
      type: [''],
      isActive: [true],
    });

    if (this.isEdit && this.data.make) {
      this.vehicleMakeForm.patchValue({
        name: this.data.make.name,
        displayName: this.data.make.displayName,
        icon: this.data.make.icon || 'directions_car',
        isActive: this.data.make.isActive,
      });
    }
  }

  onSubmit(): void {
    if (this.vehicleMakeForm.invalid) {
      return;
    }

    const formValue = this.vehicleMakeForm.value;

    const makeData: Partial<VehicleMake> = {
      name: formValue.name,
      displayName: formValue.displayName,
      type: formValue.type || 'Car',
      icon: formValue.icon,
      vehicleTypes: this.vehicleTypes,
      isActive: formValue.isActive,
    };

    this.dialogRef.close(makeData);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  addVehicleType(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    if (value) {
      this.vehicleTypes.push(value);
    }

    event.chipInput!.clear();
    this.vehicleMakeForm.get('type')?.reset();
  }

  removeVehicleType(type: string): void {
    const index = this.vehicleTypes.indexOf(type);

    if (index >= 0) {
      this.vehicleTypes.splice(index, 1);
    }
  }
}
