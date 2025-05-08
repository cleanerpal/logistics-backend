// src/app/utils/firestore-utils.ts

/**
 * Convert Firestore timestamp to JavaScript Date
 * This utility function safely converts various timestamp formats
 * @param timestamp The timestamp to convert
 * @returns JavaScript Date object or undefined
 */
export function convertFirestoreTimestamp(timestamp: any): Date | undefined {
  if (!timestamp) return undefined;

  // Firebase timestamp object with toDate() method
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return timestamp.toDate();
  }

  // String timestamp
  if (typeof timestamp === 'string') {
    return new Date(timestamp);
  }

  // Number timestamp (milliseconds since epoch)
  if (typeof timestamp === 'number') {
    return new Date(timestamp);
  }

  // If it's already a Date object
  if (timestamp instanceof Date) {
    return timestamp;
  }

  return undefined;
}

/**
 * Safe date formatter that works with both Date objects and Firestore timestamps
 * @param date Date or timestamp to format
 * @param format 'short', 'medium', 'long', or a custom format function
 * @returns Formatted date string or 'N/A' if date is invalid
 */
export function formatFirestoreDate(date: any, format: 'short' | 'medium' | 'long' | ((date: Date) => string) = 'medium'): string {
  const jsDate = convertFirestoreTimestamp(date);
  if (!jsDate) return 'N/A';

  if (typeof format === 'function') {
    return format(jsDate);
  }

  switch (format) {
    case 'short':
      return jsDate.toLocaleDateString();
    case 'long':
      return jsDate.toLocaleString();
    case 'medium':
    default:
      return jsDate.toLocaleDateString() + ' ' + jsDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
