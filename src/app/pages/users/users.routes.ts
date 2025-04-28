import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./user-management/user-management.component').then(
        (m) => m.UserManagementComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./user-form/user-form.component').then(
        (m) => m.UserFormComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'edit/:id',
    loadComponent: () =>
      import('./user-form/user-form.component').then(
        (m) => m.UserFormComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
];
