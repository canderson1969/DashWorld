import express from 'express';
import { hashPassword, comparePassword, generateToken, authenticateToken } from '../utils/auth.js';
import { logger, logSuccess, logError } from '../utils/logger.js';
import { registrationLimiter, loginLimiter, passwordLimiter } from '../utils/rateLimiter.js';
import {
  getAllUsers,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  createUser,
  updateUser
} from '../utils/database.js';

const router = express.Router();

/**
 * POST /api/auth/register - Register new user
 * Rate limited: 5 registrations per IP per hour
 */
router.post('/register', registrationLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingEmail = await getUserByEmail(email);
    const existingUsername = await getUserByUsername(username);

    if (existingEmail || existingUsername) {
      logger.warn('Registration failed - user already exists', {
        username,
        email,
        operation: 'register'
      });
      return res.status(409).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create new user
    const newUser = await createUser({
      username,
      email,
      password: passwordHash,
      role: 'user', // Default role: 'user', 'moderator', or 'admin'
      created_at: new Date().toISOString()
    });

    // Generate token
    const token = generateToken(newUser);

    logSuccess('User registered successfully', {
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
      operation: 'register'
    });

    // Return user data without password
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        created_at: newUser.created_at
      }
    });
  } catch (error) {
    logError('Registration failed', error, {
      operation: 'register'
    });
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login - Login user
 * Rate limited: 10 attempts per IP per 15 minutes
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    // Validate required fields
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    // Find user by email or username
    let user = await getUserByEmail(identifier);
    if (!user) {
      user = await getUserByUsername(identifier);
    }

    if (!user) {
      logger.warn('Login failed - user not found', {
        identifier,
        operation: 'login'
      });
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    // Verify password
    const passwordMatch = await comparePassword(password, user.password);

    if (!passwordMatch) {
      logger.warn('Login failed - incorrect password', {
        userId: user.id,
        identifier,
        operation: 'login'
      });
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    // Generate token
    const token = generateToken(user);

    logSuccess('User logged in successfully', {
      userId: user.id,
      username: user.username,
      email: user.email,
      operation: 'login'
    });

    // Return user data without password
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role || 'user', // Default to 'user' for existing users without role
        created_at: user.created_at
      }
    });
  } catch (error) {
    logError('Login failed', error, {
      operation: 'login'
    });
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me - Get current user info
 * Requires authentication
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);

    if (!user) {
      logger.warn('User not found for authenticated request', {
        userId: req.user.id,
        operation: 'get_profile'
      });
      return res.status(404).json({ error: 'User not found' });
    }

    logSuccess('User profile retrieved', {
      userId: user.id,
      username: user.username,
      operation: 'get_profile'
    });

    // Return user data without password
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    });
  } catch (error) {
    logError('Failed to fetch user profile', error, {
      userId: req.user?.id,
      operation: 'get_profile'
    });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PATCH /api/auth/me - Update current user profile
 * Requires authentication
 *
 * Request body:
 * - username: string (optional) - New username
 * - email: string (optional) - New email address
 */
router.patch('/me', authenticateToken, async (req, res) => {
  try {
    const { username, email } = req.body;
    const userId = req.user.id;

    // Validate at least one field is provided
    if (!username && !email) {
      return res.status(400).json({ error: 'At least one field (username or email) is required' });
    }

    const user = await getUserById(userId);

    if (!user) {
      logger.warn('User not found for profile update', {
        userId,
        operation: 'update_profile'
      });
      return res.status(404).json({ error: 'User not found' });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if email is already taken by another user
      const existingEmail = await getUserByEmail(email);
      if (existingEmail && existingEmail.id !== userId) {
        logger.warn('Email already in use', {
          userId,
          email,
          operation: 'update_profile'
        });
        return res.status(409).json({ error: 'Email already in use' });
      }
    }

    // Check if username is already taken by another user
    if (username) {
      const existingUsername = await getUserByUsername(username);
      if (existingUsername && existingUsername.id !== userId) {
        logger.warn('Username already in use', {
          userId,
          username,
          operation: 'update_profile'
        });
        return res.status(409).json({ error: 'Username already in use' });
      }
    }

    // Update user data
    const updates = {};
    if (username) updates.username = username;
    if (email) updates.email = email;

    await updateUser(userId, updates);

    const updatedUser = await getUserById(userId);

    logSuccess('User profile updated', {
      userId,
      updatedFields: { username: !!username, email: !!email },
      operation: 'update_profile'
    });

    // Return updated user data without password
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        created_at: updatedUser.created_at
      }
    });
  } catch (error) {
    logError('Failed to update profile', error, {
      userId: req.user?.id,
      operation: 'update_profile'
    });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * PATCH /api/auth/me/password - Change password
 * Requires authentication
 * Rate limited: 5 attempts per IP per hour
 *
 * Request body:
 * - current_password: string (required) - Current password for verification
 * - new_password: string (required) - New password (minimum 6 characters)
 */
router.patch('/me/password', passwordLimiter, authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Validate new password strength
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const user = await getUserById(userId);

    if (!user) {
      logger.warn('User not found for password change', {
        userId,
        operation: 'change_password'
      });
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await comparePassword(current_password, user.password);

    if (!passwordMatch) {
      logger.warn('Incorrect current password', {
        userId,
        operation: 'change_password'
      });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(new_password);

    // Update password
    await updateUser(userId, { password: newPasswordHash });

    logSuccess('Password changed successfully', {
      userId,
      operation: 'change_password'
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logError('Failed to change password', error, {
      userId: req.user?.id,
      operation: 'change_password'
    });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * DELETE /api/auth/me - Delete user account
 * Requires authentication
 *
 * Request body:
 * - password: string (required) - Password confirmation for account deletion
 */
router.delete('/me', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.id;

    // Validate password confirmation
    if (!password) {
      return res.status(400).json({ error: 'Password confirmation is required' });
    }

    const user = await getUserById(userId);

    if (!user) {
      logger.warn('User not found for account deletion', {
        userId,
        operation: 'delete_account'
      });
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const passwordMatch = await comparePassword(password, user.password);

    if (!passwordMatch) {
      logger.warn('Incorrect password for account deletion', {
        userId,
        operation: 'delete_account'
      });
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Note: We don't have a deleteUser function yet, but for now we'll just log it
    // In a real implementation, you'd want to handle cascading deletes of user's data
    logger.warn('Account deletion requested but not fully implemented', {
      userId: user.id,
      username: user.username,
      email: user.email,
      operation: 'delete_account'
    });

    // TODO: Implement user deletion when needed
    // For now, return success without actually deleting
    res.json({
      success: true,
      message: 'Account deletion is not yet implemented'
    });
  } catch (error) {
    logError('Failed to delete account', error, {
      userId: req.user?.id,
      operation: 'delete_account'
    });
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
