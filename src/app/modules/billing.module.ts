import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { JobBillingComponent } from '../components/job-billing/job-billing.component';
import { BillingDashboardComponent } from '../pages/billing/billing-dashboard.component';
import { BillingSettingsComponent } from '../pages/settings/billing-settings/billing-settings.component';

import { JobBillingService } from '../services/job-billing.service';
import { EmailService } from '../services/email.service';

import { AuthGuard } from '../guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: BillingDashboardComponent,
    canActivate: [AuthGuard],
    data: { title: 'Billing Dashboard' },
  },
  {
    path: 'dashboard',
    component: BillingDashboardComponent,
    canActivate: [AuthGuard],
    data: { title: 'Billing Dashboard' },
  },
  {
    path: 'settings',
    component: BillingSettingsComponent,
    canActivate: [AuthGuard],
    data: { title: 'Billing Settings' },
  },
];

@NgModule({
  declarations: [JobBillingComponent, BillingDashboardComponent, BillingSettingsComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),

    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatChipsModule,
    MatExpansionModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  providers: [JobBillingService, EmailService],
  exports: [JobBillingComponent, BillingDashboardComponent, BillingSettingsComponent],
})
export class BillingModule {}
