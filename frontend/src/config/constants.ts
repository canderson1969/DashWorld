/// <reference types="vite/client" />

/**
 * API configuration
 */
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  SERVER_URL: import.meta.env.VITE_SERVER_URL || 'http://localhost:5000',
  UPLOAD_TIMEOUT_MS: 300000, // 5 minutes for large video uploads
  DEFAULT_TIMEOUT_MS: 30000   // 30 seconds for other requests
} as const;

/**
 * Thumbnail generation configuration
 */
export const THUMBNAIL_CONFIG = {
  // Original large size (for detail pages)
  LARGE: {
    MAX_WIDTH: 1280,
    MAX_HEIGHT: 720,
    QUALITY: 0.85,
    SUFFIX: '_large'
  },
  // Medium size (for grid views)
  MEDIUM: {
    MAX_WIDTH: 320,
    MAX_HEIGHT: 180,
    QUALITY: 0.80,
    SUFFIX: '_medium'
  },
  // Small size (for quick preview/blur-up)
  SMALL: {
    MAX_WIDTH: 80,
    MAX_HEIGHT: 45,
    QUALITY: 0.70,
    SUFFIX: '_small'
  },
  SEEK_TIME_SECONDS: 1,
  FORMAT: 'image/jpeg' as const
} as const;

/**
 * File upload constraints
 */
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 250 * 1024 * 1024, // 250MB
  MAX_FILE_SIZE_MB: 250,
  ALLOWED_VIDEO_EXTENSIONS: ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv'],
  ALLOWED_VIDEO_TYPES: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm',
    'video/x-flv'
  ]
} as const;

/**
 * Map configuration
 */
export const MAP_CONFIG = {
  DEFAULT_CENTER: [37.7749, -122.4194] as [number, number], // San Francisco
  DEFAULT_ZOOM: 12,
  MARKER_ZOOM: 15,
  TILE_URL: '/api/tiles/{z}/{x}/{y}.png',
  ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
} as const;

/**
 * UI constants
 */
export const UI_CONSTANTS = {
  // Incident type emojis
  INCIDENT_EMOJIS: ['🚗', '🚙', '🚕', '🚐', '🚓', '🚑'] as const,

  // Date/time formats
  DATE_FORMAT: 'YYYY-MM-DD',
  TIME_FORMAT: 'HH:mm',
  DISPLAY_DATE_FORMAT: 'MMM D, YYYY',
  DISPLAY_TIME_FORMAT: 'h:mm A',

  // Incident types
  INCIDENT_TYPES: [
    { value: 'collision', label: 'Collision' },
    { value: 'near_miss', label: 'Near Miss' },
    { value: 'rear_end', label: 'Rear End' },
    { value: 'side_swipe', label: 'Side Swipe' },
    { value: 'other', label: 'Other' }
  ] as const,

  // Request reasons
  REQUEST_REASONS: [
    { value: 'involved', label: 'I was involved in the incident' },
    { value: 'witness', label: 'I witnessed the incident' },
    { value: 'representative', label: 'Legal/Insurance representative' },
    { value: 'other', label: 'Other reason' }
  ] as const
} as const;

/**
 * Privacy notice text
 */
export const PRIVACY_NOTICE = {
  UPLOAD_WARNING: 'Uploaded footage will be visible to all users. You may choose to blur license plates and faces if you wish, but this is optional.',
  REQUEST_INFO: 'Submitting a request will notify the uploader. They may contact you directly to share footage or additional details.'
} as const;
