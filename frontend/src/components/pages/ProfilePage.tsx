/**
 * Profile page component
 *
 * Displays and manages user profile with tabs for viewing info, editing profile,
 * changing password, and deleting account. Includes confirmation modal for account deletion.
 *
 * @module ProfilePage
 */

import { useState } from 'react';
import { ArrowLeft, User, AlertTriangle, Trash2 } from 'lucide-react';
import type { User as ApiUser } from '../../api';
import * as api from '../../api';

interface ProfilePageProps {
  user: ApiUser;
  authToken: string;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onBack: () => void;
  onLogout: () => void;
  onProfileUpdate: (user: ApiUser) => void;
}

/**
 * Format date for display
 *
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date (e.g., "January 15, 2025")
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Profile page component
 *
 * @param {ApiUser} user - Current user object
 * @param {string} authToken - JWT authentication token
 * @param {Function} showToast - Toast notification function
 * @param {() => void} onBack - Handler for back navigation
 * @param {() => void} onLogout - Handler for logout after account deletion
 * @param {(user: ApiUser) => void} onProfileUpdate - Handler for profile update
 * @returns {JSX.Element} Profile management page
 */
export function ProfilePage({ user, authToken, showToast, onBack, onLogout, onProfileUpdate }: ProfilePageProps) {
  const [activeSection, setActiveSection] = useState<'info' | 'edit' | 'password' | 'delete'>('info');

  // Edit profile state
  const [editFormData, setEditFormData] = useState({ username: user.username, email: user.email });
  const [isEditLoading, setIsEditLoading] = useState(false);

  // Change password state
  const [passwordFormData, setPasswordFormData] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Delete account state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  /**
   * Handle profile update submission
   *
   * @param {React.FormEvent} e - Form submit event
   */
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editFormData.username.trim() || !editFormData.email.trim()) {
      showToast('Username and email are required', 'error');
      return;
    }

    setIsEditLoading(true);
    try {
      const response = await api.updateUserProfile(
        {
          username: editFormData.username.trim(),
          email: editFormData.email.trim()
        },
        authToken
      );

      showToast(response.message, 'success');
      onProfileUpdate(response.user);
      setActiveSection('info');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      showToast(errorMessage, 'error');
    } finally {
      setIsEditLoading(false);
    }
  };

  /**
   * Handle password change submission
   *
   * @param {React.FormEvent} e - Form submit event
   */
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordFormData.currentPassword || !passwordFormData.newPassword || !passwordFormData.confirmNewPassword) {
      showToast('All password fields are required', 'error');
      return;
    }

    if (passwordFormData.newPassword !== passwordFormData.confirmNewPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    if (passwordFormData.newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }

    setIsPasswordLoading(true);
    try {
      const response = await api.changePassword(
        passwordFormData.currentPassword,
        passwordFormData.newPassword,
        authToken
      );

      showToast(response.message, 'success');
      setPasswordFormData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      setActiveSection('info');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
      showToast(errorMessage, 'error');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  /**
   * Handle account deletion submission
   */
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showToast('Password is required to delete account', 'error');
      return;
    }

    if (deleteConfirmation !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'error');
      return;
    }

    setIsDeleteLoading(true);
    try {
      const response = await api.deleteUserAccount(deletePassword, authToken);
      showToast(response.message, 'success');
      setShowDeleteModal(false);

      // Log out user after account deletion
      setTimeout(() => {
        onLogout();
      }, 1500);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete account';
      showToast(errorMessage, 'error');
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition mb-4"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <User size={28} />
          My Profile
        </h1>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        {/* Navigation Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4 p-2 flex gap-2">
          <button
            onClick={() => setActiveSection('info')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
              activeSection === 'info'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Profile Info
          </button>
          <button
            onClick={() => setActiveSection('edit')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
              activeSection === 'edit'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Edit Profile
          </button>
          <button
            onClick={() => setActiveSection('password')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
              activeSection === 'password'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Change Password
          </button>
          <button
            onClick={() => setActiveSection('delete')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition ${
              activeSection === 'delete'
                ? 'bg-red-600 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Delete Account
          </button>
        </div>

        {/* Profile Info Section */}
        {activeSection === 'info' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Profile Information</h2>

            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{user.username}</h3>
                  <p className="text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Email Address
                  </label>
                  <p className="text-gray-800 dark:text-gray-100">{user.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Account Created
                  </label>
                  <p className="text-gray-800 dark:text-gray-100">{formatDate(user.created_at)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    User ID
                  </label>
                  <p className="text-gray-800 dark:text-gray-100">#{user.id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Role
                  </label>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                    user.role === 'admin'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                      : user.role === 'moderator'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile Section */}
        {activeSection === 'edit' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Edit Profile</h2>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={editFormData.username}
                  onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditFormData({ username: user.username, email: user.email });
                    setActiveSection('info');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg transition font-semibold"
                >
                  {isEditLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Change Password Section */}
        {activeSection === 'password' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6">Change Password</h2>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordFormData.currentPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordFormData.newPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter new password (min 6 characters)"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordFormData.confirmNewPassword}
                  onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmNewPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordFormData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
                    setActiveSection('info');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPasswordLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg transition font-semibold"
                >
                  {isPasswordLoading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Delete Account Section */}
        {activeSection === 'delete' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Delete Account</h2>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle size={24} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                    Warning: This action is permanent and cannot be undone!
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-400 space-y-1 list-disc list-inside">
                    <li>All your uploaded footage will be deleted</li>
                    <li>All your messages and conversations will be deleted</li>
                    <li>Your username and email will become available for others to use</li>
                    <li>You will be immediately logged out</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-semibold flex items-center justify-center gap-2"
            >
              <Trash2 size={20} />
              Delete My Account
            </button>
          </div>
        )}
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-red-600 dark:bg-red-700 px-6 py-4 flex items-center gap-3">
              <AlertTriangle size={24} className="text-white" />
              <h2 className="text-xl font-bold text-white">Confirm Account Deletion</h2>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                This action cannot be undone. Please enter your password and type <strong>DELETE</strong> to confirm.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter your password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type DELETE to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Type DELETE"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteConfirmation('');
                }}
                disabled={isDeleteLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleteLoading || deleteConfirmation !== 'DELETE'}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg transition font-semibold"
              >
                {isDeleteLoading ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
