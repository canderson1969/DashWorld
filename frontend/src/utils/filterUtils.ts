/**
 * Filtering and search utility functions
 *
 * @module filterUtils
 */

import type { FootageItem, BasicFilters, AdvancedSearchFilters } from '../types';
import { getTimeRangeCutoff, isTimeWithinRange } from './dateUtils';
import { calculateDistance } from './distanceCalculator';

/**
 * Apply basic filters to footage data
 *
 * @param {FootageItem[]} footage - Array of footage to filter
 * @param {BasicFilters} filters - Filter criteria
 * @param {boolean} isFilterApplied - Whether filters are active
 * @param {string} timeRange - Time range preset
 * @returns {FootageItem[]} Filtered footage array
 */
export function applyBasicFilters(
  footage: FootageItem[],
  filters: BasicFilters,
  isFilterApplied: boolean,
  timeRange: string
): FootageItem[] {
  let filteredFootage = footage;

  // Always apply time range filter
  const cutoffDate = getTimeRangeCutoff(timeRange as any);
  filteredFootage = filteredFootage.filter(item => item.date >= cutoffDate);

  // If no other filters applied, return after time range filter
  if (!isFilterApplied) return filteredFootage;

  // Apply additional user filters
  return filteredFootage.filter(item => {
    // Search query filter (location)
    if (filters.searchQuery && !item.location.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
      return false;
    }

    // Date range filter
    if (filters.dateFrom && item.date < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && item.date > filters.dateTo) {
      return false;
    }

    // Time of day filter (approximate)
    if (filters.timeOfDay) {
      const itemTime = item.time; // HH:MM format
      const filterTime = filters.timeOfDay; // HH:MM format
      // Check if within 1 hour of selected time
      const itemHour = parseInt(itemTime.split(':')[0]);
      const filterHour = parseInt(filterTime.split(':')[0]);
      if (Math.abs(itemHour - filterHour) > 1) {
        return false;
      }
    }

    // Incident type filter
    if (filters.incidentType && filters.incidentType !== 'all' && item.type !== filters.incidentType) {
      return false;
    }

    return true;
  });
}

/**
 * Apply advanced search filters to footage data
 *
 * @param {FootageItem[]} footage - Array of footage to filter
 * @param {AdvancedSearchFilters} searchFilters - Advanced filter criteria
 * @returns {FootageItem[]} Filtered footage array
 */
export function applyAdvancedFilters(
  footage: FootageItem[],
  searchFilters: AdvancedSearchFilters
): FootageItem[] {
  return footage.filter(item => {
    // Date range filter
    if (searchFilters.dateFrom && item.date < searchFilters.dateFrom) {
      return false;
    }
    if (searchFilters.dateTo && item.date > searchFilters.dateTo) {
      return false;
    }

    // Time range filter (+/- hours from specified time)
    if (searchFilters.timeOfDay) {
      if (!isTimeWithinRange(item.time, searchFilters.timeOfDay, searchFilters.timeRangeHours)) {
        return false;
      }
    }

    // Incident types filter (multiple selection)
    if (searchFilters.incidentTypes.length > 0 && !searchFilters.incidentTypes.includes(item.type)) {
      return false;
    }

    // Location radius filter
    if (searchFilters.locationLat !== null && searchFilters.locationLng !== null) {
      const distance = calculateDistance(
        searchFilters.locationLat,
        searchFilters.locationLng,
        item.lat,
        item.lng
      );
      if (distance > searchFilters.locationRadius) {
        return false;
      }
    }

    return true;
  });
}
