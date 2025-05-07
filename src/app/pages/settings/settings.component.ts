import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface SettingsNavItem {
  label: string;
  route: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false,
})
export class SettingsComponent implements OnInit {
  navItems: SettingsNavItem[] = [
    {
      label: 'Vehicle Makes',
      route: '/settings/vehicle-makes',
      icon: 'directions_car',
      description: 'Manage vehicle manufacturers and brands',
    },
    {
      label: 'Vehicle Models',
      route: '/settings/vehicle-models',
      icon: 'model_training',
      description: 'Manage vehicle models associated with makes',
    },
    {
      label: 'User Roles',
      route: '/settings/user-roles',
      icon: 'admin_panel_settings',
      description: 'Configure user roles and permissions',
    },
    {
      label: 'System Preferences',
      route: '/settings/system-preferences',
      icon: 'settings',
      description: 'Global application settings and preferences',
    },
  ];

  isAdmin = false;
  currentYear = new Date().getFullYear();
  appVersion = '1.0.0';

  constructor(private router: Router, private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.isAdmin().subscribe((isAdmin) => {
      this.isAdmin = isAdmin;

      // If not admin, redirect to home
      if (!isAdmin) {
        this.router.navigate(['/']);
      }
    });
  }

  isActive(route: string): boolean {
    return this.router.isActive(route, true);
  }
}
