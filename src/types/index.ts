export interface UserState {
  currentLevel: number;
  currentXp: number; // 0 to 99 (levels up at 100)
  mascotHealth: number; // 0 to 100
  streakDays: number;
  streakShields: number; // currency to restore streak
  lastActionDate: string | null; // ISO string for streak logic
  totalItemsConsumed: number;
  mascotName: string;
  customOutfit?: 'auto' | 'none' | 'chef' | 'crown' | 'astronaut';
}

export type ItemStatus = 'active' | 'consumed' | 'spoiled';

export interface PantryItem {
  id: string;
  name: string;
  shelfLifeDays: number;
  dateAdded: string; // ISO string
  status: ItemStatus;
  markedAt: string | null; // ISO string when consumed/spoiled
  category?: string;
}

export interface PresetItem {
  name: string;
  defaultShelfLife: number;
  category: string;
  icon: string;
  isPackaged?: boolean;
}

export type QuestStatus = 'active' | 'completed' | 'expired';

export interface Quest {
  id: string;
  expiringItemIds: string[];
  recipe: string;
  status: QuestStatus;
  xpReward: number;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  defaultAvgItemCost: number;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)', defaultAvgItemCost: 120 },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)', defaultAvgItemCost: 2.50 },
  { code: 'EUR', symbol: '€', name: 'Euro (€)', defaultAvgItemCost: 2.20 },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)', defaultAvgItemCost: 2.00 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)', defaultAvgItemCost: 3.20 },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar (AU$)', defaultAvgItemCost: 3.50 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)', defaultAvgItemCost: 350 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real (R$)', defaultAvgItemCost: 12 },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso (MX$)', defaultAvgItemCost: 45 }
];

export function getCurrencyInfo(code: string = 'INR'): CurrencyInfo {
  return SUPPORTED_CURRENCIES.find(c => c.code === code) || SUPPORTED_CURRENCIES[0];
}

export interface UserSettings {
  notificationEnabled: boolean;
  notificationTime: string; // "HH:MM"
  notificationTimes?: string[]; // Array of reminder times ["08:00", "20:00"]
  darkMode: boolean;
  geminiApiKey: string; // User-provided key (optional)
  currency?: string; // e.g. "INR", "USD", "EUR"
  customItemCost?: number; // Optional user override for average item value
  householdCode?: string | null; // e.g. "SIM-8492" for paired cloud sync
}

export interface ShoppingItem {
  id: string;
  name: string;
  category?: string;
  isBought?: boolean;
  dateAdded: string;
}

export interface HeroRank {
  tier: number;
  title: string;
  icon: string;
  minLevel: number;
  description: string;
  badgeColor: string;
  perk: string;
}

export const HERO_RANKS: HeroRank[] = [
  { 
    tier: 1, 
    title: 'Kitchen Novice', 
    icon: '🥔', 
    minLevel: 1, 
    description: 'Beginning the food waste rescue journey!', 
    badgeColor: '#94a3b8',
    perk: '📋 Smart Expiry Notifications & Daily Streak Tracking' 
  },
  { 
    tier: 2, 
    title: 'Pantry Apprentice', 
    icon: '🥗', 
    minLevel: 3, 
    description: 'Learning the ways of shelf-life management.', 
    badgeColor: '#475569',
    perk: '💡 Freshness Preservation Hacks & 20+ Produce Storage Guides' 
  },
  { 
    tier: 3, 
    title: 'Junior Sous Chef', 
    icon: '🧑‍🍳', 
    minLevel: 5, 
    description: 'Saving ingredients before they spoil!', 
    badgeColor: '#16a34a',
    perk: '🍳 3-Ingredient Leftover Rescue Recipe Generator' 
  },
  { 
    tier: 4, 
    title: 'Flavor Guardian', 
    icon: '🍲', 
    minLevel: 8, 
    description: 'Mastering quick recipes & meal prep.', 
    badgeColor: '#0284c7',
    perk: '🛒 Auto-Restock Grocery List (1-Tap Grocery Checklist)' 
  },
  { 
    tier: 5, 
    title: 'Culinary Knight', 
    icon: '👑', 
    minLevel: 10, 
    description: 'A champion for zero food waste!', 
    badgeColor: '#7c3aed',
    perk: '💰 Real Money Saved Tracker ($ Saved vs Food Wasted)' 
  },
  { 
    tier: 6, 
    title: 'Pantry Warden', 
    icon: '⚔️', 
    minLevel: 15, 
    description: 'Defending the kitchen from spoilage.', 
    badgeColor: '#d97706',
    perk: '📸 AI Packet Expiry Date Scanner (Camera Date Auto-Fill)' 
  },
  { 
    tier: 7, 
    title: 'Waste-Zero Hero', 
    icon: '🌟', 
    minLevel: 20, 
    description: 'A legendary food saver in the community.', 
    badgeColor: '#ea580c',
    perk: '🌿 Eco Carbon & Water Footprint Impact Metrics (CO₂ Saved)' 
  },
  { 
    tier: 8, 
    title: 'Kitchen Alchemist', 
    icon: '🧙‍♂️', 
    minLevel: 25, 
    description: 'Turning leftover scraps into gourmet feasts!', 
    badgeColor: '#dc2626',
    perk: '🍱 7-Day Zero-Waste Meal Prep Planner' 
  },
  { 
    tier: 9, 
    title: 'Grandmaster Chef', 
    icon: '🐉', 
    minLevel: 30, 
    description: 'Ruling the kitchen with absolute zero waste.', 
    badgeColor: '#b91c1c',
    perk: '🧊 Multi-Zone Pantry Manager (Fridge, Freezer, Cabinet Sorting)' 
  },
  { 
    tier: 10, 
    title: 'Cosmic Food Deity', 
    icon: '🌌', 
    minLevel: 50, 
    description: 'Immortal protector of all food ecosystems!', 
    badgeColor: '#4f46e5',
    perk: '🌐 Full Data Export (CSV/JSON) & Custom Shelf-Life Engine' 
  }
];



export function getCurrentHeroRank(level: number): HeroRank {
  const unlocked = HERO_RANKS.filter(r => level >= r.minLevel);
  return unlocked[unlocked.length - 1] || HERO_RANKS[0];
}

export function getNextHeroRank(level: number): HeroRank | null {
  return HERO_RANKS.find(r => r.minLevel > level) || null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'STREAK' | 'RESCUE' | 'COOKING' | 'PANTRY' | 'SOCIAL';
  targetCount: number;
  xpReward: number;
  perkText: string;
}

export interface WeeklyRaid {
  id: string;
  title: string;
  description: string;
  icon: string;
  targetCount: number;
  currentCount: number;
  xpReward: number;
  shieldReward: number;
  isCompleted: boolean;
  startDate: string;
}




