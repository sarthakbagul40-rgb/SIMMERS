import { Preferences } from '@capacitor/preferences';

const ALL_STORAGE_KEYS = [
  'simmer_onboarding_done',
  'pantry_rpg_user',
  'pantry_rpg_items',
  'pantry_rpg_settings',
  'pantry_rpg_quests',
  'pantry_rpg_daily_quests',
  'pantry_rpg_pro_pass',
  'kitchen_hero_shopping_list',
  'pantry_rpg_has_seeded',
  'simmer_device_id',
  'simmer_device_profile'
];

export class NativeStorageService {
  /**
   * Save a key-value pair to native Android SharedPreferences and localStorage
   */
  static async set(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
      await Preferences.set({ key, value });
    } catch (e) {
      console.warn(`[NativeStorage] Failed to write key ${key}:`, e);
    }
  }

  /**
   * Get value from localStorage or fallback to native SharedPreferences
   */
  static async get(key: string): Promise<string | null> {
    const localVal = localStorage.getItem(key);
    if (localVal !== null && localVal !== undefined) return localVal;

    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        localStorage.setItem(key, value);
        return value;
      }
    } catch (e) {
      console.warn(`[NativeStorage] Failed to read key ${key}:`, e);
    }
    return null;
  }

  /**
   * Remove key from native storage and localStorage
   */
  static async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
      await Preferences.remove({ key });
    } catch (e) {
      console.warn(`[NativeStorage] Failed to remove key ${key}:`, e);
    }
  }

  /**
   * Called at App launch to hydrate storage safely.
   * Prioritizes active synchronous web localStorage, and flushes to native storage.
   * Restores from native storage only if web cache was cleared.
   */
  static async initStorage(): Promise<void> {
    try {
      for (const key of ALL_STORAGE_KEYS) {
        const localValue = localStorage.getItem(key);
        const { value: nativeValue } = await Preferences.get({ key });

        if (localValue !== null && localValue !== undefined) {
          // localStorage has active user edits - sync to native storage
          await Preferences.set({ key, value: localValue });
        } else if (nativeValue !== null && nativeValue !== undefined) {
          // Web cache was cleared - restore from native storage backup
          localStorage.setItem(key, nativeValue);
        }
      }
    } catch (e) {
      console.warn('[NativeStorage] Init hydration failed:', e);
    }
  }
}
