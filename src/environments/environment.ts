export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyBUqjn2Zuiv8mGSse4YAmSH1uZDXUzOzKA',
    authDomain: 'ni-vehicle-logistics-ef2bf.firebaseapp.com',
    projectId: 'ni-vehicle-logistics-ef2bf',
    storageBucket: 'ni-vehicle-logistics-ef2bf.firebasestorage.app',
    messagingSenderId: '1043357428512',
    appId: '1:1043357428512:web:7c4659dc471ee20ba40545',
    measurementId: 'G-M3SC9Z72FM',
  },
  googleCalendar: {
    apiKey: 'AIzaSyBUqjn2Zuiv8mGSse4YAmSH1uZDXUzOzKA',
    clientId: '', // You'll need to add OAuth 2.0 Client ID here
    scope: 'https://www.googleapis.com/auth/calendar',
    discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
  },
  appVersion: '1.0.0',
  apiUrl: 'http://localhost:3000', // <-- Set to your backend API URL
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
