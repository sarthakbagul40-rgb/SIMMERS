/**
 * Client-Side Rate Limiter & Request Throttler
 * Prevents API spamming, runaway loops, and accidental DDoS attacks on Firebase & Cloudflare endpoints.
 */

interface RateLimitConfig {
  maxRequests: number; // Maximum allowed requests in window
  windowMs: number;    // Time window in milliseconds
}

class RateLimiter {
  private requestLog: Map<string, number[]> = new Map();

  /**
   * Check if an action key is allowed or rate-limited.
   */
  isAllowed(actionKey: string, config: RateLimitConfig = { maxRequests: 10, windowMs: 10000 }): boolean {
    const now = Date.now();
    const timestamps = this.requestLog.get(actionKey) || [];

    // Filter out timestamps outside the time window
    const validTimestamps = timestamps.filter(ts => now - ts < config.windowMs);

    if (validTimestamps.length >= config.maxRequests) {
      return false; // Rate limit exceeded!
    }

    validTimestamps.push(now);
    this.requestLog.set(actionKey, validTimestamps);
    return true;
  }

  /**
   * Returns remaining seconds until rate limit resets for an action key.
   */
  getResetTimeSeconds(actionKey: string, windowMs: number = 10000): number {
    const now = Date.now();
    const timestamps = this.requestLog.get(actionKey) || [];
    if (timestamps.length === 0) return 0;

    const oldest = timestamps[0];
    const remainingMs = windowMs - (now - oldest);
    return Math.max(1, Math.ceil(remainingMs / 1000));
  }
}

export const ClientRateLimiter = new RateLimiter();
