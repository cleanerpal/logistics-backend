import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./reports-dashboard/reports-dashboard.component').then(
        (m) => m.ReportsDashboardComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'jobs',
    loadComponent: () =>
      import('./job-reports/job-reports.component').then(
        (m) => m.JobReportsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'drivers',
    loadComponent: () =>
      import('./driver-reports/driver-reports.component').then(
        (m) => m.DriverReportsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'vehicles',
    loadComponent: () =>
      import('./vehicle-reports/vehicle-reports.component').then(
        (m) => m.VehicleReportsComponent
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
    path: 'expenses',
    loadComponent: () =>
      import('./expense-reports/expense-reports.component').then(
        (m) => m.ExpenseReportsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
];
