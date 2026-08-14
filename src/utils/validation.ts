export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function sanitizeText(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export class InputValidator {
  static sanitizeText(input: string): string {
    return sanitizeText(input);
  }

  /**
   * Validate Food Item Name
   * Type: string
   * Length: 1 to 60 characters
   * Format: Non-empty, no control characters
   */
  static validateFoodName(name: any): ValidationResult {
    if (typeof name !== 'string') {
      return { valid: false, error: 'Item name must be text.' };
    }
    const clean = name.trim();
    if (clean.length < 1) {
      return { valid: false, error: 'Item name cannot be empty.' };
    }
    if (clean.length > 60) {
      return { valid: false, error: 'Item name cannot exceed 60 characters.' };
    }
    if (/[\u0000-\u001F\u007F-\u009F]/.test(clean)) {
      return { valid: false, error: 'Item name contains invalid control characters.' };
    }
    return { valid: true };
  }

  /**
   * Validate Shelf Life Days
   * Type: number (Integer)
   * Range: 1 to 365 days
   */
  static validateShelfLife(days: any): ValidationResult {
    const num = Number(days);
    if (typeof days === 'boolean' || typeof num !== 'number' || isNaN(num) || !Number.isFinite(num) || !Number.isInteger(num)) {
      return { valid: false, error: 'Shelf life must be a whole number.' };
    }
    if (num < 1 || num > 365) {
      return { valid: false, error: 'Shelf life must be between 1 and 365 days.' };
    }
    return { valid: true };
  }

  /**
   * Validate Household Code
   * Type: string
   * Length: 4 to 12 chars
   * Format: Alphanumeric and hyphens (e.g., SIM-8492)
   */
  static validateHouseholdCode(code: any): ValidationResult {
    if (typeof code !== 'string') {
      return { valid: false, error: 'Household code must be text.' };
    }
    const clean = code.trim().toUpperCase();
    if (clean.length < 4 || clean.length > 12) {
      return { valid: false, error: 'Household code must be between 4 and 12 characters.' };
    }
    if (!/^[A-Z0-9\-]{4,12}$/.test(clean)) {
      return { valid: false, error: 'Invalid Household Code format. Example: SIM-4829' };
    }
    return { valid: true };
  }

  /**
   * Validate Mascot Name
   * Type: string
   * Length: 1 to 30 chars
   */
  static validateMascotName(name: any): ValidationResult {
    if (typeof name !== 'string') {
      return { valid: false, error: 'Mascot name must be text.' };
    }
    const clean = name.trim();
    if (clean.length < 1) {
      return { valid: false, error: 'Mascot name cannot be empty.' };
    }
    if (clean.length > 30) {
      return { valid: false, error: 'Mascot name cannot exceed 30 characters.' };
    }
    if (/[\u0000-\u001F\u007F-\u009F]/.test(clean)) {
      return { valid: false, error: 'Mascot name contains invalid characters.' };
    }
    return { valid: true };
  }

  /**
   * Validate Notification Time
   * Type: string
   * Format: HH:MM (24-hour time e.g., 08:00 or 20:30)
   */
  static validateNotificationTime(time: any): ValidationResult {
    if (typeof time !== 'string') {
      return { valid: false, error: 'Notification time must be a string.' };
    }
    const clean = time.trim();
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(clean)) {
      return { valid: false, error: 'Invalid time format. Please use HH:MM format (e.g. 08:00 or 20:30).' };
    }
    return { valid: true };
  }

  /**
   * Validate Gemini API Key (Optional)
   * Type: string
   * Format: Alphanumeric & hyphens/underscores, max 128 chars
   */
  static validateApiKey(key: any): ValidationResult {
    if (typeof key !== 'string') {
      return { valid: false, error: 'API key must be text.' };
    }
    const clean = key.trim();
    if (clean.length === 0) return { valid: true };
    if (clean.length > 128) {
      return { valid: false, error: 'API key cannot exceed 128 characters.' };
    }
    if (!/^[A-Za-z0-9_\-]+$/.test(clean)) {
      return { valid: false, error: 'API key contains invalid characters.' };
    }
    return { valid: true };
  }

  /**
   * Validate Complete Backup Import File Schema
   * Strict type, structure & range checking
   */
  static validateBackupData(backup: any): ValidationResult {
    if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
      return { valid: false, error: 'Invalid backup format: root must be a JSON object.' };
    }

    // Validate User State
    if (!backup.user || typeof backup.user !== 'object') {
      return { valid: false, error: 'Backup schema error: missing "user" object.' };
    }
    const u = backup.user;
    if (typeof u.currentLevel !== 'number' || !Number.isInteger(u.currentLevel) || u.currentLevel < 1 || u.currentLevel > 100) {
      return { valid: false, error: 'Backup schema error: invalid user level.' };
    }
    if (typeof u.currentXp !== 'number' || u.currentXp < 0 || u.currentXp > 100) {
      return { valid: false, error: 'Backup schema error: invalid XP range.' };
    }
    if (typeof u.mascotHealth !== 'number' || u.mascotHealth < 0 || u.mascotHealth > 100) {
      return { valid: false, error: 'Backup schema error: invalid mascot health.' };
    }
    if (typeof u.streakDays !== 'number' || u.streakDays < 0) {
      return { valid: false, error: 'Backup schema error: invalid streak days.' };
    }

    // Validate Inventory Items
    if (!Array.isArray(backup.items)) {
      return { valid: false, error: 'Backup schema error: "items" must be an array.' };
    }
    for (let i = 0; i < backup.items.length; i++) {
      const item = backup.items[i];
      if (!item || typeof item !== 'object') {
        return { valid: false, error: `Backup schema error: item at index ${i + 1} is invalid.` };
      }
      const nameVal = this.validateFoodName(item.name);
      if (!nameVal.valid) {
        return { valid: false, error: `Backup schema error on item #${i + 1}: ${nameVal.error}` };
      }
      const lifeVal = this.validateShelfLife(item.shelfLifeDays);
      if (!lifeVal.valid) {
        return { valid: false, error: `Backup schema error on item #${i + 1} ("${item.name}"): ${lifeVal.error}` };
      }
      if (!['active', 'consumed', 'spoiled'].includes(item.status)) {
        return { valid: false, error: `Backup schema error on item #${i + 1} ("${item.name}"): invalid status.` };
      }
    }

    return { valid: true };
  }

  /**
   * Validates uploaded image file type (MIME + extension) & max file size (10 MB).
   */
  static validateUploadedImage(file: File): ValidationResult {
    if (!file) {
      return { valid: false, error: 'No file selected.' };
    }
    // Max size 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, error: 'Photo size cannot exceed 10 MB.' };
    }

    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic'];

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const isMimeValid = validMimeTypes.includes(file.type.toLowerCase());
    const isExtValid = validExtensions.includes(ext);

    if (!isMimeValid && !isExtValid) {
      return { valid: false, error: 'Invalid file type. Please select a valid image (JPEG, PNG, WebP).' };
    }

    return { valid: true };
  }

  /**
   * Validates JSON backup file size (max 5 MB) & extension.
   */
  static validateBackupFile(file: File): ValidationResult {
    if (!file) {
      return { valid: false, error: 'No file selected.' };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: 'Backup file size cannot exceed 5 MB.' };
    }
    if (!file.name.toLowerCase().endsWith('.json')) {
      return { valid: false, error: 'Invalid backup file format. Must be a .json file.' };
    }
    return { valid: true };
  }
}
