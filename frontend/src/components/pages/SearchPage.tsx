import { useState, useRef } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Filter, Search, Play, AlertTriangle } from 'lucide-react';
import { API_CONFIG } from '../../config/constants';
import { formatTimeTo12Hour, formatDuration, formatIncidentType } from '../../utils/timeFormat';
import { ProgressiveImage } from '../ProgressiveImage';
import { Loader } from '../shared/Loader';
import type { FootageItem } from '../../types';

interface SearchFilters {
  dateFrom: string;
  dateTo: string;
  timeOfDay: string;
  timeRangeHours: number;
  incidentTypes: string[];
  locationQuery: string;
  locationRadius: number;
  locationLat: number | null;
  locationLng: number | null;
}

interface SearchPageProps {
  footageData: FootageItem[];
  onBack: () => void;
  onSelectFootage: (footage: FootageItem) => void;
  onShowContentWarning: (footage: FootageItem) => void;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 *
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Advanced search page for finding footage with comprehensive filters
 *
 * @param {SearchPageProps} props - Component props
 * @returns {JSX.Element} The search page component
 */
export function SearchPage({ footageData, onBack, onSelectFootage, onShowContentWarning }: SearchPageProps) {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
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
  const [isSearching, setIsSearching] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const locationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Search for location suggestions using Nominatim OpenStreetMap API
   *
   * @param {string} query - The search query
   */
  const searchLocation = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    setIsSearchingLocation(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        throw new Error('Location search failed');
      }

      const results = await response.json();
      setLocationSuggestions(results);
      setShowLocationSuggestions(results.length > 0);
    } catch (error) {
      console.error('Location search error:', error);
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  /**
   * Handle selecting a location suggestion
   *
   * @param {any} suggestion - The selected Nominatim search result
   */
  const handleSelectLocation = (suggestion: any) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);

    setSearchFilters(prev => ({
      ...prev,
      locationQuery: suggestion.display_name,
      locationLat: lat,
      locationLng: lng
    }));

    setLocationSuggestions([]);
    setShowLocationSuggestions(false);
  };

  /**
   * Apply advanced search filters to footage data
   *
   * @param {FootageItem[]} footage - Array of footage to filter
   * @returns {FootageItem[]} Filtered footage array
   */
  const applyAdvancedSearchFilters = (footage: FootageItem[]): FootageItem[] => {
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
        const itemHour = parseInt(item.time.split(':')[0]);
        const itemMinute = parseInt(item.time.split(':')[1]);
        const filterHour = parseInt(searchFilters.timeOfDay.split(':')[0]);
        const filterMinute = parseInt(searchFilters.timeOfDay.split(':')[1]);

        const itemTotalMinutes = itemHour * 60 + itemMinute;
        const filterTotalMinutes = filterHour * 60 + filterMinute;
        const rangeMinutes = searchFilters.timeRangeHours * 60;

        const minuteDiff = Math.abs(itemTotalMinutes - filterTotalMinutes);
        const minuteDiffWrapped = Math.min(minuteDiff, 1440 - minuteDiff);

        if (minuteDiffWrapped > rangeMinutes) {
          return false;
        }
      }

      // Incident types filter
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
  };

  /**
   * Execute search with current filters
   */
  const executeSearch = () => {
    setIsSearching(true);
    const results = applyAdvancedSearchFilters(footageData);
    setSearchResults(results);
    setIsSearching(false);
  };

  /**
   * Clear all search filters
   */
  const clearSearchFilters = () => {
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
  };

  /**
   * Handle footage card click - show warning if graphic, otherwise select
   *
   * @param {FootageItem} footage - The clicked footage
   */
  const handleFootageClick = (footage: FootageItem) => {
    if (footage.is_graphic_content) {
      onShowContentWarning(footage);
    } else {
      onSelectFootage(footage);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Browse
          </button>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Advanced Search</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Find footage with comprehensive filters</p>
        </div>

        {/* Search Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date Range Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <Calendar size={16} />
                Date Range
              </label>
              <div className="space-y-2">
                <input
                  type="date"
                  value={searchFilters.dateFrom}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={searchFilters.dateTo}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Time Range Filter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <Clock size={16} />
                Time of Day (+/- hours)
              </label>
              <div className="space-y-2">
                <input
                  type="time"
                  value={searchFilters.timeOfDay}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, timeOfDay: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 dark:text-gray-300">± Hours:</label>
                  <input
                    type="number"
                    min="0"
                    max="12"
                    value={searchFilters.timeRangeHours}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, timeRangeHours: parseInt(e.target.value) || 0 }))}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Location Filter */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <MapPin size={16} />
                Location (within radius)
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={searchFilters.locationQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSearchFilters(prev => ({ ...prev, locationQuery: value }));

                      if (locationTimeoutRef.current) {
                        clearTimeout(locationTimeoutRef.current);
                      }

                      locationTimeoutRef.current = setTimeout(() => {
                        searchLocation(value);
                      }, 500);
                    }}
                    onFocus={() => {
                      if (locationSuggestions.length > 0) {
                        setShowLocationSuggestions(true);
                      }
                    }}
                    placeholder="Enter address, intersection, or landmark..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Location Suggestions */}
                  {showLocationSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto z-10">
                      {locationSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelectLocation(suggestion)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        >
                          <div className="flex items-start gap-2">
                            <MapPin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                                {suggestion.display_name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {suggestion.type}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {isSearchingLocation && (
                    <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <Loader size={14} className="animate-spin" />
                        Searching for location...
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 dark:text-gray-300">Radius (miles):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={searchFilters.locationRadius}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, locationRadius: parseInt(e.target.value) || 1 }))}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Incident Types */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <Filter size={16} />
                Incident Types (select multiple)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { value: 'collision', label: 'Collision', emoji: '💥' },
                  { value: 'near_miss', label: 'Near Miss', emoji: '⚠️' },
                  { value: 'rear_end', label: 'Rear End', emoji: '🚗' },
                  { value: 'side_swipe', label: 'Side Swipe', emoji: '↔️' },
                  { value: 'other', label: 'Other', emoji: '📹' }
                ].map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition ${
                      searchFilters.incidentTypes.includes(type.value)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={searchFilters.incidentTypes.includes(type.value)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSearchFilters(prev => ({
                          ...prev,
                          incidentTypes: checked
                            ? [...prev.incidentTypes, type.value]
                            : prev.incidentTypes.filter(t => t !== type.value)
                        }));
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-lg">{type.emoji}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={executeSearch}
              disabled={isSearching}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Search
                </>
              )}
            </button>
            <button
              onClick={clearSearchFilters}
              className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-semibold"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Search Results ({searchResults.length} found)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map(footage => (
                <div key={footage.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
                  <div
                    onClick={() => handleFootageClick(footage)}
                    className="bg-gray-800 aspect-video flex items-center justify-center text-white relative overflow-hidden cursor-pointer group"
                  >
                    {footage.thumbnail ? (
                      <>
                        <ProgressiveImage
                          smallSrc={`${API_CONFIG.SERVER_URL}/uploads/thumbnails/${footage.thumbnail_small || footage.thumbnail}`}
                          mediumSrc={`${API_CONFIG.SERVER_URL}/uploads/thumbnails/${footage.thumbnail_medium || footage.thumbnail}`}
                          largeSrc={footage.thumbnail_large ? `${API_CONFIG.SERVER_URL}/uploads/thumbnails/${footage.thumbnail_large}` : undefined}
                          alt={footage.type}
                          className="w-full h-full object-cover"
                          shouldBlur={footage.is_graphic_content}
                        />
                        {footage.duration && (
                          <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-semibold z-10">
                            {formatDuration(footage.duration)}
                          </div>
                        )}
                        {footage.is_graphic_content && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 pointer-events-none">
                            <AlertTriangle size={48} className="text-orange-500" />
                            <div className="text-center px-4">
                              <p className="font-bold text-sm">Graphic Content Warning</p>
                              <p className="text-xs text-gray-300 mt-1">Click to view content warning</p>
                            </div>
                          </div>
                        )}
                        {!footage.is_graphic_content && (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition">
                            <Play size={48} className="text-white" />
                          </div>
                        )}
                      </>
                    ) : (
                      <Play size={48} className="opacity-70" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-1">{formatIncidentType(footage.type)}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{footage.location}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {footage.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatTimeTo12Hour(footage.time)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleFootageClick(footage)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition font-semibold text-sm"
                    >
                      {footage.is_graphic_content ? 'View Content Warning' : 'View Details'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
