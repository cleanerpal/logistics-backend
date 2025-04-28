import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const COMPANIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./companies.component').then((m) => m.CompaniesComponent),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./company-form/company-form.component').then(
        (m) => m.CompanyFormComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'edit/:id',
    loadComponent: () =>
      import('./company-form/company-form.component').then(
        (m) => m.CompanyFormComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: ':id/addresses',
    loadComponent: () =>
      import('./company-address/company-address.component').then(
        (m) => m.CompanyAddressesComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
];
