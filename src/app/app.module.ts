// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Firebase imports
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getStorage, provideStorage } from '@angular/fire/storage';

// Routing
import { AppRoutingModule } from './app-routing.module';

// Components
import { AppComponent } from './app.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { NavSidebarComponent } from './layout/nav-sidebar/nav-sidebar.component';
import { TopbarComponent } from './layout/topbar/topbar.component';
import { JobListComponent } from './pages/jobs/job-list/job-list.component';
import { JobDetailsComponent } from './pages/jobs/job-details/job-details.component';
import { JobCreateComponent } from './pages/jobs/job-create/job-create.component';
import { JobEditComponent } from './pages/jobs/job-edit/job-edit.component';
import { DriverListComponent } from './pages/drivers/driver-list/driver-list.component';
import { VehicleModelsComponent } from './pages/vehicles/vehicle-models/vehicle-models.component';
import { DriverCreateComponent } from './pages/drivers/driver-create/driver-create.component';
import { DriverDetailsComponent } from './pages/drivers/driver-details/driver-details.component';
import { VehicleListComponent } from './pages/vehicles/vehicle-list/vehicle-list.component';
import { VehicleDetailsComponent } from './pages/vehicles/vehicle-details/vehicle-details.component';
import { ConfirmationDialogComponent } from './dialogs/confirmation-dialog.component';
import { VehicleCreateComponent } from './pages/vehicles/vehicle-create/vehicle-create.component';
import { TimeAgoPipe } from './shared/pipes/time-ago.pipe';
import { ExpenseCreateComponent } from './pages/expenses/expense-create/expense-create.component';
import { ExpenseListComponent } from './pages/expenses/expense-list/expense-list.component';
import { VehicleMovementComponent } from './pages/vehicles/vehicle-movement/vehicle-movement.component';

// Material design imports
import { MaterialModule } from './material.module';

// Charts
import { NgxChartsModule } from '@swimlane/ngx-charts';

// Services
import { JobService } from './services/job.service';
import { AuthService } from './services/auth.service';
import { VehicleService } from './services/vehicle.service';
import { CustomerService } from './services/customer.service';
import { ExpenseService } from './services/expense.service';
import { NotificationService } from './services/notification.service';

// Other providers
import { provideNgxMask } from 'ngx-mask';
import { FirebaseService } from './services/firebase.service';
import { DriverSelectionDialogComponent } from './dialogs/driver-selection-dialog.component';
import { environment } from '../environments/environment.prod';
import { CustomerListComponent } from './pages/customers/customers-list/customer-list.component';
import { CustomerCreateComponent } from './pages/customers/customer-create/customer-create.component';
import { CustomerDetailsComponent } from './pages/customers/customer-details/customer-details.component';
import { DriverEditComponent } from './pages/drivers/driver-edit/driver-edit.component';
import { JobDuplicateDialogComponent } from './dialogs/job-duplicate-dialog.component';

@NgModule({
  declarations: [
    // App Core Components
    AppComponent,
    DashboardComponent,

    // Layout Components
    NavSidebarComponent,
    TopbarComponent,

    // Driver Components
    DriverListComponent,
    DriverCreateComponent,
    DriverDetailsComponent,
    DriverEditComponent,

    // Job Components
    JobListComponent,
    JobCreateComponent,
    JobDetailsComponent,
    JobEditComponent,
    JobDuplicateDialogComponent,

    // Vehicle Components
    VehicleListComponent,
    VehicleCreateComponent,
    VehicleDetailsComponent,
    VehicleModelsComponent,
    VehicleMovementComponent,

    // Customer Components
    CustomerListComponent,
    CustomerCreateComponent,
    CustomerDetailsComponent,

    // Expense Components
    ExpenseListComponent,
    ExpenseCreateComponent,

    // Dialogs
    ConfirmationDialogComponent,
    DriverSelectionDialogComponent,

    // Pipes
    TimeAgoPipe,
  ],
  imports: [BrowserModule, BrowserAnimationsModule, AppRoutingModule, FormsModule, ReactiveFormsModule, NgxChartsModule, MaterialModule],
  providers: [
    provideNgxMask(),
    FirebaseService,
    JobService,
    AuthService,
    VehicleService,
    CustomerService,
    ExpenseService,
    NotificationService,
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
    provideStorage(() => getStorage()),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
