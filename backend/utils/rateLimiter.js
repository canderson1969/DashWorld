import rateLimit from 'express-rate-limit';
import { logger } from './logger.js';

/**
 * Create a rate limiter with logging
 *
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Max requests per window
 * @param {string} options.name - Name for logging purposes
 * @param {string} options.message - Error message to return
 * @returns {Function} Express rate limiter middleware
 */
function createLimiter({ windowMs, max, name, message }) {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded', {
        limiter: name,
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      res.status(options.statusCode).json(options.message);
    },
    skip: (req) => {
      // Skip rate limiting in test environment
      return process.env.NODE_ENV === 'test';
    }
  });
}

/**
 * Rate limiter for account registration
 * Limit: 5 accounts per IP per hour
 */
export const registrationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  name: 'registration',
  message: 'Too many accounts created from this IP. Please try again in an hour.'
});

/**
 * Rate limiter for login attempts
 * Limit: 10 attempts per IP per 15 minutes
 */
export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  name: 'login',
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

/**
 * Rate limiter for file uploads
 * Limit: 20 uploads per user per hour
 */
export const uploadLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  name: 'upload',
  message: 'Upload limit reached. Please try again in an hour.'
});

/**
 * Rate limiter for password reset/change
 * Limit: 5 attempts per IP per hour
 */
export const passwordLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  name: 'password',
  message: 'Too many password attempts. Please try again in an hour.'
});

/**
 * General API rate limiter
 * Limit: 300 requests per IP per minute
 * (Processing page polls 2x/second = 120/min, plus other API calls)
 */
export const apiLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  name: 'api',
  message: 'Too many requests. Please slow down.'
});

/**
 * Strict rate limiter for sensitive operations
 * Limit: 10 requests per IP per hour
 */
export const strictLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  name: 'strict',
  message: 'Rate limit exceeded for this operation. Please try again later.'
});
