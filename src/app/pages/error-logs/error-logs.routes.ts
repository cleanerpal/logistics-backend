import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const ERROR_LOGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./error-logs-list/error-logs-list.component').then(
        (m) => m.ErrorLogsListComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./error-log-details/error-log-details.component').then(
        (m) => m.ErrorLogDetailsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
];
