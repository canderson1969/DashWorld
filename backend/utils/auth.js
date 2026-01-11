import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logger } from './logger.js';

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'dash-world-secret-change-in-production';
const SALT_ROUNDS = 10;

/**
 * Hash password using bcrypt
 *
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 * @throws {Error} If hashing fails
 */
export async function hashPassword(password) {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    logger.error('Password hashing failed', error, {
      operation: 'hash_password'
    });
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare password with hash
 *
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 * @throws {Error} If comparison fails
 */
export async function comparePassword(password, hash) {
  try {
    const match = await bcrypt.compare(password, hash);
    return match;
  } catch (error) {
    logger.error('Password comparison failed', error, {
      operation: 'compare_password'
    });
    throw new Error('Failed to compare password');
  }
}

/**
 * Generate JWT token for user
 *
 * @param {Object} user - User object containing id, email, username, role
 * @returns {string} JWT token
 */
export function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role || 'user'
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d' // Token expires in 7 days
  });

  logger.info('JWT token generated', {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresIn: '7d'
  });

  return token;
}

/**
 * Verify JWT token
 *
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    logger.warn('Invalid JWT token', {
      error: error.message,
      operation: 'verify_token'
    });
    return null;
  }
}

/**
 * Express middleware to authenticate requests
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('Authentication failed - no token provided', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = verifyToken(token);

  if (!user) {
    logger.warn('Authentication failed - invalid token', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  // Attach user to request object
  req.user = user;

  logger.debug('User authenticated successfully', {
    userId: user.id,
    username: user.username,
    path: req.path,
    method: req.method
  });

  next();
}

/**
 * Express middleware to check if user is moderator or admin
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function requireModerator(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const role = req.user.role || 'user';

  if (role !== 'moderator' && role !== 'admin') {
    logger.warn('Authorization failed - insufficient permissions', {
      userId: req.user.id,
      username: req.user.username,
      role: role,
      requiredRole: 'moderator',
      path: req.path,
      method: req.method
    });
    return res.status(403).json({ error: 'Moderator or admin privileges required' });
  }

  next();
}

/**
 * Express middleware to check if user is admin
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const role = req.user.role || 'user';

  if (role !== 'admin') {
    logger.warn('Authorization failed - admin required', {
      userId: req.user.id,
      username: req.user.username,
      role: role,
      requiredRole: 'admin',
      path: req.path,
      method: req.method
    });
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  next();
}
