// nav-sidebar.component.ts
import { Component } from '@angular/core';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  active: boolean;
}

@Component({
  selector: 'app-nav-sidebar',
  templateUrl: './nav-sidebar.component.html',
  styleUrls: ['./nav-sidebar.component.scss'],
})
export class NavSidebarComponent {
  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/', active: true },
    { label: 'Jobs', icon: 'work', route: '/jobs', active: false },
    { label: 'Drivers', icon: 'people', route: '/drivers', active: false },
    {
      label: 'Companies',
      icon: 'business',
      route: '/companies',
      active: false,
    },
    {
      label: 'Vehicles',
      icon: 'directions_car',
      route: '/vehicles',
      active: false,
    },
    {
      label: 'Expenses',
      icon: 'receipt_long',
      route: '/expenses',
      active: false,
    },
  ];
}
