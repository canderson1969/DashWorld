/**
 * Toast notification component
 *
 * Displays temporary notification messages in the bottom-right corner.
 *
 * @module Toast
 */

import { Check, AlertCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
}

/**
 * Toast notification component
 *
 * @param {string} message - The message to display
 * @param {'success' | 'error' | 'info'} type - The type of toast notification
 * @returns {JSX.Element} Toast notification
 */
export function Toast({ message, type }: ToastProps) {
  return (
    <div
      className={`fixed bottom-6 right-6 max-w-md px-6 py-4 rounded-lg shadow-2xl text-white font-semibold z-50 animate-slide-in ${
        type === 'success'
          ? 'bg-green-600 shadow-green-200'
          : type === 'error'
          ? 'bg-red-600 shadow-red-200'
          : 'bg-blue-600 shadow-blue-200'
      }`}
    >
      <div className="flex items-center gap-3">
        {type === 'success' && (
          <div className="bg-white rounded-full p-1">
            <Check size={24} className="text-green-600" />
          </div>
        )}
        {type === 'error' && <AlertCircle size={24} />}
        {type === 'info' && <Info size={24} />}
        <span className="text-base">{message}</span>
      </div>
    </div>
  );
}
