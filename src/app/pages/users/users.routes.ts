import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./users-list/users-list.component').then(
        (m) => m.UsersListComponent
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
  {
    path: ':id',
    loadComponent: () =>
      import('./user-details/user-details.component').then(
        (m) => m.UserDetailsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
];
