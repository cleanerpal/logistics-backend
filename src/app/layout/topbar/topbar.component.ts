import { Component, OnInit, ViewChild, ElementRef, Output, EventEmitter, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { NotificationService, Notification } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

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
  standalone: false,
})
export class TopbarComponent implements OnInit, OnDestroy {
  @Output() menuToggled = new EventEmitter<void>();
  @ViewChild('searchInput') searchInput!: ElementRef;

  userName = 'John Doe';
  userEmail = 'john.doe@example.com';
  userRole = 'Administrator';
  userAvatar = 'assets/images/avatar-placeholder.png';
  isUserOnline = true;

  isSearchOpen = false;
  searchQuery = '';
  searchResults: SearchResult[] = [];

  isDarkTheme = false;

  currentSection = '';
  currentPage = '';

  notifications: Notification[] = [];
  unreadCount = 0;
  private notificationsSubscription: Subscription;
  private unreadCountSubscription: Subscription;
  private userProfileSubscription: Subscription;

  constructor(private router: Router, private notificationService: NotificationService, private authService: AuthService, private snackBar: MatSnackBar) {
    this.setupRouteListener();

    this.notificationsSubscription = this.notificationService.notifications$.subscribe((notifications) => {
      this.notifications = notifications;
    });

    this.unreadCountSubscription = this.notificationService.unreadCount$.subscribe((count) => {
      this.unreadCount = count;
    });

    this.userProfileSubscription = this.authService.getUserProfile().subscribe((profile) => {
      if (profile) {
        this.userName = profile.name || `${profile.firstName} ${profile.lastName}`.trim();
        this.userEmail = profile.email;
        this.userRole = profile.role || 'User';
        this.isUserOnline = true;
      }
    });
  }

  ngOnInit(): void {
    this.updateBreadcrumb();
    this.loadUserPreferences();
  }

  ngOnDestroy(): void {
    if (this.notificationsSubscription) {
      this.notificationsSubscription.unsubscribe();
    }
    if (this.unreadCountSubscription) {
      this.unreadCountSubscription.unsubscribe();
    }
    if (this.userProfileSubscription) {
      this.userProfileSubscription.unsubscribe();
    }
  }

  private setupRouteListener(): void {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
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

  openSearch(): void {
    this.isSearchOpen = true;

    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
      }
    });
  }

  closeSearch(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('.search-card')) {
      return;
    }
    this.isSearchOpen = false;
    this.searchQuery = '';
    this.searchResults = [];
  }

  onSearch(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeSearch(event as unknown as MouseEvent);
      return;
    }

    if (this.searchQuery.length >= 2) {
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
        {
          id: '5',
          icon: 'receipt_long',
          title: 'Expenses',
          subtitle: 'Manage expenses',
          link: '/expenses',
        },
      ].filter((result) => result.title.toLowerCase().includes(this.searchQuery.toLowerCase()) || result.subtitle.toLowerCase().includes(this.searchQuery.toLowerCase()));
    } else {
      this.searchResults = [];
    }
  }

  get hasUnreadNotifications(): boolean {
    return this.unreadCount > 0;
  }

  getUnreadCount(): number {
    return this.unreadCount;
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  markAsRead(notification: Notification): void {
    this.notificationService.markAsRead(notification.id);

    if (notification.actionUrl) {
      this.router.navigateByUrl(notification.actionUrl);
    }
  }

  deleteNotification(notification: Notification): void {
    this.notificationService.removeNotification(notification.id);
  }

  viewAllNotifications(): void {
    this.router.navigate(['/notifications']);
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    document.body.classList.toggle('dark-theme');
    this.saveUserPreferences();
  }

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

  viewProfile(): void {
    // Navigate to driver details for the current user
    this.authService.getUserProfile().subscribe((profile) => {
      if (profile && profile.id) {
        this.router.navigate(['/drivers', profile.id]);
      } else {
        // Fallback to settings if no profile ID
        this.router.navigate(['/settings/system-preferences']);
      }
    });
  }

  openPreferences(): void {
    this.router.navigate(['/settings/system-preferences']);
  }

  openAppSettings(): void {
    this.router.navigate(['/settings']);
  }

  toggleSidebar(): void {
    this.menuToggled.emit();
  }

  logout(): void {
    this.authService.signOut().subscribe({
      next: () => {
        this.notificationService.addNotification({
          type: 'info',
          title: 'Signed Out',
          message: 'You have been successfully signed out',
        });
        this.router.navigate(['/auth/sign-in']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        this.snackBar.open('Failed to sign out. Please try again.', 'Dismiss', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
      },
    });
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'info':
        return 'info';
      case 'success':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'notifications';
    }
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
  }
}
