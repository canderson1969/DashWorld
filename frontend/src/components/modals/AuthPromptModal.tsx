/**
 * Authentication prompt modal component
 *
 * Displays a modal prompting users to sign in or create an account
 * when attempting to access authentication-required features.
 *
 * @module AuthPromptModal
 */

import { LogIn, UserPlus, X } from 'lucide-react';

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onRegister: () => void;
}

/**
 * Authentication prompt modal component
 *
 * Displays a modal dialog prompting unauthenticated users to sign in or register
 * when they attempt to access features requiring authentication.
 *
 * @param {boolean} isOpen - Whether the modal is currently visible
 * @param {() => void} onClose - Callback function to close the modal
 * @param {() => void} onSignIn - Callback function to open sign in modal
 * @param {() => void} onRegister - Callback function to open registration modal
 * @returns {JSX.Element | null} Auth prompt modal or null if not open
 */
export function AuthPromptModal({ isOpen, onClose, onSignIn, onRegister }: AuthPromptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md relative transition-colors duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="text-blue-600 dark:text-blue-400" size={32} />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Sign In to Contact Uploader
          </h2>

          <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            To contact the uploader, you need an account. This helps prevent abuse and enables
            conversation tracking so you can receive responses.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => {
                onClose();
                onSignIn();
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2"
            >
              <LogIn size={18} />
              Sign In
            </button>

            <button
              onClick={() => {
                onClose();
                onRegister();
              }}
              className="w-full border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-500 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              Create Account
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
            Creating an account is free and takes less than a minute
          </p>
        </div>
      </div>
    </div>
  );
}
