import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const BILLING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./billing-list/billing-list.component').then(
        (m) => m.BillingListComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'generate-invoice',
    loadComponent: () =>
      import('./generate-invoice/generate-invoice.component').then(
        (m) => m.GenerateInvoiceComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
  {
    path: 'invoice/:id',
    loadComponent: () =>
      import('./invoice-details/invoice-details.component').then(
        (m) => m.InvoiceDetailsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin', 'Admin'] },
  },
];
