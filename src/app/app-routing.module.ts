import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { JobDetailsComponent } from './pages/jobs/job-details/job-details.component';
import { JobListComponent } from './pages/jobs/job-list/job-list.component';
import { DriverListComponent } from './pages/drivers/driver-list/driver-list.component';
import { VehicleModelsComponent } from './pages/vehicles/vehicle-models/vehicle-models.component';
import { JobCreateComponent } from './pages/jobs/job-create/job-create.component';
import { JobEditComponent } from './pages/jobs/job-edit/job-edit.component';
import { DriverCreateComponent } from './pages/drivers/driver-create/driver-create.component';
import { DriverDetailsComponent } from './pages/drivers/driver-details/driver-details.component';
import { VehicleListComponent } from './pages/vehicles/vehicle-list/vehicle-list.component';
import { VehicleDetailsComponent } from './pages/vehicles/vehicle-details/vehicle-details.component';
import { VehicleCreateComponent } from './pages/vehicles/vehicle-create/vehicle-create.component';

import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { CustomerListComponent } from './pages/customers/customers-list/customer-list.component';
import { CustomerCreateComponent } from './pages/customers/customer-create/customer-create.component';
import { CustomerDetailsComponent } from './pages/customers/customer-details/customer-details.component';
import { DriverEditComponent } from './pages/drivers/driver-edit/driver-edit.component';
import { ExpenseListComponent } from './pages/expenses/expense-list/expense-list.component';
import { ExpenseCreateComponent } from './pages/expenses/expense-create/expense-create.component';

const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.module').then((m) => m.AuthModule),
  },

  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'jobs',
    canActivate: [AuthGuard],
    children: [
      { path: '', component: JobListComponent },
      {
        path: 'new',
        component: JobCreateComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canCreateJobs', 'isAdmin'] },
      },
      { path: ':id', component: JobDetailsComponent },
      {
        path: ':id/edit',
        component: JobEditComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canEditJobs', 'isAdmin'] },
      },
    ],
  },
  {
    path: 'drivers',
    canActivate: [AuthGuard],
    children: [
      { path: '', component: DriverListComponent },
      {
        path: 'new',
        component: DriverCreateComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canManageUsers', 'isAdmin'] },
      },
      { path: ':id', component: DriverDetailsComponent },
      {
        path: ':id/edit',
        component: DriverEditComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canManageUsers', 'isAdmin'] },
      },
    ],
  },
  {
    path: 'customers',
    canActivate: [AuthGuard],
    children: [
      { path: '', component: CustomerListComponent },
      {
        path: 'new',
        component: CustomerCreateComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canManageUsers', 'isAdmin'] },
      },
      { path: ':id', component: CustomerDetailsComponent },
      {
        path: ':id/edit',
        component: CustomerCreateComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canManageUsers', 'isAdmin'] },
      },
    ],
  },
  {
    path: 'vehicles',
    canActivate: [AuthGuard],
    children: [
      { path: '', component: VehicleListComponent },
      {
        path: 'new',
        component: VehicleCreateComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canManageUsers', 'isAdmin'] },
      },
      {
        path: 'models',
        component: VehicleModelsComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canManageUsers', 'isAdmin'] },
      },
      { path: ':id', component: VehicleDetailsComponent },
      {
        path: ':id/edit',
        component: VehicleCreateComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canManageUsers', 'isAdmin'] },
      },
    ],
  },
  {
    path: 'expenses',
    canActivate: [AuthGuard],
    children: [
      { path: '', component: ExpenseListComponent },
      {
        path: 'new',
        component: ExpenseCreateComponent,
      },
      {
        path: 'new/:jobId',
        component: ExpenseCreateComponent,
      },
    ],
  },

  {
    path: 'settings',
    loadChildren: () => import('./pages/settings/settings.module').then((m) => m.SettingsModule),
    canActivate: [RoleGuard],
    data: { permissions: ['isAdmin'] },
  },

  { path: '**', redirectTo: '/dashboard' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
