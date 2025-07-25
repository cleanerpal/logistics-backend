# Google OAuth 2.0 Setup for Calendar Integration

## Current Status ✅

- ✅ **API Key configured**: `AIzaSyBUqjn2Zuiv8mGSse4YAmSH1uZDXUzOzKA`
- ✅ **Google Calendar Service created**: Real API integration ready
- ✅ **Dependencies installed**: `googleapis` package added
- ❌ **Missing**: OAuth 2.0 Client ID for authentication

## Next Step: Get OAuth 2.0 Client ID

Your API key is configured, but **Google Calendar requires OAuth 2.0 authentication** to write/read calendar data. Here's how to get it:

### Step 1: Go to Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. **Select your project**: `ni-vehicle-logistics-ef2bf` (same project as your API key)

### Step 2: Enable Google Calendar API (if not already done)

1. Go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Calendar API"**
3. Click **"Enable"** if not already enabled

### Step 3: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"**
3. Select **"OAuth 2.0 Client ID"**

### Step 4: Configure OAuth Consent Screen (if needed)

If prompted to configure consent screen:

1. Choose **"External"** user type
2. Fill in basic app information:
   - **App name**: "Logistics System Calendar Integration"
   - **User support email**: Your email
   - **Developer contact**: Your email
3. Add scopes: `https://www.googleapis.com/auth/calendar`
4. Add test users (your email addresses)

### Step 5: Create OAuth 2.0 Client ID

1. **Application type**: Web application
2. **Name**: "Logistics Calendar Integration"
3. **Authorized JavaScript origins**: Add your domains
   - `http://localhost:4200` (for development)
   - `https://yourdomain.com` (for production)
4. **Authorized redirect URIs**: (optional for this setup)
5. Click **"Create"**

### Step 6: Copy Client ID

1. **Copy the Client ID** (looks like: `123456789-abc123def456.apps.googleusercontent.com`)
2. **DO NOT share** the Client Secret publicly

### Step 7: Update Environment Configuration

Add the Client ID to your environment file:

**File**: `src/environments/environment.ts`

```typescript
googleCalendar: {
  apiKey: 'AIzaSyBUqjn2Zuiv8mGSse4YAmSH1uZDXUzOzKA',
  clientId: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com', // 👈 Add this
  scope: 'https://www.googleapis.com/auth/calendar',
  discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
}
```

## Test the Integration

### Option 1: Test with Dashboard

1. Go to Dashboard
2. Click **"Sync to Google Calendar"**
3. It should prompt for Google login
4. Grant calendar permissions
5. Jobs should sync to your Google Calendar

### Option 2: Test with Settings

1. Go to **Settings** → **Calendar Settings**
2. Choose **"Custom Calendar"**
3. Enter a calendar ID (e.g., your email address)
4. Click **"Test Connection"**
5. Should authenticate and test the calendar

## Expected OAuth Flow

1. **User clicks sync/test** → Triggers authentication
2. **Google login popup** → User signs in with Google
3. **Permission request** → User grants calendar access
4. **Authentication success** → Real calendar operations work
5. **Calendar events created** → Jobs appear in Google Calendar

## Troubleshooting

### Error: "OAuth 2.0 Client ID not configured"

- ✅ **Solution**: Complete Step 7 above - add Client ID to environment

### Error: "redirect_uri_mismatch"

- ✅ **Solution**: Add your domain to "Authorized JavaScript origins" in OAuth settings

### Error: "access_denied"

- ✅ **Solution**: User needs to grant calendar permissions in the OAuth popup

### Error: "invalid_client"

- ✅ **Solution**: Check that Client ID is correct and project matches

## Security Notes

- ✅ **Client ID is safe** to include in frontend code (it's designed for public use)
- ❌ **Never expose Client Secret** in frontend code
- ✅ **Use HTTPS** in production for OAuth security
- ✅ **Limit authorized domains** to your actual domains only

## Calendar Integration Features

Once OAuth is set up, your app will have:

### ✅ **Real Calendar Sync**

- Creates actual events in Google Calendar
- Updates existing events when jobs change
- Includes driver assignments, addresses, timing

### ✅ **Multiple Calendar Support**

- Primary calendar (user's default)
- Custom calendars (company calendars, shared calendars)
- Real-time connection testing

### ✅ **Professional Authentication**

- Standard Google OAuth flow
- Secure token handling
- Automatic re-authentication

### ✅ **Error Handling**

- Clear error messages for users
- Fallback for authentication failures
- Detailed setup instructions

## Example Client IDs

**Format**: `123456789012-abcdefghijklmnop.apps.googleusercontent.com`

**Your project**: Should start with numbers from your Firebase project

## After OAuth Setup

Once you add the Client ID:

1. **Dashboard sync** → Real Google Calendar integration
2. **Settings test** → Actual calendar connection verification
3. **Job events** → Appear in Google Calendar with full details
4. **Team collaboration** → Shared calendars for logistics coordination

Your app is **99% ready** - just need that Client ID! 🎯
