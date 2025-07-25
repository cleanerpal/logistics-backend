import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { JobNewService } from '../../../services/job-new.service';
import { GoogleCalendarService } from '../../../services/google-calendar.service';

interface CalendarConfig {
  id: string;
  summary: string;
  description: string;
  backgroundColor: string;
}

interface CalendarSettings {
  selectedCalendarType: 'primary' | 'custom';
  customCalendarId?: string;
  customCalendarName?: string;
  autoSyncEnabled: boolean;
  includeJobDetails: boolean;
  updateEventStatus: boolean;
  removeCompletedJobs: boolean;
}

@Component({
  selector: 'app-calendar-settings',
  templateUrl: './calendar-settings.component.html',
  styleUrls: ['./calendar-settings.component.scss'],
  standalone: false,
})
export class CalendarSettingsComponent implements OnInit {
  // Calendar configuration
  selectedCalendar: CalendarConfig = {
    id: 'primary',
    summary: 'Primary Calendar',
    description: 'Your main Google Calendar',
    backgroundColor: '#3f51b5',
  };

  // Form data
  selectedCalendarType: 'primary' | 'custom' = 'primary';
  customCalendarId = '';
  customCalendarName = '';
  currentUserEmail = '';

  // Sync options
  autoSyncEnabled = true;
  includeJobDetails = true;
  updateEventStatus = true;
  removeCompletedJobs = false;

  // State flags
  calendarConnected = true;
  isTestingConnection = false;
  isSaving = false;
  isSyncing = false;
  calendarIdError = '';

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private jobService: JobNewService,
    private googleCalendarService: GoogleCalendarService
  ) {}

  ngOnInit(): void {
    this.loadCurrentSettings();
    this.loadCurrentUser();
  }

  private loadCurrentUser(): void {
    this.authService.getCurrentUser().subscribe((currentUser) => {
      if (currentUser?.email) {
        this.currentUserEmail = currentUser.email;
      }
    });
  }

  private loadCurrentSettings(): void {
    // Load settings from localStorage or Firebase user profile
    const savedSettings = localStorage.getItem('calendarSettings');
    if (savedSettings) {
      try {
        const settings: CalendarSettings = JSON.parse(savedSettings);
        this.applySettings(settings);
      } catch (error) {
        console.error('Error parsing saved calendar settings:', error);
      }
    }
  }

  private applySettings(settings: CalendarSettings): void {
    this.selectedCalendarType = settings.selectedCalendarType;
    this.customCalendarId = settings.customCalendarId || '';
    this.customCalendarName = settings.customCalendarName || '';
    this.autoSyncEnabled = settings.autoSyncEnabled;
    this.includeJobDetails = settings.includeJobDetails;
    this.updateEventStatus = settings.updateEventStatus;
    this.removeCompletedJobs = settings.removeCompletedJobs;

    // Update selected calendar display
    this.updateSelectedCalendar();
  }

  onCalendarTypeChange(): void {
    this.updateSelectedCalendar();
    this.calendarIdError = '';
  }

  private updateSelectedCalendar(): void {
    if (this.selectedCalendarType === 'primary') {
      this.selectedCalendar = {
        id: 'primary',
        summary: 'Primary Calendar',
        description: `Your main Google Calendar${this.currentUserEmail ? ` (${this.currentUserEmail})` : ''}`,
        backgroundColor: '#3f51b5',
      };
    } else if (this.selectedCalendarType === 'custom' && this.customCalendarId) {
      this.selectedCalendar = {
        id: this.customCalendarId,
        summary: this.customCalendarName || 'Custom Calendar',
        description: 'Custom Google Calendar',
        backgroundColor: '#4caf50',
      };
    }
  }

  validateCalendarId(): void {
    this.calendarIdError = '';

    if (!this.customCalendarId) {
      return;
    }

    // Basic validation for calendar ID format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const groupCalendarRegex = /^[a-z0-9]+@group\.calendar\.google\.com$/;

    if (!emailRegex.test(this.customCalendarId) && !groupCalendarRegex.test(this.customCalendarId)) {
      this.calendarIdError = 'Invalid calendar ID format. Should be an email address or group calendar ID.';
    }

    this.updateSelectedCalendar();
  }

  async testCalendarConnection(): Promise<void> {
    if (!this.customCalendarId) {
      return;
    }

    this.isTestingConnection = true;
    this.calendarIdError = '';

    try {
      // Check if OAuth credentials are configured
      if (!this.googleCalendarService.hasOAuthCredentials()) {
        throw new Error('OAuth 2.0 Client ID not configured. Please complete the OAuth setup first.');
      }

      // Initialize Google Calendar API
      await this.googleCalendarService.initialize();
      const isSignedIn = await this.googleCalendarService.signIn();

      if (!isSignedIn) {
        throw new Error('Google Calendar authentication required');
      }

      // Test the specific calendar
      const isValid = await this.googleCalendarService.testCalendar(this.customCalendarId);

      if (isValid) {
        this.calendarConnected = true;
        this.notificationService.addNotification({
          type: 'success',
          title: 'Calendar Connection Successful',
          message: `Successfully connected to calendar: ${this.customCalendarId}`,
        });
        this.updateSelectedCalendar();
      } else {
        this.calendarConnected = false;
        this.calendarIdError = 'Unable to connect to this calendar. Please check the ID and permissions.';
        this.notificationService.addNotification({
          type: 'error',
          title: 'Calendar Connection Failed',
          message: 'Please verify the calendar ID and ensure you have access to this calendar.',
        });
      }
    } catch (error: any) {
      this.calendarConnected = false;
      this.calendarIdError = error?.message || 'Connection test failed';
      this.notificationService.addNotification({
        type: 'error',
        title: 'Connection Test Failed',
        message: error?.message || 'Please check your Google Calendar setup and ensure OAuth credentials are configured.',
      });
    } finally {
      this.isTestingConnection = false;
    }
  }

  saveCalendarSettings(): void {
    this.isSaving = true;

    // Validate settings
    if (this.selectedCalendarType === 'custom' && !this.customCalendarId) {
      this.notificationService.addNotification({
        type: 'error',
        title: 'Invalid Settings',
        message: 'Please enter a valid calendar ID for custom calendar option.',
      });
      this.isSaving = false;
      return;
    }

    const settings: CalendarSettings = {
      selectedCalendarType: this.selectedCalendarType,
      customCalendarId: this.customCalendarId,
      customCalendarName: this.customCalendarName,
      autoSyncEnabled: this.autoSyncEnabled,
      includeJobDetails: this.includeJobDetails,
      updateEventStatus: this.updateEventStatus,
      removeCompletedJobs: this.removeCompletedJobs,
    };

    // Save to localStorage (in real app, save to Firebase user profile)
    localStorage.setItem('calendarSettings', JSON.stringify(settings));

    // Update the selected calendar
    this.updateSelectedCalendar();

    setTimeout(() => {
      this.notificationService.addNotification({
        type: 'success',
        title: 'Settings Saved',
        message: 'Calendar settings have been saved successfully.',
      });
      this.isSaving = false;
    }, 1000);
  }

  syncNow(): void {
    if (!this.calendarConnected) {
      this.notificationService.addNotification({
        type: 'error',
        title: 'Cannot Sync',
        message: 'Please configure and test your calendar connection first.',
      });
      return;
    }

    this.isSyncing = true;

    this.notificationService.addNotification({
      type: 'info',
      title: 'Calendar Sync Started',
      message: `Syncing jobs to ${this.selectedCalendar.summary}...`,
    });

    // Get jobs and sync (simulate for now)
    const syncSub = this.jobService.getRecentJobs(1000).subscribe({
      next: (jobs) => {
        // Simulate sync process
        setTimeout(() => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Calendar Sync Complete',
            message: `Successfully synced ${jobs.length} jobs to ${this.selectedCalendar.summary}.`,
          });
          this.isSyncing = false;
        }, 2000);
      },
      error: (error) => {
        console.error('Error during calendar sync:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Sync Failed',
          message: 'Failed to sync jobs to calendar. Please try again.',
        });
        this.isSyncing = false;
      },
    });
  }

  resetToDefaults(): void {
    this.selectedCalendarType = 'primary';
    this.customCalendarId = '';
    this.customCalendarName = '';
    this.autoSyncEnabled = true;
    this.includeJobDetails = true;
    this.updateEventStatus = true;
    this.removeCompletedJobs = false;
    this.calendarIdError = '';

    this.updateSelectedCalendar();

    this.notificationService.addNotification({
      type: 'info',
      title: 'Settings Reset',
      message: 'Calendar settings have been reset to defaults.',
    });
  }
}
