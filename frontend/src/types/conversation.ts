/**
 * Conversation and messaging type definitions
 *
 * This module contains all types related to conversations and messages.
 */

/**
 * Conversation between two users about a footage item
 */
export interface Conversation {
  id: number;
  footage_id: number;
  participant1_id: number;
  participant2_id: number;
  subject: string;
  created_at: string;
  updated_at: string;
  participant1_username?: string;
  participant2_username?: string;
  last_message?: string;
  unread_count?: number;
}

/**
 * Individual message in a conversation
 */
export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  message_body: string;
  created_at: string;
  is_read: boolean;
  sender_username?: string;
}

/**
 * Unread count response
 */
export interface UnreadCountResponse {
  unread_count: number;
}
