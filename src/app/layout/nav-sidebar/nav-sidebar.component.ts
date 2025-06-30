// nav-sidebar.component.ts
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  active: boolean;
  requiresAdmin?: boolean;
}

@Component({
  selector: 'app-nav-sidebar',
  templateUrl: './nav-sidebar.component.html',
  styleUrls: ['./nav-sidebar.component.scss'],
  standalone: false,
})
export class NavSidebarComponent implements OnInit {
  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/', active: true },
    { label: 'Jobs', icon: 'work', route: '/jobs', active: false },
    { label: 'Drivers', icon: 'people', route: '/drivers', active: false },
    {
      label: 'Customers',
      icon: 'business',
      route: '/customers',
      active: false,
    },
    {
      label: 'Vehicles',
      icon: 'directions_car',
      route: '/vehicles',
      active: false,
    },
    {
      label: 'Invoices',
      icon: 'receipt_long',
      route: '/expenses',
      active: false,
    },
    {
      label: 'Settings',
      icon: 'settings',
      route: '/settings',
      active: false,
      requiresAdmin: true,
    },
  ];

  isAdmin = false;
  visibleNavItems: NavItem[] = [];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.isAdmin().subscribe((isAdmin) => {
      this.isAdmin = isAdmin;
      this.updateVisibleNavItems();
    });
  }

  private updateVisibleNavItems(): void {
    this.visibleNavItems = this.navItems.filter((item) => !item.requiresAdmin || (item.requiresAdmin && this.isAdmin));
  }
}
