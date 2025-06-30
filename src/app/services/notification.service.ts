import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private notifications = new BehaviorSubject<Notification[]>([]);
  private unreadCount = new BehaviorSubject<number>(0);

  constructor(private snackBar: MatSnackBar) {
    this.loadNotifications();
  }

  get notifications$(): Observable<Notification[]> {
    return this.notifications.asObservable();
  }

  get unreadCount$(): Observable<number> {
    return this.unreadCount.asObservable();
  }

  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date(),
      read: false,
    };

    const currentNotifications = this.notifications.getValue();
    const updatedNotifications = [newNotification, ...currentNotifications];

    this.notifications.next(updatedNotifications);
    this.unreadCount.next(this.unreadCount.getValue() + 1);

    this.saveNotifications(updatedNotifications);

    this.showSnackbar(notification);
  }

  markAsRead(notificationId: string): void {
    const currentNotifications = this.notifications.getValue();
    const updatedNotifications = currentNotifications.map((notification) => {
      if (notification.id === notificationId && !notification.read) {
        return { ...notification, read: true };
      }
      return notification;
    });

    this.notifications.next(updatedNotifications);

    const unreadCount = updatedNotifications.filter((n) => !n.read).length;
    this.unreadCount.next(unreadCount);

    this.saveNotifications(updatedNotifications);
  }

  markAllAsRead(): void {
    const currentNotifications = this.notifications.getValue();
    const updatedNotifications = currentNotifications.map((notification) => ({
      ...notification,
      read: true,
    }));

    this.notifications.next(updatedNotifications);
    this.unreadCount.next(0);

    this.saveNotifications(updatedNotifications);
  }

  removeNotification(notificationId: string): void {
    const currentNotifications = this.notifications.getValue();
    const updatedNotifications = currentNotifications.filter((notification) => notification.id !== notificationId);

    this.notifications.next(updatedNotifications);

    const unreadCount = updatedNotifications.filter((n) => !n.read).length;
    this.unreadCount.next(unreadCount);

    this.saveNotifications(updatedNotifications);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private loadNotifications(): void {
    try {
      const savedNotifications = localStorage.getItem('notifications');
      if (savedNotifications) {
        const parsedNotifications: Notification[] = JSON.parse(savedNotifications);

        const processedNotifications = parsedNotifications.map((n) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));

        this.notifications.next(processedNotifications);

        const unreadCount = processedNotifications.filter((n) => !n.read).length;
        this.unreadCount.next(unreadCount);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);

      this.notifications.next([]);
      this.unreadCount.next(0);
    }
  }

  private saveNotifications(notifications: Notification[]): void {
    try {
      localStorage.setItem('notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  private showSnackbar(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const config = {
      duration: 5000,
      horizontalPosition: 'end' as const,
      verticalPosition: 'top' as const,
      panelClass: [`${notification.type}-snackbar`],
    };

    const actionText = notification.actionUrl ? 'View' : 'Dismiss';

    const snackBarRef = this.snackBar.open(notification.title, actionText, config);

    if (notification.actionUrl) {
      snackBarRef.onAction().subscribe(() => {
        window.location.href = notification.actionUrl!;
      });
    }
  }
}
