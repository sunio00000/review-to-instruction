/**
 * Rate Limiter - Prevents excessive API calls
 */

export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  /**
   * @param maxRequests - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   */
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed
   * @returns true if allowed, false if rate limit exceeded
   */
  tryRequest(): boolean {
    const now = Date.now();

    // Remove old requests outside the time window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    // Check if limit exceeded
    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    // Add new request
    this.requests.push(now);
    return true;
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  /**
   * Get time until next available request (in ms)
   */
  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0;

    const now = Date.now();
    const oldestRequest = Math.min(...this.requests);
    const resetTime = oldestRequest + this.windowMs;

    return Math.max(0, resetTime - now);
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }
}

/**
 * Debouncer - Prevents rapid successive calls
 */
export class Debouncer {
  private timeoutId: number | null = null;
  private lastCallTime: number = 0;
  private readonly delayMs: number;

  constructor(delayMs: number) {
    this.delayMs = delayMs;
  }

  /**
   * Debounce a function call
   * @param fn - Function to debounce
   */
  debounce<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      this.timeoutId = setTimeout(() => {
        fn(...args);
        this.timeoutId = null;
      }, this.delayMs);
    };
  }

  /**
   * Check if enough time has passed since last call
   */
  canCall(): boolean {
    const now = Date.now();
    if (now - this.lastCallTime < this.delayMs) {
      return false;
    }
    this.lastCallTime = now;
    return true;
  }

  /**
   * Get time remaining until next call allowed (in ms)
   */
  getTimeRemaining(): number {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    return Math.max(0, this.delayMs - elapsed);
  }
}
