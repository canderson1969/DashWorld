import { AlertTriangle, MessageSquare, Trash2 } from 'lucide-react';
import type { FootageItem } from '../../types';
import type { Conversation } from '../../api';

interface ContentWarningModalProps {
  isOpen: boolean;
  footage: FootageItem | null;
  onClose: () => void;
  onConfirm: (footage: FootageItem) => void;
}

/**
 * Modal displaying content warning for graphic footage
 *
 * @param {ContentWarningModalProps} props - Component props
 * @returns {JSX.Element | null} The modal or null if not open
 */
export function ContentWarningModal({ isOpen, footage, onClose, onConfirm }: ContentWarningModalProps) {
  if (!isOpen || !footage) return null;

  const warningLabels: Record<string, string> = {
    'accident_injury': 'Accident/Injury Related Content',
    'violence': 'Violence or Altercation',
    'vulnerable': 'Vulnerable Individuals',
    'audio_visual': 'Distressing Audio/Visual Content',
    'other': 'Other Graphic Content'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-orange-500 dark:bg-orange-600 px-6 py-4 flex items-center gap-3">
          <AlertTriangle size={28} className="text-white" />
          <h2 className="text-xl font-bold text-white">Graphic Content Warning</h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            This footage has been marked as containing graphic content that may be disturbing to some viewers.
          </p>

          {/* Content Warnings List */}
          {footage.content_warnings && footage.content_warnings.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="font-semibold text-sm text-orange-900 dark:text-orange-200 mb-2">This footage may contain:</p>
              <ul className="space-y-1.5">
                {footage.content_warnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-300">
                    <span className="text-orange-500 mt-0.5">•</span>
                    <span>{warningLabels[warning] || warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400">
            By continuing, you acknowledge that you understand this footage may contain graphic content.
          </p>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium"
          >
            Go Back
          </button>
          <button
            onClick={() => onConfirm(footage)}
            className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition font-semibold"
          >
            I Understand, Continue
          </button>
        </div>
      </div>
    </div>
  );
}

interface ExistingConversationModalProps {
  isOpen: boolean;
  conversation: Conversation | null;
  onClose: () => void;
  onGoToThread: (conversation: Conversation) => void;
}

/**
 * Modal shown when user tries to contact uploader but conversation already exists
 *
 * @param {ExistingConversationModalProps} props - Component props
 * @returns {JSX.Element | null} The modal or null if not open
 */
export function ExistingConversationModal({ isOpen, conversation, onClose, onGoToThread }: ExistingConversationModalProps) {
  if (!isOpen || !conversation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-700 px-6 py-4 flex items-center gap-3">
          <MessageSquare size={24} className="text-white" />
          <h2 className="text-xl font-bold text-white">Conversation Exists</h2>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            You have already contacted the uploader about this footage. Would you like to go to the message thread?
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              {conversation.subject}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              {conversation.message_count || 0} message{conversation.message_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onGoToThread(conversation)}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold"
          >
            Go to Thread
          </button>
        </div>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Modal for confirming footage deletion
 *
 * @param {DeleteConfirmModalProps} props - Component props
 * @returns {JSX.Element | null} The modal or null if not open
 */
export function DeleteConfirmModal({ isOpen, onClose, onConfirm }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 dark:bg-red-700 px-6 py-4 flex items-center gap-3">
          <Trash2 size={24} className="text-white" />
          <h2 className="text-xl font-bold text-white">Delete Footage</h2>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Are you sure you want to delete this footage? This action cannot be undone.
          </p>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>This will permanently delete the video and all associated data.</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-semibold"
          >
            Delete Forever
          </button>
        </div>
      </div>
    </div>
  );
}
