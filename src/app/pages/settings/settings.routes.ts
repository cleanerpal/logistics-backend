import { Routes } from '@angular/router';
import { authGuard } from '../../guards/auth.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./settings-dashboard/settings-dashboard.component').then(
        (m) => m.SettingsDashboardComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'company',
    loadComponent: () =>
      import('./company-settings/company-settings.component').then(
        (m) => m.CompanySettingsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('./notification-settings/notification-settings.component').then(
        (m) => m.NotificationSettingsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'tax',
    loadComponent: () =>
      import('./tax-settings/tax-settings.component').then(
        (m) => m.TaxSettingsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'integrations',
    loadComponent: () =>
      import('./integration-settings/integration-settings.component').then(
        (m) => m.IntegrationSettingsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
  {
    path: 'backup',
    loadComponent: () =>
      import('./backup-settings/backup-settings.component').then(
        (m) => m.BackupSettingsComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['SuperAdmin'] },
  },
];
