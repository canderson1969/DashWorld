/**
 * Thumbnail generation utilities for video files
 *
 * Generates multiple sizes of JPEG thumbnails from video files.
 *
 * @module thumbnailGenerator
 */

import { THUMBNAIL_CONFIG } from '../config/constants';

/**
 * Generate a single thumbnail at specific size and quality
 *
 * @param {HTMLVideoElement} video - The video element to capture from
 * @param {number} maxWidth - Maximum width for the thumbnail
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>} Promise resolving to JPEG image blob
 */
function generateSingleThumbnail(video: HTMLVideoElement, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    // Set canvas size to video dimensions (scaled to max width)
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to generate thumbnail'));
        }
      },
      THUMBNAIL_CONFIG.FORMAT,
      quality
    );
  });
}

/**
 * Generate thumbnails at multiple sizes from video file
 *
 * Creates small, medium, and large thumbnails from video at 1-second mark.
 *
 * @param {File} videoFile - The video file to generate thumbnails from
 * @returns {Promise<{small: Blob, medium: Blob, large: Blob}>} Promise resolving to thumbnail blobs
 */
export function generateThumbnails(videoFile: File): Promise<{small: Blob, medium: Blob, large: Blob}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      // Seek to 1 second into the video (or start if shorter)
      video.currentTime = Math.min(THUMBNAIL_CONFIG.SEEK_TIME_SECONDS, video.duration / 2);
    };

    video.onseeked = async () => {
      try {
        // Generate all three sizes
        const [small, medium, large] = await Promise.all([
          generateSingleThumbnail(video, THUMBNAIL_CONFIG.SMALL.MAX_WIDTH, THUMBNAIL_CONFIG.SMALL.QUALITY),
          generateSingleThumbnail(video, THUMBNAIL_CONFIG.MEDIUM.MAX_WIDTH, THUMBNAIL_CONFIG.MEDIUM.QUALITY),
          generateSingleThumbnail(video, THUMBNAIL_CONFIG.LARGE.MAX_WIDTH, THUMBNAIL_CONFIG.LARGE.QUALITY)
        ]);

        resolve({ small, medium, large });

        // Cleanup
        URL.revokeObjectURL(video.src);
      } catch (error) {
        reject(error);
        URL.revokeObjectURL(video.src);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
      URL.revokeObjectURL(video.src);
    };

    video.src = URL.createObjectURL(videoFile);
  });
}
