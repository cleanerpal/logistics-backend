import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const EXPENSES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./expenses-list/expenses-list.component').then(
        (m) => m.ExpensesListComponent
      ),
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
