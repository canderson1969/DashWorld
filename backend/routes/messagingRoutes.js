import express from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../utils/auth.js';
import { VALIDATION_RULES } from '../config/server.config.js';
import {
  getConversationsByUserId,
  getConversationById,
  getConversationByParticipants,
  createConversation,
  updateConversationLastMessage,
  getMessagesByConversationId,
  getMessageById,
  getLastMessage,
  getMessageCount,
  createMessage,
  markMessagesAsRead,
  markMessageAsRead,
  getUnreadCountForUser
} from '../utils/database.js';

const router = express.Router();

/**
 * POST /api/conversations
 * Create a new conversation or get existing one
 *
 * Request body:
 * - footage_id: number (required) - ID of the footage
 * - recipient_id: number (required) - ID of the recipient user
 * - subject: string (optional) - Subject line
 * - initial_message: string (required) - First message body
 */
router.post('/conversations', authenticateToken, async (req, res) => {
  const { footage_id, recipient_id, subject, initial_message } = req.body;
  const sender_id = req.user.id;

  logger.info('Creating conversation', {
    sender_id,
    recipient_id,
    footage_id,
    operation: 'create_conversation'
  });

  // Validation
  if (!recipient_id || !initial_message) {
    logger.warn('Missing required fields for conversation creation', {
      sender_id,
      recipient_id,
      has_message: !!initial_message
    });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (initial_message.length > VALIDATION_RULES.MESSAGE_BODY_MAX_LENGTH) {
    return res.status(400).json({ error: 'Message body exceeds maximum length' });
  }

  if (subject && subject.length > VALIDATION_RULES.MESSAGE_SUBJECT_MAX_LENGTH) {
    return res.status(400).json({ error: 'Subject exceeds maximum length' });
  }

  try {
    // Check if conversation already exists between these users for this footage
    let conversation = await getConversationByParticipants(footage_id, sender_id, recipient_id);

    if (!conversation) {
      // Create new conversation
      conversation = await createConversation({
        footage_id: footage_id || null,
        participant1_id: sender_id,
        participant2_id: recipient_id,
        subject: subject || `Request for Footage #${footage_id}`,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      logger.info('Conversation created', {
        conversation_id: conversation.id,
        sender_id,
        recipient_id
      });
    }

    // Create the initial message
    const message = await createMessage({
      conversation_id: conversation.id,
      sender_id,
      message_body: initial_message,
      is_read: false,
      created_at: new Date().toISOString()
    });

    logger.info('Message sent', {
      message_id: message.id,
      conversation_id: conversation.id,
      sender_id
    });

    res.json({
      conversation,
      message
    });
  } catch (error) {
    logger.error('Failed to create conversation', {
      error: error.message,
      stack: error.stack,
      sender_id,
      recipient_id
    });
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/conversations
 * Get all conversations for the current user
 */
router.get('/conversations', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  logger.info('Fetching conversations', {
    user_id: userId,
    operation: 'get_conversations'
  });

  try {
    const conversations = await getConversationsByUserId(userId);

    // Sort by most recent message
    conversations.sort((a, b) =>
      new Date(b.last_message_at) - new Date(a.last_message_at)
    );

    // Get last message and message count for each conversation
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await getLastMessage(conv.id);
        const messageCount = await getMessageCount(conv.id);

        return {
          ...conv,
          last_message: lastMessage || null,
          message_count: messageCount
        };
      })
    );

    logger.info('Conversations fetched', {
      user_id: userId,
      count: enrichedConversations.length
    });

    res.json(enrichedConversations);
  } catch (error) {
    logger.error('Failed to fetch conversations', {
      error: error.message,
      stack: error.stack,
      user_id: userId
    });
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Get all messages in a conversation
 */
router.get('/conversations/:id/messages', authenticateToken, async (req, res) => {
  const conversationId = parseInt(req.params.id);
  const userId = req.user.id;

  logger.info('Fetching conversation messages', {
    conversation_id: conversationId,
    user_id: userId,
    operation: 'get_messages'
  });

  try {
    // Find conversation
    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      logger.warn('Conversation not found', {
        conversation_id: conversationId,
        user_id: userId
      });
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Verify user is a participant
    if (conversation.participant1_id !== userId && conversation.participant2_id !== userId) {
      logger.warn('Unauthorized conversation access', {
        conversation_id: conversationId,
        user_id: userId
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get messages for this conversation
    const conversationMessages = await getMessagesByConversationId(conversationId);

    logger.info('Messages fetched', {
      conversation_id: conversationId,
      user_id: userId,
      count: conversationMessages.length
    });

    res.json(conversationMessages);
  } catch (error) {
    logger.error('Failed to fetch messages', {
      error: error.message,
      stack: error.stack,
      conversation_id: conversationId,
      user_id: userId
    });
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/messages
 * Send a new message in an existing conversation
 *
 * Request body:
 * - conversation_id: number (required)
 * - message_body: string (required)
 */
router.post('/messages', authenticateToken, async (req, res) => {
  const { conversation_id, message_body } = req.body;
  const sender_id = req.user.id;

  logger.info('Sending message', {
    conversation_id,
    sender_id,
    operation: 'send_message'
  });

  // Validation
  if (!conversation_id || !message_body) {
    logger.warn('Missing required fields for message', {
      sender_id,
      has_conversation_id: !!conversation_id,
      has_message_body: !!message_body
    });
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (message_body.length > VALIDATION_RULES.MESSAGE_BODY_MAX_LENGTH) {
    return res.status(400).json({ error: 'Message body exceeds maximum length' });
  }

  try {
    // Find conversation
    const conversation = await getConversationById(conversation_id);

    if (!conversation) {
      logger.warn('Conversation not found', {
        conversation_id,
        sender_id
      });
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Verify user is a participant
    if (conversation.participant1_id !== sender_id && conversation.participant2_id !== sender_id) {
      logger.warn('Unauthorized message send attempt', {
        conversation_id,
        sender_id
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create message
    const message = await createMessage({
      conversation_id,
      sender_id,
      message_body,
      is_read: false,
      created_at: new Date().toISOString()
    });

    logger.info('Message sent', {
      message_id: message.id,
      conversation_id,
      sender_id
    });

    res.json(message);
  } catch (error) {
    logger.error('Failed to send message', {
      error: error.message,
      stack: error.stack,
      conversation_id,
      sender_id
    });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * PATCH /api/messages/:id/read
 * Mark a message as read
 */
router.patch('/messages/:id/read', authenticateToken, async (req, res) => {
  const messageId = parseInt(req.params.id);
  const userId = req.user.id;

  logger.info('Marking message as read', {
    message_id: messageId,
    user_id: userId,
    operation: 'mark_read'
  });

  try {
    // Find message
    const message = await getMessageById(messageId);

    if (!message) {
      logger.warn('Message not found', {
        message_id: messageId,
        user_id: userId
      });
      return res.status(404).json({ error: 'Message not found' });
    }

    // Find conversation to verify user is recipient
    const conversation = await getConversationById(message.conversation_id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Only the recipient can mark as read
    if (message.sender_id === userId) {
      logger.warn('Sender cannot mark own message as read', {
        message_id: messageId,
        user_id: userId
      });
      return res.status(400).json({ error: 'Cannot mark own message as read' });
    }

    // Verify user is a participant
    if (conversation.participant1_id !== userId && conversation.participant2_id !== userId) {
      logger.warn('Unauthorized mark read attempt', {
        message_id: messageId,
        user_id: userId
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Mark as read
    await markMessageAsRead(messageId);

    logger.info('Message marked as read', {
      message_id: messageId,
      user_id: userId
    });

    res.json({ success: true, message: { ...message, is_read: true } });
  } catch (error) {
    logger.error('Failed to mark message as read', {
      error: error.message,
      stack: error.stack,
      message_id: messageId,
      user_id: userId
    });
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

/**
 * PATCH /api/conversations/:id/read-all
 * Mark all messages in a conversation as read
 */
router.patch('/conversations/:id/read-all', authenticateToken, async (req, res) => {
  const conversationId = parseInt(req.params.id);
  const userId = req.user.id;

  logger.info('Marking all conversation messages as read', {
    conversation_id: conversationId,
    user_id: userId,
    operation: 'mark_all_read'
  });

  try {
    // Find conversation
    const conversation = await getConversationById(conversationId);

    if (!conversation) {
      logger.warn('Conversation not found', {
        conversation_id: conversationId,
        user_id: userId
      });
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Verify user is a participant
    if (conversation.participant1_id !== userId && conversation.participant2_id !== userId) {
      logger.warn('Unauthorized mark all read attempt', {
        conversation_id: conversationId,
        user_id: userId
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Mark all messages from other user as read
    const markedCount = await markMessagesAsRead(conversationId, userId);

    logger.info('All conversation messages marked as read', {
      conversation_id: conversationId,
      user_id: userId,
      marked_count: markedCount
    });

    res.json({ success: true, marked_count: markedCount });
  } catch (error) {
    logger.error('Failed to mark all messages as read', {
      error: error.message,
      stack: error.stack,
      conversation_id: conversationId,
      user_id: userId
    });
    res.status(500).json({ error: 'Failed to mark all messages as read' });
  }
});

/**
 * GET /api/messages/unread-count
 * Get total unread message count for current user
 */
router.get('/messages/unread-count', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const unreadCount = await getUnreadCountForUser(userId);
    res.json({ unread_count: unreadCount });
  } catch (error) {
    logger.error('Failed to get unread count', {
      error: error.message,
      stack: error.stack,
      user_id: userId
    });
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

export default router;
