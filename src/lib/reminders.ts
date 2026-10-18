/**
 * Daily check-in reminder via local notifications.
 * Web is unsupported (scheduled notifications don't exist there) — callers
 * should hide the toggle on web. Uses the same interface either way so the
 * Home screen stays clean.
 */
import { Platform } from 'react-native';

const REMINDER_HOUR = 20; // 8 pm local

export const remindersSupported = Platform.OS !== 'web';

/** Ask permission + schedule the daily reminder. Returns true on success. */
export async function enableDailyReminder(): Promise<boolean> {
  if (!remindersSupported) return false;
  const Notifications = await import('expo-notifications');

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  // Replace any previous schedule so we never stack duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time for your daily check-in 🌿',
      body: 'A minute of reflection keeps your streak alive. How was your day?',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: 0,
    },
  });
  return true;
}

export async function disableDailyReminder(): Promise<void> {
  if (!remindersSupported) return;
  const Notifications = await import('expo-notifications');
  await Notifications.cancelAllScheduledNotificationsAsync();
}
