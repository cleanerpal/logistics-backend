import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const AUDIT_LOGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./audit-logs-list/audit-logs-list.component').then(
        (m) => m.AuditLogsListComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./audit-log-details/audit-log-details.component').then(
        (m) => m.AuditLogDetailsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
];
