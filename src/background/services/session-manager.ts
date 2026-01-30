/**
 * Session Manager - Handles automatic session timeout
 * Locks the extension after 30 minutes of inactivity
 */

import { globalCrypto } from '../global-crypto';
import { iconManager } from './icon-manager';
import { logger } from '../../utils/logger';

export class SessionManager {
  private static readonly TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  private static readonly STORAGE_KEY = 'lastActivityTime';
  private timeoutId: number | null = null;
  private activityCheckInterval: number | null = null;

  /**
   * Start session monitoring
   */
  async start() {
    // Check for existing session on startup
    await this.checkSessionValidity();

    // Set up activity checker (every minute)
    this.activityCheckInterval = setInterval(() => {
      this.checkSessionValidity();
    }, 60000);

    // Update activity on any chrome.runtime message
    chrome.runtime.onMessage.addListener(() => {
      this.updateActivity();
    });

    logger.log('[SessionManager] Started with 30-minute timeout');
  }

  /**
   * Stop session monitoring
   */
  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
    }

    logger.log('[SessionManager] Stopped');
  }

  /**
   * Update last activity time
   */
  async updateActivity() {
    const now = Date.now();
    await chrome.storage.local.set({ [SessionManager.STORAGE_KEY]: now });

    // Reset timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      this.lockSession();
    }, SessionManager.TIMEOUT_MS);
  }

  /**
   * Check if session is still valid
   */
  private async checkSessionValidity() {
    try {
      const result = await chrome.storage.local.get([SessionManager.STORAGE_KEY]);
      const lastActivity = result[SessionManager.STORAGE_KEY] as number | undefined;

      if (!lastActivity || typeof lastActivity !== 'number') {
        // No activity recorded, set current time
        await this.updateActivity();
        return;
      }

      const timeSinceActivity = Date.now() - lastActivity;

      if (timeSinceActivity > SessionManager.TIMEOUT_MS) {
        // Session expired
        logger.log('[SessionManager] Session expired, locking...');
        await this.lockSession();
      } else {
        // Session still valid, schedule timeout
        const remainingTime = SessionManager.TIMEOUT_MS - timeSinceActivity;

        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
        }

        this.timeoutId = setTimeout(() => {
          this.lockSession();
        }, remainingTime);

        logger.log(`[SessionManager] Session valid, will lock in ${Math.ceil(remainingTime / 60000)} minutes`);
      }
    } catch (error) {
      logger.error('[SessionManager] Error checking session validity:', error);
    }
  }

  /**
   * Lock the session (clear master password from memory)
   */
  private async lockSession() {
    try {
      logger.log('[SessionManager] Locking session due to inactivity');

      // Clear master password from session storage
      await chrome.storage.session.remove(['masterPassword']);

      // Clear from global crypto service
      globalCrypto.clearMasterPassword();

      // Update icon to locked state
      await iconManager.setIconState('locked');

      // Clear timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }

      logger.log('[SessionManager] Session locked successfully');
    } catch (error) {
      logger.error('[SessionManager] Error locking session:', error);
    }
  }

  /**
   * Manually lock the session
   */
  async lock() {
    await this.lockSession();
  }

  /**
   * Get remaining time until session timeout (in milliseconds)
   */
  async getRemainingTime(): Promise<number> {
    try {
      const result = await chrome.storage.local.get([SessionManager.STORAGE_KEY]);
      const lastActivity = result[SessionManager.STORAGE_KEY] as number | undefined;

      if (!lastActivity || typeof lastActivity !== 'number') {
        return SessionManager.TIMEOUT_MS;
      }

      const timeSinceActivity = Date.now() - lastActivity;
      return Math.max(0, SessionManager.TIMEOUT_MS - timeSinceActivity);
    } catch {
      return 0;
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
