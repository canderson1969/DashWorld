/**
 * User-related type definitions
 *
 * This module contains all types related to users and authentication.
 */

/**
 * User data structure
 */
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  created_at: string;
}

/**
 * Authentication response from API
 */
export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegistrationData {
  username: string;
  email: string;
  password: string;
}

/**
 * Password change request
 */
export interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
}
