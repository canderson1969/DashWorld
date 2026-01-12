import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Scissors, X, Loader, Volume2, VolumeX, Undo2, Redo2, Clock } from 'lucide-react';
import { formatTime, trimVideo, generateThumbnailStrip } from '../utils/videoUtils';
import { ErrorDisplay } from './ErrorDisplay';
import { logger } from '../utils/logger';

interface VideoTrimmerProps {
  videoFile: File;
  onTrimComplete: (trimmedFile: File) => void;
  onCancel: () => void;
}

interface TrimState {
  startTime: number;
  endTime: number;
}

export const VideoTrimmer = ({ videoFile, onTrimComplete, onCancel }: VideoTrimmerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingRegion, setIsDraggingRegion] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<TrimState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;

    const handleLoadedMetadata = () => {
      const dur = video.duration;
      setDuration(dur);
      setEndTime(dur);
      video.volume = volume;
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Auto-pause at end trim point during preview
      if (video.currentTime >= endTime && isPlaying) {
        video.pause();
        setIsPlaying(false);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleSeeking = () => setIsSeeking(true);
    const handleSeeked = () => setIsSeeking(false);
    const handleWaiting = () => setIsWaiting(true);
    const handleCanPlay = () => setIsWaiting(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);

    // Generate thumbnails with adaptive quality based on video duration
    // For short videos (< 35s = < 7 thumbnails at 5s interval), use higher resolution
    const handleLoadedForThumbnails = () => {
      const dur = video.duration;
      const minInterval = 5;
      const expectedThumbnailCount = Math.ceil(dur / minInterval);

      // Use high quality for videos with few thumbnails (< 7)
      const useHighQuality = expectedThumbnailCount < 7;
      const width = useHighQuality ? 320 : 160;
      const height = useHighQuality ? 180 : 90;
      const quality = useHighQuality ? 0.85 : 0.7;

      logger.debug('Generating thumbnails with adaptive quality', {
        fileName: videoFile.name,
        duration: dur,
        expectedThumbnailCount,
        useHighQuality,
        width,
        height,
        quality,
      });

      generateThumbnailStrip(videoFile, minInterval, width, height, quality)
        .then(setThumbnails)
        .catch((err) => {
          logger.warn('Failed to generate thumbnail strip', {
            fileName: videoFile.name,
            error: err instanceof Error ? err.message : String(err),
          });
          // Don't set error state for thumbnails - they're optional
        });
    };

    // Wait for metadata to calculate thumbnail quality
    if (video.readyState >= 1) {
      handleLoadedForThumbnails();
    } else {
      video.addEventListener('loadedmetadata', handleLoadedForThumbnails, { once: true });
    }

    return () => {
      URL.revokeObjectURL(videoUrl);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoFile]);

  /**
   * Toggle play/pause
   */
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // Start from beginning of selection if at end
      if (currentTime >= endTime) {
        videoRef.current.currentTime = startTime;
      }
      videoRef.current.play();
    }
  };

  /**
   * Seek to specific time
   */
  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(time, duration));
    }
  };

  /**
   * Skip forward by seconds
   */
  const skip = (seconds: number) => {
    seekTo(currentTime + seconds);
  };

  /**
   * Set start trim point to current time
   */
  const setStartToCurrent = () => {
    setStartTime(Math.min(currentTime, endTime - 1));
  };

  /**
   * Set end trim point to current time
   */
  const setEndToCurrent = () => {
    setEndTime(Math.max(currentTime, startTime + 1));
  };

  /**
   * Save current trim state to history
   */
  const saveToHistory = (start: number, end: number) => {
    const newState: TrimState = { startTime: start, endTime: end };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  /**
   * Update trim times with history tracking
   */
  const updateTrimTimes = (start: number, end: number) => {
    saveToHistory(start, end);
    setStartTime(start);
    setEndTime(end);
  };

  /**
   * Undo last trim change
   */
  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setStartTime(prevState.startTime);
      setEndTime(prevState.endTime);
      setHistoryIndex(historyIndex - 1);
    }
  };

  /**
   * Redo last undone trim change
   */
  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setStartTime(nextState.startTime);
      setEndTime(nextState.endTime);
      setHistoryIndex(historyIndex + 1);
    }
  };

  /**
   * Apply quick trim preset
   */
  const applyPreset = (type: 'first30' | 'first60' | 'last30' | 'last60' | 'middle30') => {
    let newStart = 0;
    let newEnd = duration;

    switch (type) {
      case 'first30':
        newStart = 0;
        newEnd = Math.min(30, duration);
        break;
      case 'first60':
        newStart = 0;
        newEnd = Math.min(60, duration);
        break;
      case 'last30':
        newStart = Math.max(0, duration - 30);
        newEnd = duration;
        break;
      case 'last60':
        newStart = Math.max(0, duration - 60);
        newEnd = duration;
        break;
      case 'middle30':
        const middle = duration / 2;
        newStart = Math.max(0, middle - 15);
        newEnd = Math.min(duration, middle + 15);
        break;
    }

    updateTrimTimes(newStart, newEnd);
    seekTo(newStart);
  };

  /**
   * Handle volume change
   */
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  /**
   * Toggle mute
   */
  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume || 0.5;
        setIsMuted(false);
        if (volume === 0) setVolume(0.5);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  /**
   * Handle timeline click to seek
   */
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;

    seekTo(time);
  };

  /**
   * Handle start handle drag
   */
  const handleStartDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingStart(true);
  };

  /**
   * Handle end handle drag
   */
  const handleEndDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingEnd(true);
  };

  /**
   * Handle region pan/drag to move entire trimmed section
   */
  const handleRegionDrag = (e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const clickTime = percent * duration;

    // Store the offset from the start of the region
    setDragStartOffset(clickTime - startTime);
    setIsDraggingRegion(true);
  };

  /**
   * Handle mouse move for dragging
   */
  useEffect(() => {
    let dragStartState: TrimState | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current || (!isDraggingStart && !isDraggingEnd && !isDraggingRegion)) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const time = percent * duration;

      if (isDraggingStart) {
        setStartTime(Math.min(time, endTime - 1));
      } else if (isDraggingEnd) {
        setEndTime(Math.max(time, startTime + 1));
      } else if (isDraggingRegion) {
        // Calculate new start time based on cursor position and offset
        const regionDuration = endTime - startTime;
        let newStartTime = time - dragStartOffset;

        // Constrain to video bounds
        newStartTime = Math.max(0, Math.min(newStartTime, duration - regionDuration));

        setStartTime(newStartTime);
        setEndTime(newStartTime + regionDuration);
      }
    };

    const handleMouseUp = () => {
      // Save to history when drag ends
      if (dragStartState && (dragStartState.startTime !== startTime || dragStartState.endTime !== endTime)) {
        saveToHistory(startTime, endTime);
      }
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setIsDraggingRegion(false);
      dragStartState = null;
    };

    if (isDraggingStart || isDraggingEnd || isDraggingRegion) {
      // Save state when drag starts
      dragStartState = { startTime, endTime };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingStart, isDraggingEnd, isDraggingRegion, dragStartOffset, duration, startTime, endTime]);

  /**
   * Keyboard shortcuts for undo/redo
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  /**
   * Process and trim video
   */
  const handleTrim = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Optimization: Check if trimming is actually needed
      const needsTrimming = startTime !== 0 || endTime !== duration;

      if (!needsTrimming) {
        // No trimming needed - use original file directly
        logger.info('Skipping trim operation - using full video', {
          fileName: videoFile.name,
          fileSize: videoFile.size,
          duration: duration,
        });

        onTrimComplete(videoFile);
      } else {
        // Trimming needed - call backend trim endpoint
        const trimmedBlob = await trimVideo(videoFile, startTime, endTime);
        const trimmedFile = new File([trimmedBlob], videoFile.name, { type: 'video/mp4' });

        logger.info('Video trim completed, invoking completion callback', {
          fileName: videoFile.name,
          trimmedSize: trimmedFile.size,
          trimStart: startTime,
          trimEnd: endTime,
        });

        onTrimComplete(trimmedFile);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error during video trimming');

      logger.error('Video trimming failed in component', {
        fileName: videoFile.name,
        startTime,
        endTime,
      }, error);

      setError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const trimmedDuration = endTime - startTime;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Trim Video (Optional)</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X size={24} />
        </button>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Trim your video to include only the relevant portion of the incident. You can skip this step if the entire video is needed.
      </p>

      {/* Error Display */}
      <ErrorDisplay error={error} onDismiss={() => setError(null)} />

      {/* Video Preview */}
      <div className="bg-black rounded-xl overflow-hidden mb-6 relative shadow-lg">
        <video
          ref={videoRef}
          className="w-full"
          style={{ maxHeight: '500px' }}
        />

        {/* Loading overlay */}
        {(isSeeking || isWaiting) && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader className="animate-spin text-white" size={48} />
              <span className="text-white text-sm font-medium">
                {isSeeking ? 'Seeking...' : 'Loading...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Timeline with thumbnails */}
      <div className="mb-6">
        <div
          ref={timelineRef}
          className="relative h-20 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer overflow-hidden shadow-md border-2 border-gray-300 dark:border-gray-600"
          onClick={handleTimelineClick}
        >
          {/* Thumbnail strip */}
          <div className="absolute inset-0 flex">
            {thumbnails.map((thumb, i) => (
              <img
                key={i}
                src={thumb}
                alt={`Thumbnail ${i}`}
                className="h-full object-cover"
                style={{ width: `${100 / thumbnails.length}%` }}
              />
            ))}
          </div>

          {/* Trimmed region overlay */}
          <div className="absolute inset-0 flex">
            <div
              className="bg-black bg-opacity-60"
              style={{ width: `${(startTime / duration) * 100}%` }}
            />
            <div
              className="bg-blue-500 bg-opacity-30 border-t-2 border-b-2 border-blue-500 cursor-move hover:bg-opacity-40 transition-opacity"
              style={{ width: `${((endTime - startTime) / duration) * 100}%` }}
              onMouseDown={handleRegionDrag}
              title="Drag to move the trimmed region"
            />
            <div
              className="bg-black bg-opacity-60"
              style={{ width: `${((duration - endTime) / duration) * 100}%` }}
            />
          </div>

          {/* Start trim handle */}
          <div
            className="absolute top-0 bottom-0 w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-700"
            style={{ left: `${(startTime / duration) * 100}%` }}
            onMouseDown={handleStartDrag}
          >
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-8 bg-blue-600 rounded-sm flex items-center justify-center">
              <div className="w-0.5 h-4 bg-white" />
            </div>
          </div>

          {/* End trim handle */}
          <div
            className="absolute top-0 bottom-0 w-2 bg-blue-600 cursor-ew-resize hover:bg-blue-700"
            style={{ left: `${(endTime / duration) * 100}%`, transform: 'translateX(-100%)' }}
            onMouseDown={handleEndDrag}
          >
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-8 bg-blue-600 rounded-sm flex items-center justify-center">
              <div className="w-0.5 h-4 bg-white" />
            </div>
          </div>

          {/* Current time indicator */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        {/* Time display */}
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2 px-1">
          <span className="font-medium">{formatTime(startTime)}</span>
          <span className="text-gray-500 dark:text-gray-500">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <span className="font-medium">{formatTime(endTime)}</span>
        </div>
      </div>

      {/* Playback controls */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => skip(-5)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
            title="Rewind 5s"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={togglePlay}
            className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full"
            title="Play/Pause (Space)"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          <button
            onClick={() => skip(5)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
            title="Forward 5s"
          >
            <SkipForward size={20} />
          </button>

          <select
            value={playbackRate}
            onChange={(e) => {
              const rate = parseFloat(e.target.value);
              setPlaybackRate(rate);
              if (videoRef.current) videoRef.current.playbackRate = rate;
            }}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-100"
          >
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1">1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>

        {/* Volume control */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-3 max-w-xs mx-auto">
            <button
              onClick={toggleMute}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-800 dark:text-gray-100"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(isMuted ? 0 : volume) * 100}%, #d1d5db ${(isMuted ? 0 : volume) * 100}%, #d1d5db 100%)`
              }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400 w-10 text-right">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Preview volume only (does not affect uploaded video)
          </p>
        </div>
      </div>

      {/* Quick trim presets */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={16} className="text-gray-600 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Quick Presets</h3>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <button
            onClick={() => applyPreset('first30')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 text-xs text-gray-800 dark:text-gray-100"
            disabled={duration < 1}
          >
            First 30s
          </button>
          <button
            onClick={() => applyPreset('first60')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 text-xs text-gray-800 dark:text-gray-100"
            disabled={duration < 1}
          >
            First 1m
          </button>
          <button
            onClick={() => applyPreset('middle30')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 text-xs text-gray-800 dark:text-gray-100"
            disabled={duration < 1}
          >
            Middle 30s
          </button>
          <button
            onClick={() => applyPreset('last60')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 text-xs text-gray-800 dark:text-gray-100"
            disabled={duration < 1}
          >
            Last 1m
          </button>
          <button
            onClick={() => applyPreset('last30')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900 text-xs text-gray-800 dark:text-gray-100"
            disabled={duration < 1}
          >
            Last 30s
          </button>
        </div>
      </div>

      {/* Trim controls */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <button
            onClick={setStartToCurrent}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-800 dark:text-gray-100"
            title="Set start point ([)"
          >
            Set Start ([)
          </button>
          <button
            onClick={setEndToCurrent}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-800 dark:text-gray-100"
            title="Set end point (])"
          >
            Set End (])
          </button>
        </div>

        {/* Undo/Redo buttons */}
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} />
            Undo
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} />
            Redo
          </button>
        </div>
      </div>

      {/* Info display */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 mb-6 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Original Duration:</span>
          <span className="font-medium text-gray-800 dark:text-gray-200">{formatTime(duration)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Trimmed Duration:</span>
          <span className="font-medium text-gray-800 dark:text-gray-200">{formatTime(trimmedDuration)}</span>
        </div>
      </div>

      {/* Action button */}
      <div className="flex gap-4">
        <button
          onClick={handleTrim}
          disabled={isProcessing}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader size={20} className="animate-spin" />
              Processing...
            </>
          ) : startTime === 0 && endTime === duration ? (
            <>
              <Scissors size={20} />
              Use Whole Video
            </>
          ) : (
            <>
              <Scissors size={20} />
              Apply Trim
            </>
          )}
        </button>
      </div>
    </div>
  );
};
