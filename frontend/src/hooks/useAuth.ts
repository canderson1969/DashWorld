/**
 * Authentication state management hook
 *
 * Manages user authentication state, login/logout, and localStorage persistence.
 *
 * @module useAuth
 */

import { useState } from 'react';
import type { User } from '../types';

interface UseAuthReturn {
  authToken: string | null;
  currentUser: User | null;
  handleAuthSuccess: (token: string, user: User) => void;
  handleLogout: () => void;
  updateUser: (user: User) => void;
}

/**
 * Hook for managing authentication state
 *
 * @returns {UseAuthReturn} Authentication state and handlers
 */
export function useAuth(): UseAuthReturn {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('dash_world_token');
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const userJson = localStorage.getItem('dash_world_user');
    return userJson ? JSON.parse(userJson) : null;
  });

  /**
   * Handle successful authentication
   *
   * @param {string} token - JWT authentication token
   * @param {User} user - User object containing id, username, email
   */
  const handleAuthSuccess = (token: string, user: User) => {
    setAuthToken(token);
    setCurrentUser(user);
    localStorage.setItem('dash_world_token', token);
    localStorage.setItem('dash_world_user', JSON.stringify(user));
  };

  /**
   * Handle user logout by clearing auth state and localStorage
   */
  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    localStorage.removeItem('dash_world_token');
    localStorage.removeItem('dash_world_user');
  };

  /**
   * Update current user data
   *
   * @param {User} user - Updated user object
   */
  const updateUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('dash_world_user', JSON.stringify(user));
  };

  return {
    authToken,
    currentUser,
    handleAuthSuccess,
    handleLogout,
    updateUser
  };
}
