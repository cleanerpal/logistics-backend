import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./analytics/analytics.component').then(
        (m) => m.AnalyticsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'performance',
    loadComponent: () =>
      import('./performance/performance.component').then(
        (m) => m.PerformanceComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'operations',
    loadComponent: () =>
      import('./operations/operations.component').then(
        (m) => m.OperationsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'financial',
    loadComponent: () =>
      import('./financial/financial.component').then(
        (m) => m.FinancialComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
];
