/**
 * Processing page component
 *
 * Displays upload progress and compression status after footage upload.
 * Polls backend for processing status and enables viewing once first quality is ready.
 */

import { useEffect, useState, useRef } from 'react';
import { Check, Clock, Loader, MapPin, Calendar, AlertCircle } from 'lucide-react';
import { API_CONFIG } from '../../config/constants';
import { ProgressiveImage } from '../ProgressiveImage';
import { formatIncidentType, formatTimeTo12Hour } from '../../utils/timeFormat';
import type { Footage } from '../../api';

interface ProcessingPageProps {
  footageId: number;
  thumbnail: string;
  onViewVideo: () => void;
}

interface ProcessingStatus {
  isComplete: boolean;
  availableQualities: string[];
  processingQualities: string[];
  pendingQualities: string[];
  canView: boolean;
}

interface EncodingProgress {
  [quality: string]: {
    progress: number;
    status: string;
  };
}

export function ProcessingPage({
  footageId,
  thumbnail,
  onViewVideo
}: ProcessingPageProps) {
  const [status, setStatus] = useState<ProcessingStatus>({
    isComplete: false,
    availableQualities: [],
    processingQualities: [],
    pendingQualities: ['240p', '360p', '480p', '720p', '1080p'],
    canView: false
  });
  const [encodingProgress, setEncodingProgress] = useState<EncodingProgress>({});
  const pollingIntervalRef = useRef<number | null>(null);
  const [footageData, setFootageData] = useState<Footage | null>(null);

  /**
   * Fetch processing status from backend
   */
  const checkProcessingStatus = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/footage/${footageId}`);

      // Check if response is OK
      if (!response.ok) {
        console.error('Failed to fetch footage:', response.status, response.statusText);
        return;
      }

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Response is not JSON:', contentType);
        return;
      }

      const footage = await response.json();

      // Store footage data for metadata display
      setFootageData(footage);

      const availableQualities: string[] = [];
      const allQualities = ['240p', '360p', '480p', '720p', '1080p'];

      allQualities.forEach(quality => {
        if (footage[`filename_${quality}`]) {
          availableQualities.push(quality);
        }
      });

      const isComplete = availableQualities.length === allQualities.length;
      const canView = availableQualities.length >= 1;

      // Determine processing and pending based on encoding progress
      const processingQualities: string[] = [];
      const pendingQualities: string[] = [];

      allQualities.forEach(quality => {
        if (!availableQualities.includes(quality)) {
          // Check if this quality is currently being processed
          const progressData = encodingProgress[quality];
          if (progressData && progressData.status === 'processing') {
            processingQualities.push(quality);
          } else if (!progressData || progressData.status !== 'completed') {
            pendingQualities.push(quality);
          }
        }
      });

      setStatus({
        isComplete,
        availableQualities,
        processingQualities,
        pendingQualities,
        canView
      });

      // Stop polling when all qualities are ready
      if (isComplete && pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    } catch (error) {
      console.error('Failed to check processing status:', error);
    }
  };

  /**
   * Fetch encoding progress from backend
   */
  const checkEncodingProgress = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/footage/${footageId}/encoding-progress`);

      if (!response.ok) {
        return;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return;
      }

      const progress = await response.json();
      setEncodingProgress(progress);
    } catch (error) {
      console.error('Failed to check encoding progress:', error);
    }
  };

  /**
   * Start polling for status updates
   */
  useEffect(() => {
    // Initial checks
    checkProcessingStatus();
    checkEncodingProgress();

    // Poll every 2 seconds for both status and encoding progress
    const interval = window.setInterval(() => {
      checkProcessingStatus();
      checkEncodingProgress();
    }, 2000);
    pollingIntervalRef.current = interval;

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [footageId]);

  const getQualityStatus = (quality: string): 'complete' | 'processing' | 'pending' => {
    // Check encoding progress data first for real-time status
    const progressData = encodingProgress[quality];

    if (progressData) {
      if (progressData.status === 'completed' || progressData.progress === 100) {
        return 'complete';
      }
      if (progressData.status === 'processing' && progressData.progress > 0) {
        return 'processing';
      }
    }

    // Fall back to database status
    if (status.availableQualities.includes(quality)) return 'complete';

    return 'pending';
  };

  const qualities = ['240p', '360p', '480p', '720p', '1080p'];

  // Calculate overall progress including partial completion
  const calculateOverallProgress = (): number => {
    let totalProgress = 0;
    const progressPerQuality = 100 / qualities.length; // Each quality is worth 20%

    qualities.forEach(quality => {
      if (status.availableQualities.includes(quality)) {
        // Quality is complete
        totalProgress += progressPerQuality;
      } else {
        // Check if quality is being processed
        const progressData = encodingProgress[quality];
        if (progressData && progressData.progress > 0) {
          // Add partial progress for this quality
          totalProgress += (progressPerQuality * progressData.progress) / 100;
        }
      }
    });

    return Math.round(totalProgress);
  };

  const progressPercentage = calculateOverallProgress();

  return (
    <div className="h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="h-full max-w-7xl mx-auto p-4 lg:p-6">
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Left Column - Processing Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 lg:p-6 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="text-center mb-4 flex-shrink-0">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
                {status.isComplete ? (
                  <Check size={24} className="text-blue-600 dark:text-blue-400" />
                ) : (
                  <Loader size={24} className="text-blue-600 dark:text-blue-400 animate-spin" />
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {status.isComplete ? 'Processing Complete!' : 'Processing Your Video...'}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {status.isComplete
                  ? 'Your footage is ready to view in all quality options.'
                  : 'We\'re generating multiple quality versions for optimal playback.'}
              </p>
            </div>

            {/* Overall Progress Bar */}
            {!status.isComplete && (
              <div className="mb-4 flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Overall Progress
                  </span>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {progressPercentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {status.availableQualities.length} of {qualities.length} quality versions complete
                </p>
              </div>
            )}

            {/* Thumbnail Preview - Flexible height */}
            <div className="flex-1 min-h-0 mb-4 rounded-lg overflow-hidden bg-gray-900">
              <ProgressiveImage
                smallSrc={`${API_CONFIG.SERVER_URL}/uploads/thumbnails/${thumbnail}`}
                mediumSrc={`${API_CONFIG.SERVER_URL}/uploads/thumbnails/${thumbnail}`}
                alt="Video thumbnail"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Quality Processing Status - Compact Grid */}
            <div className="mb-4 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Quality Versions
              </h3>
              <div className="grid grid-cols-5 gap-2">
                {qualities.map(quality => {
                  const qualityStatus = getQualityStatus(quality);
                  const progressData = encodingProgress[quality];
                  const progressPercent = progressData?.progress || 0;

                  return (
                    <div
                      key={quality}
                      className={`relative p-2 rounded-lg border-2 transition-all ${
                        qualityStatus === 'complete'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : qualityStatus === 'processing'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                      }`}
                    >
                      <div className="text-center">
                        {qualityStatus === 'complete' && (
                          <Check size={14} className="text-green-600 dark:text-green-400 mx-auto mb-0.5" />
                        )}
                        {qualityStatus === 'processing' && (
                          <Loader size={14} className="text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-0.5" />
                        )}
                        {qualityStatus === 'pending' && (
                          <Clock size={14} className="text-gray-400 dark:text-gray-500 mx-auto mb-0.5" />
                        )}
                        <div className={`text-xs font-bold ${
                          qualityStatus === 'complete'
                            ? 'text-green-700 dark:text-green-300'
                            : qualityStatus === 'processing'
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {quality}
                        </div>
                        {qualityStatus === 'processing' && progressPercent > 0 && (
                          <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            {progressPercent}%
                          </div>
                        )}
                      </div>
                      {qualityStatus === 'processing' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-600 rounded-b-lg overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Message */}
            {(status.canView || status.isComplete) && (
              <div className="mb-4 p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 flex-shrink-0">
                <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                  <Check size={16} className="flex-shrink-0" />
                  <span className="font-medium">
                    {status.isComplete
                      ? 'All quality versions complete!'
                      : 'Your video is ready to watch! Additional quality options are still processing.'}
                  </span>
                </div>
              </div>
            )}

            {/* Action Button */}
            <div className="flex-shrink-0">
              <button
                onClick={onViewVideo}
                disabled={!status.canView}
                className={`w-full px-4 py-2.5 rounded-lg font-semibold transition text-sm ${
                  status.canView
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                {status.canView ? 'View Video' : 'Processing...'}
              </button>
            </div>
          </div>

          {/* Right Column - Footage Details */}
          <div className="flex flex-col gap-4 lg:gap-6 overflow-hidden">
            {/* Incident Details Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 lg:p-6 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <AlertCircle size={20} className="text-blue-600 dark:text-blue-400" />
                Incident Details
              </h2>

              {footageData ? (
                <div className="space-y-3">
                  {/* Incident Type */}
                  <div className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      <AlertCircle size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Incident Type
                      </div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatIncidentType(footageData.incident_type)}
                      </div>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <Calendar size={16} className="text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Date
                        </div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {footageData.incident_date}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <Clock size={16} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Time
                        </div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatTimeTo12Hour(footageData.incident_time)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {footageData.description && (
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Description
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        {footageData.description}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-6">
                  <Loader size={20} className="text-blue-500 animate-spin" />
                </div>
              )}
            </div>

            {/* Location Card with Map - Fills remaining space */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 lg:p-6 flex-1 min-h-0 flex flex-col overflow-hidden">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2 flex-shrink-0">
                <MapPin size={20} className="text-red-600 dark:text-red-400" />
                Location
              </h2>

              {footageData ? (
                <div className="flex flex-col flex-1 min-h-0 gap-3">
                  {/* Location Name & Coordinates - Compact row */}
                  <div className="flex-shrink-0 grid grid-cols-3 gap-2">
                    <div className="col-span-3 lg:col-span-1 flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <MapPin size={16} className="text-red-600 dark:text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          Address
                        </div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {footageData.location_name}
                        </div>
                      </div>
                    </div>
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Lat
                      </div>
                      <div className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {footageData.lat.toFixed(6)}
                      </div>
                    </div>
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Lng
                      </div>
                      <div className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {footageData.lng.toFixed(6)}
                      </div>
                    </div>
                  </div>

                  {/* Map - Fills remaining space */}
                  <div className="flex-1 min-h-0 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${footageData.lng - 0.01},${footageData.lat - 0.01},${footageData.lng + 0.01},${footageData.lat + 0.01}&layer=mapnik&marker=${footageData.lat},${footageData.lng}`}
                      style={{ border: 0 }}
                    />
                  </div>

                  {/* View on Map Link */}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${footageData.lat}&mlon=${footageData.lng}#map=15/${footageData.lat}/${footageData.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 block w-full text-center px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium text-sm"
                  >
                    View on OpenStreetMap
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1">
                  <Loader size={20} className="text-blue-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
