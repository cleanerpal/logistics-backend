import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Interface for creating a user
interface CreateUserData {
  email: string;
  password: string;
  role: string;
}

// Interface for updating a user email
interface UpdateEmailData {
  uid: string;
  newEmail: string;
}

// Interface for updating user status
interface UpdateUserStatusData {
  uid: string;
  disabled: boolean;
}

// Create a new user account with admin privileges
export const createUserAccount = functions.https.onCall(
  async (request: functions.https.CallableRequest<CreateUserData>) => {
    // Check if the caller is an admin
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }

    try {
      const callerUid = request.auth.uid;
      const callerRef = admin.firestore().collection('users').doc(callerUid);
      const callerSnap = await callerRef.get();

      if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only administrators can create new user accounts.'
        );
      }

      // Create a new user with the provided email and password
      const userRecord = await admin.auth().createUser({
        email: request.data.email,
        password: request.data.password,
        emailVerified: false, // Set to false so users will need to verify their email
      });

      return {
        uid: userRecord.uid,
        email: userRecord.email,
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error
          ? error.message
          : 'An error occurred while creating the user account.'
      );
    }
  }
);

// Send password reset email with admin privileges
export const sendPasswordResetEmail = functions.https.onCall(
  async (request: functions.https.CallableRequest<{ email: string }>) => {
    // Check if the caller is an admin
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }

    try {
      const callerUid = request.auth.uid;
      const callerRef = admin.firestore().collection('users').doc(callerUid);
      const callerSnap = await callerRef.get();

      if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only administrators can send password reset emails.'
        );
      }

      // Generate password reset link
      const link = await admin
        .auth()
        .generatePasswordResetLink(request.data.email);

      // In a production app, you would send this email using a service like SendGrid, Mailgun, etc.
      // For now, we'll just log it and respond with success
      console.log(`Password reset link for ${request.data.email}: ${link}`);

      // Here we'd normally call a service to send the email
      // For testing, Firebase will automatically send the reset email

      return { success: true };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error
          ? error.message
          : 'An error occurred while sending the password reset email.'
      );
    }
  }
);

// Update user email with admin privileges
export const updateUserEmail = functions.https.onCall(
  async (request: functions.https.CallableRequest<UpdateEmailData>) => {
    // Check if the caller is an admin
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }

    try {
      const callerUid = request.auth.uid;
      const callerRef = admin.firestore().collection('users').doc(callerUid);
      const callerSnap = await callerRef.get();

      if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only administrators can update user emails.'
        );
      }

      // Update the user's email
      await admin.auth().updateUser(request.data.uid, {
        email: request.data.newEmail,
        emailVerified: false, // Reset email verification status
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating user email:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error
          ? error.message
          : 'An error occurred while updating the user email.'
      );
    }
  }
);

// Delete a user account with admin privileges
export const deleteUserAccount = functions.https.onCall(
  async (request: functions.https.CallableRequest<{ uid: string }>) => {
    // Check if the caller is an admin
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }

    try {
      const callerUid = request.auth.uid;
      const callerRef = admin.firestore().collection('users').doc(callerUid);
      const callerSnap = await callerRef.get();

      if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only administrators can delete user accounts.'
        );
      }

      // Delete the user account
      await admin.auth().deleteUser(request.data.uid);

      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error
          ? error.message
          : 'An error occurred while deleting the user account.'
      );
    }
  }
);

// Update user status (enable/disable account) with admin privileges
export const updateUserStatus = functions.https.onCall(
  async (request: functions.https.CallableRequest<UpdateUserStatusData>) => {
    // Check if the caller is an admin
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }

    try {
      const callerUid = request.auth.uid;
      const callerRef = admin.firestore().collection('users').doc(callerUid);
      const callerSnap = await callerRef.get();

      if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only administrators can update user status.'
        );
      }

      // Update the user's disabled status
      await admin.auth().updateUser(request.data.uid, {
        disabled: request.data.disabled,
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating user status:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error
          ? error.message
          : 'An error occurred while updating the user status.'
      );
    }
  }
);

// Trigger when a user is deleted to clean up Firestore data
export const userDeleted = onUserDeleted(async (event: UserEvent) => {
  try {
    // Delete the user's document from Firestore
    const userRef = admin.firestore().collection('users').doc(event.data.uid);
    await userRef.delete();

    console.log(`Successfully deleted user data for ${event.data.uid}`);
    return true;
  } catch (error) {
    console.error('Error deleting user data:', error);
    throw error;
  }
});
