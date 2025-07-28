import { Component, OnInit, HostListener } from '@angular/core';
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
      label: 'Company Vehicles',
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
  isCollapsed = false;

  constructor(private authService: AuthService) {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.authService.isAdmin().subscribe((isAdmin) => {
      this.isAdmin = isAdmin;
      this.updateVisibleNavItems();
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    this.isCollapsed = window.innerWidth <= 1024;
  }

  private updateVisibleNavItems(): void {
    this.visibleNavItems = this.navItems.filter((item) => !item.requiresAdmin || (item.requiresAdmin && this.isAdmin));
  }
}
