import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { JobDetailsComponent } from './pages/jobs/job-details/job-details.component';
import { JobListComponent } from './pages/jobs/job-list/job-list.component';
import { DriverListComponent } from './pages/drivers/driver-list/driver-list.component';
import { VehicleModelsComponent } from './pages/vehicles/vehicle-models/vehicle-models.component';
import { JobCreateComponent } from './pages/jobs/job-create/job-create.component';
import { CompaniesListComponent } from './pages/companies/companies-list/companies-list.component';
import { CompanyCreateComponent } from './pages/companies/company-create/company-create.component';
import { CompanyDetailsComponent } from './pages/companies/company-details/company-details.component';
import { DriverCreateComponent } from './pages/drivers/driver-create/driver-create.component';
import { DriverDetailsComponent } from './pages/drivers/driver-details/driver-details.component';
import { VehicleListComponent } from './pages/vehicles/vehicle-list/vehicle-list.component';
import { VehicleDetailsComponent } from './pages/vehicles/vehicle-details/vehicle-details.component';
import { VehicleCreateComponent } from './pages/vehicles/vehicle-create/vehicle-create.component';
import { VehicleMovementComponent } from './pages/vehicles/vehicle-movement/vehicle-movement.component';

// Guards
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';

const routes: Routes = [
  // Auth routes (lazy loaded)
  {
    path: 'auth',
    loadChildren: () =>
      import('./pages/auth/auth.module').then((m) => m.AuthModule),
  },

  // Protected routes
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
    ],
  },
  {
    path: 'companies',
    canActivate: [AuthGuard],
    children: [
      { path: '', component: CompaniesListComponent },
      {
        path: 'new',
        component: CompanyCreateComponent,
        canActivate: [RoleGuard],
        data: { permissions: ['canManageUsers', 'isAdmin'] },
      },
      { path: ':id', component: CompanyDetailsComponent },
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
    ],
  },
  {
    path: 'vehicle-movement',
    component: VehicleMovementComponent,
    canActivate: [AuthGuard],
  },

  // Fallback route
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
