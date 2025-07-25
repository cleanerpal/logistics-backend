# Real Google Calendar Implementation

## Current Status: SIMULATED

The current implementation is a **complete UI framework with simulated backend**. It's not actually connecting to Google Calendar yet - it just shows you what the real integration will look like.

## What's Currently Simulated

### 1. Dashboard Sync Button

**Location**: `src/app/pages/dashboard/dashboard.component.ts` - Line 1056

```typescript
// CURRENT SIMULATION:
private syncEventsToGoogleCalendar(events: any[]): number {
  console.log('Syncing events to Google Calendar:', events);
  return events.length; // Just returns count
}
```

### 2. Calendar Settings Test Connection

**Location**: `src/app/pages/settings/calendar-settings/calendar-settings.component.ts` - Line 135

```typescript
// CURRENT SIMULATION:
testCalendarConnection(): void {
  setTimeout(() => {
    const isValid = Math.random() > 0.3; // 70% success rate for demo
    // Shows success/failure notification
  }, 2000);
}
```

## How to Implement Real Google Calendar API

### Step 1: Install Dependencies

```bash
npm install googleapis
npm install @types/gapi
```

### Step 2: Environment Configuration

Add to `src/environments/environment.ts`:

```typescript
export const environment = {
  // ... existing config
  googleCalendar: {
    clientId: 'your-google-client-id.googleusercontent.com',
    apiKey: 'your-google-api-key',
    scope: 'https://www.googleapis.com/auth/calendar',
    discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
  },
};
```

### Step 3: Create Google Calendar Service

Create `src/app/services/google-calendar.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare var gapi: any;

@Injectable({
  providedIn: 'root',
})
export class GoogleCalendarService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load Google API
    await this.loadGoogleAPI();

    // Initialize gapi client
    await gapi.load('client:auth2', async () => {
      await gapi.client.init({
        apiKey: environment.googleCalendar.apiKey,
        clientId: environment.googleCalendar.clientId,
        discoveryDocs: [environment.googleCalendar.discoveryDoc],
        scope: environment.googleCalendar.scope,
      });
    });

    this.isInitialized = true;
  }

  async signIn(): Promise<boolean> {
    const authInstance = gapi.auth2.getAuthInstance();
    if (!authInstance.isSignedIn.get()) {
      await authInstance.signIn();
    }
    return authInstance.isSignedIn.get();
  }

  async listCalendars(): Promise<any> {
    return gapi.client.calendar.calendarList.list();
  }

  async testCalendar(calendarId: string): Promise<boolean> {
    try {
      await gapi.client.calendar.calendars.get({
        calendarId: calendarId,
      });
      return true;
    } catch (error) {
      console.error('Calendar test failed:', error);
      return false;
    }
  }

  async createEvent(calendarId: string, event: any): Promise<any> {
    return gapi.client.calendar.events.insert({
      calendarId: calendarId,
      resource: event,
    });
  }

  async updateEvent(calendarId: string, eventId: string, event: any): Promise<any> {
    return gapi.client.calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      resource: event,
    });
  }

  async listEvents(calendarId: string, query?: string): Promise<any> {
    return gapi.client.calendar.events.list({
      calendarId: calendarId,
      q: query,
      maxResults: 2500,
    });
  }

  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof gapi !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }
}
```

### Step 4: Replace Simulated Code

#### Replace Dashboard Sync Method

**File**: `src/app/pages/dashboard/dashboard.component.ts`

```typescript
// Add to constructor
constructor(
  // ... existing dependencies
  private googleCalendarService: GoogleCalendarService
) {}

// REPLACE the simulated method with:
private async syncEventsToGoogleCalendar(events: any[]): Promise<number> {
  try {
    // Initialize Google Calendar API
    await this.googleCalendarService.initialize();
    const isSignedIn = await this.googleCalendarService.signIn();

    if (!isSignedIn) {
      throw new Error('Google Calendar authentication failed');
    }

    // Get calendar settings
    const calendarSettings = this.getCalendarSettings();
    const calendarId = calendarSettings?.selectedCalendarType === 'custom'
      ? calendarSettings.customCalendarId
      : 'primary';

    // Get existing events
    const existingEvents = await this.googleCalendarService.listEvents(calendarId, 'Logistics Job');
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
    for (const event of events) {
      const existingEvent = existingEventsMap.get(event.extendedProperties.private.jobId);

      try {
        if (existingEvent) {
          // Update existing event
          await this.googleCalendarService.updateEvent(calendarId, existingEvent.id, event);
          updated++;
        } else {
          // Create new event
          await this.googleCalendarService.createEvent(calendarId, event);
          created++;
        }
      } catch (eventError) {
        console.error(`Error syncing job ${event.extendedProperties.private.jobId}:`, eventError);
      }
    }

    console.log(`Calendar sync complete: ${created} created, ${updated} updated`);
    return created + updated;

  } catch (error) {
    console.error('Google Calendar sync error:', error);
    throw error;
  }
}
```

#### Replace Calendar Settings Test Connection

**File**: `src/app/pages/settings/calendar-settings/calendar-settings.component.ts`

```typescript
// Add to constructor
constructor(
  // ... existing dependencies
  private googleCalendarService: GoogleCalendarService
) {}

// REPLACE the simulated method with:
async testCalendarConnection(): Promise<void> {
  if (!this.customCalendarId) {
    return;
  }

  this.isTestingConnection = true;
  this.calendarIdError = '';

  try {
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
        message: `Successfully connected to calendar: ${this.customCalendarId}`
      });
      this.updateSelectedCalendar();
    } else {
      this.calendarConnected = false;
      this.calendarIdError = 'Unable to connect to this calendar. Please check the ID and permissions.';
      this.notificationService.addNotification({
        type: 'error',
        title: 'Calendar Connection Failed',
        message: 'Please verify the calendar ID and ensure you have access to this calendar.'
      });
    }

  } catch (error) {
    this.calendarConnected = false;
    this.calendarIdError = error.message || 'Connection test failed';
    this.notificationService.addNotification({
      type: 'error',
      title: 'Connection Test Failed',
      message: error.message || 'Please check your Google Calendar setup.'
    });
  } finally {
    this.isTestingConnection = false;
  }
}
```

### Step 5: Add Google API Script

Add to `src/index.html` (in `<head>` section):

```html
<script src="https://apis.google.com/js/api.js"></script>
```

## Implementation Checklist

- [ ] **Set up Google Cloud Project**

  - [ ] Enable Google Calendar API
  - [ ] Create OAuth 2.0 credentials
  - [ ] Configure authorized domains

- [ ] **Install Dependencies**

  - [ ] `npm install googleapis`
  - [ ] `npm install @types/gapi`

- [ ] **Environment Setup**

  - [ ] Add Google API credentials to environment files
  - [ ] Add Google API script to index.html

- [ ] **Create Service**

  - [ ] Create GoogleCalendarService
  - [ ] Add authentication methods
  - [ ] Add calendar CRUD operations

- [ ] **Replace Simulated Code**

  - [ ] Update dashboard sync method
  - [ ] Update calendar settings test connection
  - [ ] Add proper error handling

- [ ] **Test & Deploy**
  - [ ] Test with real Google Calendar
  - [ ] Verify OAuth flow works
  - [ ] Test with different calendar types

## Current vs Real Implementation

| Feature                | Current (Simulated)   | Real Implementation               |
| ---------------------- | --------------------- | --------------------------------- |
| **Sync Button**        | Shows fake success    | Creates real calendar events      |
| **Test Connection**    | Random success/fail   | Tests actual calendar access      |
| **Calendar Selection** | Saves to localStorage | Uses real Google Calendar IDs     |
| **Event Creation**     | Console logs only     | Creates events in Google Calendar |
| **Authentication**     | No auth required      | Full OAuth 2.0 flow               |
| **Error Handling**     | Simulated errors      | Real API error responses          |

## Security Notes

- Store API credentials securely (environment variables)
- Implement proper OAuth consent flow
- Handle API rate limits gracefully
- Add user permission checks for calendar access

The current implementation gives you a **complete, professional UI** that's ready for the real Google Calendar integration - you just need to replace the simulated methods with actual API calls!
