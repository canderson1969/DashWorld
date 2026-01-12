/**
 * PostgreSQL Database Module
 *
 * Provides database initialization and CRUD operations for all entities.
 * Uses pg for async PostgreSQL operations.
 *
 * @module database
 */

import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

let pool = null;

/**
 * Initialize the PostgreSQL database connection and schema
 *
 * @param {Object} config - Database configuration
 * @param {string} config.connectionString - PostgreSQL connection URL
 * @returns {Promise<Pool>} The database pool instance
 */
export async function initializeDatabase(config = {}) {
  const connectionString = config.connectionString || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    logger.info('Database connection established');
  } finally {
    client.release();
  }

  // Create tables
  await pool.query(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Footage table
    CREATE TABLE IF NOT EXISTS footage (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      filename TEXT NOT NULL,
      filename_compressed TEXT,
      filename_240p TEXT,
      filename_360p TEXT,
      filename_480p TEXT,
      filename_720p TEXT,
      filename_1080p TEXT,
      thumbnail TEXT,
      thumbnail_small TEXT,
      thumbnail_medium TEXT,
      thumbnail_large TEXT,
      location_name TEXT,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      incident_date TEXT NOT NULL,
      incident_time TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      description TEXT,
      duration DOUBLE PRECISION,
      is_graphic_content BOOLEAN DEFAULT FALSE,
      content_warnings TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Requests table
    CREATE TABLE IF NOT EXISTS requests (
      id SERIAL PRIMARY KEY,
      footage_id INTEGER NOT NULL REFERENCES footage(id) ON DELETE CASCADE,
      requester_name TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      reason TEXT NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Conversations table
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      footage_id INTEGER REFERENCES footage(id) ON DELETE SET NULL,
      participant1_id INTEGER NOT NULL REFERENCES users(id),
      participant2_id INTEGER NOT NULL REFERENCES users(id),
      subject TEXT,
      last_message_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      message_body TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Encoding progress table
    CREATE TABLE IF NOT EXISTS encoding_progress (
      id SERIAL PRIMARY KEY,
      footage_id INTEGER NOT NULL REFERENCES footage(id) ON DELETE CASCADE,
      quality TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(footage_id, quality)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_footage_user ON footage(user_id);
    CREATE INDEX IF NOT EXISTS idx_footage_date ON footage(incident_date);
    CREATE INDEX IF NOT EXISTS idx_footage_location ON footage(lat, lng);
    CREATE INDEX IF NOT EXISTS idx_requests_footage ON requests(footage_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant1_id, participant2_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_encoding_footage ON encoding_progress(footage_id);
  `);

  // Add filename_original column if it doesn't exist (for Lambda processing)
  await pool.query(`
    ALTER TABLE footage
    ADD COLUMN IF NOT EXISTS filename_original TEXT;
  `);

  // Add processing_status column for Lambda job tracking
  await pool.query(`
    ALTER TABLE footage
    ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));
  `);

  logger.info('Database schema initialized');
  return pool;
}

/**
 * Get the database pool instance
 * @returns {Pool}
 */
export function getDb() {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return pool;
}

// ============ FOOTAGE OPERATIONS ============

/**
 * Get all footage records
 * @param {Object} options - Query options
 * @param {number} options.limit - Max records to return
 * @param {number} options.offset - Records to skip
 * @returns {Promise<Array<Object>>}
 */
export async function getAllFootage({ limit = 1000, offset = 0 } = {}) {
  const result = await pool.query(
    `SELECT * FROM footage ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows.map(row => ({
    ...row,
    content_warnings: row.content_warnings ? JSON.parse(row.content_warnings) : null
  }));
}

/**
 * Get footage count for pagination
 * @returns {Promise<number>}
 */
export async function getFootageCount() {
  const result = await pool.query('SELECT COUNT(*) as count FROM footage');
  return parseInt(result.rows[0].count);
}

/**
 * Get footage by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getFootageById(id) {
  const result = await pool.query('SELECT * FROM footage WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    content_warnings: row.content_warnings ? JSON.parse(row.content_warnings) : null
  };
}

/**
 * Create new footage record
 * @param {Object} footage
 * @returns {Promise<Object>} Created footage with ID
 */
export async function createFootage(footage) {
  const result = await pool.query(
    `INSERT INTO footage (
      user_id, filename, filename_compressed, thumbnail, thumbnail_small,
      thumbnail_medium, thumbnail_large, location_name, lat, lng,
      incident_date, incident_time, incident_type, description, duration,
      is_graphic_content, content_warnings, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING id`,
    [
      footage.user_id,
      footage.filename,
      footage.filename_compressed,
      footage.thumbnail,
      footage.thumbnail_small,
      footage.thumbnail_medium,
      footage.thumbnail_large,
      footage.location_name,
      footage.lat,
      footage.lng,
      footage.incident_date,
      footage.incident_time,
      footage.incident_type,
      footage.description,
      footage.duration,
      footage.is_graphic_content || false,
      footage.content_warnings ? JSON.stringify(footage.content_warnings) : null,
      footage.created_at || new Date().toISOString()
    ]
  );

  return { ...footage, id: result.rows[0].id };
}

/**
 * Update footage record
 * @param {number} id
 * @param {Object} updates
 * @returns {Promise<boolean>} Success
 */
export async function updateFootage(id, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${paramIndex}`);
    if (key === 'content_warnings') {
      values.push(value ? JSON.stringify(value) : null);
    } else {
      values.push(value);
    }
    paramIndex++;
  }

  if (fields.length === 0) return false;

  values.push(id);
  const result = await pool.query(
    `UPDATE footage SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
  return result.rowCount > 0;
}

/**
 * Delete footage record
 * @param {number} id
 * @returns {Promise<boolean>} Success
 */
export async function deleteFootage(id) {
  const result = await pool.query('DELETE FROM footage WHERE id = $1', [id]);
  return result.rowCount > 0;
}

// ============ USER OPERATIONS ============

/**
 * Get all users
 * @returns {Promise<Array<Object>>}
 */
export async function getAllUsers() {
  const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  return result.rows;
}

/**
 * Get user by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
export async function getUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

/**
 * Get user by username
 * @param {string} username
 * @returns {Promise<Object|null>}
 */
export async function getUserByUsername(username) {
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0] || null;
}

/**
 * Create new user
 * @param {Object} user
 * @returns {Promise<Object>} Created user with ID
 */
export async function createUser(user) {
  const result = await pool.query(
    `INSERT INTO users (username, email, password, role, created_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      user.username,
      user.email,
      user.password,
      user.role || 'user',
      user.created_at || new Date().toISOString()
    ]
  );

  return { ...user, id: result.rows[0].id };
}

/**
 * Update user
 * @param {number} id
 * @param {Object} updates
 * @returns {Promise<boolean>}
 */
export async function updateUser(id, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  if (fields.length === 0) return false;

  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
  return result.rowCount > 0;
}

// ============ REQUEST OPERATIONS ============

/**
 * Get all requests
 * @returns {Promise<Array<Object>>}
 */
export async function getAllRequests() {
  const result = await pool.query('SELECT * FROM requests ORDER BY created_at DESC');
  return result.rows;
}

/**
 * Get requests by footage ID
 * @param {number} footageId
 * @returns {Promise<Array<Object>>}
 */
export async function getRequestsByFootageId(footageId) {
  const result = await pool.query(
    'SELECT * FROM requests WHERE footage_id = $1 ORDER BY created_at DESC',
    [footageId]
  );
  return result.rows;
}

/**
 * Create request
 * @param {Object} request
 * @returns {Promise<Object>}
 */
export async function createRequest(request) {
  const result = await pool.query(
    `INSERT INTO requests (footage_id, requester_name, requester_email, reason, message, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      request.footage_id,
      request.requester_name,
      request.requester_email,
      request.reason,
      request.message,
      request.status || 'pending',
      request.created_at || new Date().toISOString()
    ]
  );

  return { ...request, id: result.rows[0].id };
}

// ============ CONVERSATION OPERATIONS ============

/**
 * Get conversations for a user
 * @param {number} userId
 * @returns {Promise<Array<Object>>}
 */
export async function getConversationsByUserId(userId) {
  const result = await pool.query(
    `SELECT c.*,
      u1.username as participant1_username,
      u2.username as participant2_username,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = FALSE AND m.sender_id != $1) as unread_count
    FROM conversations c
    LEFT JOIN users u1 ON c.participant1_id = u1.id
    LEFT JOIN users u2 ON c.participant2_id = u2.id
    WHERE c.participant1_id = $1 OR c.participant2_id = $1
    ORDER BY c.last_message_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Get conversation by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getConversationById(id) {
  const result = await pool.query('SELECT * FROM conversations WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Find existing conversation between two users for a footage
 * @param {number} footageId
 * @param {number} participant1Id
 * @param {number} participant2Id
 * @returns {Promise<Object|null>}
 */
export async function getConversationByParticipants(footageId, participant1Id, participant2Id) {
  const result = await pool.query(
    `SELECT * FROM conversations
     WHERE footage_id = $1
     AND ((participant1_id = $2 AND participant2_id = $3) OR (participant1_id = $3 AND participant2_id = $2))`,
    [footageId, participant1Id, participant2Id]
  );
  return result.rows[0] || null;
}

/**
 * Create conversation
 * @param {Object} conversation
 * @returns {Promise<Object>}
 */
export async function createConversation(conversation) {
  const now = new Date().toISOString();
  const result = await pool.query(
    `INSERT INTO conversations (footage_id, participant1_id, participant2_id, subject, last_message_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      conversation.footage_id,
      conversation.participant1_id,
      conversation.participant2_id,
      conversation.subject,
      conversation.last_message_at || now,
      conversation.created_at || now
    ]
  );

  return { ...conversation, id: result.rows[0].id };
}

/**
 * Update conversation last message time
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function updateConversationLastMessage(id) {
  const result = await pool.query(
    'UPDATE conversations SET last_message_at = $1 WHERE id = $2',
    [new Date().toISOString(), id]
  );
  return result.rowCount > 0;
}

// ============ MESSAGE OPERATIONS ============

/**
 * Get messages by conversation ID
 * @param {number} conversationId
 * @returns {Promise<Array<Object>>}
 */
export async function getMessagesByConversationId(conversationId) {
  const result = await pool.query(
    `SELECT m.*, u.username as sender_username
     FROM messages m
     LEFT JOIN users u ON m.sender_id = u.id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [conversationId]
  );
  return result.rows;
}

/**
 * Get message by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getMessageById(id) {
  const result = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  return result.rows[0] || null;
}

/**
 * Get last message in a conversation
 * @param {number} conversationId
 * @returns {Promise<Object|null>}
 */
export async function getLastMessage(conversationId) {
  const result = await pool.query(
    `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [conversationId]
  );
  return result.rows[0] || null;
}

/**
 * Get message count in a conversation
 * @param {number} conversationId
 * @returns {Promise<number>}
 */
export async function getMessageCount(conversationId) {
  const result = await pool.query(
    'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1',
    [conversationId]
  );
  return parseInt(result.rows[0].count);
}

/**
 * Mark a single message as read
 * @param {number} messageId
 * @returns {Promise<boolean>}
 */
export async function markMessageAsRead(messageId) {
  const result = await pool.query(
    'UPDATE messages SET is_read = TRUE WHERE id = $1',
    [messageId]
  );
  return result.rowCount > 0;
}

/**
 * Create message
 * @param {Object} message
 * @returns {Promise<Object>}
 */
export async function createMessage(message) {
  const result = await pool.query(
    `INSERT INTO messages (conversation_id, sender_id, message_body, is_read, created_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      message.conversation_id,
      message.sender_id,
      message.message_body,
      message.is_read || false,
      message.created_at || new Date().toISOString()
    ]
  );

  // Update conversation last message time
  await updateConversationLastMessage(message.conversation_id);

  return { ...message, id: result.rows[0].id };
}

/**
 * Mark messages as read
 * @param {number} conversationId
 * @param {number} userId - The user reading the messages
 * @returns {Promise<number>} Number of messages marked as read
 */
export async function markMessagesAsRead(conversationId, userId) {
  const result = await pool.query(
    `UPDATE messages SET is_read = TRUE
     WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE`,
    [conversationId, userId]
  );
  return result.rowCount;
}

/**
 * Get unread message count for user
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function getUnreadCountForUser(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM messages m
     JOIN conversations c ON m.conversation_id = c.id
     WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
     AND m.sender_id != $1
     AND m.is_read = FALSE`,
    [userId]
  );
  return parseInt(result.rows[0].count);
}

// ============ ENCODING PROGRESS OPERATIONS ============

/**
 * Set encoding progress
 * @param {number} footageId
 * @param {string} quality
 * @param {number} progress
 * @param {string} status
 */
export async function setEncodingProgress(footageId, quality, progress, status = 'processing') {
  await pool.query(
    `INSERT INTO encoding_progress (footage_id, quality, progress, status, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (footage_id, quality) DO UPDATE SET
       progress = $3,
       status = $4,
       updated_at = $5`,
    [footageId, quality, progress, status, new Date().toISOString()]
  );
}

/**
 * Get encoding progress for footage
 * @param {number} footageId
 * @returns {Promise<Object>} Map of quality -> {progress, status}
 */
export async function getEncodingProgress(footageId) {
  const result = await pool.query(
    'SELECT quality, progress, status FROM encoding_progress WHERE footage_id = $1',
    [footageId]
  );

  const progressMap = {};
  for (const row of result.rows) {
    progressMap[row.quality] = { progress: row.progress, status: row.status };
  }
  return progressMap;
}

/**
 * Clear encoding progress for footage
 * @param {number} footageId
 */
export async function clearEncodingProgress(footageId) {
  await pool.query('DELETE FROM encoding_progress WHERE footage_id = $1', [footageId]);
}

// ============ MIGRATION UTILITIES ============

/**
 * Migrate data from JSON files to PostgreSQL
 * @param {string} dataDir - Directory containing JSON data files
 */
export async function migrateFromJson(dataDir) {
  const fs = await import('fs');
  const path = await import('path');

  // Check if migration is needed (empty database)
  const { rows: existingUsers } = await pool.query('SELECT COUNT(*) as count FROM users');
  if (parseInt(existingUsers[0].count) > 0) {
    logger.info('Database already has data - skipping JSON migration');
    return;
  }

  logger.info('Starting JSON migration to PostgreSQL', { dataDir });

  try {
    // Migrate users
    const usersPath = path.default.join(dataDir, 'users.json');
    if (fs.default.existsSync(usersPath)) {
      const users = JSON.parse(fs.default.readFileSync(usersPath, 'utf8'));
      for (const user of users) {
        await pool.query(
          `INSERT INTO users (id, username, email, password, role, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [user.id, user.username, user.email, user.password, user.role || 'user', user.created_at]
        );
      }
      // Reset sequence
      await pool.query(`SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 0) FROM users))`);
      logger.info('Migrated users', { count: users.length });
    }

    // Migrate footage
    const footagePath = path.default.join(dataDir, 'footage.json');
    if (fs.default.existsSync(footagePath)) {
      const footage = JSON.parse(fs.default.readFileSync(footagePath, 'utf8'));
      for (const f of footage) {
        await pool.query(
          `INSERT INTO footage (id, user_id, filename, filename_compressed, filename_240p, filename_360p,
            filename_480p, filename_720p, filename_1080p, thumbnail, thumbnail_small, thumbnail_medium,
            thumbnail_large, location_name, lat, lng, incident_date, incident_time, incident_type,
            description, duration, is_graphic_content, content_warnings, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
           ON CONFLICT (id) DO NOTHING`,
          [f.id, f.user_id, f.filename, f.filename_compressed, f.filename_240p, f.filename_360p,
           f.filename_480p, f.filename_720p, f.filename_1080p, f.thumbnail, f.thumbnail_small,
           f.thumbnail_medium, f.thumbnail_large, f.location_name, f.lat, f.lng, f.incident_date,
           f.incident_time, f.incident_type, f.description, f.duration, f.is_graphic_content,
           f.content_warnings ? JSON.stringify(f.content_warnings) : null, f.created_at]
        );
      }
      await pool.query(`SELECT setval('footage_id_seq', (SELECT COALESCE(MAX(id), 0) FROM footage))`);
      logger.info('Migrated footage', { count: footage.length });
    }

    // Migrate requests
    const requestsPath = path.default.join(dataDir, 'requests.json');
    if (fs.default.existsSync(requestsPath)) {
      const requests = JSON.parse(fs.default.readFileSync(requestsPath, 'utf8'));
      for (const r of requests) {
        // Check if footage exists
        const { rows } = await pool.query('SELECT id FROM footage WHERE id = $1', [r.footage_id]);
        if (rows.length > 0) {
          await pool.query(
            `INSERT INTO requests (id, footage_id, requester_name, requester_email, reason, message, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [r.id, r.footage_id, r.requester_name, r.requester_email, r.reason, r.message, r.status, r.created_at]
          );
        }
      }
      await pool.query(`SELECT setval('requests_id_seq', (SELECT COALESCE(MAX(id), 0) FROM requests))`);
      logger.info('Migrated requests', { count: requests.length });
    }

    // Migrate conversations (skip if users don't exist)
    const conversationsPath = path.default.join(dataDir, 'conversations.json');
    if (fs.default.existsSync(conversationsPath)) {
      const conversations = JSON.parse(fs.default.readFileSync(conversationsPath, 'utf8'));
      let migratedCount = 0;
      for (const c of conversations) {
        // Check if both participants exist
        const { rows: p1 } = await pool.query('SELECT id FROM users WHERE id = $1', [c.participant1_id]);
        const { rows: p2 } = await pool.query('SELECT id FROM users WHERE id = $1', [c.participant2_id]);
        if (p1.length > 0 && p2.length > 0) {
          await pool.query(
            `INSERT INTO conversations (id, footage_id, participant1_id, participant2_id, subject, last_message_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
            [c.id, c.footage_id, c.participant1_id, c.participant2_id, c.subject, c.last_message_at, c.created_at]
          );
          migratedCount++;
        }
      }
      await pool.query(`SELECT setval('conversations_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM conversations), 1))`);
      logger.info('Migrated conversations', { count: migratedCount, skipped: conversations.length - migratedCount });
    }

    // Migrate messages (skip if conversation doesn't exist)
    const messagesPath = path.default.join(dataDir, 'messages.json');
    if (fs.default.existsSync(messagesPath)) {
      const messages = JSON.parse(fs.default.readFileSync(messagesPath, 'utf8'));
      let migratedCount = 0;
      for (const m of messages) {
        const { rows: conv } = await pool.query('SELECT id FROM conversations WHERE id = $1', [m.conversation_id]);
        const { rows: sender } = await pool.query('SELECT id FROM users WHERE id = $1', [m.sender_id]);
        if (conv.length > 0 && sender.length > 0) {
          await pool.query(
            `INSERT INTO messages (id, conversation_id, sender_id, message_body, is_read, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [m.id, m.conversation_id, m.sender_id, m.message_body, m.is_read, m.created_at]
          );
          migratedCount++;
        }
      }
      await pool.query(`SELECT setval('messages_id_seq', GREATEST((SELECT COALESCE(MAX(id), 0) FROM messages), 1))`);
      logger.info('Migrated messages', { count: migratedCount, skipped: messages.length - migratedCount });
    }

    logger.info('JSON migration completed successfully');
  } catch (error) {
    logger.error('JSON migration failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}
