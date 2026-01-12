/**
 * Inbox page component
 *
 * Displays list of user's conversations with message counts and timestamps.
 * Shows empty state when no conversations exist.
 *
 * @module InboxPage
 */

import { Inbox, Mail, MessageSquare } from 'lucide-react';
import type { Conversation } from '../../api';

interface InboxPageProps {
  conversations: Conversation[];
  onSelectConversation: (id: number) => void;
}

/**
 * Format timestamp for conversation list display
 *
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted time string (e.g., "2 hours ago", "Mar 15")
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Inbox page component
 *
 * @param {Conversation[]} conversations - Array of conversations
 * @param {(id: number) => void} onSelectConversation - Handler for selecting a conversation
 * @returns {JSX.Element} Inbox page with conversation list
 */
export function InboxPage({ conversations, onSelectConversation }: InboxPageProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Inbox size={28} />
          Inbox
        </h1>
      </div>

      {/* Conversation List */}
      <div className="max-w-4xl mx-auto p-4">
        {conversations.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Mail size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No messages yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Your inbox is empty. When someone messages you about footage, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className="w-full bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition p-4 text-left border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {conversation.subject}
                      </h3>
                      {conversation.unread_count && conversation.unread_count > 0 && (
                        <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                    {conversation.last_message && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {conversation.last_message.message_body.substring(0, 100)}
                        {conversation.last_message.message_body.length > 100 ? '...' : ''}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <MessageSquare size={14} />
                      <span>{conversation.message_count || 0} messages</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTimestamp(conversation.last_message_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
