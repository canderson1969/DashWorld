/**
 * Conversation thread page component
 *
 * Displays messages in a conversation thread with message history and reply input.
 * Auto-scrolls to latest message and supports Enter to send, Shift+Enter for new line.
 *
 * @module ConversationPage
 */

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Reply } from 'lucide-react';
import type { Conversation, Message, User } from '../../api';

interface ConversationPageProps {
  conversation: Conversation;
  messages: Message[];
  currentUser: User | null;
  onSendMessage: (message: string) => void;
  onBack: () => void;
}

/**
 * Format message timestamp for display
 *
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted time string (e.g., "Mar 15, 2:30 PM")
 */
function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Conversation page component
 *
 * @param {Conversation} conversation - The conversation object
 * @param {Message[]} messages - Array of messages in the conversation
 * @param {User | null} currentUser - Currently logged in user
 * @param {(message: string) => void} onSendMessage - Handler for sending a message
 * @param {() => void} onBack - Handler for back navigation
 * @returns {JSX.Element} Conversation thread page
 */
export function ConversationPage({ conversation, messages, currentUser, onSendMessage, onBack }: ConversationPageProps) {
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * Scroll to bottom of message list when new messages arrive
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Handle message submission
   *
   * @param {React.FormEvent} e - Form submit event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(messageInput.trim());
      setMessageInput('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition mb-2"
        >
          <ArrowLeft size={20} />
          Back to Inbox
        </button>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{conversation.subject}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Footage #{conversation.footage_id}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => {
            const isCurrentUser = currentUser && message.sender_id === currentUser.id;

            return (
              <div
                key={message.id}
                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    isCurrentUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.message_body}</p>
                  <p
                    className={`text-xs mt-2 ${
                      isCurrentUser ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {formatMessageTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
          <textarea
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Type your message... (Shift+Enter for new line)"
            rows={3}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={!messageInput.trim() || isSending}
            className="px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg transition font-semibold flex items-center gap-2 self-end"
          >
            <Reply size={18} />
            {isSending ? 'Sending...' : 'Reply'}
          </button>
        </form>
      </div>
    </div>
  );
}
