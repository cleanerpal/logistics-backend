import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const VEHICLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./vehicles.component').then((m) => m.VehiclesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./vehicle-form/vehicle-form.component').then(
        (m) => m.VehicleFormComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'edit/:id',
    loadComponent: () =>
      import('./vehicle-form/vehicle-form.component').then(
        (m) => m.VehicleFormComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: ':id/jobs',
    loadComponent: () =>
      import('./vehicle-jobs/vehicle-jobs.component').then(
        (m) => m.VehicleJobsComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./vehicle-details/vehicle-details.component').then(
        (m) => m.VehicleDetailsComponent
      ),
    canActivate: [authGuard],
  },
];
