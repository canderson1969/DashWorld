/**
 * Map view component
 *
 * Displays an interactive OpenStreetMap with footage pins, clustering, and search functionality.
 * Includes time range filtering and selected pin information display.
 *
 * @module MapView
 */

import { RefObject, MutableRefObject } from 'react';
import { Search, Clock, Info, Calendar, Play, AlertTriangle, MapPin } from 'lucide-react';
import { getAssetUrl } from '../../config/constants';
import { formatTimeTo12Hour, formatDuration, formatIncidentType } from '../../utils/timeFormat';
import { ProgressiveImage } from '../ProgressiveImage';
import { Loader } from '../shared/Loader';
import type { FootageItem } from '../../types';

interface MapViewProps {
  leafletLoaded: boolean;
  mapRef: RefObject<HTMLDivElement>;
  mapSearchQuery: string;
  setMapSearchQuery: (query: string) => void;
  mapSearchTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  searchMapLocation: (query: string) => void;
  mapLocationSuggestions: any[];
  showMapLocationSuggestions: boolean;
  setShowMapLocationSuggestions: (show: boolean) => void;
  handleSelectMapLocation: (suggestion: any) => void;
  isSearchingMapLocation: boolean;
  timeRange: '24h' | '3days' | '1week' | '2weeks' | '1month' | '3months' | 'all';
  setTimeRange: (range: '24h' | '3days' | '1week' | '2weeks' | '1month' | '3months' | 'all') => void;
  selectedPin: FootageItem | null;
  setSelectedPin: (pin: FootageItem | null) => void;
  setWarningFootage: (footage: FootageItem) => void;
  setShowContentWarningModal: (show: boolean) => void;
  setPage: (page: 'browse' | 'search' | 'upload' | 'video-detail' | 'request-form' | 'request-sent' | 'inbox' | 'conversation' | 'profile') => void;
  showHeatmap: boolean;
  setShowHeatmap: (show: boolean) => void;
  mapDarkness: number;
  setMapDarkness: (darkness: number) => void;
}

/**
 * Map view component
 *
 * Renders the interactive map with footage markers, search, and time filtering.
 *
 * @param {MapViewProps} props - Component props including map state and callbacks
 * @returns {JSX.Element} Map view with controls and selected pin info
 */
export function MapView({
  leafletLoaded,
  mapRef,
  mapSearchQuery,
  setMapSearchQuery,
  mapSearchTimeoutRef,
  searchMapLocation,
  mapLocationSuggestions,
  showMapLocationSuggestions,
  setShowMapLocationSuggestions,
  handleSelectMapLocation,
  isSearchingMapLocation,
  timeRange,
  setTimeRange,
  selectedPin,
  setSelectedPin,
  setWarningFootage,
  setShowContentWarningModal,
  setPage,
  showHeatmap,
  setShowHeatmap,
  mapDarkness,
  setMapDarkness
}: MapViewProps) {
  return (
    <div className="h-full relative">
      {/* Loading state */}
      {!leafletLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-gray-600">Loading map...</div>
        </div>
      )}

      {/* OpenStreetMap Container */}
      <div ref={mapRef} className="absolute inset-0 z-0"></div>

      {/* CSS to darken only map tiles while keeping heatmap bright */}
      {showHeatmap && mapDarkness > 0 && (
        <style>{`
          .leaflet-tile-pane {
            filter: brightness(${1 - mapDarkness});
          }
        `}</style>
      )}

      {/* Map Search Bar - Top Center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 w-96">
        <div className="relative">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search location on map..."
              value={mapSearchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setMapSearchQuery(value);

                // Clear previous timeout
                if (mapSearchTimeoutRef.current) {
                  clearTimeout(mapSearchTimeoutRef.current);
                }

                // Debounce search - only search after user stops typing
                mapSearchTimeoutRef.current = setTimeout(() => {
                  searchMapLocation(value);
                }, 500);
              }}
              onFocus={() => {
                if (mapLocationSuggestions.length > 0) {
                  setShowMapLocationSuggestions(true);
                }
              }}
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg transition-colors duration-200"
            />
          </div>

          {/* Location Suggestions Dropdown */}
          {showMapLocationSuggestions && mapLocationSuggestions.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
              {mapLocationSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectMapLocation(suggestion)}
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

          {/* Loading Indicator */}
          {isSearchingMapLocation && (
            <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Loader size={14} className="animate-spin" />
                Searching...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Time Range Selector - Right Side */}
      <div className="absolute top-4 right-4 z-20 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600 p-4 w-56">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Time Range</h3>
          <div className="group relative inline-flex ml-auto">
            <Info
              size={14}
              className="text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 cursor-help transition-colors"
            />
            {/* Tooltip positioned to the left to avoid screen edge cutoff */}
            <div className="absolute hidden group-hover:block z-[9999] right-full mr-2 top-1/2 -translate-y-1/2 w-52 p-2.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-xl whitespace-normal">
              <div className="font-semibold mb-1">Time Filter</div>
              <div className="text-gray-300">
                Control how far back to view footage. Limiting the time range keeps the map performant.
              </div>
              {/* Arrow on right side pointing to icon */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { value: '24h', label: 'Past 24 Hours' },
            { value: '3days', label: 'Past 3 Days' },
            { value: '1week', label: 'Past Week' },
            { value: '2weeks', label: 'Past 2 Weeks' },
            { value: '1month', label: 'Past Month' },
            { value: '3months', label: 'Past 3 Months' },
            { value: 'all', label: 'All Time' }
          ].map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded transition"
            >
              <input
                type="radio"
                name="timeRange"
                value={option.value}
                checked={timeRange === option.value}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className={timeRange === option.value ? 'font-medium' : ''}>{option.label}</span>
            </label>
          ))}
        </div>

        {/* Heatmap Toggle */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded transition">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(e) => setShowHeatmap(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className={showHeatmap ? 'font-medium' : ''}>Heatmap View</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-6">
            Show density heatmap instead of individual markers
          </p>

          {/* Map Darkness Slider - only visible when heatmap is enabled */}
          {showHeatmap && (
            <div className="mt-3 ml-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Map Darkness</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {Math.round(mapDarkness * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.7"
                step="0.05"
                value={mapDarkness}
                onChange={(e) => setMapDarkness(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          )}
        </div>
      </div>

      {/* Selected Pin Info */}
      {selectedPin && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-96 z-10 transition-colors duration-200">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{formatIncidentType(selectedPin.type)}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{selectedPin.location}</p>
            </div>
            <button onClick={() => setSelectedPin(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Calendar size={14} />
              <span>{selectedPin.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Clock size={14} />
              <span>{formatTimeTo12Hour(selectedPin.time)}</span>
            </div>
          </div>

          <div
            onClick={() => {
              if (selectedPin.is_graphic_content) {
                setWarningFootage(selectedPin);
                setShowContentWarningModal(true);
              } else {
                setPage('video-detail');
              }
            }}
            className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center text-white text-sm mb-3 relative overflow-hidden cursor-pointer group"
          >
            {selectedPin.thumbnail ? (
              <>
                <ProgressiveImage
                  smallSrc={getAssetUrl(selectedPin.thumbnail_url_small || selectedPin.thumbnail_url)}
                  mediumSrc={getAssetUrl(selectedPin.thumbnail_url_medium || selectedPin.thumbnail_url)}
                  largeSrc={selectedPin.thumbnail_url_large ? getAssetUrl(selectedPin.thumbnail_url_large) : undefined}
                  alt={selectedPin.type}
                  className="w-full h-full object-cover"
                  shouldBlur={selectedPin.is_graphic_content}
                />
                {selectedPin.duration && (
                  <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-semibold">
                    {formatDuration(selectedPin.duration)}
                  </div>
                )}
                {selectedPin.is_graphic_content ? (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 pointer-events-none">
                    <AlertTriangle size={32} className="text-orange-500" />
                    <p className="text-xs font-semibold">Graphic Content</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition">
                    <Play size={48} className="text-white" />
                  </div>
                )}
                {selectedPin.video_url && !selectedPin.is_graphic_content && (
                  <video
                    src={getAssetUrl(selectedPin.video_url)}
                    className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    muted
                    loop
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause();
                      e.currentTarget.currentTime = 0;
                    }}
                  />
                )}
              </>
            ) : (
              <Play size={48} className="opacity-70" />
            )}
          </div>

          <button
            onClick={() => {
              if (selectedPin.is_graphic_content) {
                setWarningFootage(selectedPin);
                setShowContentWarningModal(true);
              } else {
                setPage('video-detail');
              }
            }}
            className={`w-full ${selectedPin.is_graphic_content ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'} text-white py-2 rounded-lg transition font-semibold`}>
            {selectedPin.is_graphic_content ? 'View Warning' : 'View Footage'}
          </button>
        </div>
      )}
    </div>
  );
}
