import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getAuth, provideAuth, connectAuthEmulator } from '@angular/fire/auth';
import { getStorage, provideStorage, connectStorageEmulator } from '@angular/fire/storage';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';

import { MaterialModule } from './material.module';

import { NgxChartsModule } from '@swimlane/ngx-charts';

import { AppRoutingModule } from './app-routing.module';

import { environment } from '../environments/environment';

import { AppComponent } from './app.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { NavSidebarComponent } from './layout/nav-sidebar/nav-sidebar.component';
import { TopbarComponent } from './layout/topbar/topbar.component';

import { JobListComponent } from './pages/jobs/job-list/job-list.component';
import { JobDetailsComponent } from './pages/jobs/job-details/job-details.component';
import { JobCreateComponent } from './pages/jobs/job-create/job-create.component';
import { JobEditComponent } from './pages/jobs/job-edit/job-edit.component';

import { DriverListComponent } from './pages/drivers/driver-list/driver-list.component';
import { DriverCreateComponent } from './pages/drivers/driver-create/driver-create.component';
import { DriverDetailsComponent } from './pages/drivers/driver-details/driver-details.component';
import { DriverEditComponent } from './pages/drivers/driver-edit/driver-edit.component';

import { VehicleListComponent } from './pages/vehicles/vehicle-list/vehicle-list.component';
import { VehicleDetailsComponent } from './pages/vehicles/vehicle-details/vehicle-details.component';
import { VehicleCreateComponent } from './pages/vehicles/vehicle-create/vehicle-create.component';
import { VehicleModelsComponent } from './pages/vehicles/vehicle-models/vehicle-models.component';

import { CustomerListComponent } from './pages/customers/customers-list/customer-list.component';
import { CustomerCreateComponent } from './pages/customers/customer-create/customer-create.component';
import { CustomerDetailsComponent } from './pages/customers/customer-details/customer-details.component';

import { ExpenseCreateComponent } from './pages/expenses/expense-create/expense-create.component';
import { ExpenseListComponent } from './pages/expenses/expense-list/expense-list.component';

import { ConfirmationDialogComponent } from './dialogs/confirmation-dialog.component';
import { DriverSelectionDialogComponent } from './dialogs/driver-selection-dialog.component';
import { JobDuplicateDialogComponent } from './dialogs/job-duplicate-dialog.component';

import { JobService } from './services/job.service';
import { AuthService } from './services/auth.service';
import { VehicleService } from './services/vehicle.service';
import { CustomerService } from './services/customer.service';
import { ExpenseService } from './services/expense.service';
import { NotificationService } from './services/notification.service';
import { FirebaseService } from './services/firebase.service';

import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';

import { TimeAgoPipe } from './shared/pipes/time-ago.pipe';

@NgModule({
  declarations: [
    AppComponent,

    NavSidebarComponent,
    TopbarComponent,

    DashboardComponent,

    JobListComponent,
    JobDetailsComponent,
    JobCreateComponent,
    JobEditComponent,

    DriverListComponent,
    DriverCreateComponent,
    DriverDetailsComponent,
    DriverEditComponent,

    VehicleListComponent,
    VehicleDetailsComponent,
    VehicleCreateComponent,
    VehicleModelsComponent,

    CustomerListComponent,
    CustomerCreateComponent,
    CustomerDetailsComponent,

    ExpenseCreateComponent,
    ExpenseListComponent,

    ConfirmationDialogComponent,
    DriverSelectionDialogComponent,
    JobDuplicateDialogComponent,

    TimeAgoPipe,
  ],
  imports: [BrowserModule, BrowserAnimationsModule, FormsModule, ReactiveFormsModule, HttpClientModule, MaterialModule, NgxChartsModule, AppRoutingModule],
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => {
      const firestore = getFirestore();

      return firestore;
    }),
    provideAuth(() => {
      const auth = getAuth();

      return auth;
    }),
    provideStorage(() => {
      const storage = getStorage();

      return storage;
    }),
    provideFunctions(() => {
      const functions = getFunctions();

      return functions;
    }),

    JobService,
    AuthService,
    VehicleService,
    CustomerService,
    ExpenseService,
    NotificationService,
    FirebaseService,

    AuthGuard,
    RoleGuard,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
