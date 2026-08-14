import { LocalNotifications } from '@capacitor/local-notifications';
import type { PantryItem, UserSettings, UserState } from '../types';
import { getLocalDateString, getDaysDifference } from './db';

export class NotificationService {
  /**
   * Ensure Android High-Importance Notification Channels exist (Android 8.0+)
   */
  static async ensureChannels(): Promise<void> {
    try {
      await LocalNotifications.createChannel({
        id: 'simmers_expiry_alerts',
        name: 'Expiry & Pantry Alerts',
        description: 'Notifications for items expiring soon in your pantry',
        importance: 5, // Importance 5 = High (Heads-up banner + sound + vibration)
        visibility: 1, // Public on lockscreen
        vibration: true,
        lights: true,
        lightColor: '#EF4444'
      });

      await LocalNotifications.createChannel({
        id: 'simmers_daily_reminders',
        name: 'Daily App Reminders',
        description: 'Daily recipe quests and streak reminders',
        importance: 4,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#3B49DF'
      });
    } catch (e) {
      console.warn('[NotificationService] Channel creation warning:', e);
    }
  }

  /**
   * Request system push notification permissions (Android 13+ & iOS & Web)
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const status = await LocalNotifications.requestPermissions();
      if (status.display === 'granted') {
        await this.ensureChannels();
        return true;
      }
    } catch (e) {
      console.warn('[NotificationService] LocalNotifications permission error:', e);
    }

    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          await this.ensureChannels();
          return true;
        }
      } catch (e) {
        console.warn('[NotificationService] Web Notification permission error:', e);
      }
    }
    return false;
  }

  /**
   * Send an immediate test notification (triggers in 3 seconds) for instant verification on screen
   */
  static async sendTestNotification(): Promise<boolean> {
    const hasPerm = await this.requestPermissions();
    if (!hasPerm) return false;

    try {
      await this.ensureChannels();
      const testTime = new Date(Date.now() + 3000); // 3 seconds from now

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 9999,
            title: '🔔 SIMMERS Notifications Active!',
            body: 'Your food waste alerts & daily reminders are configured and working on your screen! 🎉',
            schedule: { at: testTime },
            channelId: 'simmers_expiry_alerts',
            smallIcon: 'ic_launcher',
            iconColor: '#3b49df'
          }
        ]
      });
      return true;
    } catch (e) {
      console.error('[NotificationService] Test notification error:', e);
      return false;
    }
  }

  /**
   * Schedule smart local notifications:
   * 1. Product Expiry Warnings
   * 2. Daily App Engagement Reminders (Recurring 9AM, 2PM, 8PM every single day)
   */
  static async scheduleExpiryNotifications(items: PantryItem[], settings: UserSettings, user?: UserState): Promise<void> {
    if (!settings.notificationEnabled) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
        }
      } catch (e) {
        // ignore
      }
      return;
    }

    // Ensure permissions & Android channels
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    try {
      await this.ensureChannels();

      // Clear previous scheduled notifications to avoid duplicate clutter
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }

      const notificationsToSchedule: any[] = [];
      const mascotName = user?.mascotName || 'Simmer';

      // --- SECTION 1: PRODUCT EXPIRY NOTIFICATIONS (RECURRING DAILY ALERTS) ---
      const activeItems = items.filter(i => i.status === 'active');
      const today = getLocalDateString();

      const expiringItems = activeItems.filter(item => {
        const dateAddedStr = item.dateAdded.substring(0, 10);
        const elapsed = getDaysDifference(dateAddedStr, today);
        const remaining = item.shelfLifeDays - elapsed;
        return remaining <= 3;
      });

      if (expiringItems.length > 0) {
        const expiringTodayOrPast = expiringItems.filter(item => {
          const elapsed = getDaysDifference(item.dateAdded.substring(0, 10), today);
          return (item.shelfLifeDays - elapsed) <= 0;
        });

        const expiringSoon = expiringItems.filter(item => {
          const elapsed = getDaysDifference(item.dateAdded.substring(0, 10), today);
          return (item.shelfLifeDays - elapsed) > 0;
        });

        const times = settings.notificationTimes || [settings.notificationTime || '08:00'];
        let expiryNotifId = 100;

        for (const timeStr of times) {
          const [hours, minutes] = timeStr.split(':').map(Number);
          if (isNaN(hours) || isNaN(minutes)) continue;

          let bodyMessage = '';
          if (expiringTodayOrPast.length > 0) {
            const names = expiringTodayOrPast.map(i => i.name).slice(0, 3).join(', ');
            bodyMessage = `⚠️ ${expiringTodayOrPast.length} item(s) expiring today (${names})! Consume now to save mascot health!`;
          } else {
            const names = expiringSoon.map(i => i.name).slice(0, 3).join(', ');
            bodyMessage = `🔔 ${expiringSoon.length} item(s) expiring soon (${names})! Complete recipe quests for +XP!`;
          }

          // Schedule recurring daily expiry check at user's preferred time
          notificationsToSchedule.push({
            title: '🍲 SIMMERS Expiry Alert',
            body: bodyMessage,
            id: expiryNotifId++,
            schedule: {
              on: { hour: hours, minute: minutes },
              repeats: true
            },
            channelId: 'simmers_expiry_alerts',
            smallIcon: 'ic_launcher',
            iconColor: '#ef4444'
          });
        }
      }

      // --- SECTION 2: DAILY RECURRING APP ENGAGEMENT REMINDERS (9AM, 2PM, 8PM EVERY SINGLE DAY) ---
      const engagementSlots = [
        {
          id: 201,
          hour: 9,
          minute: 0,
          title: '🌅 Morning Hero Quests Ready!',
          body: `Your daily recipe quests & XP rewards are waiting! Check in with ${mascotName} 🛡️`
        },
        {
          id: 202,
          hour: 14,
          minute: 0,
          title: `🍲 ${mascotName} Misses You!`,
          body: 'Check out how much money & food you saved this week! Tap to view your progress 🌟'
        },
        {
          id: 203,
          hour: 20,
          minute: 0,
          title: '🌙 Evening Pantry Check-In',
          body: 'Plan tomorrow\'s meals & protect your hero streak! 1 tap to update your pantry 🧺'
        }
      ];

      for (const slot of engagementSlots) {
        notificationsToSchedule.push({
          title: slot.title,
          body: slot.body,
          id: slot.id,
          schedule: {
            on: { hour: slot.hour, minute: slot.minute },
            repeats: true
          },
          channelId: 'simmers_daily_reminders',
          smallIcon: 'ic_launcher',
          iconColor: '#3b49df'
        });
      }

      if (notificationsToSchedule.length > 0) {
        await LocalNotifications.schedule({
          notifications: notificationsToSchedule
        });
        console.log(`[NotificationService] Scheduled ${notificationsToSchedule.length} recurring daily notifications with Android High-Importance Channels.`);
      }
    } catch (e) {
      console.warn('[NotificationService] Error scheduling local notifications:', e);
    }
  }
}
