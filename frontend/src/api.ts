import { API_CONFIG } from './config/constants';

const API_BASE_URL = API_CONFIG.BASE_URL;

export interface Footage {
  id: number;
  user_id?: number;
  filename: string;
  filename_compressed?: string | null;
  filename_240p?: string | null;
  filename_360p?: string | null;
  filename_480p?: string | null;
  filename_720p?: string | null;
  filename_1080p?: string | null;
  thumbnail: string | null;
  thumbnail_small?: string | null;
  thumbnail_medium?: string | null;
  thumbnail_large?: string | null;
  location_name: string;
  lat: number;
  lng: number;
  incident_date: string;
  incident_time: string;
  incident_type: string;
  description: string | null;
  duration: number | null;
  is_graphic_content?: boolean;
  content_warnings?: string[] | null;
  created_at: string;
  // URL fields (populated by backend transformFootageUrls)
  video_url?: string | null;
  video_url_240p?: string | null;
  video_url_360p?: string | null;
  video_url_480p?: string | null;
  video_url_720p?: string | null;
  video_url_1080p?: string | null;
  thumbnail_url?: string | null;
  thumbnail_url_small?: string | null;
  thumbnail_url_medium?: string | null;
  thumbnail_url_large?: string | null;
}

export interface FootageRequest {
  id: number;
  footage_id: number;
  requester_name: string;
  requester_email: string;
  reason: string;
  message: string | null;
  status: string;
  created_at: string;
}

/**
 * Fetch all footage entries from the API
 *
 * @returns {Promise<Footage[]>} Promise resolving to array of all footage records with metadata
 * @throws {Error} If API request fails or returns non-OK status
 */
export async function getAllFootage(): Promise<Footage[]> {
  const response = await fetch(`${API_BASE_URL}/footage`);
  if (!response.ok) {
    throw new Error('Failed to fetch footage');
  }
  return response.json();
}

/**
 * Fetch single footage entry by ID
 *
 * @param {number} id - The footage ID to retrieve
 * @returns {Promise<Footage>} Promise resolving to footage object with metadata
 * @throws {Error} If footage not found (404) or request fails
 */
export async function getFootageById(id: number): Promise<Footage> {
  const response = await fetch(`${API_BASE_URL}/footage/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch footage');
  }
  return response.json();
}

/**
 * Upload new footage with video file, thumbnail, and metadata
 *
 * @param {FormData} formData - FormData containing video, thumbnail, and metadata fields
 * @param {string} token - JWT authentication token
 * @param {function} onProgress - Optional callback for upload progress (0-100)
 * @returns {Promise<{success: boolean, id: number, message: string}>} Upload result with new footage ID
 * @throws {Error} If upload fails due to validation, file size, or server error
 */
export async function uploadFootage(
  formData: FormData,
  token: string,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; id: number; message: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        onProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error('Failed to parse server response'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || 'Failed to upload footage'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open('POST', `${API_BASE_URL}/footage/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

/**
 * Submit a request to contact the footage uploader
 *
 * @param {number} footageId - The ID of the footage being requested
 * @param {Object} data - Request details
 * @param {string} data.name - Requester's full name
 * @param {string} data.email - Requester's email address
 * @param {string} data.reason - Reason for request (involved, witness, representative, other)
 * @param {string} [data.message] - Optional additional message
 * @returns {Promise<{success: boolean, id: number, message: string}>} Request submission result
 * @throws {Error} If request submission fails or footage not found
 */
export async function submitFootageRequest(
  footageId: number,
  data: { name: string; email: string; reason: string; message?: string }
): Promise<{ success: boolean; id: number; message: string }> {
  const response = await fetch(`${API_BASE_URL}/footage/${footageId}/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit request');
  }
  return response.json();
}

/**
 * Fetch all requests for a specific footage entry
 *
 * @param {number} footageId - The footage ID to get requests for
 * @returns {Promise<FootageRequest[]>} Promise resolving to array of request objects
 * @throws {Error} If API request fails or footage not found
 */
export async function getFootageRequests(footageId: number): Promise<FootageRequest[]> {
  const response = await fetch(`${API_BASE_URL}/footage/${footageId}/requests`);
  if (!response.ok) {
    throw new Error('Failed to fetch requests');
  }
  return response.json();
}

/**
 * Check API server health status
 *
 * @returns {Promise<{status: string, message: string}>} Health check response
 * @throws {Error} If server is unreachable or unhealthy
 */
export async function healthCheck(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('API is not responding');
  }
  return response.json();
}

// ========== Authentication APIs ==========

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  created_at: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

/**
 * Register a new user account
 *
 * @param {string} username - Unique username
 * @param {string} email - User email address
 * @param {string} password - Password (minimum 6 characters)
 * @returns {Promise<AuthResponse>} Authentication response with token and user info
 * @throws {Error} If registration fails or user already exists
 */
export async function register(username: string, email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Registration failed');
  }

  return response.json();
}

/**
 * Login with existing user credentials
 *
 * @param {string} identifier - User email address or username
 * @param {string} password - User password
 * @returns {Promise<AuthResponse>} Authentication response with token and user info
 * @throws {Error} If login fails or credentials are invalid
 */
export async function login(identifier: string, password: string): Promise<AuthResponse> {
  // Determine if identifier is email or username based on @ symbol
  const isEmail = identifier.includes('@');
  const body = isEmail
    ? { email: identifier, password }
    : { username: identifier, password };

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  return response.json();
}

/**
 * Get current user profile
 *
 * @param {string} token - JWT authentication token
 * @returns {Promise<User>} Current user profile data
 * @throws {Error} If fetch fails or token is invalid
 */
export async function getCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch user profile');
  }

  return response.json();
}

/**
 * Update current user profile
 *
 * @param {Object} data - Profile update data
 * @param {string} [data.username] - New username
 * @param {string} [data.email] - New email address
 * @param {string} token - JWT authentication token
 * @returns {Promise<{success: boolean, message: string, user: User}>} Update result with updated user data
 * @throws {Error} If update fails, username/email already taken, or validation fails
 */
export async function updateUserProfile(
  data: { username?: string; email?: string },
  token: string
): Promise<{ success: boolean; message: string; user: User }> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update profile');
  }

  return response.json();
}

/**
 * Change user password
 *
 * @param {string} currentPassword - Current password for verification
 * @param {string} newPassword - New password (minimum 6 characters)
 * @param {string} token - JWT authentication token
 * @returns {Promise<{success: boolean, message: string}>} Change password result
 * @throws {Error} If password change fails or current password is incorrect
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/me/password`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to change password');
  }

  return response.json();
}

/**
 * Delete user account
 *
 * @param {string} password - Password confirmation for account deletion
 * @param {string} token - JWT authentication token
 * @returns {Promise<{success: boolean, message: string}>} Delete confirmation
 * @throws {Error} If deletion fails or password is incorrect
 */
export async function deleteUserAccount(
  password: string,
  token: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete account');
  }

  return response.json();
}

/**
 * Delete a footage entry (user must own the footage)
 *
 * @param {number} id - The footage ID to delete
 * @param {string} token - JWT authentication token
 * @returns {Promise<{success: boolean, message: string}>} Delete confirmation
 * @throws {Error} If delete fails or user is not authorized
 */
export async function deleteFootage(id: number, token: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/footage/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete footage');
  }

  return response.json();
}

/**
 * Update footage description (moderator/admin only)
 *
 * @param {number} id - The footage ID to update
 * @param {string} description - New description text
 * @param {string} token - JWT authentication token
 * @returns {Promise<{success: boolean, message: string, footage: Footage}>} Update confirmation with updated footage
 * @throws {Error} If update fails or user is not authorized
 */
export async function updateFootageDescription(id: number, description: string, token: string): Promise<{ success: boolean; message: string; footage: Footage }> {
  const response = await fetch(`${API_BASE_URL}/footage/${id}/description`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ description }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update footage description');
  }

  return response.json();
}

// ============================================================================
// Messaging API
// ============================================================================

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  message_body: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  footage_id: number | null;
  participant1_id: number;
  participant2_id: number;
  subject: string;
  last_message_at: string;
  created_at: string;
  unread_count?: number;
  last_message?: Message | null;
  message_count?: number;
}

/**
 * Create a new conversation or get existing one
 *
 * @param {number} footageId - ID of the footage being discussed
 * @param {number} recipientId - ID of the recipient user
 * @param {string} subject - Subject line for the conversation
 * @param {string} initialMessage - First message in the conversation
 * @param {string} token - JWT authentication token
 * @returns {Promise<{conversation: Conversation, message: Message}>} Created conversation and message
 * @throws {Error} If creation fails
 */
export async function createConversation(
  footageId: number,
  recipientId: number,
  subject: string,
  initialMessage: string,
  token: string
): Promise<{ conversation: Conversation; message: Message }> {
  const response = await fetch(`${API_BASE_URL}/conversations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      footage_id: footageId,
      recipient_id: recipientId,
      subject,
      initial_message: initialMessage
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create conversation');
  }

  return response.json();
}

/**
 * Get all conversations for the current user
 *
 * @param {string} token - JWT authentication token
 * @returns {Promise<Conversation[]>} Array of conversations sorted by most recent
 * @throws {Error} If fetch fails
 */
export async function getConversations(token: string): Promise<Conversation[]> {
  const response = await fetch(`${API_BASE_URL}/conversations`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch conversations');
  }

  return response.json();
}

/**
 * Get all messages in a conversation
 *
 * @param {number} conversationId - ID of the conversation
 * @param {string} token - JWT authentication token
 * @returns {Promise<Message[]>} Array of messages in chronological order
 * @throws {Error} If fetch fails or user is not authorized
 */
export async function getConversationMessages(conversationId: number, token: string): Promise<Message[]> {
  const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch messages');
  }

  return response.json();
}

/**
 * Send a new message in an existing conversation
 *
 * @param {number} conversationId - ID of the conversation
 * @param {string} messageBody - Message text content
 * @param {string} token - JWT authentication token
 * @returns {Promise<Message>} The created message
 * @throws {Error} If send fails or user is not authorized
 */
export async function sendMessage(
  conversationId: number,
  messageBody: string,
  token: string
): Promise<Message> {
  const response = await fetch(`${API_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      message_body: messageBody
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return response.json();
}

/**
 * Mark a message as read
 *
 * @param {number} messageId - ID of the message to mark as read
 * @param {string} token - JWT authentication token
 * @returns {Promise<{success: boolean, message: Message}>} Success status and updated message
 * @throws {Error} If marking fails or user is not authorized
 */
export async function markMessageAsRead(messageId: number, token: string): Promise<{ success: boolean; message: Message }> {
  const response = await fetch(`${API_BASE_URL}/messages/${messageId}/read`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to mark message as read');
  }

  return response.json();
}

/**
 * Mark all messages in a conversation as read
 *
 * @param {number} conversationId - ID of the conversation
 * @param {string} token - JWT authentication token
 * @returns {Promise<{success: boolean, marked_count: number}>} Success status and count of messages marked
 * @throws {Error} If marking fails or user is not authorized
 */
export async function markConversationAsRead(conversationId: number, token: string): Promise<{ success: boolean; marked_count: number }> {
  const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/read-all`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to mark conversation as read');
  }

  return response.json();
}

/**
 * Get total unread message count for current user
 *
 * @param {string} token - JWT authentication token
 * @returns {Promise<{unread_count: number}>} Unread message count
 * @throws {Error} If fetch fails
 */
export async function getUnreadCount(token: string): Promise<{ unread_count: number }> {
  const response = await fetch(`${API_BASE_URL}/messages/unread-count`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get unread count');
  }

  return response.json();
}
