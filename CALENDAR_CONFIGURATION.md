# Google Calendar Configuration Guide

## Understanding "Primary Calendar"

### What is Primary Calendar?

- **Primary Calendar** = Default Google Calendar for ANY Google account
- **Ownership**: Belongs to whoever authenticates with Google Calendar API
- **API Reference**: Always uses `calendarId: 'primary'` in Google Calendar API calls
- **Name**: Usually shows as the user's email address (e.g., "john@company.com")

### Important: Not Related to Firebase

- ❌ **Not stored in Firebase**: This is Google's calendar system
- ❌ **Not your app's data**: It's external to your logistics app
- ✅ **Google Account**: Tied to Google account used for authentication

## Configuration Options

### Option 1: Use Primary Calendar (Current Setup)

**Best for**: Individual users managing their own schedules

```typescript
this.selectedCalendar = {
  id: 'primary',
  summary: 'Primary Calendar',
  description: 'Your main Google Calendar',
  backgroundColor: '#3f51b5',
};
```

**Result**: Jobs sync to the calendar of whoever is logged into Google

### Option 2: Company-Wide Shared Calendar

**Best for**: Central logistics calendar for entire company

```typescript
this.selectedCalendar = {
  id: 'logistics@yourcompany.com', // Specific calendar ID
  summary: 'Company Logistics',
  description: 'Shared company logistics calendar',
  backgroundColor: '#ff5722',
};
```

**Setup Required**:

1. Create `logistics@yourcompany.com` Google account
2. Create/share calendar with all team members
3. Use this calendar ID in the code

### Option 3: User-Specific Calendar from Firebase

**Best for**: Each user has their own preferred calendar stored in their profile

```typescript
// In your user interface (extend existing UserProfile)
interface UserProfile {
  // ... existing fields
  preferredCalendarId?: string;
  preferredCalendarName?: string;
}

// In dashboard component
private async initializeDefaultCalendar(): Promise<void> {
  // Get current user from Firebase
  const currentUser = this.authService.getCurrentUser();

  if (currentUser?.preferredCalendarId) {
    // Use user's preferred calendar from Firebase
    this.selectedCalendar = {
      id: currentUser.preferredCalendarId,
      summary: currentUser.preferredCalendarName || 'User Calendar',
      description: 'User-selected calendar',
      backgroundColor: '#4caf50',
    };
  } else {
    // Fallback to primary calendar
    this.selectedCalendar = {
      id: 'primary',
      summary: 'Primary Calendar',
      description: 'Your main Google Calendar',
      backgroundColor: '#3f51b5',
    };
  }
}
```

### Option 4: Environment-Based Calendar

**Best for**: Different calendars for development/staging/production

```typescript
// In environment files
export const environment = {
  // ... existing config
  googleCalendar: {
    defaultCalendarId: 'logistics-dev@yourcompany.com', // Dev calendar
    // defaultCalendarId: 'logistics@yourcompany.com',  // Production calendar
  }
};

// In component
private initializeDefaultCalendar(): void {
  this.selectedCalendar = {
    id: environment.googleCalendar.defaultCalendarId,
    summary: 'Logistics Calendar',
    description: 'Environment-specific calendar',
    backgroundColor: '#9c27b0',
  };
}
```

## How to Set Specific User Calendars

### Method 1: Store in Firebase User Profile

1. **Update User Interface**:

```typescript
// In src/app/interfaces/user-profile.interface.ts
export interface UserProfile {
  // ... existing fields
  calendarSettings?: {
    preferredCalendarId: string;
    preferredCalendarName: string;
    syncEnabled: boolean;
  };
}
```

2. **Save User Preference**:

```typescript
// In user settings or calendar selection dialog
async saveCalendarPreference(calendarId: string, calendarName: string): Promise<void> {
  const currentUser = this.authService.getCurrentUser();
  if (currentUser) {
    await this.authService.updateUserProfile(currentUser.uid, {
      calendarSettings: {
        preferredCalendarId: calendarId,
        preferredCalendarName: calendarName,
        syncEnabled: true
      }
    });
  }
}
```

3. **Load User Preference**:

```typescript
private async loadUserCalendarPreference(): Promise<void> {
  const currentUser = this.authService.getCurrentUser();
  if (currentUser?.calendarSettings?.preferredCalendarId) {
    this.selectedCalendar = {
      id: currentUser.calendarSettings.preferredCalendarId,
      summary: currentUser.calendarSettings.preferredCalendarName,
      description: 'User-selected calendar',
      backgroundColor: '#4caf50',
    };
  }
}
```

### Method 2: Role-Based Calendar Assignment

```typescript
private initializeCalendarByRole(): void {
  const currentUser = this.authService.getCurrentUser();
  const userRole = currentUser?.role;

  switch (userRole) {
    case 'Admin':
      this.selectedCalendar = {
        id: 'admin-logistics@yourcompany.com',
        summary: 'Admin Logistics Calendar',
        description: 'Administrative logistics calendar',
        backgroundColor: '#f44336',
      };
      break;

    case 'Manager':
      this.selectedCalendar = {
        id: 'manager-logistics@yourcompany.com',
        summary: 'Manager Logistics Calendar',
        description: 'Management logistics calendar',
        backgroundColor: '#ff9800',
      };
      break;

    case 'Driver':
      this.selectedCalendar = {
        id: 'driver-schedules@yourcompany.com',
        summary: 'Driver Schedules',
        description: 'Driver scheduling calendar',
        backgroundColor: '#2196f3',
      };
      break;

    default:
      // Fallback to primary calendar
      this.selectedCalendar = {
        id: 'primary',
        summary: 'Primary Calendar',
        description: 'Your main Google Calendar',
        backgroundColor: '#3f51b5',
      };
  }
}
```

### Method 3: Company Calendar with Individual Access

1. **Create Company Calendar**:

   - Create `logistics@yourcompany.com` Google account
   - Share calendar with all team members (view/edit permissions)
   - Use this shared calendar ID

2. **Implementation**:

```typescript
private initializeDefaultCalendar(): void {
  // Always use company logistics calendar
  this.selectedCalendar = {
    id: 'logistics@yourcompany.com',  // Your actual company calendar
    summary: 'Company Logistics Calendar',
    description: 'Shared team logistics calendar',
    backgroundColor: '#673ab7',
  };
}
```

## Google Calendar ID Examples

- **Primary Calendar**: `'primary'`
- **Gmail Account**: `'user@gmail.com'`
- **Company Account**: `'logistics@yourcompany.com'`
- **Shared Calendar**: `'abc123def456@group.calendar.google.com'`

## Authentication Context

**Important**: The calendar used depends on which Google account is authenticated:

- If **John logs in**: His `'primary'` calendar = john@company.com
- If **Sarah logs in**: Her `'primary'` calendar = sarah@company.com
- If **Company Account logs in**: `'primary'` = logistics@company.com

## Recommended Approach

For a business logistics system, I recommend **Option 2 (Company-Wide Calendar)**:

1. Create dedicated `logistics@yourcompany.com` Google account
2. Create shared calendar accessible to all team members
3. Use this specific calendar ID in your app
4. All jobs sync to one central calendar everyone can see

This ensures consistency and team-wide visibility of all logistics operations.
