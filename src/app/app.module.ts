import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { NavSidebarComponent } from './layout/nav-sidebar/nav-sidebar.component';
import { TopbarComponent } from './layout/topbar/topbar.component';
import { JobListComponent } from './pages/jobs/job-list/job-list.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { JobDetailsComponent } from './pages/jobs/job-details/job-details.component';
import { JobCreateComponent } from './pages/jobs/job-create/job-create.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { VehicleModelsComponent } from './pages/vehicles/vehicle-models/vehicle-models.component';

import { DriverListComponent } from './pages/drivers/driver-list/driver-list.component';
import { MaterialModule } from './material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CompaniesListComponent } from './pages/companies/companies-list/companies-list.component';
import { CompanyCreateComponent } from './pages/companies/company-create/company-create.component';
import { CompanyDetailsComponent } from './pages/companies/company-details/company-details.component';
import { DriverCreateComponent } from './pages/drivers/driver-create/driver-create.component';
import { DriverDetailsComponent } from './pages/drivers/driver-details/driver-details.component';
import { provideNgxMask } from 'ngx-mask';
import { VehicleListComponent } from './pages/vehicles/vehicle-list/vehicle-list.component';
import { VehicleDetailsComponent } from './pages/vehicles/vehicle-details/vehicle-details.component';
import { ConfirmationDialogComponent } from './dialogs/confirmation-dialog.component';
import { VehicleCreateComponent } from './pages/vehicles/vehicle-create/vehicle-create.component';
import { TimeAgoPipe } from './shared/pipes/time-ago.pipe';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    NavSidebarComponent,
    TopbarComponent,
    DriverListComponent,
    DriverCreateComponent,
    DriverDetailsComponent,
    JobListComponent,
    JobCreateComponent,
    JobDetailsComponent,
    CompaniesListComponent,
    CompanyCreateComponent,
    CompanyDetailsComponent,
    VehicleListComponent,
    VehicleModelsComponent,
    VehicleDetailsComponent,
    VehicleCreateComponent,
    ConfirmationDialogComponent,
    TimeAgoPipe,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    NgxChartsModule,
    MaterialModule,
  ],
  providers: [provideNgxMask()],
  bootstrap: [AppComponent],
})
export class AppModule {}
