import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const DRIVERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./drivers-list/drivers-list.component').then(
        (m) => m.DriversListComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./driver-form/driver-form.component').then(
        (m) => m.DriverFormComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'edit/:id',
    loadComponent: () =>
      import('./driver-form/driver-form.component').then(
        (m) => m.DriverFormComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./driver-details/driver-details.component').then(
        (m) => m.DriverDetailsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: ':id/jobs',
    loadComponent: () =>
      import('./driver-jobs/driver-jobs.component').then(
        (m) => m.DriverJobsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
];
