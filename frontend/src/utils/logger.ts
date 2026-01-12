/**
 * Structured logger for client-side logging
 * Provides console logging with context and proper formatting
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private serviceName: string;
  private minLevel: LogLevel;

  constructor(serviceName: string = 'dash-world-frontend') {
    this.serviceName = serviceName;
    this.minLevel = import.meta.env.DEV ? 'debug' : 'info';
  }

  /**
   * Log debug information (development only)
   *
   * @param {string} message - Log message
   * @param {LogContext} context - Additional context data
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log informational message
   *
   * @param {string} message - Log message
   * @param {LogContext} context - Additional context data
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning message
   *
   * @param {string} message - Log message
   * @param {LogContext} context - Additional context data
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error message
   *
   * @param {string} message - Log message
   * @param {LogContext} context - Additional context data
   * @param {Error} error - Error object
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error);
  }

  /**
   * Internal logging method
   *
   * @param {LogLevel} level - Log level
   * @param {string} message - Log message
   * @param {LogContext} context - Additional context data
   * @param {Error} error - Error object
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: {
        service: this.serviceName,
        ...context,
      },
    };

    if (error) {
      logEntry.error = error;
      logEntry.context = {
        ...logEntry.context,
        errorMessage: error.message,
        errorStack: error.stack,
      };
    }

    this.outputLog(logEntry);
  }

  /**
   * Check if log level should be output
   *
   * @param {LogLevel} level - Log level to check
   * @returns {boolean} Whether to output this log level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  /**
   * Output log entry to console
   *
   * @param {LogEntry} entry - Log entry to output
   */
  private outputLog(entry: LogEntry): void {
    const { level, message, timestamp, context, error } = entry;

    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const formattedMessage = `${prefix} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, context);
        break;
      case 'info':
        console.info(formattedMessage, context);
        break;
      case 'warn':
        console.warn(formattedMessage, context);
        break;
      case 'error':
        console.error(formattedMessage, context, error);
        break;
    }

    // Store errors for display in UI
    if (level === 'error') {
      this.storeErrorForDisplay(entry);
    }
  }

  /**
   * Store error in session storage for UI display
   *
   * @param {LogEntry} entry - Error log entry
   */
  private storeErrorForDisplay(entry: LogEntry): void {
    try {
      const errors = this.getStoredErrors();
      errors.push(entry);

      // Keep only last 10 errors
      const recentErrors = errors.slice(-10);

      sessionStorage.setItem('dash-world-errors', JSON.stringify(recentErrors));

      // Dispatch custom event for UI to listen to
      window.dispatchEvent(new CustomEvent('dash-world-error', { detail: entry }));
    } catch (e) {
      // If storage fails, just log to console
      console.error('Failed to store error for display:', e);
    }
  }

  /**
   * Get stored errors from session storage
   *
   * @returns {LogEntry[]} Array of stored error entries
   */
  getStoredErrors(): LogEntry[] {
    try {
      const stored = sessionStorage.getItem('dash-world-errors');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear stored errors
   */
  clearStoredErrors(): void {
    try {
      sessionStorage.removeItem('dash-world-errors');
    } catch (e) {
      console.error('Failed to clear stored errors:', e);
    }
  }
}

// Export singleton instance
export const logger = new Logger('dash-world-frontend');
