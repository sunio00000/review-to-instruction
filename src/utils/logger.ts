/**
 * Logger - Conditional logging based on environment
 * In production, only errors are logged
 */

// Check if running in development mode
const isDevelopment = () => {
  // For Chrome Extension, check if we're in development
  try {
    // In development, chrome.runtime.getManifest() returns version with -dev suffix
    // or you can check the installation mode
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      // Check if it's an unpacked extension (development)
      return !('update_url' in chrome.runtime.getManifest());
    }
  } catch {
    // Fallback to false (production mode)
  }
  return false;
};

const DEBUG = isDevelopment();

export const logger = {
  /**
   * Debug log - only in development
   */
  log(...args: any[]) {
    if (DEBUG) {
      console.log('[RTI]', ...args);
    }
  },

  /**
   * Info log - only in development
   */
  info(...args: any[]) {
    if (DEBUG) {
      console.info('[RTI]', ...args);
    }
  },

  /**
   * Warning log - only in development
   */
  warn(...args: any[]) {
    if (DEBUG) {
      console.warn('[RTI]', ...args);
    }
  },

  /**
   * Error log - always logged (even in production)
   */
  error(...args: any[]) {
    console.error('[RTI Error]', ...args);
  },

  /**
   * Group start - only in development
   */
  group(label: string) {
    if (DEBUG) {
      console.group(`[RTI] ${label}`);
    }
  },

  /**
   * Group end - only in development
   */
  groupEnd() {
    if (DEBUG) {
      console.groupEnd();
    }
  },

  /**
   * Table log - only in development
   */
  table(data: any) {
    if (DEBUG) {
      console.table(data);
    }
  }
};

// Export convenient aliases
export const log = logger.log;
export const info = logger.info;
export const warn = logger.warn;
export const error = logger.error;
