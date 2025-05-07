import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { VehicleMakesComponent } from './vehicle-makes/vehicle-makes.component';
import { VehicleModelsComponent } from './vehicle-models/vehicle-models.component';
import { UserRolesComponent } from './user-roles/user-roles.component';
import { SystemPreferencesComponent } from './system-preferences/system-preferences.component';
import { RoleGuard } from '../../guards/role.guard';

const routes: Routes = [
  {
    path: '',
    component: SettingsComponent,
    canActivate: [RoleGuard],
    data: { permissions: ['isAdmin'] },
    children: [
      {
        path: '',
        redirectTo: 'vehicle-makes',
        pathMatch: 'full',
      },
      {
        path: 'vehicle-makes',
        component: VehicleMakesComponent,
      },
      {
        path: 'vehicle-models',
        component: VehicleModelsComponent,
      },
      {
        path: 'user-roles',
        component: UserRolesComponent,
      },
      {
        path: 'system-preferences',
        component: SystemPreferencesComponent,
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsRoutingModule {}
