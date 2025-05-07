import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

import { SettingsRoutingModule } from './settings-routing.module';
import { MaterialModule } from '../../material.module';

import { SettingsComponent } from './settings.component';
import { VehicleMakesComponent } from './vehicle-makes/vehicle-makes.component';
import { VehicleModelsComponent } from './vehicle-models/vehicle-models.component';
import { UserRolesComponent } from './user-roles/user-roles.component';
import { SystemPreferencesComponent } from './system-preferences/system-preferences.component';
import { VehicleMakeDialogComponent } from './vehicle-makes/vehicle-make-dialog/vehicle-make-dialog.component';
import { VehicleModelDialogComponent } from './vehicle-models/vehicle-model-dialog/vehicle-model-dialog.component';
import { UserRoleDialogComponent } from './user-roles/user-role-dialog/user-role-dialog.component';

@NgModule({
  declarations: [
    SettingsComponent,
    VehicleMakesComponent,
    VehicleModelsComponent,
    UserRolesComponent,
    SystemPreferencesComponent,
    VehicleMakeDialogComponent,
    VehicleModelDialogComponent,
    UserRoleDialogComponent,
  ],
  imports: [CommonModule, SettingsRoutingModule, MaterialModule, ReactiveFormsModule],
})
export class SettingsModule {}
