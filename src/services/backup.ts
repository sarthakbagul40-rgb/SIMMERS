import type { UserState, PantryItem, Quest, UserSettings } from '../types';
import { DbService } from './db';
import { InputValidator } from '../utils/validation';

interface BackupData {
  version: string;
  user: UserState;
  items: PantryItem[];
  quests: Quest[];
  settings: UserSettings;
  timestamp: string;
}

export class BackupService {
  // Export all localStorage data to a single JSON file
  static exportBackup(): void {
    const user = DbService.loadUser();
    const items = DbService.loadItems();
    const quests = DbService.loadQuests();
    const settings = DbService.loadSettings();

    // Strip sensitive fields before export — never leak API keys or sync codes
    const safeSettings = { ...settings, geminiApiKey: '', householdCode: null };

    const backupData: BackupData = {
      version: '1.0.0',
      user,
      items,
      quests,
      settings: safeSettings,
      timestamp: new Date().toISOString()
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create temporary link and trigger download
    const link = document.createElement('a');
    const safeName = user.mascotName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.href = url;
    link.download = `pantry_rpg_${safeName}_backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Import and validate JSON backup file
  static async importBackup(file: File): Promise<{ success: boolean; error?: string }> {
    const fileVal = InputValidator.validateBackupFile(file);
    if (!fileVal.valid) {
      return { success: false, error: fileVal.error };
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const backup = JSON.parse(content) as Partial<BackupData>;

          // Strict schema validation using InputValidator
          const val = InputValidator.validateBackupData(backup);
          if (!val.valid) {
            return resolve({ success: false, error: val.error || 'Invalid backup schema structure.' });
          }

          // Save validated data to local storage
          DbService.saveUser(backup.user!);
          DbService.saveItems(backup.items!);
          if (backup.quests && Array.isArray(backup.quests)) {
            DbService.saveQuests(backup.quests);
          }
          if (backup.settings) {
            DbService.saveSettings(backup.settings as UserSettings);
          }

          resolve({ success: true });
        } catch (error) {
          console.error('[BackupService] Failed to parse JSON backup file:', error);
          resolve({ success: false, error: 'Could not import file. Please select a valid SIMMERS backup JSON file.' });
        }
      };

      reader.onerror = (err) => {
        console.error('[BackupService] FileReader error:', err);
        resolve({ success: false, error: 'Could not read file. Please try again.' });
      };

      reader.readAsText(file);
    });
  }
}
