import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./pages/dashboard/dashboard.routes').then(
        (m) => m.DASHBOARD_ROUTES
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'jobs',
    loadChildren: () =>
      import('./pages/jobs/jobs.routes').then((m) => m.JOBS_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'drivers',
    loadChildren: () =>
      import('./pages/drivers/drivers.routes').then((m) => m.DRIVERS_ROUTES),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'companies',
    loadChildren: () =>
      import('./pages/companies/companies.routes').then(
        (m) => m.COMPANIES_ROUTES
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'vehicles',
    loadChildren: () =>
      import('./pages/vehicles/vehicles.routes').then((m) => m.VEHICLES_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'billing',
    loadChildren: () =>
      import('./pages/companies/billing/billing.routes').then(
        (m) => m.BILLING_ROUTES
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'expenses',
    loadChildren: () =>
      import('./pages/expenses/expenses.routes').then((m) => m.EXPENSES_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'reports',
    loadChildren: () =>
      import('./pages/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./pages/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'handovers',
    loadChildren: () =>
      import('./pages/handovers/handovers.routes').then(
        (m) => m.HANDOVERS_ROUTES
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'users',
    loadChildren: () =>
      import('./pages/users/users.routes').then((m) => m.USERS_ROUTES),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'audit-logs',
    loadChildren: () =>
      import('./pages/audit-logs/audit-logs.routes').then(
        (m) => m.AUDIT_LOGS_ROUTES
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'error-logs',
    loadChildren: () =>
      import('./pages/error-logs/error-logs.routes').then(
        (m) => m.ERROR_LOGS_ROUTES
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./pages/profile/profile.component').then(
        (m) => m.ProfileComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
