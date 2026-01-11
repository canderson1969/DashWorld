/**
 * Video duration utility
 *
 * Extract duration from video files.
 *
 * @module videoDuration
 */

/**
 * Get video duration from file
 *
 * @param {File} videoFile - Video file to get duration from
 * @returns {Promise<number>} Duration in seconds
 */
export function getDuration(videoFile: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(0);
    };
    video.src = URL.createObjectURL(videoFile);
  });
}
