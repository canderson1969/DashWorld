/**
 * SQLite Database Module
 *
 * Provides database initialization and CRUD operations for all entities.
 * Uses better-sqlite3 for synchronous, fast SQLite operations.
 *
 * @module database
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db = null;

/**
 * Initialize the SQLite database with schema
 *
 * @param {string} dataDir - Directory to store the database file
 * @returns {Database} The database instance
 */
export function initializeDatabase(dataDir) {
  const dbPath = path.join(dataDir, 'dashworld.db');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable foreign keys and WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Footage table
    CREATE TABLE IF NOT EXISTS footage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
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
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      incident_date TEXT NOT NULL,
      incident_time TEXT NOT NULL,
      incident_type TEXT NOT NULL,
      description TEXT,
      duration REAL,
      is_graphic_content INTEGER DEFAULT 0,
      content_warnings TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Requests table
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      footage_id INTEGER NOT NULL,
      requester_name TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      reason TEXT NOT NULL,
      message TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (footage_id) REFERENCES footage(id) ON DELETE CASCADE
    );

    -- Conversations table
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      footage_id INTEGER,
      participant1_id INTEGER NOT NULL,
      participant2_id INTEGER NOT NULL,
      subject TEXT,
      last_message_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (footage_id) REFERENCES footage(id) ON DELETE SET NULL,
      FOREIGN KEY (participant1_id) REFERENCES users(id),
      FOREIGN KEY (participant2_id) REFERENCES users(id)
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      message_body TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id)
    );

    -- Encoding progress table (persists encoding state)
    CREATE TABLE IF NOT EXISTS encoding_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      footage_id INTEGER NOT NULL,
      quality TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (footage_id) REFERENCES footage(id) ON DELETE CASCADE,
      UNIQUE(footage_id, quality)
    );

    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_footage_user ON footage(user_id);
    CREATE INDEX IF NOT EXISTS idx_footage_date ON footage(incident_date);
    CREATE INDEX IF NOT EXISTS idx_footage_location ON footage(lat, lng);
    CREATE INDEX IF NOT EXISTS idx_requests_footage ON requests(footage_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant1_id, participant2_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_encoding_footage ON encoding_progress(footage_id);
  `);

  logger.info('Database initialized', { dbPath });
  return db;
}

/**
 * Get the database instance
 * @returns {Database}
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

// ============ FOOTAGE OPERATIONS ============

/**
 * Get all footage records
 * @param {Object} options - Query options
 * @param {number} options.limit - Max records to return
 * @param {number} options.offset - Records to skip
 * @returns {Array<Object>}
 */
export function getAllFootage({ limit = 1000, offset = 0 } = {}) {
  const stmt = db.prepare(`
    SELECT *,
      CASE WHEN is_graphic_content = 1 THEN true ELSE false END as is_graphic_content
    FROM footage
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(limit, offset);
  return rows.map(row => ({
    ...row,
    is_graphic_content: Boolean(row.is_graphic_content),
    content_warnings: row.content_warnings ? JSON.parse(row.content_warnings) : null
  }));
}

/**
 * Get footage count for pagination
 * @returns {number}
 */
export function getFootageCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM footage');
  return stmt.get().count;
}

/**
 * Get footage by ID
 * @param {number} id
 * @returns {Object|null}
 */
export function getFootageById(id) {
  const stmt = db.prepare('SELECT * FROM footage WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  return {
    ...row,
    is_graphic_content: Boolean(row.is_graphic_content),
    content_warnings: row.content_warnings ? JSON.parse(row.content_warnings) : null
  };
}

/**
 * Create new footage record
 * @param {Object} footage
 * @returns {Object} Created footage with ID
 */
export function createFootage(footage) {
  const stmt = db.prepare(`
    INSERT INTO footage (
      user_id, filename, filename_compressed, thumbnail, thumbnail_small,
      thumbnail_medium, thumbnail_large, location_name, lat, lng,
      incident_date, incident_time, incident_type, description, duration,
      is_graphic_content, content_warnings, created_at
    ) VALUES (
      @user_id, @filename, @filename_compressed, @thumbnail, @thumbnail_small,
      @thumbnail_medium, @thumbnail_large, @location_name, @lat, @lng,
      @incident_date, @incident_time, @incident_type, @description, @duration,
      @is_graphic_content, @content_warnings, @created_at
    )
  `);

  const result = stmt.run({
    ...footage,
    is_graphic_content: footage.is_graphic_content ? 1 : 0,
    content_warnings: footage.content_warnings ? JSON.stringify(footage.content_warnings) : null,
    created_at: footage.created_at || new Date().toISOString()
  });

  return { ...footage, id: result.lastInsertRowid };
}

/**
 * Update footage record
 * @param {number} id
 * @param {Object} updates
 * @returns {boolean} Success
 */
export function updateFootage(id, updates) {
  const fields = [];
  const values = {};

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'content_warnings') {
      fields.push(`${key} = @${key}`);
      values[key] = value ? JSON.stringify(value) : null;
    } else if (key === 'is_graphic_content') {
      fields.push(`${key} = @${key}`);
      values[key] = value ? 1 : 0;
    } else {
      fields.push(`${key} = @${key}`);
      values[key] = value;
    }
  }

  if (fields.length === 0) return false;

  const stmt = db.prepare(`UPDATE footage SET ${fields.join(', ')} WHERE id = @id`);
  const result = stmt.run({ ...values, id });
  return result.changes > 0;
}

/**
 * Delete footage record
 * @param {number} id
 * @returns {boolean} Success
 */
export function deleteFootage(id) {
  const stmt = db.prepare('DELETE FROM footage WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============ USER OPERATIONS ============

/**
 * Get all users
 * @returns {Array<Object>}
 */
export function getAllUsers() {
  const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
  return stmt.all();
}

/**
 * Get user by ID
 * @param {number} id
 * @returns {Object|null}
 */
export function getUserById(id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) || null;
}

/**
 * Get user by email
 * @param {string} email
 * @returns {Object|null}
 */
export function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email) || null;
}

/**
 * Get user by username
 * @param {string} username
 * @returns {Object|null}
 */
export function getUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username) || null;
}

/**
 * Create new user
 * @param {Object} user
 * @returns {Object} Created user with ID
 */
export function createUser(user) {
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password, role, created_at)
    VALUES (@username, @email, @password, @role, @created_at)
  `);

  const result = stmt.run({
    ...user,
    role: user.role || 'user',
    created_at: user.created_at || new Date().toISOString()
  });

  return { ...user, id: result.lastInsertRowid };
}

/**
 * Update user
 * @param {number} id
 * @param {Object} updates
 * @returns {boolean}
 */
export function updateUser(id, updates) {
  const fields = Object.keys(updates).map(k => `${k} = @${k}`);
  if (fields.length === 0) return false;

  const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = @id`);
  const result = stmt.run({ ...updates, id });
  return result.changes > 0;
}

// ============ REQUEST OPERATIONS ============

/**
 * Get all requests
 * @returns {Array<Object>}
 */
export function getAllRequests() {
  const stmt = db.prepare('SELECT * FROM requests ORDER BY created_at DESC');
  return stmt.all();
}

/**
 * Get requests by footage ID
 * @param {number} footageId
 * @returns {Array<Object>}
 */
export function getRequestsByFootageId(footageId) {
  const stmt = db.prepare('SELECT * FROM requests WHERE footage_id = ? ORDER BY created_at DESC');
  return stmt.all(footageId);
}

/**
 * Create request
 * @param {Object} request
 * @returns {Object}
 */
export function createRequest(request) {
  const stmt = db.prepare(`
    INSERT INTO requests (footage_id, requester_name, requester_email, reason, message, status, created_at)
    VALUES (@footage_id, @requester_name, @requester_email, @reason, @message, @status, @created_at)
  `);

  const result = stmt.run({
    ...request,
    status: request.status || 'pending',
    created_at: request.created_at || new Date().toISOString()
  });

  return { ...request, id: result.lastInsertRowid };
}

// ============ CONVERSATION OPERATIONS ============

/**
 * Get conversations for a user
 * @param {number} userId
 * @returns {Array<Object>}
 */
export function getConversationsByUserId(userId) {
  const stmt = db.prepare(`
    SELECT c.*,
      u1.username as participant1_username,
      u2.username as participant2_username,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = 0 AND m.sender_id != ?) as unread_count
    FROM conversations c
    LEFT JOIN users u1 ON c.participant1_id = u1.id
    LEFT JOIN users u2 ON c.participant2_id = u2.id
    WHERE c.participant1_id = ? OR c.participant2_id = ?
    ORDER BY c.last_message_at DESC
  `);
  return stmt.all(userId, userId, userId);
}

/**
 * Get conversation by ID
 * @param {number} id
 * @returns {Object|null}
 */
export function getConversationById(id) {
  const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
  return stmt.get(id) || null;
}

/**
 * Create conversation
 * @param {Object} conversation
 * @returns {Object}
 */
export function createConversation(conversation) {
  const stmt = db.prepare(`
    INSERT INTO conversations (footage_id, participant1_id, participant2_id, subject, last_message_at, created_at)
    VALUES (@footage_id, @participant1_id, @participant2_id, @subject, @last_message_at, @created_at)
  `);

  const now = new Date().toISOString();
  const result = stmt.run({
    ...conversation,
    last_message_at: conversation.last_message_at || now,
    created_at: conversation.created_at || now
  });

  return { ...conversation, id: result.lastInsertRowid };
}

/**
 * Update conversation last message time
 * @param {number} id
 * @returns {boolean}
 */
export function updateConversationLastMessage(id) {
  const stmt = db.prepare('UPDATE conversations SET last_message_at = ? WHERE id = ?');
  const result = stmt.run(new Date().toISOString(), id);
  return result.changes > 0;
}

// ============ MESSAGE OPERATIONS ============

/**
 * Get messages by conversation ID
 * @param {number} conversationId
 * @returns {Array<Object>}
 */
export function getMessagesByConversationId(conversationId) {
  const stmt = db.prepare(`
    SELECT m.*, u.username as sender_username
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `);
  return stmt.all(conversationId).map(row => ({
    ...row,
    is_read: Boolean(row.is_read)
  }));
}

/**
 * Create message
 * @param {Object} message
 * @returns {Object}
 */
export function createMessage(message) {
  const stmt = db.prepare(`
    INSERT INTO messages (conversation_id, sender_id, message_body, is_read, created_at)
    VALUES (@conversation_id, @sender_id, @message_body, @is_read, @created_at)
  `);

  const result = stmt.run({
    ...message,
    is_read: message.is_read ? 1 : 0,
    created_at: message.created_at || new Date().toISOString()
  });

  // Update conversation last message time
  updateConversationLastMessage(message.conversation_id);

  return { ...message, id: result.lastInsertRowid };
}

/**
 * Mark messages as read
 * @param {number} conversationId
 * @param {number} userId - The user reading the messages (mark others' messages as read)
 * @returns {number} Number of messages marked as read
 */
export function markMessagesAsRead(conversationId, userId) {
  const stmt = db.prepare(`
    UPDATE messages SET is_read = 1
    WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
  `);
  const result = stmt.run(conversationId, userId);
  return result.changes;
}

/**
 * Get unread message count for user
 * @param {number} userId
 * @returns {number}
 */
export function getUnreadCountForUser(userId) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE (c.participant1_id = ? OR c.participant2_id = ?)
    AND m.sender_id != ?
    AND m.is_read = 0
  `);
  return stmt.get(userId, userId, userId).count;
}

// ============ ENCODING PROGRESS OPERATIONS ============

/**
 * Set encoding progress
 * @param {number} footageId
 * @param {string} quality
 * @param {number} progress
 * @param {string} status
 */
export function setEncodingProgress(footageId, quality, progress, status = 'processing') {
  const stmt = db.prepare(`
    INSERT INTO encoding_progress (footage_id, quality, progress, status, updated_at)
    VALUES (@footage_id, @quality, @progress, @status, @updated_at)
    ON CONFLICT(footage_id, quality) DO UPDATE SET
      progress = @progress,
      status = @status,
      updated_at = @updated_at
  `);

  stmt.run({
    footage_id: footageId,
    quality,
    progress,
    status,
    updated_at: new Date().toISOString()
  });
}

/**
 * Get encoding progress for footage
 * @param {number} footageId
 * @returns {Object} Map of quality -> {progress, status}
 */
export function getEncodingProgress(footageId) {
  const stmt = db.prepare('SELECT quality, progress, status FROM encoding_progress WHERE footage_id = ?');
  const rows = stmt.all(footageId);

  const result = {};
  for (const row of rows) {
    result[row.quality] = { progress: row.progress, status: row.status };
  }
  return result;
}

/**
 * Clear encoding progress for footage
 * @param {number} footageId
 */
export function clearEncodingProgress(footageId) {
  const stmt = db.prepare('DELETE FROM encoding_progress WHERE footage_id = ?');
  stmt.run(footageId);
}

// ============ MIGRATION UTILITIES ============

/**
 * Migrate data from JSON files to SQLite
 * @param {string} dataDir - Directory containing JSON files
 */
export function migrateFromJson(dataDir) {
  const jsonFiles = {
    users: path.join(dataDir, 'users.json'),
    footage: path.join(dataDir, 'footage.json'),
    requests: path.join(dataDir, 'requests.json'),
    conversations: path.join(dataDir, 'conversations.json'),
    messages: path.join(dataDir, 'messages.json')
  };

  // Check if migration is needed
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    logger.info('Database already has data, skipping migration');
    return;
  }

  logger.info('Starting migration from JSON files');

  // Migrate users
  if (fs.existsSync(jsonFiles.users)) {
    const users = JSON.parse(fs.readFileSync(jsonFiles.users, 'utf8'));
    const stmt = db.prepare(`
      INSERT INTO users (id, username, email, password, role, created_at)
      VALUES (@id, @username, @email, @password, @role, @created_at)
    `);
    for (const user of users) {
      stmt.run(user);
    }
    logger.info(`Migrated ${users.length} users`);
  }

  // Migrate footage
  if (fs.existsSync(jsonFiles.footage)) {
    const footage = JSON.parse(fs.readFileSync(jsonFiles.footage, 'utf8'));
    const stmt = db.prepare(`
      INSERT INTO footage (
        id, user_id, filename, filename_compressed, filename_240p, filename_360p,
        filename_480p, filename_720p, filename_1080p, thumbnail, thumbnail_small,
        thumbnail_medium, thumbnail_large, location_name, lat, lng, incident_date,
        incident_time, incident_type, description, duration, is_graphic_content,
        content_warnings, created_at
      ) VALUES (
        @id, @user_id, @filename, @filename_compressed, @filename_240p, @filename_360p,
        @filename_480p, @filename_720p, @filename_1080p, @thumbnail, @thumbnail_small,
        @thumbnail_medium, @thumbnail_large, @location_name, @lat, @lng, @incident_date,
        @incident_time, @incident_type, @description, @duration, @is_graphic_content,
        @content_warnings, @created_at
      )
    `);
    for (const f of footage) {
      stmt.run({
        ...f,
        is_graphic_content: f.is_graphic_content ? 1 : 0,
        content_warnings: f.content_warnings ? JSON.stringify(f.content_warnings) : null
      });
    }
    logger.info(`Migrated ${footage.length} footage records`);
  }

  // Migrate requests
  if (fs.existsSync(jsonFiles.requests)) {
    const requests = JSON.parse(fs.readFileSync(jsonFiles.requests, 'utf8'));
    const stmt = db.prepare(`
      INSERT INTO requests (id, footage_id, requester_name, requester_email, reason, message, status, created_at)
      VALUES (@id, @footage_id, @requester_name, @requester_email, @reason, @message, @status, @created_at)
    `);
    for (const r of requests) {
      stmt.run(r);
    }
    logger.info(`Migrated ${requests.length} requests`);
  }

  // Migrate conversations
  if (fs.existsSync(jsonFiles.conversations)) {
    const conversations = JSON.parse(fs.readFileSync(jsonFiles.conversations, 'utf8'));
    const stmt = db.prepare(`
      INSERT INTO conversations (id, footage_id, participant1_id, participant2_id, subject, last_message_at, created_at)
      VALUES (@id, @footage_id, @participant1_id, @participant2_id, @subject, @last_message_at, @created_at)
    `);
    for (const c of conversations) {
      stmt.run(c);
    }
    logger.info(`Migrated ${conversations.length} conversations`);
  }

  // Migrate messages
  if (fs.existsSync(jsonFiles.messages)) {
    const messages = JSON.parse(fs.readFileSync(jsonFiles.messages, 'utf8'));
    const stmt = db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, message_body, is_read, created_at)
      VALUES (@id, @conversation_id, @sender_id, @message_body, @is_read, @created_at)
    `);
    for (const m of messages) {
      stmt.run({
        ...m,
        is_read: m.is_read ? 1 : 0
      });
    }
    logger.info(`Migrated ${messages.length} messages`);
  }

  logger.info('Migration completed');
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
