import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const HANDOVERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./handovers-list/handovers-list.component').then(
        (m) => m.HandoversListComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./handover-form/handover-form.component').then(
        (m) => m.HandoverFormComponent
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
