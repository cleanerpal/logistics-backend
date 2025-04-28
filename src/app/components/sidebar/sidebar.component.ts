import { Component, OnInit } from '@angular/core';
import { RoleService } from '../../services/role.service';
import { Observable, of } from 'rxjs';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface MenuItem {
  text: string;
  icon: string;
  route: string;
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    AsyncPipe,
    MatListModule,
    MatIconModule,
    MatDividerModule,
    RouterLink,
    RouterLinkActive,
  ],
})
export class SidebarComponent implements OnInit {
  isSuperAdmin$: Observable<boolean>;
  isAdmin$: Observable<boolean>;

  menuItems: MenuItem[] = [
    { text: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { text: 'Jobs', icon: 'work', route: '/jobs' },
    {
      text: 'Drivers',
      icon: 'person',
      route: '/drivers',
      roles: ['SuperAdmin', 'Admin'],
    },
    {
      text: 'Companies',
      icon: 'business',
      route: '/companies',
      roles: ['SuperAdmin', 'Admin'],
    },
    { text: 'Vehicles', icon: 'directions_car', route: '/vehicles' },
    {
      text: 'Billing',
      icon: 'receipt',
      route: '/billing',
      roles: ['SuperAdmin', 'Admin'],
    },
    { text: 'Expenses', icon: 'account_balance_wallet', route: '/expenses' },
    {
      text: 'Reports',
      icon: 'assessment',
      route: '/reports',
      roles: ['SuperAdmin', 'Admin'],
    },
  ];

  adminMenuItems: MenuItem[] = [
    {
      text: 'Settings',
      icon: 'settings',
      route: '/settings',
      roles: ['SuperAdmin'],
    },
    {
      text: 'Handovers',
      icon: 'swap_horiz',
      route: '/handovers',
      roles: ['SuperAdmin'],
    },
    {
      text: 'User Management',
      icon: 'people',
      route: '/users',
      roles: ['SuperAdmin'],
    },
    {
      text: 'Audit Logs',
      icon: 'history',
      route: '/audit-logs',
      roles: ['SuperAdmin'],
    },
    {
      text: 'Error Logs',
      icon: 'error',
      route: '/error-logs',
      roles: ['SuperAdmin', 'Admin'],
    },
  ];

  constructor(private roleService: RoleService) {
    this.isSuperAdmin$ = this.roleService.isSuperAdmin();
    this.isAdmin$ = this.roleService.isAdmin();
  }

  ngOnInit(): void {}

  showMenuItem(item: MenuItem): Observable<boolean> {
    if (!item.roles) {
      return of(true);
    }

    if (item.roles.includes('SuperAdmin')) {
      return this.isSuperAdmin$;
    }

    if (item.roles.includes('Admin')) {
      return this.isAdmin$;
    }

    return of(true);
  }
}
