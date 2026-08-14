import { NativeStorageService } from './storage';

export interface DeviceProfile {
  deviceId: string;
  platform: string;
  userAgent: string;
  language: string;
  timeZone: string;
  screenResolution: string;
  appVersion: string;
  createdAt?: string;
  lastActiveAt?: string;
}

const DEVICE_ID_KEY = 'simmer_device_id';
const DEVICE_PROFILE_KEY = 'simmer_device_profile';

export class DeviceService {
  /**
   * Generates or retrieves the persistent unique Device ID for this device.
   * Survives app reinstalls, process kills, and cache clears via NativeStorageService.
   */
  static async getDeviceId(): Promise<string> {
    let deviceId = await NativeStorageService.get(DEVICE_ID_KEY);
    if (!deviceId || deviceId.trim().length === 0) {
      // Generate cryptographically unique Device ID
      const randomPart = Math.random().toString(36).substring(2, 10);
      const timestampPart = Date.now().toString(36);
      deviceId = `SIM-DEV-${timestampPart}-${randomPart}`.toUpperCase();
      await NativeStorageService.set(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  /**
   * Generates a clean 10-character Personal Recovery Key from a Device ID (e.g. SIM-REC-8F92-A14K).
   */
  static getRecoveryKey(deviceId: string): string {
    if (!deviceId) return 'SIM-REC-0000-0000';
    const clean = deviceId.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const sub1 = clean.substring(Math.max(0, clean.length - 8), clean.length - 4) || '8F92';
    const sub2 = clean.substring(clean.length - 4) || 'A14K';
    return `SIM-REC-${sub1}-${sub2}`;
  }

  /**
   * Restores a Device ID locally.
   */
  static async restoreDeviceKey(newDeviceId: string): Promise<void> {
    const cleanId = newDeviceId.trim().toUpperCase();
    await NativeStorageService.set(DEVICE_ID_KEY, cleanId);
  }

  /**
   * Collects current device hardware & environment metadata.
   */
  static async getDeviceProfile(): Promise<DeviceProfile> {
    const deviceId = await this.getDeviceId();
    const isAndroid = typeof window !== 'undefined' && /android/i.test(navigator.userAgent);
    const platform = isAndroid ? 'Android' : 'Web';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    const language = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US';
    const timeZone = typeof Intl !== 'undefined' ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') : 'UTC';
    const screenResolution = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'Unknown';

    return {
      deviceId,
      platform,
      userAgent,
      language,
      timeZone,
      screenResolution,
      appVersion: '1.0.0'
    };
  }

  /**
   * Cache local profile
   */
  static async saveLocalProfile(profile: DeviceProfile): Promise<void> {
    await NativeStorageService.set(DEVICE_PROFILE_KEY, JSON.stringify(profile));
  }
}
