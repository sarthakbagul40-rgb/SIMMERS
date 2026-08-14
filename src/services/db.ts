import type { UserState, PantryItem, Quest, UserSettings, ShoppingItem } from '../types';
import { NativeStorageService } from './storage';
import { InputValidator } from '../utils/validation';
import { HybridSyncService } from './hybridSyncService';


// Helper to get local date in YYYY-MM-DD format
export function getLocalDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('sv'); // 'sv' locale outputs YYYY-MM-DD format
}

// Helper to format ISO/date string into human readable Month Day, Year (e.g. Aug 10, 2026)
export function formatDisplayDate(dateIso: string, addDays: number = 0): string {
  const d = new Date(dateIso);
  if (addDays !== 0) {
    d.setDate(d.getDate() + addDays);
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper to categorize item based on name
export function getItemCategory(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('milk') || lower.includes('egg') || lower.includes('cheese') || lower.includes('yogurt') || lower.includes('butter') || lower.includes('cream')) return 'Dairy';
  if (lower.includes('veg') || lower.includes('fruit') || lower.includes('apple') || lower.includes('banana') || lower.includes('tomato') || lower.includes('potato') || lower.includes('berry')) return 'Produce';
  if (lower.includes('bread') || lower.includes('bun') || lower.includes('cake') || lower.includes('pastry') || lower.includes('croissant')) return 'Bakery';
  if (lower.includes('chicken') || lower.includes('meat') || lower.includes('beef') || lower.includes('pork') || lower.includes('fish') || lower.includes('steak')) return 'Meat';
  return 'Pantry';
}

// Calculate difference in days between two YYYY-MM-DD date strings
export function getDaysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Default States
const DEFAULT_USER: UserState = {
  currentLevel: 1,
  currentXp: 0,
  mascotHealth: 100,
  streakDays: 0,
  streakShields: 50,
  lastActionDate: null,
  totalItemsConsumed: 0,
  mascotName: 'Bitey'
};

import { SUPPORTED_CURRENCIES, getCurrencyInfo } from '../types';

export function detectLocalCurrency(): string {
  try {
    const locale = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US';
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' });
    const resolved = formatter.resolvedOptions().currency;
    if (resolved && SUPPORTED_CURRENCIES.some(c => c.code === resolved)) {
      return resolved;
    }
    const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
    if (locale.includes('IN') || tz.includes('Kolkata')) {
      return 'INR';
    }
  } catch {
    // Fallback
  }
  return 'INR';
}

const DEFAULT_SETTINGS: UserSettings = {
  notificationEnabled: true,
  notificationTime: '08:00',
  notificationTimes: ['08:00', '20:00'],
  darkMode: false,
  geminiApiKey: '',
  currency: detectLocalCurrency()
};

// Helper to calculate money saved based on local currency
export function calculateFinancialSavings(
  items: PantryItem[],
  settings: UserSettings,
  daysBack: number = 7
): { count: number; totalSavings: number; formattedSavings: string; currencySymbol: string; currencyCode: string } {
  const currencyCode = settings.currency || detectLocalCurrency();
  const currencyInfo = getCurrencyInfo(currencyCode);
  const costPerItem = settings.customItemCost || currencyInfo.defaultAvgItemCost;

  const now = new Date().getTime();
  const cutoffTime = now - daysBack * 24 * 60 * 60 * 1000;

  const rescuedItems = items.filter((item) => {
    if (item.status !== 'consumed') return false;
    if (!item.markedAt) return true; // fallback
    const markedTime = new Date(item.markedAt).getTime();
    return markedTime >= cutoffTime;
  });

  const count = rescuedItems.length;
  const totalSavings = count * costPerItem;

  // Formatting currency with zero decimals for JPY / INR or 2 decimals for USD / EUR
  const isZeroDecimals = currencyCode === 'JPY' || (currencyCode === 'INR' && totalSavings % 1 === 0);
  const formattedVal = totalSavings.toLocaleString(undefined, {
    minimumFractionDigits: isZeroDecimals ? 0 : 2,
    maximumFractionDigits: 2
  });

  return {
    count,
    totalSavings,
    formattedSavings: `${currencyInfo.symbol} ${formattedVal}`,
    currencySymbol: currencyInfo.symbol,
    currencyCode
  };
}

// LocalStorage Keys
const KEYS = {
  USER: 'pantry_rpg_user',
  ITEMS: 'pantry_rpg_items',
  SETTINGS: 'pantry_rpg_settings',
  QUESTS: 'pantry_rpg_quests',
  DAILY_QUESTS: 'pantry_rpg_daily_quests'
};

export class DbService {
  static loadUser(): UserState {
    const data = localStorage.getItem(KEYS.USER);
    if (!data) return DEFAULT_USER;
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('[DbService] Error parsing user state JSON:', e);
      return DEFAULT_USER;
    }
  }

  static saveUser(user: UserState): void {
    const json = JSON.stringify(user);
    localStorage.setItem(KEYS.USER, json);
    NativeStorageService.set(KEYS.USER, json);
  }

  static loadItems(): PantryItem[] {
    const data = localStorage.getItem(KEYS.ITEMS);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('[DbService] Error parsing items JSON:', e);
      return [];
    }
  }

  static saveItems(items: PantryItem[]): void {
    const json = JSON.stringify(items);
    localStorage.setItem(KEYS.ITEMS, json);
    NativeStorageService.set(KEYS.ITEMS, json);
  }

  static loadSettings(): UserSettings {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (!data) return DEFAULT_SETTINGS;
    try {
      const parsed = JSON.parse(data);
      if (!parsed.notificationTimes || !Array.isArray(parsed.notificationTimes) || parsed.notificationTimes.length === 0) {
        parsed.notificationTimes = [parsed.notificationTime || '08:00'];
      }
      if (!parsed.currency) {
        parsed.currency = detectLocalCurrency();
      }
      // Decode obfuscated API key from localStorage
      if (parsed.geminiApiKey && parsed.geminiApiKey.length > 0) {
        try {
          parsed.geminiApiKey = atob(parsed.geminiApiKey);
        } catch (e) {
          console.warn('[DbService] Key decode warning (legacy key):', e);
        }
      }
      return parsed;
    } catch (e) {
      console.error('[DbService] Error parsing settings JSON:', e);
      return DEFAULT_SETTINGS;
    }
  }


  static saveSettings(settings: UserSettings): void {
    // Obfuscate sensitive API key before writing to localStorage
    const safeSettings = { ...settings };
    if (safeSettings.geminiApiKey && safeSettings.geminiApiKey.length > 0) {
      safeSettings.geminiApiKey = btoa(safeSettings.geminiApiKey);
    }
    const json = JSON.stringify(safeSettings);
    localStorage.setItem(KEYS.SETTINGS, json);
    NativeStorageService.set(KEYS.SETTINGS, json);
  }

  static loadQuests(): Quest[] {
    const data = localStorage.getItem(KEYS.QUESTS);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveQuests(quests: Quest[]): void {
    const json = JSON.stringify(quests);
    localStorage.setItem(KEYS.QUESTS, json);
    NativeStorageService.set(KEYS.QUESTS, json);
  }

  static loadDailyQuests(): { lastGeneratedAt: number; quests: any[]; completedQuestIds: string[]; allCompletedAt: number | null } | null {
    const data = localStorage.getItem(KEYS.DAILY_QUESTS);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  static saveDailyQuests(state: { lastGeneratedAt: number; quests: any[]; completedQuestIds: string[]; allCompletedAt: number | null }): void {
    const json = JSON.stringify(state);
    localStorage.setItem(KEYS.DAILY_QUESTS, json);
    NativeStorageService.set(KEYS.DAILY_QUESTS, json);
  }



  // --- BUSINESS LOGIC ---

  // Add item to pantry
  static addItem(name: string, shelfLifeDays: number, category?: string): { success: boolean; error?: string; item?: PantryItem } {
    const nameVal = InputValidator.validateFoodName(name);
    if (!nameVal.valid) {
      return { success: false, error: nameVal.error };
    }

    const lifeVal = InputValidator.validateShelfLife(shelfLifeDays);
    if (!lifeVal.valid) {
      return { success: false, error: lifeVal.error };
    }

    const items = this.loadItems();
    
    // Check item limit (Free limit: 50 items)
    const activeItemsCount = items.filter(i => i.status === 'active').length;
    const isPro = localStorage.getItem('pantry_rpg_pro_pass') === 'true';

    if (!isPro && activeItemsCount >= 50) {
      return { 
        success: false, 
        error: 'Pantry limit reached (50 items max on free tier). Upgrade to Pro Pass in Settings for unlimited slots!' 
      };
    }

    const newItem: PantryItem = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      shelfLifeDays,
      dateAdded: new Date().toISOString(),
      status: 'active',
      markedAt: null,
      category: category || getItemCategory(name)
    };

    items.push(newItem);
    this.saveItems(items);
    return { success: true, item: newItem };
  }

  // Consume item (+XP, adjust streak, update mascot)
  static consumeItem(itemId: string): { success: boolean; xpGained: number; levelUp: boolean } {
    const items = this.loadItems();
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || items[itemIndex].status !== 'active') {
      return { success: false, xpGained: 0, levelUp: false };
    }

    const item = items[itemIndex];
    item.status = 'consumed';
    item.markedAt = new Date().toISOString();
    this.saveItems(items);

    // Calculate XP
    let xpGained = 25; // Short shelf life (1-3 days)
    if (item.shelfLifeDays >= 4 && item.shelfLifeDays <= 7) {
      xpGained = 50; // Medium
    } else if (item.shelfLifeDays >= 8) {
      xpGained = 75; // Long
    }

    // Update User State
    const user = this.loadUser();
    let newXp = user.currentXp + xpGained;
    let newLevel = user.currentLevel;
    let levelUp = false;

    if (newXp >= 100) {
      newLevel += Math.floor(newXp / 100);
      newXp = newXp % 100;
      levelUp = true;
    }

    // Recover Mascot Health (+5% up to 100)
    const newHealth = Math.min(100, user.mascotHealth + 5);

    // Update streak logic
    const today = getLocalDateString();
    let newStreak = user.streakDays;

    if (!user.lastActionDate) {
      newStreak = 1;
    } else {
      const diff = getDaysDifference(user.lastActionDate, today);
      if (diff === 1) {
        newStreak += 1;
      } else if (diff > 1) {
        newStreak = 1;
      }
    }

    const updatedUser: UserState = {
      ...user,
      currentLevel: newLevel,
      currentXp: newXp,
      mascotHealth: newHealth,
      streakDays: newStreak,
      lastActionDate: today,
      totalItemsConsumed: user.totalItemsConsumed + 1
    };

    this.saveUser(updatedUser);
    return { success: true, xpGained, levelUp };
  }

  // Spoil item (-10% Mascot Health)
  static spoilItem(itemId: string): { success: boolean } {
    const items = this.loadItems();
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || items[itemIndex].status !== 'active') {
      return { success: false };
    }

    items[itemIndex].status = 'spoiled';
    items[itemIndex].markedAt = new Date().toISOString();
    this.saveItems(items);

    // Deduct 10% Health
    const user = this.loadUser();
    const newHealth = Math.max(0, user.mascotHealth - 10);
    this.saveUser({ ...user, mascotHealth: newHealth });

    return { success: true };
  }

  // Restore spoiled item back to active (+10% Mascot Health)
  static unspoilItem(itemId: string): { success: boolean } {
    const items = this.loadItems();
    const itemIndex = items.findIndex(i => i.id === itemId);
    if (itemIndex === -1 || items[itemIndex].status !== 'spoiled') {
      return { success: false };
    }

    items[itemIndex].status = 'active';
    delete items[itemIndex].markedAt;
    this.saveItems(items);

    // Restore 10% Health
    const user = this.loadUser();
    const newHealth = Math.min(100, user.mascotHealth + 10);
    this.saveUser({ ...user, mascotHealth: newHealth });

    return { success: true };
  }


  // Update item details (Name, Shelf Life, Category)
  static updateItem(itemId: string, name: string, shelfLifeDays: number, category?: string): boolean {
    const nameVal = InputValidator.validateFoodName(name);
    if (!nameVal.valid) return false;

    const lifeVal = InputValidator.validateShelfLife(shelfLifeDays);
    if (!lifeVal.valid) return false;

    const items = this.loadItems();
    const item = items.find(i => i.id === itemId);
    if (!item) return false;

    item.name = name.trim();
    item.shelfLifeDays = Number(shelfLifeDays);
    if (category) item.category = category;
    this.saveItems(items);
    return true;
  }

  // Edit item shelf life
  static editShelfLife(itemId: string, newShelfLifeDays: number): boolean {
    const lifeVal = InputValidator.validateShelfLife(newShelfLifeDays);
    if (!lifeVal.valid) return false;

    const items = this.loadItems();
    const item = items.find(i => i.id === itemId);
    if (!item) return false;

    item.shelfLifeDays = Number(newShelfLifeDays);
    this.saveItems(items);
    return true;
  }

  // Delete item
  static deleteItem(itemId: string, householdId?: string): void {
    const items = this.loadItems();
    const filtered = items.filter(i => i.id !== itemId);
    this.saveItems(filtered);
    if (householdId) {
      HybridSyncService.deleteItemFromCloud(householdId, itemId);
    }
  }

  // Revive streak using shields
  static reviveStreak(): { success: boolean; error?: string } {
    const user = this.loadUser();
    if (user.streakShields < 50) {
      return { success: false, error: 'Not enough Streak Shields (50 required).' };
    }

    const updatedUser: UserState = {
      ...user,
      streakShields: user.streakShields - 50,
      lastActionDate: getLocalDateString()
    };
    this.saveUser(updatedUser);
    return { success: true };
  }

  // Add streak shields (e.g., watching rewarded ad)
  static addStreakShields(amount: number): void {
    const user = this.loadUser();
    this.saveUser({ ...user, streakShields: user.streakShields + amount });
  }

  // Quest Management
  static updateQuestStatus(): void {
    const quests = this.loadQuests();
    const items = this.loadItems();

    let updated = false;
    const todayIso = new Date().toISOString();

    quests.forEach((q) => {
      if (q.status === 'active') {
        const ingredientsConsumed = q.expiringItemIds.every((id) => {
          const item = items.find((i) => i.id === id);
          return item && item.status === 'consumed';
        });

        if (ingredientsConsumed) {
          q.status = 'completed';
          updated = true;
          const user = this.loadUser();
          user.currentXp += q.xpReward;
          this.saveUser(user);
        } else if (todayIso > q.expiresAt) {
          q.status = 'expired';
          updated = true;
        }
      }
    });

    if (updated) {
      this.saveQuests(quests);
    }
  }

  // Shopping List Management
  static loadShoppingList(): ShoppingItem[] {
    try {
      const data = localStorage.getItem('kitchen_hero_shopping_list');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveShoppingList(list: ShoppingItem[]): void {
    try {
      localStorage.setItem('kitchen_hero_shopping_list', JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save shopping list', e);
    }
  }
}

