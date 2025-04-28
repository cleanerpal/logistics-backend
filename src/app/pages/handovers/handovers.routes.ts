import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const HANDOVERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./handovers.component').then((m) => m.HandoversComponent),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'history',
    loadComponent: () =>
      import('./handovers-history/handovers-history.component').then(
        (m) => m.HandoversHistoryComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./handover-details/handover-details.component').then(
        (m) => m.HandoverDetailsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
];
