import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare var gapi: any;

@Injectable({
  providedIn: 'root',
})
export class GoogleCalendarService {
  private isInitialized = false;
  private isAuthenticated = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load Google API
      await this.loadGoogleAPI();

      // Initialize gapi client
      await new Promise<void>((resolve, reject) => {
        gapi.load('client:auth2', async () => {
          try {
            await gapi.client.init({
              apiKey: environment.googleCalendar.apiKey,
              clientId: environment.googleCalendar.clientId,
              discoveryDocs: [environment.googleCalendar.discoveryDoc],
              scope: environment.googleCalendar.scope,
            });
            this.isInitialized = true;
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Failed to initialize Google Calendar API:', error);
      throw new Error('Google Calendar API initialization failed');
    }
  }

  async signIn(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Check if OAuth Client ID is configured
      if (!environment.googleCalendar.clientId) {
        throw new Error('OAuth 2.0 Client ID not configured. Please set up OAuth credentials.');
      }

      const authInstance = gapi.auth2.getAuthInstance();

      if (!authInstance.isSignedIn.get()) {
        await authInstance.signIn();
      }

      this.isAuthenticated = authInstance.isSignedIn.get();
      return this.isAuthenticated;
    } catch (error) {
      console.error('Google Calendar authentication failed:', error);
      throw error;
    }
  }

  async listCalendars(): Promise<any> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Calendar');
    }

    try {
      return await gapi.client.calendar.calendarList.list();
    } catch (error) {
      console.error('Failed to list calendars:', error);
      throw error;
    }
  }

  async testCalendar(calendarId: string): Promise<boolean> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Calendar');
    }

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
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Calendar');
    }

    try {
      const response = await gapi.client.calendar.events.insert({
        calendarId: calendarId,
        resource: event,
      });
      return response;
    } catch (error) {
      console.error('Failed to create calendar event:', error);
      throw error;
    }
  }

  async updateEvent(calendarId: string, eventId: string, event: any): Promise<any> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Calendar');
    }

    try {
      const response = await gapi.client.calendar.events.update({
        calendarId: calendarId,
        eventId: eventId,
        resource: event,
      });
      return response;
    } catch (error) {
      console.error('Failed to update calendar event:', error);
      throw error;
    }
  }

  async listEvents(calendarId: string, query?: string): Promise<any> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Calendar');
    }

    try {
      const response = await gapi.client.calendar.events.list({
        calendarId: calendarId,
        q: query,
        maxResults: 2500,
        orderBy: 'startTime',
        singleEvents: true,
      });
      return response;
    } catch (error) {
      console.error('Failed to list calendar events:', error);
      throw error;
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated with Google Calendar');
    }

    try {
      await gapi.client.calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
      });
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
      throw error;
    }
  }

  isSignedIn(): boolean {
    if (!this.isInitialized) return false;
    const authInstance = gapi.auth2.getAuthInstance();
    return authInstance && authInstance.isSignedIn.get();
  }

  getCurrentUser(): any {
    if (!this.isSignedIn()) return null;
    const authInstance = gapi.auth2.getAuthInstance();
    return authInstance.currentUser.get();
  }

  async signOut(): Promise<void> {
    if (!this.isInitialized) return;

    const authInstance = gapi.auth2.getAuthInstance();
    if (authInstance) {
      await authInstance.signOut();
      this.isAuthenticated = false;
    }
  }

  private loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if gapi is already loaded
      if (typeof gapi !== 'undefined') {
        resolve();
        return;
      }

      // Load the Google API script
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        // Wait a bit for gapi to be fully available
        setTimeout(() => {
          if (typeof gapi !== 'undefined') {
            resolve();
          } else {
            reject(new Error('Google API failed to load'));
          }
        }, 100);
      };
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.head.appendChild(script);
    });
  }

  // Helper method to check if we have proper OAuth setup
  hasOAuthCredentials(): boolean {
    return !!environment.googleCalendar.clientId && environment.googleCalendar.clientId.trim() !== '';
  }

  // Method to get setup instructions if OAuth is not configured
  getSetupInstructions(): string {
    return `
    To enable Google Calendar integration:
    
    1. Go to Google Cloud Console (https://console.cloud.google.com/)
    2. Select your project: ni-vehicle-logistics-ef2bf
    3. Go to "APIs & Services" > "Credentials"
    4. Click "Create Credentials" > "OAuth 2.0 Client ID"
    5. Set application type to "Web application"
    6. Add your domain to "Authorized JavaScript origins"
    7. Copy the Client ID and add it to environment.googleCalendar.clientId
    `;
  }
}
