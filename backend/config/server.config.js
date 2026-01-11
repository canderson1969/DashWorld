/**
 * Server configuration constants
 *
 * Uses environment variables with sensible defaults for local development
 */
export const SERVER_CONFIG = {
  // Server settings
  PORT: parseInt(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Directory paths
  UPLOAD_DIR: process.env.UPLOAD_DIR || '../uploads',
  THUMBNAILS_DIR: process.env.THUMBNAILS_DIR || '../uploads/thumbnails',
  DATA_DIR: process.env.DATA_DIR || './data',

  // Database files
  FOOTAGE_DB_FILE: 'footage.json',
  REQUESTS_DB_FILE: 'requests.json',
  CONVERSATIONS_DB_FILE: 'conversations.json',
  MESSAGES_DB_FILE: 'messages.json',

  // CORS settings - comma-separated list of allowed origins
  // In production, set to your frontend domain(s)
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:5173'],

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

/**
 * File upload configuration
 */
export const FILE_CONFIG = {
  // File size limits
  MAX_FILE_SIZE_BYTES: 250 * 1024 * 1024, // 250MB
  MAX_FILE_SIZE_MB: 250,

  // File naming
  VIDEO_PREFIX: 'video-',
  THUMBNAIL_PREFIX: 'thumbnail-',
  RANDOM_SUFFIX_MAX: 1E9,

  // Allowed MIME types
  ALLOWED_VIDEO_TYPES: [
    'video/mp4',
    'video/quicktime',      // .mov
    'video/x-msvideo',      // .avi
    'video/avi',            // .avi (alternative MIME)
    'video/x-matroska',     // .mkv
    'video/mkv',            // .mkv (alternative MIME)
    'video/webm',           // .webm
    'video/x-flv',          // .flv
    'video/flv'             // .flv (alternative MIME)
  ],

  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png'
  ]
};

/**
 * Validation rules
 */
export const VALIDATION_RULES = {
  // Coordinate ranges
  LATITUDE_MIN: -90,
  LATITUDE_MAX: 90,
  LONGITUDE_MIN: -180,
  LONGITUDE_MAX: 180,

  // String length limits
  LOCATION_NAME_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 1000,
  REQUESTER_NAME_MAX_LENGTH: 100,
  REQUESTER_EMAIL_MAX_LENGTH: 100,
  REQUEST_MESSAGE_MAX_LENGTH: 1000,
  MESSAGE_BODY_MAX_LENGTH: 5000,
  MESSAGE_SUBJECT_MAX_LENGTH: 200,

  // Incident types
  VALID_INCIDENT_TYPES: [
    'collision',
    'near_miss',
    'rear_end',
    'side_swipe',
    'other'
  ],

  // Request reasons
  VALID_REQUEST_REASONS: [
    'involved',
    'witness',
    'representative',
    'other'
  ]
};

/**
 * API response messages
 */
export const MESSAGES = {
  // Success messages
  FOOTAGE_UPLOADED: 'Footage uploaded successfully',
  REQUEST_SUBMITTED: 'Request submitted successfully',

  // Error messages
  NO_VIDEO_FILE: 'No video file uploaded',
  INVALID_VIDEO_TYPE: 'Only video files are allowed',
  FILE_TOO_LARGE: `File size exceeds ${FILE_CONFIG.MAX_FILE_SIZE_MB}MB limit`,
  MISSING_REQUIRED_FIELDS: 'Missing required fields',
  FOOTAGE_NOT_FOUND: 'Footage not found',
  INVALID_COORDINATES: 'Invalid coordinates',
  INVALID_INCIDENT_TYPE: 'Invalid incident type',
  INVALID_REQUEST_REASON: 'Invalid request reason',

  // Server messages
  SERVER_RUNNING: 'Dash World API is running',
  SERVER_HEALTHY: 'ok'
};
