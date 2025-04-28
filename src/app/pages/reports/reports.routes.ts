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
];
