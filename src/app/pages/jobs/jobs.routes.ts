import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const JOBS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./jobs-list/jobs-list.component').then(
        (m) => m.JobsListComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./job-form/job-form.component').then((m) => m.JobFormComponent),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'edit/:id',
    loadComponent: () =>
      import('./job-form/job-form.component').then((m) => m.JobFormComponent),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./job-details/job-details.component').then(
        (m) => m.JobDetailsComponent
      ),
    canActivate: [authGuard],
  },
];
