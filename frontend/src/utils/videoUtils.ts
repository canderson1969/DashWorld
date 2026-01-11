import { logger } from './logger';
import { VideoTrimmingError, ThumbnailGenerationError } from './errors';
import { API_CONFIG, getAssetUrl } from '../config/constants';

/**
 * Generate thumbnail images from video at regular intervals
 * Automatically adjusts interval to cap maximum thumbnails at 15 for performance
 *
 * @param {File} videoFile - The video file to extract thumbnails from
 * @param {number} minInterval - Minimum time interval between thumbnails in seconds
 * @param {number} width - Canvas width for thumbnails (default: 160)
 * @param {number} height - Canvas height for thumbnails (default: 90)
 * @param {number} quality - JPEG quality from 0 to 1 (default: 0.7)
 * @returns {Promise<string[]>} Array of thumbnail data URLs (max 15)
 */
export async function generateThumbnailStrip(
  videoFile: File,
  minInterval: number = 5,
  width: number = 160,
  height: number = 90,
  quality: number = 0.7
): Promise<string[]> {
  logger.debug('Starting thumbnail generation', {
    fileName: videoFile.name,
    fileSize: videoFile.size,
    minInterval,
    width,
    height,
    quality,
  });

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(videoFile);

    const thumbnails: string[] = [];
    let currentTime = 0;

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const MAX_THUMBNAILS = 15;

      // Calculate optimal interval to cap thumbnails at MAX_THUMBNAILS
      const calculatedInterval = duration / MAX_THUMBNAILS;
      const interval = Math.max(minInterval, calculatedInterval);

      logger.debug('Thumbnail generation parameters calculated', {
        fileName: videoFile.name,
        duration,
        interval,
        estimatedThumbnails: Math.ceil(duration / interval),
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        const error = new ThumbnailGenerationError(new Error('Failed to get canvas context'), {
          fileName: videoFile.name,
        });
        logger.error('Failed to get canvas 2D context', {
          fileName: videoFile.name,
        }, error);
        URL.revokeObjectURL(video.src);
        reject(error);
        return;
      }

      canvas.width = width;
      canvas.height = height;

      const captureThumbnail = () => {
        if (currentTime >= duration) {
          URL.revokeObjectURL(video.src);
          logger.info('Thumbnail generation completed', {
            fileName: videoFile.name,
            thumbnailCount: thumbnails.length,
            interval,
          });
          resolve(thumbnails);
          return;
        }

        video.currentTime = currentTime;
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbnails.push(canvas.toDataURL('image/jpeg', quality));
        currentTime += interval;
        captureThumbnail();
      };

      video.onerror = () => {
        const error = new ThumbnailGenerationError(new Error('Video loading failed'), {
          fileName: videoFile.name,
          currentTime,
        });
        logger.error('Video loading failed during thumbnail generation', {
          fileName: videoFile.name,
          currentTime,
        }, error);
        URL.revokeObjectURL(video.src);
        reject(error);
      };

      captureThumbnail();
    };
  });
}

/**
 * Trim video using server-side FFmpeg processing
 *
 * @param {File} videoFile - Original video file
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @returns {Promise<Blob>} Trimmed video blob
 */
export async function trimVideo(videoFile: File, startTime: number, endTime: number): Promise<Blob> {
  logger.info('Starting server-side video trim operation', {
    fileName: videoFile.name,
    fileSize: videoFile.size,
    startTime,
    endTime,
    duration: endTime - startTime,
  });

  try {
    // Create FormData to send video file and trim parameters
    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('startTime', startTime.toString());
    formData.append('endTime', endTime.toString());

    logger.debug('Sending trim request to server', {
      fileName: videoFile.name,
      startTime,
      endTime,
      apiUrl: `${API_CONFIG.SERVER_URL}/api/trim-video`,
    });

    // Send request to backend
    const response = await fetch(`${API_CONFIG.SERVER_URL}/api/trim-video`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      const error = new VideoTrimmingError(
        errorData.error || 'Server-side video trimming failed',
        undefined,
        {
          fileName: videoFile.name,
          startTime,
          endTime,
          statusCode: response.status,
          details: errorData.details,
        }
      );

      logger.error('Server-side video trimming failed', {
        fileName: videoFile.name,
        startTime,
        endTime,
        statusCode: response.status,
        error: errorData.error,
        details: errorData.details,
      }, error);

      throw error;
    }

    const result = await response.json();

    logger.debug('Trim request successful, fetching trimmed video', {
      fileName: videoFile.name,
      trimmedFilename: result.filename,
      trimmedSize: result.size,
    });

    // Fetch the trimmed video file
    const videoUrl = result.video_url || `/uploads/${result.filename}`;
    const videoResponse = await fetch(getAssetUrl(videoUrl));

    if (!videoResponse.ok) {
      const error = new VideoTrimmingError(
        'Failed to fetch trimmed video file',
        undefined,
        {
          fileName: videoFile.name,
          trimmedFilename: result.filename,
          statusCode: videoResponse.status,
        }
      );

      logger.error('Failed to fetch trimmed video file', {
        fileName: videoFile.name,
        trimmedFilename: result.filename,
        statusCode: videoResponse.status,
      }, error);

      throw error;
    }

    const blob = await videoResponse.blob();

    logger.info('Server-side video trim completed successfully', {
      fileName: videoFile.name,
      originalSize: videoFile.size,
      trimmedSize: blob.size,
      startTime,
      endTime,
      duration: endTime - startTime,
    });

    return blob;
  } catch (error) {
    // If error is already a custom error, re-throw it
    if (error instanceof VideoTrimmingError) {
      throw error;
    }

    // Wrap unexpected errors
    const wrappedError = new VideoTrimmingError(
      'Unexpected error during server-side video trimming',
      error instanceof Error ? error : undefined,
      {
        fileName: videoFile.name,
        startTime,
        endTime,
      }
    );

    logger.error('Unexpected error during server-side video trimming', {
      fileName: videoFile.name,
      startTime,
      endTime,
    }, wrappedError);

    throw wrappedError;
  }
}

/**
 * Format seconds to HH:MM:SS or MM:SS format
 *
 * @param {number} seconds - Time in seconds
 * @param {boolean} includeHours - Whether to always include hours
 * @returns {string} Formatted time string
 */
export function formatTime(seconds: number, includeHours: boolean = false): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0 || includeHours) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse time string (HH:MM:SS or MM:SS) to seconds
 *
 * @param {string} timeString - Time string to parse
 * @returns {number} Time in seconds
 */
export function parseTimeString(timeString: string): number {
  const parts = timeString.split(':').map(p => parseInt(p, 10));

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return 0;
}

/**
 * Calculate estimated file size after trimming
 *
 * @param {number} originalSize - Original file size in bytes
 * @param {number} originalDuration - Original duration in seconds
 * @param {number} trimmedDuration - Trimmed duration in seconds
 * @returns {number} Estimated trimmed file size in bytes
 */
export function estimateTrimmedSize(
  originalSize: number,
  originalDuration: number,
  trimmedDuration: number
): number {
  const bitrate = originalSize / originalDuration;
  return Math.floor(bitrate * trimmedDuration);
}

/**
 * Format file size to human-readable string
 *
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "24.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
