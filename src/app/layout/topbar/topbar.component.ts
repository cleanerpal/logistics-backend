// topbar.component.ts
import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

interface Notification {
  id: number;
  type: 'info' | 'alert' | 'success' | 'warning';
  icon: string;
  title: string;
  message?: string;
  time: Date;
  read: boolean;
}

interface SearchResult {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  link: string;
}

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
})
export class TopbarComponent implements OnInit {
  @Output() menuToggled = new EventEmitter<void>();
  @ViewChild('searchInput') searchInput!: ElementRef;

  // User Information
  userName = 'John Doe';
  userEmail = 'john.doe@example.com';
  userRole = 'Administrator';
  userAvatar = 'assets/images/avatar-placeholder.png';
  isUserOnline = true;

  // Search State
  isSearchOpen = false;
  searchQuery = '';
  searchResults: SearchResult[] = [];

  // Theme State
  isDarkTheme = false;

  // Navigation State
  currentSection = '';
  currentPage = '';

  // Notifications
  notifications: Notification[] = [
    {
      id: 1,
      type: 'info',
      icon: 'info',
      title: 'System update available',
      message: 'A new system update is available for installation',
      time: new Date(),
      read: false,
    },
    {
      id: 2,
      type: 'alert',
      icon: 'warning',
      title: 'Server load high',
      message: 'Server CPU usage exceeds 90%',
      time: new Date(Date.now() - 3600000),
      read: false,
    },
    {
      id: 3,
      type: 'success',
      icon: 'check_circle',
      title: 'Backup completed',
      message: 'System backup completed successfully',
      time: new Date(Date.now() - 7200000),
      read: true,
    },
  ];

  constructor(private router: Router) {
    this.setupRouteListener();
  }

  ngOnInit(): void {
    this.updateBreadcrumb();
    this.loadUserPreferences();
  }

  // Navigation Methods
  private setupRouteListener(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateBreadcrumb();
      });
  }

  private updateBreadcrumb(): void {
    const path = this.router.url.split('/').filter((segment) => segment);
    this.currentSection = this.formatBreadcrumb(path[0] || 'Dashboard');
    this.currentPage = path[1] ? this.formatBreadcrumb(path[1]) : '';
  }

  private formatBreadcrumb(segment: string): string {
    return segment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  getCurrentSection(): string {
    return this.currentSection;
  }

  getCurrentPage(): string {
    return this.currentPage;
  }

  // Search Methods
  openSearch(): void {
    this.isSearchOpen = true;
    // Allow DOM to update before focusing
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
      }
    });
  }

  closeSearch(event: MouseEvent): void {
    // Prevent closing when clicking inside the search card
    if ((event.target as HTMLElement).closest('.search-card')) {
      return;
    }
    this.isSearchOpen = false;
    this.searchQuery = '';
    this.searchResults = [];
  }

  onSearch(event: KeyboardEvent): void {
    // Handle escape key
    if (event.key === 'Escape') {
      this.closeSearch(event as unknown as MouseEvent);
      return;
    }

    // Perform search
    if (this.searchQuery.length >= 2) {
      // Example search results - replace with actual search logic
      this.searchResults = [
        {
          id: '1',
          icon: 'dashboard',
          title: 'Dashboard',
          subtitle: 'Overview and analytics',
          link: '/dashboard',
        },
        {
          id: '2',
          icon: 'work',
          title: 'Jobs',
          subtitle: 'Manage and track jobs',
          link: '/jobs',
        },
        {
          id: '3',
          icon: 'business',
          title: 'Companies',
          subtitle: 'View all companies',
          link: '/companies',
        },
        {
          id: '4',
          icon: 'people',
          title: 'Drivers',
          subtitle: 'Driver management',
          link: '/drivers',
        },
      ].filter(
        (result) =>
          result.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          result.subtitle.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    } else {
      this.searchResults = [];
    }
  }

  // Notification Methods
  get hasUnreadNotifications(): boolean {
    return this.notifications.some((notification) => !notification.read);
  }

  getUnreadCount(): number {
    return this.notifications.filter((notification) => !notification.read)
      .length;
  }

  markAllAsRead(): void {
    this.notifications = this.notifications.map((notification) => ({
      ...notification,
      read: true,
    }));
  }

  markAsRead(notification: Notification): void {
    notification.read = true;
  }

  viewAllNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  deleteNotification(notification: Notification): void {
    this.notifications = this.notifications.filter(
      (n) => n.id !== notification.id
    );
  }

  // Theme Methods
  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    document.body.classList.toggle('dark-theme');
    this.saveUserPreferences();
  }

  // User Preference Methods
  private loadUserPreferences(): void {
    const preferences = localStorage.getItem('userPreferences');
    if (preferences) {
      const { isDarkTheme } = JSON.parse(preferences);
      this.isDarkTheme = isDarkTheme;
      if (isDarkTheme) {
        document.body.classList.add('dark-theme');
      }
    }
  }

  private saveUserPreferences(): void {
    localStorage.setItem(
      'userPreferences',
      JSON.stringify({
        isDarkTheme: this.isDarkTheme,
      })
    );
  }

  // Navigation Methods
  viewProfile(): void {
    this.router.navigate(['/profile']);
  }

  openPreferences(): void {
    this.router.navigate(['/preferences']);
  }

  openAppSettings(): void {
    this.router.navigate(['/settings']);
  }

  openHelp(): void {
    window.open('/help', '_blank');
  }

  // Sidebar Toggle
  toggleSidebar(): void {
    this.menuToggled.emit();
  }

  // Logout Method
  logout(): void {
    // Add your logout logic here
    console.log('Logging out...');
    this.router.navigate(['/login']);
  }
}
