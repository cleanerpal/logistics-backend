import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./reports.component').then((m) => m.ReportsComponent),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'driver-performance',
    loadComponent: () =>
      import('./driver-performance/driver-performance.component').then(
        (m) => m.DriverPerformanceComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'vehicle-utilization',
    loadComponent: () =>
      import('./vehicle-utilization/vehicle-utilization.component').then(
        (m) => m.VehicleUtilizationComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'revenue',
    loadComponent: () =>
      import('./revenue-reports/revenue-reports.component').then(
        (m) => m.RevenueReportsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'job-status',
    loadComponent: () =>
      import('./job-status/job-status.component').then(
        (m) => m.JobStatusComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'driver-handover',
    loadComponent: () =>
      import('./driver-handover/driver-handover.component').then(
        (m) => m.DriverHandoverComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'driver-hours',
    loadComponent: () =>
      import('./driver-hours/driver-hours.component').then(
        (m) => m.DriverHoursComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
];
