import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavSidebarComponent } from './layout/nav-sidebar/nav-sidebar.component';
import { TopbarComponent } from './layout/topbar/topbar.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { JobCreateComponent } from './pages/jobs/job-create/job-create.component';
import { JobDetailsComponent } from './pages/jobs/job-details/job-details.component';
import { JobListComponent } from './pages/jobs/job-list/job-list.component';
import { VehicleModelsComponent } from './pages/vehicles/vehicle-models/vehicle-models.component';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideNgxMask } from 'ngx-mask';
import { ConfirmationDialogComponent } from './dialogs/confirmation-dialog.component';
import { MaterialModule } from './material.module';
import { CompaniesListComponent } from './pages/companies/companies-list/companies-list.component';
import { CompanyCreateComponent } from './pages/companies/company-create/company-create.component';
import { CompanyDetailsComponent } from './pages/companies/company-details/company-details.component';
import { DriverCreateComponent } from './pages/drivers/driver-create/driver-create.component';
import { DriverDetailsComponent } from './pages/drivers/driver-details/driver-details.component';
import { DriverListComponent } from './pages/drivers/driver-list/driver-list.component';
import { VehicleCreateComponent } from './pages/vehicles/vehicle-create/vehicle-create.component';
import { VehicleDetailsComponent } from './pages/vehicles/vehicle-details/vehicle-details.component';
import { VehicleListComponent } from './pages/vehicles/vehicle-list/vehicle-list.component';
import { TimeAgoPipe } from './shared/pipes/time-ago.pipe';

// Services
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { provideFirestore } from '@angular/fire/firestore';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../environments/environment.prod';
import { ExpenseCreateComponent } from './pages/expenses/expense-create/expense-create.component';
import { ExpenseListComponent } from './pages/expenses/expense-list/expense-list.component';
import { VehicleMovementComponent } from './pages/vehicles/vehicle-movement/vehicle-movement.component';
import { ExpenseService } from './services/expense.service';
import { NotificationService } from './services/notification.service';
import { provideFunctions } from '@angular/fire/functions';
import { getFunctions } from 'firebase/functions';

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
    ExpenseCreateComponent,
    ExpenseListComponent,
    VehicleMovementComponent,
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
  bootstrap: [AppComponent],
  providers: [
    provideNgxMask(),
    ExpenseService,
    NotificationService,
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => {
      return getAuth();
    }),
    provideFirestore(() => getFirestore()),
    provideFunctions(() => getFunctions()),
    {
      provide: 'GoogleMapsConfig',
      useValue: {
        apiKey: 'AIzaSyC2t1Vx22CqXpItIAIvCickKnnXNHYX-rQ',
      },
    },
  ],
})
export class AppModule {}
