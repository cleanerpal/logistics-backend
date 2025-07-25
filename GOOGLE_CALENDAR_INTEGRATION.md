# Google Calendar Integration for Logistics System

## Overview

The dashboard now includes a "Sync to Google Calendar" button that allows syncing all jobs to Google Calendar. Currently, it's implemented as a simulation, but this guide explains how to implement the real Google Calendar API integration.

## Current Implementation

- **Location**: `src/app/pages/dashboard/dashboard.component.ts`
- **Method**: `syncToGoogleCalendar()`
- **Status**: Simulated (not connected to real Google Calendar API)
- **Target Calendar**: Currently set to "Primary Calendar" - visible in the dashboard UI
- **Calendar Selection**: Settings button available for future calendar choice functionality

## Features Implemented

1. **Job to Calendar Event Conversion**: Converts job data to Google Calendar event format
2. **Driver Assignment**: Includes assigned driver information in calendar events
3. **Comprehensive Job Details**: Event descriptions include all job information
4. **Smart Scheduling**: Uses collection date as start time, delivery date or +2 hours as end time
5. **Loading States**: Button shows spinner and "Syncing..." during operation
6. **Notifications**: Success/error notifications for user feedback

## To Implement Real Google Calendar API Integration

### 1. Install Google APIs

```bash
npm install googleapis
```

### 2. Set Up Google Calendar API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Calendar API
4. Create credentials (OAuth 2.0 Client ID)
5. Add your domain to authorized origins

### 3. Environment Configuration

Add to `src/environments/environment.ts`:

```typescript
export const environment = {
  // ... existing config
  googleCalendar: {
    clientId: 'your-google-client-id',
    apiKey: 'your-google-api-key',
    scope: 'https://www.googleapis.com/auth/calendar',
    discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
  },
};
```

### 4. Create Google Calendar Service

Create `src/app/services/google-calendar.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GoogleCalendarService {
  private gapi: any;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.loadGoogleAPI();
    await this.gapi.load('client:auth2', async () => {
      await this.gapi.client.init({
        apiKey: environment.googleCalendar.apiKey,
        clientId: environment.googleCalendar.clientId,
        discoveryDocs: [environment.googleCalendar.discoveryDoc],
        scope: environment.googleCalendar.scope,
      });
    });

    this.isInitialized = true;
  }

  async signIn(): Promise<boolean> {
    const authInstance = this.gapi.auth2.getAuthInstance();
    if (!authInstance.isSignedIn.get()) {
      await authInstance.signIn();
    }
    return authInstance.isSignedIn.get();
  }

  async createEvent(event: any): Promise<any> {
    return this.gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });
  }

  async updateEvent(eventId: string, event: any): Promise<any> {
    return this.gapi.client.calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: event,
    });
  }

  async listEvents(query?: string): Promise<any> {
    return this.gapi.client.calendar.events.list({
      calendarId: 'primary',
      q: query,
      maxResults: 2500,
    });
  }

  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof gapi !== 'undefined') {
        this.gapi = gapi;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        this.gapi = (window as any).gapi;
        resolve();
      };
      document.head.appendChild(script);
    });
  }
}
```

### 5. Update Dashboard Component

Replace the simulated sync method in `dashboard.component.ts`:

```typescript
// Add to imports
import { GoogleCalendarService } from '../services/google-calendar.service';

// Add to constructor
constructor(
  // ... existing dependencies
  private googleCalendarService: GoogleCalendarService
) {}

// Replace the syncToGoogleCalendar method
async syncToGoogleCalendar(): Promise<void> {
  this.isSyncingCalendar = true;

  try {
    // Initialize and authenticate
    await this.googleCalendarService.initialize();
    const isSignedIn = await this.googleCalendarService.signIn();

    if (!isSignedIn) {
      throw new Error('Google Calendar authentication failed');
    }

    this.notificationService.addNotification({
      type: 'info',
      title: 'Calendar Sync Started',
      message: 'Syncing jobs to Google Calendar...',
    });

    // Get all jobs
    const allJobs = await this.jobService.getRecentJobs(1000).toPromise();

    // Get existing calendar events
    const existingEvents = await this.googleCalendarService.listEvents('Logistics Job');
    const existingEventsMap = new Map();

    existingEvents.result.items.forEach((event: any) => {
      const jobId = event.extendedProperties?.private?.jobId;
      if (jobId) {
        existingEventsMap.set(jobId, event);
      }
    });

    let created = 0;
    let updated = 0;

    // Process each job
    for (const job of allJobs) {
      const calendarEvent = this.convertJobToCalendarEvent(job);
      const existingEvent = existingEventsMap.get(job.id);

      try {
        if (existingEvent) {
          // Update existing event
          await this.googleCalendarService.updateEvent(existingEvent.id, calendarEvent);
          updated++;
        } else {
          // Create new event
          await this.googleCalendarService.createEvent(calendarEvent);
          created++;
        }
      } catch (eventError) {
        console.error(`Error syncing job ${job.id}:`, eventError);
      }
    }

    this.notificationService.addNotification({
      type: 'success',
      title: 'Calendar Sync Complete',
      message: `Created ${created} events, updated ${updated} events in Google Calendar.`,
    });

  } catch (error) {
    console.error('Google Calendar sync error:', error);
    this.notificationService.addNotification({
      type: 'error',
      title: 'Sync Failed',
      message: error.message || 'Failed to sync with Google Calendar.',
    });
  } finally {
    this.isSyncingCalendar = false;
  }
}
```

### 6. Event Format

The current job-to-event conversion creates events with:

- **Summary**: Vehicle type and customer name
- **Description**: Comprehensive job details including driver, addresses, notes
- **Start/End Times**: Based on collection/delivery dates
- **Location**: Collection address
- **Extended Properties**: Job metadata for future updates

### 7. Security Considerations

- Store API credentials securely (environment variables)
- Implement proper error handling for API failures
- Add user consent for calendar access
- Consider rate limiting for bulk operations

### 8. Testing

1. Test with a small number of jobs first
2. Verify events appear correctly in Google Calendar
3. Test update functionality when job details change
4. Ensure proper error handling for network issues

## Current Sync Features

- ✅ Converts all job data to calendar events
- ✅ Includes driver assignments in event details
- ✅ Uses job timing for event scheduling
- ✅ Provides user feedback during sync
- ✅ Handles errors gracefully
- ✅ Professional event formatting

## How to Know Which Calendar Is Being Used

### Current Implementation

1. **Dashboard Display**: The target calendar name is shown next to the sync button as "Target: Primary Calendar"
2. **Sync Notifications**: When syncing starts and completes, notifications include the calendar name
3. **Settings Button**: Click the gear icon next to the sync button to see current calendar information

### Calendar Identification

- **Primary Calendar**: Default Google Calendar (usually matches your Google account email)
- **Display**: Shows "Primary Calendar" in the dashboard
- **API Reference**: Uses `calendarId: 'primary'` in Google Calendar API calls

### To Change Target Calendar (Future Implementation)

When the real Google Calendar API is integrated:

1. **List Available Calendars**:

   ```typescript
   const calendars = await gapi.client.calendar.calendarList.list();
   ```

2. **Display Calendar Options**:

   - Primary Calendar (your-email@gmail.com)
   - Work Calendar
   - Custom Calendar Name
   - Shared Calendars

3. **Calendar Selection**:
   - Settings dialog to choose from available calendars
   - Save preference in local storage or user profile
   - Update sync target dynamically

### Current Calendar Information

```typescript
selectedCalendar = {
  id: 'primary',
  summary: 'Primary Calendar',
  description: 'Your main Google Calendar',
  backgroundColor: '#3f51b5',
};
```

## Future Enhancements

- Real-time sync when jobs are updated
- Selective sync (choose which jobs to sync)
- Multiple calendar support with full selection UI
- Recurring job templates
- Calendar-based job scheduling
- Calendar color coding based on job status
- Time zone handling for global operations
