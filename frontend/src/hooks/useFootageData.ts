/**
 * Footage data management hook
 *
 * Handles footage loading, filtering, and search functionality.
 *
 * @module useFootageData
 */

import { useState, useCallback } from 'react';
import * as api from '../api';
import type { FootageItem, BasicFilters, AdvancedSearchFilters, TimeRange } from '../types';
import { applyBasicFilters, applyAdvancedFilters } from '../utils/filterUtils';

const UI_CONSTANTS = {
  INCIDENT_EMOJIS: ['🚗', '⚠️', '💥', '🚙', '🚕', '🚐', '🚛', '🏍️']
};

interface UseFootageDataReturn {
  footageData: FootageItem[];
  visibleFootage: FootageItem[];
  filters: BasicFilters;
  timeRange: TimeRange;
  isFilterApplied: boolean;
  searchFilters: AdvancedSearchFilters;
  searchResults: FootageItem[];
  loadFootage: () => Promise<void>;
  setVisibleFootage: (footage: FootageItem[]) => void;
  setTimeRange: (range: TimeRange) => void;
  applyFilters: (footage: FootageItem[]) => FootageItem[];
  executeSearch: () => void;
  clearSearchFilters: () => void;
  setSearchFilters: React.Dispatch<React.SetStateAction<AdvancedSearchFilters>>;
}

/**
 * Hook for managing footage data and filters
 *
 * @param {(message: string, type?: 'success' | 'error' | 'info') => void} showToast - Toast notification function
 * @returns {UseFootageDataReturn} Footage data state and handlers
 */
export function useFootageData(
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
): UseFootageDataReturn {
  const [footageData, setFootageData] = useState<FootageItem[]>([]);
  const [visibleFootage, setVisibleFootage] = useState<FootageItem[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('2weeks');

  const [filters] = useState<BasicFilters>({
    dateFrom: '',
    dateTo: '',
    timeOfDay: '',
    incidentType: '',
    searchQuery: ''
  });

  const [isFilterApplied] = useState(false);

  const [searchFilters, setSearchFilters] = useState<AdvancedSearchFilters>({
    dateFrom: '',
    dateTo: '',
    timeOfDay: '',
    timeRangeHours: 2,
    incidentTypes: [],
    locationQuery: '',
    locationRadius: 10,
    locationLat: null,
    locationLng: null
  });

  const [searchResults, setSearchResults] = useState<FootageItem[]>([]);

  /**
   * Load all footage from API
   */
  const loadFootage = useCallback(async () => {
    try {
      const footage = await api.getAllFootage();

      // Transform API data to component format
      const transformedData = footage.map((item, index) => ({
        id: item.id,
        user_id: (item as any).user_id,
        lat: item.lat,
        lng: item.lng,
        location: item.location_name,
        date: item.incident_date,
        time: item.incident_time,
        type: item.incident_type,
        emoji: UI_CONSTANTS.INCIDENT_EMOJIS[index % UI_CONSTANTS.INCIDENT_EMOJIS.length],
        thumbnail: item.thumbnail,
        thumbnail_small: (item as any).thumbnail_small,
        thumbnail_medium: (item as any).thumbnail_medium,
        thumbnail_large: (item as any).thumbnail_large,
        description: item.description,
        filename: item.filename,
        filename_compressed: (item as any).filename_compressed,
        duration: item.duration,
        is_graphic_content: (item as any).is_graphic_content || false,
        content_warnings: (item as any).content_warnings || null
      }));

      setFootageData(transformedData);
      setVisibleFootage(transformedData);
    } catch (error) {
      showToast('Failed to load footage. Please try again.', 'error');
    }
  }, [showToast]);

  /**
   * Apply filters to footage
   */
  const applyFilters = useCallback((footage: FootageItem[]): FootageItem[] => {
    return applyBasicFilters(footage, filters, isFilterApplied, timeRange);
  }, [filters, isFilterApplied, timeRange]);

  /**
   * Execute advanced search
   */
  const executeSearch = useCallback(() => {
    const results = applyAdvancedFilters(footageData, searchFilters);
    setSearchResults(results);
  }, [footageData, searchFilters]);

  /**
   * Clear all search filters
   */
  const clearSearchFilters = useCallback(() => {
    setSearchFilters({
      dateFrom: '',
      dateTo: '',
      timeOfDay: '',
      timeRangeHours: 2,
      incidentTypes: [],
      locationQuery: '',
      locationRadius: 10,
      locationLat: null,
      locationLng: null
    });
    setSearchResults([]);
  }, []);

  return {
    footageData,
    visibleFootage,
    filters,
    timeRange,
    isFilterApplied,
    searchFilters,
    searchResults,
    loadFootage,
    setVisibleFootage,
    setTimeRange,
    applyFilters,
    executeSearch,
    clearSearchFilters,
    setSearchFilters
  };
}
