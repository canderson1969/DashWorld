import winston from 'winston';

/**
 * Winston logger instance with structured logging configuration
 *
 * Logs to console (simple format) and files (JSON format)
 * - error.log: ERROR level and above
 * - combined.log: All levels
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'dash-world-backend' },
  transports: [
    // Write all errors to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Log successful operation with context
 *
 * @param {string} message - Description of successful operation
 * @param {Object} meta - Additional context (entity IDs, relevant data)
 */
export function logSuccess(message, meta = {}) {
  logger.info(message, meta);
}

/**
 * Log error with full context before throwing
 *
 * @param {string} message - Description of what failed
 * @param {Error} error - The error object
 * @param {Object} meta - Additional context (entity IDs, operation details)
 */
export function logError(message, error, meta = {}) {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...meta
  });
}
