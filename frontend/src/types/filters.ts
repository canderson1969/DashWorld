/**
 * Filter and search related type definitions
 *
 * This module contains all types related to filtering and searching footage.
 */

/**
 * Basic filter state for browse page sidebar
 */
export interface BasicFilters {
  dateFrom: string;
  dateTo: string;
  timeOfDay: string;
  incidentType: string;
  searchQuery: string;
}

/**
 * Advanced search filters for search page
 */
export interface AdvancedSearchFilters {
  dateFrom: string;
  dateTo: string;
  timeOfDay: string;
  timeRangeHours: number; // +/- hours from timeOfDay
  incidentTypes: string[]; // Multiple selection
  locationQuery: string;
  locationRadius: number; // miles
  locationLat: number | null;
  locationLng: number | null;
}

/**
 * Time range presets
 */
export type TimeRange = '24h' | '3days' | '1week' | '2weeks' | '1month' | '3months' | 'all';

/**
 * Request form data for contacting uploader
 */
export interface RequestFormData {
  name: string;
  reason: string;
  message: string;
}
