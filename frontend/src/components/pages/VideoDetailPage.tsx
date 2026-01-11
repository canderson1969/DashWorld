/**
 * Video detail page component
 *
 * Displays full video player with metadata, description editing, content warnings,
 * and nearby footage sidebar in a YouTube-style layout.
 *
 * @module VideoDetailPage
 */

import { useState, useEffect, Suspense, lazy, useMemo, useRef } from 'react';
import {
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  Play,
  FileText,
  Trash2,
  Share2,
  AlertTriangle,
  Download
} from 'lucide-react';
import type { FootageItem } from '../../types';
import type { User } from '../../api';
import * as api from '../../api';
import { API_CONFIG, getAssetUrl } from '../../config/constants';
import { formatIncidentType, formatTimeTo12Hour, formatDuration } from '../../utils/timeFormat';
import { calculateDistance } from '../../utils/distanceCalculator';
import { ProgressiveImage } from '../ProgressiveImage';

// Lazy load heavy components
const AdvancedVideoPlayer = lazy(() => import('../AdvancedVideoPlayer').then(module => ({ default: module.AdvancedVideoPlayer })));

interface VideoDetailPageProps {
  footage: FootageItem | null;
  allFootage: FootageItem[];
  onRequestFootage: () => void;
  onDelete?: (footageId: number) => void;
  onUpdate?: () => void;
  onShare?: (footage: FootageItem) => void;
  onSelectNearbyFootage?: (footage: FootageItem) => void;
  currentUser: User | null;
  authToken: string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  acknowledgedFootageIds: Set<number>;
  onAcknowledgeWarning: (footageId: number) => void;
}

/**
 * Loader component for loading states
 */
function Loader({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`inline-block animate-spin rounded-full border-4 border-solid border-current border-r-transparent ${className}`} style={{ width: size, height: size }} />
  );
}

/**
 * Sidebar component showing footage near the current video
 */
interface NearbyFootageSidebarProps {
  currentFootage: FootageItem;
  allFootage: FootageItem[];
  onSelectFootage: (footage: FootageItem) => void;
}

function NearbyFootageSidebar({ currentFootage, allFootage, onSelectFootage }: NearbyFootageSidebarProps) {
  // Memoize the nearby footage calculation to prevent unnecessary recalculations
  // Create a stable key from footage IDs to detect actual data changes
  const footageKey = useMemo(() => allFootage.map(f => f.id).join(','), [allFootage]);

  const nearbyFootage = useMemo(() => {
    return allFootage
      .filter(f => f.id !== currentFootage.id)
      .map(f => ({
        ...f,
        distance: calculateDistance(currentFootage.lat, currentFootage.lng, f.lat, f.lng)
      }))
      .filter(f => f.distance <= 10)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);
  }, [currentFootage.id, currentFootage.lat, currentFootage.lng, footageKey]); // Use stable key instead of array reference

  return (
    <aside className="w-[420px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto hidden lg:block">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">
          Nearby Footage
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Within 10 miles of this location
        </p>
      </div>

      <div className="p-3 space-y-3">
        {nearbyFootage.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            No nearby footage found
          </div>
        ) : (
          nearbyFootage.map(footage => (
            <div
              key={footage.id}
              onClick={() => onSelectFootage(footage)}
              className="flex gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg p-2 transition"
            >
              <div className="relative w-40 h-24 flex-shrink-0 bg-gray-800 rounded overflow-hidden">
                {footage.thumbnail ? (
                  <>
                    <ProgressiveImage
                      smallSrc={getAssetUrl(footage.thumbnail_url_small || footage.thumbnail_url)}
                      mediumSrc={getAssetUrl(footage.thumbnail_url_medium || footage.thumbnail_url)}
                      alt={footage.type}
                      className="w-full h-full object-cover"
                      shouldBlur={footage.is_graphic_content}
                    />
                    {footage.duration && (
                      <div className="absolute bottom-1 right-1 bg-black/80 text-white px-1.5 py-0.5 rounded text-xs font-semibold">
                        {formatDuration(footage.duration)}
                      </div>
                    )}
                    {footage.is_graphic_content && (
                      <div className="absolute top-1 left-1 bg-orange-600 text-white px-1.5 py-0.5 rounded text-xs font-semibold">
                        <AlertTriangle size={12} className="inline" />
                      </div>
                    )}
                  </>
                ) : (
                  <Play size={32} className="absolute inset-0 m-auto text-white opacity-70" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 mb-1">
                  {formatIncidentType(footage.type)}
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{footage.location}</p>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500 mt-1">
                  <span>{footage.date}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {footage.distance.toFixed(1)} mi
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

/**
 * Video detail page component (YouTube-style layout)
 */
export function VideoDetailPage({
  footage,
  allFootage,
  onRequestFootage,
  onDelete,
  onUpdate,
  onShare,
  onSelectNearbyFootage,
  currentUser,
  authToken,
  showToast,
  acknowledgedFootageIds,
  onAcknowledgeWarning
}: VideoDetailPageProps) {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [processingQualities, setProcessingQualities] = useState<string[]>([]);
  const [qualityState, setQualityState] = useState<{
    currentQuality: string;
    availableQualities: string[];
    switchQuality: (quality: string) => void;
    processingQualities: string[];
  } | null>(null);
  const [localQualitySources, setLocalQualitySources] = useState<{
    '240p'?: string;
    '360p'?: string;
    '480p'?: string;
    '720p'?: string;
    '1080p'?: string;
  }>({});

  // Store onUpdate callback in ref to avoid triggering useEffect when it changes
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Initialize local quality sources from footage prop
  useEffect(() => {
    if (footage) {
      setLocalQualitySources({
        '240p': footage.video_url_240p ? getAssetUrl(footage.video_url_240p) : undefined,
        '360p': footage.video_url_360p ? getAssetUrl(footage.video_url_360p) : undefined,
        '480p': footage.video_url_480p ? getAssetUrl(footage.video_url_480p) : undefined,
        '720p': footage.video_url_720p ? getAssetUrl(footage.video_url_720p) : undefined,
        '1080p': footage.video_url_1080p ? getAssetUrl(footage.video_url_1080p) : undefined,
      });
    }
  }, [footage?.id]);

  if (!footage) return null;

  /**
   * Poll for processing status to update available qualities in real-time
   */
  useEffect(() => {
    if (!footage) return;

    let interval: number | null = null;
    let pollCount = 0;
    const MAX_POLLS = 100; // Stop after 5 minutes (100 * 3 seconds = 300 seconds)
    let shouldContinuePolling = true;

    const checkProcessingStatus = async () => {
      if (!footage || !shouldContinuePolling) return;

      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/footage/${footage.id}`);
        if (!response.ok) {
          shouldContinuePolling = false;
          if (interval !== null) clearInterval(interval);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          shouldContinuePolling = false;
          if (interval !== null) clearInterval(interval);
          return;
        }

        const updatedFootage = await response.json();

        // Determine which qualities are still processing
        const allQualities = ['240p', '360p', '480p', '720p', '1080p'];
        const availableQualities: string[] = [];

        allQualities.forEach(quality => {
          if (updatedFootage[`filename_${quality}`]) {
            availableQualities.push(quality);
          }
        });

        const processingQualitiesList = allQualities.filter(q => !availableQualities.includes(q));
        setProcessingQualities(processingQualitiesList);

        // Update local quality sources with newly available qualities
        setLocalQualitySources({
          '240p': updatedFootage.video_url_240p ? getAssetUrl(updatedFootage.video_url_240p) : undefined,
          '360p': updatedFootage.video_url_360p ? getAssetUrl(updatedFootage.video_url_360p) : undefined,
          '480p': updatedFootage.video_url_480p ? getAssetUrl(updatedFootage.video_url_480p) : undefined,
          '720p': updatedFootage.video_url_720p ? getAssetUrl(updatedFootage.video_url_720p) : undefined,
          '1080p': updatedFootage.video_url_1080p ? getAssetUrl(updatedFootage.video_url_1080p) : undefined,
        });

        // If all qualities are complete, stop polling and update footage data
        if (processingQualitiesList.length === 0) {
          shouldContinuePolling = false;
          if (interval !== null) {
            clearInterval(interval);
            interval = null;
          }
          // Call onUpdate only once when processing completes (using ref to get latest callback)
          if (onUpdateRef.current) {
            onUpdateRef.current();
          }
          return;
        }

        // Stop polling after max attempts
        pollCount++;
        if (pollCount >= MAX_POLLS) {
          shouldContinuePolling = false;
          if (interval !== null) {
            clearInterval(interval);
            interval = null;
          }
          console.warn('Max polling attempts reached for footage processing');
        }
      } catch (error) {
        console.error('Failed to check processing status:', error);
        shouldContinuePolling = false;
        if (interval !== null) {
          clearInterval(interval);
          interval = null;
        }
      }
    };

    // Initial check
    checkProcessingStatus();

    // Only start polling interval if needed
    interval = window.setInterval(checkProcessingStatus, 3000);

    return () => {
      shouldContinuePolling = false;
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [footage?.id]); // Remove onUpdate from dependencies to prevent infinite loop

  const hasAcknowledgedWarning = acknowledgedFootageIds.has(footage.id);

  const isOwner = currentUser && footage.user_id === currentUser.id;
  const isModerator = currentUser && (currentUser.role === 'moderator' || currentUser.role === 'admin');
  const canEdit = isModerator;
  const canDelete = isOwner || isModerator;

  const handleEditClick = () => {
    setEditedDescription(footage.description || '');
    setIsEditingDescription(true);
  };

  const handleSaveDescription = async () => {
    if (!authToken || !footage) return;

    setIsSaving(true);
    try {
      await api.updateFootageDescription(footage.id, editedDescription, authToken);
      setIsEditingDescription(false);
      if (onUpdate) await onUpdate();
      showToast('Description updated successfully!', 'success');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update description';
      showToast('Update failed: ' + errorMessage, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Video and Info Container - aligned together, YouTube-style spacing */}
        <div className="pl-6 pr-6 pt-4">
          {/* Video Player - full width for better use of space */}
          <div className="w-full">
            {footage.is_graphic_content && !hasAcknowledgedWarning ? (
                <div className="w-full aspect-video relative bg-gray-900 rounded-xl overflow-hidden">
                  {footage.thumbnail_url && (
                    <img
                      src={getAssetUrl(footage.thumbnail_url)}
                      alt="Video thumbnail"
                      className="w-full h-full object-cover blur-2xl"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-6 p-8">
                    <AlertTriangle size={64} className="text-orange-500" />
                    <div className="text-center max-w-lg">
                      <h3 className="text-2xl font-bold text-white mb-3">Graphic Content Warning</h3>
                      <p className="text-gray-200 mb-4">
                        This footage has been marked as containing graphic content that may be disturbing to some viewers.
                      </p>

                      {footage.content_warnings && footage.content_warnings.length > 0 && (
                        <div className="bg-orange-900/40 border border-orange-500/50 rounded-lg p-4 mb-6">
                          <p className="font-semibold text-sm text-orange-200 mb-2">This footage may contain:</p>
                          <ul className="space-y-1.5 text-left">
                            {footage.content_warnings.map((warning) => {
                              const warningLabels: { [key: string]: string } = {
                                'accident_injury': 'Accident/Injury Related Content',
                                'violence': 'Violence or Altercation',
                                'vulnerable': 'Vulnerable Individuals',
                                'audio_visual': 'Distressing Audio/Visual Content',
                                'other': 'Other Graphic Content'
                              };
                              return (
                                <li key={warning} className="flex items-start gap-2 text-sm text-orange-100">
                                  <span className="text-orange-400 mt-0.5">•</span>
                                  <span>{warningLabels[warning] || warning}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      <p className="text-sm text-gray-300 mb-6">
                        By continuing, you acknowledge that you understand this footage may contain graphic content.
                      </p>

                      <button
                        onClick={() => onAcknowledgeWarning(footage.id)}
                        className="px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition font-semibold text-lg"
                      >
                        I Understand, Show Video
                      </button>
                    </div>
                  </div>
                </div>
              ) : footage.video_url ? (
                <Suspense fallback={
                  <div className="w-full aspect-video flex items-center justify-center bg-gray-900 rounded-xl">
                    <div className="text-center">
                      <Loader size={48} className="mx-auto mb-4 text-blue-500" />
                      <p className="text-gray-400">Loading video player...</p>
                    </div>
                  </div>
                }>
                  <AdvancedVideoPlayer
                    src={getAssetUrl(
                      footage.video_url_720p ||
                      footage.video_url_480p ||
                      footage.video_url_1080p ||
                      footage.video_url_360p ||
                      footage.video_url_240p ||
                      footage.video_url
                    )}
                    autoplay={false}
                    qualitySources={localQualitySources}
                    processingQualities={processingQualities}
                    hideQualitySelector={true}
                    onQualityStateReady={setQualityState}
                  />
                </Suspense>
              ) : (
                <div className="w-full h-full flex items-center justify-center aspect-video bg-gray-900 rounded-xl">
                  <Play size={64} className="text-white opacity-70" />
                </div>
              )}
          </div>

          {/* Video Info - Compact layout to maximize video space */}
          {/* Row 1: Title + Quality Selector */}
          <div className="pt-3 pb-2 flex items-center justify-between gap-4">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {formatIncidentType(footage.type)}
            </h1>
            {qualityState && qualityState.availableQualities.length > 1 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Quality</span>
                <div className="flex gap-1.5">
                  {qualityState.availableQualities.map((quality) => {
                    const isProcessing = qualityState.processingQualities.includes(quality);
                    const isDisabled = quality !== 'auto' && isProcessing;
                    return (
                      <button
                        key={quality}
                        onClick={() => !isDisabled && qualityState.switchQuality(quality)}
                        disabled={isDisabled}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                          qualityState.currentQuality === quality
                            ? 'bg-blue-600 text-white'
                            : isDisabled
                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {quality === 'auto' ? 'Auto' : quality}
                        {isProcessing && (
                          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Row 2: Metadata + Action Buttons */}
          <div className="pb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {footage.date}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {formatTimeTo12Hour(footage.time)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin size={14} />
                {footage.location}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => footage && onShare && onShare(footage)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-xs font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5 transition"
              >
                <Share2 size={14} />
                Share
              </button>
              <a
                href={getAssetUrl(footage.video_url)}
                download
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-xs font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1.5 transition"
              >
                <Download size={14} />
                Download
              </a>
              {canDelete && (
                <button
                  onClick={() => onDelete && onDelete(footage.id)}
                  className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-full text-xs font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5 transition"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Description Section */}
          <div className="py-4 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 mb-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                {/* Upload Date */}
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Uploaded {footage.created_at ? new Date(footage.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'Unknown date'}
                </div>
                {isEditingDescription ? (
                  <div className="space-y-3">
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      placeholder="Enter description..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveDescription}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white rounded-lg transition text-sm font-medium flex items-center gap-2"
                      >
                        {isSaving && <Loader size={16} />}
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setIsEditingDescription(false)}
                        disabled={isSaving}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap ${!isDescriptionExpanded && 'line-clamp-2'}`}>
                      {footage.description || <span className="italic text-gray-400 dark:text-gray-500">No description provided.</span>}
                    </p>
                    <button
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-2 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      {isDescriptionExpanded ? 'Show less' : '...more'}
                    </button>

                    {/* Mini-map when expanded */}
                    {isDescriptionExpanded && (
                      <div className="mt-4 w-72 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="relative aspect-square bg-gray-200 dark:bg-gray-700">
                          <iframe
                            title="Location Map"
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            scrolling="no"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${footage.lng - 0.008}%2C${footage.lat - 0.008}%2C${footage.lng + 0.008}%2C${footage.lat + 0.008}&layer=mapnik&marker=${footage.lat}%2C${footage.lng}`}
                            style={{ border: 0 }}
                          />
                        </div>
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <MapPin size={12} />
                          <span className="truncate">{footage.location}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {canEdit && !isEditingDescription && (
                <button
                  onClick={handleEditClick}
                  className="ml-4 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Contact Uploader Section */}
          {!canDelete && (
            <div className="py-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Need More Information?</h3>
                    <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                      If you were involved in this incident or need additional details, you can request to contact the uploader.
                    </p>
                    <button
                      onClick={onRequestFootage}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm flex items-center gap-2"
                    >
                      <FileText size={16} />
                      Contact Uploader
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nearby Footage Sidebar */}
      <NearbyFootageSidebar
        currentFootage={footage}
        allFootage={allFootage}
        onSelectFootage={(selectedFootage) => {
          if (onSelectNearbyFootage) {
            onSelectNearbyFootage(selectedFootage);
          }
        }}
      />
    </div>
  );
}
