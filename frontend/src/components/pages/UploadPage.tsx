/**
 * Upload page component
 *
 * Multi-step wizard for uploading dashcam footage with metadata extraction,
 * video trimming, timestamp verification, location setting, and incident details.
 *
 * @module UploadPage
 */

import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { ArrowLeft, Upload, AlertCircle, Check, ChevronRight, Calendar, Clock, Info, Video, X, AlertTriangle, Search, MapPin } from 'lucide-react';
import type { Metadata } from '../../types/metadata';
import { extractVideoMetadata } from '../../utils/videoMetadata';
import { generateThumbnails } from '../../utils/thumbnailGenerator';
import { getDuration } from '../../utils/videoDuration';
import * as api from '../../api';
import { PRIVACY_NOTICE, MAP_CONFIG } from '../../config/constants';

// Lazy load heavy components
const VideoTrimmer = lazy(() => import('../VideoTrimmer').then(module => ({ default: module.VideoTrimmer })));

// Declare Leaflet on window
declare global {
  interface Window {
    L: any;
  }
}

interface UploadPageProps {
  onBack: () => void;
  onUploadComplete?: () => Promise<void>;
  onUploadSuccess?: (footageId: number) => void;
  authToken: string | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
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
 * Upload page component
 *
 * @param {() => void} onBack - Handler to navigate back
 * @param {() => Promise<void>} onUploadComplete - Handler called after successful upload
 * @param {(footageId: number) => void} onUploadSuccess - Handler called with new footage ID
 * @param {string | null} authToken - JWT authentication token
 * @param {Function} showToast - Toast notification function
 * @returns {JSX.Element} Multi-step upload wizard
 */
export function UploadPage({ onBack, onUploadComplete, onUploadSuccess, authToken, showToast }: UploadPageProps) {
  const [step, setStep] = useState(1);
  const [selectedVideoPreview, setSelectedVideoPreview] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [trimmedVideoFile, setTrimmedVideoFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userTimestamp, setUserTimestamp] = useState({ date: '', time: '' });
  const [manualCoords, setManualCoords] = useState({ lat: '', lng: '' });
  const [incidentType, setIncidentType] = useState('');
  const [description, setDescription] = useState('');
  const [isGraphicContent, setIsGraphicContent] = useState(false);
  const [contentWarnings, setContentWarnings] = useState<string[]>([]);
  const [_confidence, setConfidence] = useState({ location: 'high', time: 'high' });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const uploadMapRef = useRef<HTMLDivElement | null>(null);
  const uploadMapInstanceRef = useRef<any>(null);
  const uploadMarkerRef = useRef<any>(null);
  const uploadCircleRef = useRef<any>(null);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const addressSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
    }
  }, []);

  /**
   * Create and cleanup preview URL for selected video
   */
  useEffect(() => {
    if (selectedVideoPreview) {
      const url = URL.createObjectURL(selectedVideoPreview);
      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
        setPreviewUrl(null);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [selectedVideoPreview]);

  useEffect(() => {
    if (step === 3 && leafletLoaded && uploadMapRef.current && !uploadMapInstanceRef.current) {
      const L = window.L;
      const initialLat = metadata?.location?.lat || 37.7749;
      const initialLng = metadata?.location?.lng || -122.4194;

      const map = L.map(uploadMapRef.current).setView([initialLat, initialLng], 15);

      const tileLayer = L.tileLayer(MAP_CONFIG.TILE_URL, {
        attribution: MAP_CONFIG.ATTRIBUTION,
        maxZoom: 19,
        errorTileUrl: '', // Use blank tile on error instead of broken image
      }).addTo(map);

      // Handle tile loading errors by retrying
      tileLayer.on('tileerror', function(error: any) {
        const tile = error.tile;
        const retryCount = tile.retryCount || 0;
        if (retryCount < 3) {
          tile.retryCount = retryCount + 1;
          setTimeout(() => {
            tile.src = tile.src; // Retry loading the tile
          }, 1000 * (retryCount + 1)); // Exponential backoff
        }
      });

      uploadMapInstanceRef.current = map;

      // Fix map tile loading issue with multiple invalidateSize calls
      // This ensures the map renders correctly even if container size changes
      setTimeout(() => {
        map.invalidateSize();
      }, 100);

      setTimeout(() => {
        map.invalidateSize();
      }, 250);

      setTimeout(() => {
        map.invalidateSize();
      }, 500);

      const radius = metadata?.location ? 50 : 200;

      const circle = L.circle([initialLat, initialLng], {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        radius: radius
      }).addTo(map);

      const marker = L.marker([initialLat, initialLng], {
        draggable: true
      }).addTo(map);

      uploadCircleRef.current = circle;
      uploadMarkerRef.current = marker;

      marker.on('dragend', function(e: any) {
        const pos = e.target.getLatLng();
        setUserLocation({ lat: pos.lat, lng: pos.lng });
        setManualCoords({ lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) });
        circle.setLatLng([pos.lat, pos.lng]);
        circle.setRadius(100);
        setConfidence(prev => ({ ...prev, location: 'medium' }));
      });

      map.on('click', function(e: any) {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        circle.setRadius(100);
        setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
        setManualCoords({ lat: e.latlng.lat.toFixed(6), lng: e.latlng.lng.toFixed(6) });
        setConfidence(prev => ({ ...prev, location: 'medium' }));
      });
    }

    return () => {
      if (uploadMapInstanceRef.current) {
        uploadMapInstanceRef.current.remove();
        uploadMapInstanceRef.current = null;
        uploadMarkerRef.current = null;
        uploadCircleRef.current = null;
      }
    };
  }, [step, leafletLoaded, metadata]);

  /**
   * Handle video file upload from file input
   * Shows video preview and waits for user confirmation
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - File input change event
   */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      return;
    }

    // Show preview and wait for user confirmation
    setSelectedVideoPreview(file);
  };

  /**
   * Handle user confirmation to proceed with video
   * Stores video and extracts metadata
   */
  const handleConfirmVideo = async () => {
    if (!selectedVideoPreview) {
      return;
    }

    const selectedFile = selectedVideoPreview;

    // Clear preview and store video
    setSelectedVideoPreview(null);
    setVideoFile(selectedFile);

    // Extract metadata from video
    await extractMetadataAndProceed(selectedFile);
  };

  /**
   * Handle user cancellation of video selection
   */
  const handleCancelVideo = () => {
    setSelectedVideoPreview(null);
  };

  /**
   * Extract video metadata and update state, then proceed to trim step
   *
   * @param {File} videoFile - The video file to extract metadata from
   */
  const extractMetadataAndProceed = async (videoFile: File): Promise<void> => {
    try {
      // Extract metadata from video file
      const extractedMetadata = await extractVideoMetadata(videoFile);
      const videoDuration = await getDuration(videoFile);

      // Determine location data
      let location = null;
      let locationConfidence = 'none';

      if (extractedMetadata.hasGPS && extractedMetadata.latitude && extractedMetadata.longitude) {
        location = {
          lat: extractedMetadata.latitude,
          lng: extractedMetadata.longitude,
          source: 'gps'
        };
        locationConfidence = 'high';

        setManualCoords({
          lat: extractedMetadata.latitude.toFixed(6),
          lng: extractedMetadata.longitude.toFixed(6)
        });
      }

      // Set timestamp
      const timestamp = {
        date: extractedMetadata.date || new Date().toISOString().split('T')[0],
        time: extractedMetadata.time || new Date().toTimeString().slice(0, 5)
      };

      const videoDate = new Date(`${timestamp.date}T${timestamp.time}`);

      setMetadata({
        location: location,
        timestamp: videoDate,
        hasGPS: extractedMetadata.hasGPS,
        hasCorrectTime: extractedMetadata.hasDateTime,
        duration: videoDuration,
        resolution: ''
      });

      setUserTimestamp(timestamp);

      setConfidence({
        location: locationConfidence,
        time: extractedMetadata.hasDateTime ? 'high' : 'low'
      });

      // Proceed to trim step
      setStep(1.5);
    } catch (error) {
      // Fallback: use current date/time
      const now = new Date();
      setUserTimestamp({
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().slice(0, 5)
      });

      setMetadata({
        location: null,
        timestamp: now,
        hasGPS: false,
        hasCorrectTime: false,
        duration: 0,
        resolution: ''
      });

      setConfidence({
        location: 'none',
        time: 'low'
      });

      // Proceed to trim step even with metadata extraction failure
      setStep(1.5);
    }
  };

  /**
   * Handle drag-and-drop events for video upload
   */
  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  /**
   * Handle drag-and-drop video file upload
   * Shows video preview and waits for user confirmation
   *
   * @param {React.DragEvent<HTMLLabelElement>} e - Drag event
   */
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    if (!file.type.startsWith('video/')) {
      return;
    }

    // Show preview and wait for user confirmation
    setSelectedVideoPreview(file);
  };

  /**
   * Search for address using Nominatim OpenStreetMap API
   *
   * @param {string} query - The address search query
   */
  const searchAddress = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    setIsSearchingAddress(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Address search failed');
      }

      const results = await response.json();
      setAddressSuggestions(results);
      setShowAddressSuggestions(results.length > 0);
    } catch (error) {
      console.error('Address search error:', error);
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  /**
   * Handle address selection from suggestions
   *
   * @param {any} suggestion - Selected address suggestion object
   */
  const handleSelectAddress = (suggestion: any) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);

    setUserLocation({ lat, lng });
    setManualCoords({ lat: lat.toString(), lng: lng.toString() });
    setAddressSearchQuery(suggestion.display_name);
    setShowAddressSuggestions(false);
    setConfidence(prev => ({ ...prev, location: 'medium' }));

    // Update map if loaded
    if (uploadMarkerRef.current && uploadCircleRef.current && uploadMapInstanceRef.current) {
      uploadMarkerRef.current.setLatLng([lat, lng]);
      uploadCircleRef.current.setLatLng([lat, lng]);
      uploadMapInstanceRef.current.panTo([lat, lng]);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {/* Back Button */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition"
        >
          <ArrowLeft size={20} />
          Back to Browse
        </button>
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center justify-between">
            {/* Step 1: Upload */}
            <button
              onClick={() => step > 1 && setStep(1)}
              disabled={step === 1}
              className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} ${step > 1 ? 'cursor-pointer hover:opacity-80' : step === 1 ? 'cursor-default' : 'cursor-not-allowed'} transition`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 dark:text-gray-300'}`}>
                {step > 1 ? <Check size={16} /> : '1'}
              </div>
              <span className="font-medium text-sm">Upload</span>
            </button>
            <ChevronRight className="text-gray-400 dark:text-gray-500" size={16} />

            {/* Step 1.5: Trim */}
            <button
              onClick={() => step > 1.5 && videoFile && setStep(1.5)}
              disabled={step < 1.5 || !videoFile}
              className={`flex items-center gap-2 ${step >= 1.5 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} ${step > 1.5 && videoFile ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'} transition`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1.5 ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 dark:text-gray-300'}`}>
                {step > 1.5 ? <Check size={16} /> : '2'}
              </div>
              <span className="font-medium text-sm">Trim</span>
            </button>
            <ChevronRight className="text-gray-400 dark:text-gray-500" size={16} />

            {/* Step 2: Time */}
            <button
              onClick={() => step > 2 && metadata && setStep(2)}
              disabled={step < 2 || !metadata}
              className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} ${step > 2 && metadata ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'} transition`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 dark:text-gray-300'}`}>
                {step > 2 ? <Check size={16} /> : '3'}
              </div>
              <span className="font-medium text-sm">Time</span>
            </button>
            <ChevronRight className="text-gray-400 dark:text-gray-500" size={16} />

            {/* Step 3: Location */}
            <button
              onClick={() => step > 3 && metadata && setStep(3)}
              disabled={step < 3 || !metadata}
              className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} ${step > 3 && metadata ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'} transition`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 dark:text-gray-300'}`}>
                {step > 3 ? <Check size={16} /> : '4'}
              </div>
              <span className="font-medium text-sm">Location</span>
            </button>
            <ChevronRight className="text-gray-400 dark:text-gray-500" size={16} />

            {/* Step 4: Details */}
            <button
              onClick={() => step > 4 && metadata && setStep(4)}
              disabled={step < 4 || !metadata}
              className={`flex items-center gap-2 ${step >= 4 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'} ${step > 4 && metadata ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'} transition`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 4 ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 dark:text-gray-300'}`}>
                {step > 4 ? <Check size={16} /> : '5'}
              </div>
              <span className="font-medium text-sm">Details</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {step === 1 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Upload Your Dashcam Footage</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Help others by sharing footage of incidents you've captured.
            </p>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">Privacy Notice</h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
                    {PRIVACY_NOTICE.UPLOAD_WARNING}
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-1">
                    Maximum file size: 250MB. Supported formats: MP4, MOV, AVI, and other video formats.
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">
                    💡 <span className="font-medium">Tip:</span> For best performance when trimming, keep videos under 100MB.
                  </p>
                </div>
              </div>
            </div>

            {selectedVideoPreview && previewUrl ? (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <video
                    src={previewUrl}
                    controls
                    className="w-full max-h-96 rounded-lg"
                  />
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">
                    {selectedVideoPreview.name}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelVideo}
                    className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmVideo}
                    className="flex-1 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : videoFile && !metadata ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <Loader className="animate-spin text-blue-600 dark:text-blue-400" size={48} />
                </div>
                <p className="text-center text-gray-600 dark:text-gray-400">Analyzing video metadata...</p>
              </div>
            ) : videoFile && metadata ? (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Video className="text-blue-600 dark:text-blue-400" size={24} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 dark:text-gray-200">{videoFile.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                        {metadata.duration && ` • ${Math.floor(metadata.duration / 60)}:${String(Math.floor(metadata.duration % 60)).padStart(2, '0')}`}
                      </p>
                    </div>
                    <Check className="text-green-600 dark:text-green-400" size={24} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setVideoFile(null);
                      setTrimmedVideoFile(null);
                      setMetadata(null);
                      setStep(1);
                    }}
                    className="flex-1 px-6 py-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition font-medium flex items-center justify-center gap-2"
                  >
                    <X size={20} />
                    Delete and Choose Another
                  </button>
                  <button
                    onClick={() => setStep(1.5)}
                    className="flex-1 px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <label
                className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer transition ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className={isDragging ? "text-blue-500 dark:text-blue-400 mb-4" : "text-gray-400 dark:text-gray-500 mb-4"} size={64} />
                <span className="text-gray-700 dark:text-gray-200 text-lg mb-2 font-medium">
                  {isDragging ? 'Drop video here' : 'Click to upload video or drag and drop'}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">MP4, MOV, AVI, or other formats</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}

        {step === 1.5 && videoFile && (
          <Suspense fallback={
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader size={32} className="mx-auto mb-4 text-blue-500" />
                <p className="text-gray-600 dark:text-gray-400">Loading video trimmer...</p>
              </div>
            </div>
          }>
            <VideoTrimmer
              videoFile={videoFile}
              onTrimComplete={(trimmed) => {
                setTrimmedVideoFile(trimmed);
                setStep(2);
              }}
              onCancel={() => {
                setStep(1);
                setVideoFile(null);
                setTrimmedVideoFile(null);
              }}
            />
          </Suspense>
        )}

        {step === 2 && metadata && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Verify Timestamp</h2>

            <div className={`border rounded-lg p-4 mb-6 ${!metadata.hasCorrectTime ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20' : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'}`}>
              <div className="flex items-start gap-3">
                {metadata.hasCorrectTime ? (
                  <Check className="text-green-600 dark:text-green-500 flex-shrink-0 mt-1" size={20} />
                ) : (
                  <AlertCircle className="text-orange-600 dark:text-orange-500 flex-shrink-0 mt-1" size={20} />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold mb-2 ${metadata.hasCorrectTime ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
                    {metadata.hasCorrectTime ? 'Timestamp looks good!' : 'Timestamp may be incorrect'}
                  </h3>
                  <p className={`text-sm ${metadata.hasCorrectTime ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
                    {metadata.hasCorrectTime
                      ? 'The timestamp from your video appears accurate.'
                      : 'Please correct the timestamp below.'}
                  </p>
                  <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Video file timestamp:</p>
                    <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{metadata.timestamp.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                When did this incident occur?
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <Calendar size={14} />
                    Date
                  </label>
                  <input
                    type="date"
                    value={userTimestamp.date}
                    onChange={(e) => {
                      setUserTimestamp(prev => ({ ...prev, date: e.target.value }));
                      setConfidence(prev => ({ ...prev, time: 'high' }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                    <Clock size={14} />
                    Time
                  </label>
                  <input
                    type="time"
                    value={userTimestamp.time}
                    onChange={(e) => {
                      setUserTimestamp(prev => ({ ...prev, time: e.target.value }));
                      setConfidence(prev => ({ ...prev, time: 'high' }));
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={!userTimestamp.date || !userTimestamp.time}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white py-3 rounded-lg transition font-semibold"
            >
              Continue to Location
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Set Incident Location</h2>

            <div className={`border rounded-lg p-4 mb-6 ${metadata?.location ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' : 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'}`}>
              <div className="flex items-start gap-3">
                <Info className={`${metadata?.location ? 'text-blue-600 dark:text-blue-500' : 'text-yellow-600 dark:text-yellow-500'} flex-shrink-0 mt-1`} size={20} />
                <div>
                  <h3 className={`font-semibold mb-1 ${metadata?.location ? 'text-blue-800 dark:text-blue-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
                    {metadata?.location ? 'GPS data found' : 'No GPS data'}
                  </h3>
                  <p className={`text-sm ${metadata?.location ? 'text-blue-700 dark:text-blue-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                    {metadata?.location
                      ? 'Drag the pin or click to adjust location.'
                      : 'Click on the map where the incident occurred.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Address Search Bar */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Search by Address
              </label>
              <div className="relative">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Enter street address, city, or landmark..."
                    value={addressSearchQuery}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAddressSearchQuery(value);

                      // Clear previous timeout
                      if (addressSearchTimeoutRef.current) {
                        clearTimeout(addressSearchTimeoutRef.current);
                      }

                      // Debounce search
                      addressSearchTimeoutRef.current = setTimeout(() => {
                        searchAddress(value);
                      }, 500);
                    }}
                    onFocus={() => {
                      if (addressSuggestions.length > 0) {
                        setShowAddressSuggestions(true);
                      }
                    }}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Address Suggestions Dropdown */}
                {showAddressSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto z-10">
                    {addressSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectAddress(suggestion)}
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
                {isSearchingAddress && (
                  <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <div className="inline-block animate-spin rounded-full border-2 border-solid border-current border-r-transparent w-3 h-3" />
                      Searching...
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Search for a location, then adjust on the map or use coordinates below
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Map Location
              </label>
              <div className="h-96 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
                <div ref={uploadMapRef} className="h-full w-full"></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                <Info size={12} className="inline mr-1" />
                The blue circle shows the uncertainty radius. Click on the map or drag the pin to adjust location.
              </p>
            </div>

            <div className="mb-6 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Manual Coordinates</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Latitude</label>
                  <input
                    type="text"
                    value={manualCoords.lat}
                    onChange={(e) => {
                      setManualCoords(prev => ({ ...prev, lat: e.target.value }));
                    }}
                    onBlur={() => {
                      const lat = parseFloat(manualCoords.lat);
                      const lng = parseFloat(manualCoords.lng);
                      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        setUserLocation({ lat, lng });
                        if (uploadMarkerRef.current && uploadCircleRef.current) {
                          uploadMarkerRef.current.setLatLng([lat, lng]);
                          uploadCircleRef.current.setLatLng([lat, lng]);
                          uploadMapInstanceRef.current.panTo([lat, lng]);
                        }
                        setConfidence(prev => ({ ...prev, location: 'medium' }));
                      }
                    }}
                    placeholder="37.774900"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Longitude</label>
                  <input
                    type="text"
                    value={manualCoords.lng}
                    onChange={(e) => {
                      setManualCoords(prev => ({ ...prev, lng: e.target.value }));
                    }}
                    onBlur={() => {
                      const lat = parseFloat(manualCoords.lat);
                      const lng = parseFloat(manualCoords.lng);
                      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                        setUserLocation({ lat, lng });
                        if (uploadMarkerRef.current && uploadCircleRef.current) {
                          uploadMarkerRef.current.setLatLng([lat, lng]);
                          uploadCircleRef.current.setLatLng([lat, lng]);
                          uploadMapInstanceRef.current.panTo([lat, lng]);
                        }
                        setConfidence(prev => ({ ...prev, location: 'medium' }));
                      }
                    }}
                    placeholder="-122.419400"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Enter coordinates manually or use the map pin. Coordinates will sync automatically.
              </p>
            </div>

            <button
              onClick={() => setStep(4)}
              disabled={!userLocation && !metadata?.location}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white py-3 rounded-lg transition font-semibold"
            >
              Continue to Details
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Additional Details</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Incident Type</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type...</option>
                  <option value="collision">Collision</option>
                  <option value="near_miss">Near Miss</option>
                  <option value="rear_end">Rear End</option>
                  <option value="side_swipe">Side Swipe</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what happened"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Graphic Content Warning */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="graphic-content"
                    checked={isGraphicContent}
                    onChange={(e) => {
                      setIsGraphicContent(e.target.checked);
                      if (!e.target.checked) {
                        setContentWarnings([]);
                      }
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="graphic-content" className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                    <AlertTriangle size={18} className="text-orange-500" />
                    Mark as Graphic Content
                  </label>
                </div>

                {isGraphicContent && (
                  <div className="ml-8 space-y-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <p className="text-xs text-orange-800 dark:text-orange-300 mb-3">
                      Select all categories that apply. This helps viewers make informed decisions before watching.
                    </p>

                    {[
                      {
                        id: 'accident_injury',
                        label: 'Accident/Injury Related',
                        tooltip: 'Visible injuries or blood • Medical emergency • Severe vehicle damage • Multiple vehicle collision • Pedestrian/cyclist involved'
                      },
                      {
                        id: 'violence',
                        label: 'Violence/Altercation',
                        tooltip: 'Physical altercation or assault • Road rage incident • Weapon visible'
                      },
                      {
                        id: 'vulnerable',
                        label: 'Vulnerable Individuals',
                        tooltip: 'Children involved • Elderly individuals involved • Animal involved/injured'
                      },
                      {
                        id: 'audio_visual',
                        label: 'Audio/Visual Content',
                        tooltip: 'Distressing audio (screaming, panic, etc.) • Strong language/profanity • Disturbing visuals'
                      },
                      {
                        id: 'other',
                        label: 'Other',
                        tooltip: 'Fire or explosion • Police/emergency response • Fatal or potentially fatal incident'
                      }
                    ].map((category) => (
                      <div key={category.id} className="flex items-center gap-2 group">
                        <input
                          type="checkbox"
                          id={category.id}
                          checked={contentWarnings.includes(category.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setContentWarnings([...contentWarnings, category.id]);
                            } else {
                              setContentWarnings(contentWarnings.filter(w => w !== category.id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                        />
                        <label htmlFor={category.id} className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                          {category.label}
                        </label>
                        <div className="relative group/tooltip">
                          <Info size={16} className="text-gray-400 dark:text-gray-500 cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-opacity z-10 pointer-events-none">
                            <div className="whitespace-pre-line leading-relaxed">
                              {category.tooltip.split(' • ').map((item, i) => (
                                <div key={i} className="flex items-start gap-1.5 mb-1 last:mb-0">
                                  <span className="text-blue-400 mt-0.5">•</span>
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload Progress Bar */}
              {uploading && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Uploading...</span>
                    <span className="font-semibold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg transition font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={async () => {
                    if (!videoFile || !incidentType || !authToken) {
                      if (!authToken) {
                        showToast('You must be logged in to upload footage. Please sign in or create an account.', 'error');
                      }
                      return;
                    }

                    setUploading(true);
                    setUploadProgress(0);
                    showToast('Uploading your footage...', 'info');
                    try {
                      // Use trimmed video if available, otherwise use original video
                      const fileToUpload = trimmedVideoFile || videoFile;

                      // Generate thumbnails at multiple sizes from video to upload
                      const thumbnails = await generateThumbnails(fileToUpload);

                      const formData = new FormData();
                      formData.append('video', fileToUpload);
                      formData.append('thumbnail_small', thumbnails.small, 'thumbnail_small.jpg');
                      formData.append('thumbnail_medium', thumbnails.medium, 'thumbnail_medium.jpg');
                      formData.append('thumbnail_large', thumbnails.large, 'thumbnail_large.jpg');
                      formData.append('lat', (userLocation?.lat || metadata?.location?.lat || 37.7749).toString());
                      formData.append('lng', (userLocation?.lng || metadata?.location?.lng || -122.4194).toString());
                      formData.append('incidentDate', userTimestamp.date);
                      formData.append('incidentTime', userTimestamp.time);
                      formData.append('incidentType', incidentType);
                      if (description) formData.append('description', description);
                      if (metadata?.duration) formData.append('duration', metadata.duration.toString());
                      formData.append('isGraphicContent', isGraphicContent.toString());
                      if (isGraphicContent && contentWarnings.length > 0) {
                        formData.append('contentWarnings', JSON.stringify(contentWarnings));
                      }

                      const result = await api.uploadFootage(formData, authToken, (progress) => {
                        setUploadProgress(progress);
                      });
                      if (onUploadComplete) await onUploadComplete();
                      showToast('✓ Footage successfully uploaded.', 'success');
                      // Navigate to the uploaded video
                      if (onUploadSuccess) {
                        setTimeout(() => {
                          onUploadSuccess(result.id);
                          setUploading(false);
                          setUploadProgress(0);
                        }, 500);
                      } else {
                        setTimeout(() => {
                          onBack();
                          setUploading(false);
                          setUploadProgress(0);
                        }, 1500);
                      }
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                      showToast('Upload failed: ' + errorMessage, 'error');
                      setUploading(false);
                      setUploadProgress(0);
                    }
                  }}
                  disabled={uploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white py-3 rounded-lg transition font-semibold flex items-center justify-center gap-2"
                >
                  {uploading && <Loader size={20} />}
                  {uploading ? 'Uploading...' : 'Upload to Dash World'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
