import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const EXPENSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./expenses.component').then((m) => m.ExpensesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./expense-form/expense-form.component').then(
        (m) => m.ExpenseFormComponent
      ),
    canActivate: [authGuard],
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./expense-details/expense-details.component').then(
        (m) => m.ExpenseDetailsComponent
      ),
    canActivate: [authGuard],
  },
];
