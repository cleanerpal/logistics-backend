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

const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  {
    path: 'jobs',
    children: [
      { path: '', component: JobListComponent },
      { path: 'new', component: JobCreateComponent },
      { path: ':id', component: JobDetailsComponent },
    ],
  },
  {
    path: 'drivers',
    children: [
      { path: '', component: DriverListComponent },
      { path: 'new', component: DriverCreateComponent },
      { path: ':id', component: DriverDetailsComponent },
    ],
  },
  {
    path: 'companies',
    children: [
      { path: '', component: CompaniesListComponent },
      { path: 'new', component: CompanyCreateComponent },
      { path: ':id', component: CompanyDetailsComponent },
    ],
  },
  {
    path: 'vehicles',
    children: [
      { path: '', component: VehicleListComponent },
      { path: 'new', component: VehicleCreateComponent },
      { path: 'models', component: VehicleModelsComponent },
      { path: ':id', component: VehicleDetailsComponent },
    ],
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
