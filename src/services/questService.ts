import type { PantryItem, UserState, UserSettings, Achievement, WeeklyRaid } from '../types';
import { getLocalDateString } from './db';

export const ALL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'streak_3',
    title: 'Flame Beginner',
    description: 'Maintain a 3-day active streak in Simmer.',
    icon: '🔥',
    category: 'STREAK',
    targetCount: 3,
    xpReward: 100,
    perkText: 'Unlocked Novice Badge'
  },
  {
    id: 'streak_7',
    title: 'Flame Guardian',
    description: 'Maintain a 7-day continuous streak.',
    icon: '⚡',
    category: 'STREAK',
    targetCount: 7,
    xpReward: 250,
    perkText: '+5% XP Boost on Quests'
  },
  {
    id: 'streak_30',
    title: 'Immortal Flame',
    description: 'Achieve a legendary 30-day streak.',
    icon: '👑',
    category: 'STREAK',
    targetCount: 30,
    xpReward: 1000,
    perkText: 'Free Auto Streak Shield'
  },
  {
    id: 'rescue_5',
    title: 'Waste Fighter',
    description: 'Rescue 5 food items from spoiling.',
    icon: '🥗',
    category: 'RESCUE',
    targetCount: 5,
    xpReward: 150,
    perkText: 'Sproutling Smiles Boost'
  },
  {
    id: 'rescue_25',
    title: 'Food Salvager',
    description: 'Rescue 25 food items from going to waste.',
    icon: '🛡️',
    category: 'RESCUE',
    targetCount: 25,
    xpReward: 500,
    perkText: 'Unlocks Chef Hat Outfit'
  },
  {
    id: 'rescue_100',
    title: 'Zero Waste Legend',
    description: 'Rescue 100 food items total.',
    icon: '🌟',
    category: 'RESCUE',
    targetCount: 100,
    xpReward: 2000,
    perkText: 'Unlocks Cosmic Crown Outfit'
  },
  {
    id: 'pantry_10',
    title: 'Pantry Keeper',
    description: 'Add 10 items to your digital pantry.',
    icon: '🛒',
    category: 'PANTRY',
    targetCount: 10,
    xpReward: 100,
    perkText: 'Pantry Sorting Unlocked'
  },
  {
    id: 'pantry_50',
    title: 'Stock Master',
    description: 'Log 50 items in your pantry.',
    icon: '📦',
    category: 'PANTRY',
    targetCount: 50,
    xpReward: 400,
    perkText: 'Batch Scan Helper'
  },
  {
    id: 'household_sync',
    title: 'Household Sentinel',
    description: 'Sync your pantry with family using a Household Code.',
    icon: '🔗',
    category: 'SOCIAL',
    targetCount: 1,
    xpReward: 200,
    perkText: 'Shared Pantry Mode Active'
  }
];

export class QuestService {
  /**
   * Get or initialize current Weekly Raid state
   */
  static getWeeklyRaid(items: PantryItem[]): WeeklyRaid {
    const today = getLocalDateString();
    const stored = localStorage.getItem('simmer_weekly_raid');
    
    let raid: WeeklyRaid;
    if (stored) {
      try {
        raid = JSON.parse(stored);
      } catch (e) {
        raid = QuestService.createNewRaid(today);
      }
    } else {
      raid = QuestService.createNewRaid(today);
    }

    // Check if raid week expired (older than 7 days)
    const startDate = new Date(raid.startDate);
    const currentDate = new Date(today);
    const diffDays = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));

    if (diffDays >= 7) {
      raid = QuestService.createNewRaid(today);
    }

    // Count items consumed within this raid week
    const consumedThisWeek = items.filter(i => {
      if (i.status !== 'consumed') return false;
      const markedStr = (i.markedAt || i.dateAdded).substring(0, 10);
      return markedStr >= raid.startDate;
    }).length;

    raid.currentCount = Math.min(consumedThisWeek, raid.targetCount);
    if (raid.currentCount >= raid.targetCount) {
      raid.isCompleted = true;
    }

    localStorage.setItem('simmer_weekly_raid', JSON.stringify(raid));
    return raid;
  }

  private static createNewRaid(startDateStr: string): WeeklyRaid {
    return {
      id: `raid_${startDateStr}`,
      title: 'Zero Waste Siege',
      description: 'Rescue 5 items from your pantry before Sunday midnight!',
      icon: '🛡️',
      targetCount: 5,
      currentCount: 0,
      xpReward: 250,
      shieldReward: 1,
      isCompleted: false,
      startDate: startDateStr
    };
  }

  /**
   * Evaluate which achievements are unlocked based on user stats
   */
  static getUnlockedAchievements(user: UserState, items: PantryItem[], settings: UserSettings): string[] {
    const consumedCount = items.filter(i => i.status === 'consumed').length;
    const totalAddedCount = items.length;
    const isHouseholdActive = !!settings.householdCode;

    const unlocked: string[] = [];

    ALL_ACHIEVEMENTS.forEach(ach => {
      if (ach.id.startsWith('streak_')) {
        if (user.streakDays >= ach.targetCount) unlocked.push(ach.id);
      } else if (ach.id.startsWith('rescue_')) {
        if (consumedCount >= ach.targetCount) unlocked.push(ach.id);
      } else if (ach.id.startsWith('pantry_')) {
        if (totalAddedCount >= ach.targetCount) unlocked.push(ach.id);
      } else if (ach.id === 'household_sync') {
        if (isHouseholdActive) unlocked.push(ach.id);
      }
    });

    return unlocked;
  }
}
