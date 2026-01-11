/**
 * Request Sent confirmation page
 *
 * Displays confirmation after user sends a message to footage uploader.
 * Shows next steps and provides navigation back to browse page.
 *
 * @module RequestSentPage
 */

import { Check } from 'lucide-react';

interface RequestSentPageProps {
  onBack: () => void;
}

/**
 * Request sent confirmation page component
 *
 * @param {() => void} onBack - Handler to navigate back to browse page
 * @returns {JSX.Element} Request sent confirmation page
 */
export function RequestSentPage({ onBack }: RequestSentPageProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-6 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600 dark:text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Message Sent!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your message has been sent to the uploader. They can respond to you directly through the inbox system.
          </p>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-left mb-6">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">What happens next?</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">1.</span>
                <span>The uploader will receive your message in their inbox</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">2.</span>
                <span>They can respond to you through the messaging system</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">3.</span>
                <span>Check your inbox regularly for replies and updates</span>
              </li>
            </ul>
          </div>
          <button
            onClick={onBack}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition font-semibold"
          >
            Back to Browse
          </button>
        </div>
      </div>
    </div>
  );
}
