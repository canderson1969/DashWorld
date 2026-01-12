/**
 * Conversations state management hook
 *
 * Handles messaging state including conversations, messages, and unread counts.
 *
 * @module useConversations
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';

interface UseConversationsReturn {
  conversations: api.Conversation[];
  selectedConversation: api.Conversation | null;
  conversationMessages: api.Message[];
  unreadCount: number;
  loadConversations: () => Promise<void>;
  loadConversationMessages: (conversationId: number) => Promise<void>;
  loadUnreadCount: () => Promise<void>;
  sendMessage: (conversationId: number, messageBody: string) => Promise<void>;
  setSelectedConversation: (conversation: api.Conversation | null) => void;
  findExistingConversation: (footageId: number, currentUserId: number, uploaderId: number) => api.Conversation | undefined;
}

/**
 * Hook for managing conversation and messaging state
 *
 * @param {string | null} authToken - JWT authentication token
 * @param {(message: string, type?: 'success' | 'error' | 'info') => void} showToast - Toast notification function
 * @returns {UseConversationsReturn} Conversation state and handlers
 */
export function useConversations(
  authToken: string | null,
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
): UseConversationsReturn {
  const [conversations, setConversations] = useState<api.Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<api.Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<api.Message[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * Load user's conversations from API
   */
  const loadConversations = useCallback(async () => {
    if (!authToken) return;

    try {
      const convos = await api.getConversations(authToken);
      setConversations(convos);
    } catch (error) {
      showToast('Failed to load inbox. Please try again.', 'error');
    }
  }, [authToken, showToast]);

  /**
   * Load messages for a specific conversation
   *
   * @param {number} conversationId - ID of conversation to load
   */
  const loadConversationMessages = useCallback(async (conversationId: number) => {
    if (!authToken) return;

    try {
      const msgs = await api.getConversationMessages(conversationId, authToken);
      setConversationMessages(msgs);

      // Mark conversation as read
      await api.markConversationAsRead(conversationId, authToken);

      // Reload conversations to update unread counts
      await loadConversations();
    } catch (error) {
      showToast('Failed to load messages. Please try again.', 'error');
    }
  }, [authToken, loadConversations, showToast]);

  /**
   * Load unread message count for badge
   */
  const loadUnreadCount = useCallback(async () => {
    if (!authToken) {
      setUnreadCount(0);
      return;
    }

    try {
      const result = await api.getUnreadCount(authToken);
      setUnreadCount(result.unread_count);
    } catch (error) {
      // Silently fail - unread count is not critical
      setUnreadCount(0);
    }
  }, [authToken]);

  /**
   * Send a message in a conversation
   *
   * @param {number} conversationId - ID of conversation
   * @param {string} messageBody - Message text
   */
  const sendMessage = useCallback(async (conversationId: number, messageBody: string) => {
    if (!authToken) return;

    try {
      await api.sendMessage(conversationId, messageBody, authToken);
      await loadConversationMessages(conversationId);
      showToast('Message sent', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast('Failed to send message: ' + errorMessage, 'error');
      throw error;
    }
  }, [authToken, loadConversationMessages, showToast]);

  /**
   * Find existing conversation for a footage between two users
   *
   * @param {number} footageId - Footage ID
   * @param {number} currentUserId - Current user's ID
   * @param {number} uploaderId - Uploader's user ID
   * @returns {api.Conversation | undefined} Existing conversation or undefined
   */
  const findExistingConversation = useCallback((
    footageId: number,
    currentUserId: number,
    uploaderId: number
  ): api.Conversation | undefined => {
    return conversations.find(c =>
      c.footage_id === footageId &&
      ((c.participant1_id === currentUserId && c.participant2_id === uploaderId) ||
       (c.participant2_id === currentUserId && c.participant1_id === uploaderId))
    );
  }, [conversations]);

  // Load unread count on mount and poll every 30 seconds
  useEffect(() => {
    if (authToken) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [authToken, loadUnreadCount]);

  return {
    conversations,
    selectedConversation,
    conversationMessages,
    unreadCount,
    loadConversations,
    loadConversationMessages,
    loadUnreadCount,
    sendMessage,
    setSelectedConversation,
    findExistingConversation
  };
}
