/**
 * Footage-related type definitions
 *
 * This module contains all types related to footage items,
 * including metadata, thumbnails, and content warnings.
 */

/**
 * Represents a single footage item in the application
 */
export interface FootageItem {
  id: number;
  user_id?: number;
  lat: number;
  lng: number;
  location: string;
  date: string;
  time: string;
  type: string;
  emoji: string;
  thumbnail: string | null;
  thumbnail_small?: string | null;
  thumbnail_medium?: string | null;
  thumbnail_large?: string | null;
  description: string | null;
  filename: string;
  filename_compressed?: string | null;
  filename_240p?: string | null;
  filename_360p?: string | null;
  filename_480p?: string | null;
  filename_720p?: string | null;
  filename_1080p?: string | null;
  duration: number | null;
  is_graphic_content?: boolean;
  content_warnings?: string[] | null;
  created_at?: string;
}

/**
 * Footage metadata for upload/edit operations
 */
export interface FootageMetadata {
  location: string;
  lat: number;
  lng: number;
  incidentDate: string;
  incidentTime: string;
  incidentType: string;
  description?: string;
  isGraphicContent?: boolean;
  contentWarnings?: string[];
}

/**
 * Incident type options
 */
export type IncidentType = 'collision' | 'near_miss' | 'rear_end' | 'side_swipe' | 'other';

/**
 * Content warning types
 */
export type ContentWarningType = 'accident_injury' | 'violence' | 'vulnerable' | 'audio_visual' | 'other';

/**
 * Footage with calculated distance (for nearby footage)
 */
export interface FootageWithDistance extends FootageItem {
  distance: number;
}
