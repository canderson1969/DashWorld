/**
 * Request form page for contacting footage uploaders
 *
 * Allows users to send messages to footage uploaders with their name,
 * reason for request, and optional message.
 *
 * @module RequestFormPage
 */

import { ArrowLeft, User, AlertCircle, MessageSquare, Send } from 'lucide-react';
import type { FootageItem } from '../../types';
import { formatIncidentType, formatTimeTo12Hour } from '../../utils/timeFormat';

export interface RequestFormData {
  name: string;
  reason: string;
  message: string;
}

interface RequestFormPageProps {
  footage: FootageItem | null;
  formData: RequestFormData;
  setFormData: (data: RequestFormData | ((prev: RequestFormData) => RequestFormData)) => void;
  onBack: () => void;
  onSubmit: () => void;
}

/**
 * Request form page component
 *
 * @param {FootageItem | null} footage - The footage being requested
 * @param {RequestFormData} formData - Form data state
 * @param {Function} setFormData - Form data setter
 * @param {() => void} onBack - Handler to navigate back
 * @param {() => void} onSubmit - Handler to submit form
 * @returns {JSX.Element | null} Request form page or null if no footage
 */
export function RequestFormPage({ footage, formData, setFormData, onBack, onSubmit }: RequestFormPageProps) {
  if (!footage) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition"
        >
          <ArrowLeft size={20} />
          Back to Video
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Contact Footage Uploader</h2>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>Requesting for:</strong> {formatIncidentType(footage.type)} at {footage.location} on {footage.date} at {formatTimeTo12Hour(footage.time)}
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <User size={16} />
                Your Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Smith"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <AlertCircle size={16} />
                Reason for Request *
              </label>
              <select
                value={formData.reason}
                onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a reason...</option>
                <option value="involved">I was involved in this accident</option>
                <option value="witness">I witnessed this accident</option>
                <option value="representative">I represent someone involved (legal/insurance)</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <MessageSquare size={16} />
                Message to Uploader (Optional)
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Provide any additional context, such as your vehicle description..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Adding details like your vehicle description can help the uploader verify your request
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onBack}
                className="flex-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={!formData.name || !formData.reason}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2"
              >
                <Send size={18} />
                Send Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
