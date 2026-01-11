import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger, logSuccess, logError } from './logger.js';

/**
 * Check if a video file is already in MP4 format
 *
 * @param {string} filename - The filename to check
 * @returns {boolean} True if file is MP4, false otherwise
 */
export function isMP4(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.mp4';
}

/**
 * Convert a video file to MP4 format using FFmpeg
 * Uses H.264 video codec and AAC audio codec for maximum browser compatibility
 *
 * @param {string} inputPath - Absolute path to the input video file
 * @param {string} outputPath - Absolute path where the converted MP4 should be saved
 * @returns {Promise<void>} Resolves when conversion is complete
 * @throws {Error} If FFmpeg conversion fails or FFmpeg is not installed
 */
export function convertToMP4(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    logger.info('Starting video conversion to MP4', {
      inputPath,
      outputPath,
      operation: 'video_conversion'
    });

    // FFmpeg command for conversion
    // -i: input file
    // -c:v libx264: use H.264 video codec
    // -preset fast: encoding speed/compression tradeoff
    // -crf 23: constant rate factor (quality, 23 is good default)
    // -c:a aac: use AAC audio codec
    // -b:a 128k: audio bitrate
    // -movflags +faststart: optimize for web streaming
    // -y: overwrite output file if exists
    const ffmpegArgs = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    let stderr = '';

    // Capture stderr for error messages and progress
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // Check if output file was created
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);

          logSuccess('Video conversion completed successfully', {
            inputPath,
            outputPath,
            outputSize: stats.size,
            operation: 'video_conversion'
          });

          resolve();
        } else {
          const error = new Error('FFmpeg conversion succeeded but output file not found');
          logError('FFmpeg output file missing', error, {
            inputPath,
            outputPath,
            operation: 'video_conversion'
          });
          reject(error);
        }
      } else {
        const error = new Error(`FFmpeg conversion failed with exit code ${code}`);
        logError('FFmpeg conversion failed', error, {
          inputPath,
          outputPath,
          exitCode: code,
          stderr: stderr.slice(-500), // Last 500 chars of error output
          operation: 'video_conversion'
        });
        reject(error);
      }
    });

    ffmpeg.on('error', (err) => {
      // This usually means ffmpeg is not installed
      logError('Failed to spawn FFmpeg process', err, {
        inputPath,
        outputPath,
        message: 'FFmpeg may not be installed or not in PATH',
        operation: 'video_conversion'
      });
      reject(new Error('FFmpeg is not installed or not accessible. Please install FFmpeg to convert videos.'));
    });
  });
}

/**
 * Convert uploaded video to MP4 if needed, then delete the original
 *
 * @param {string} uploadedFilePath - Path to the uploaded video file
 * @param {string} uploadsDir - Base uploads directory (used for backward compatibility, output goes to same dir as input)
 * @returns {Promise<string>} Filename of the MP4 video (either original or converted)
 */
export async function ensureMP4Format(uploadedFilePath, uploadsDir) {
  const filename = path.basename(uploadedFilePath);
  const inputDir = path.dirname(uploadedFilePath);

  // If already MP4, return as-is
  if (isMP4(filename)) {
    logger.info('Video is already MP4 format', {
      filename,
      operation: 'video_conversion'
    });
    return filename;
  }

  // Generate MP4 filename - save in same directory as input file
  const nameWithoutExt = path.parse(filename).name;
  const mp4Filename = `${nameWithoutExt}.mp4`;
  const mp4Path = path.join(inputDir, mp4Filename);

  logger.info('Converting video to MP4 format', {
    originalFilename: filename,
    mp4Filename,
    operation: 'video_conversion'
  });

  try {
    // Convert to MP4
    await convertToMP4(uploadedFilePath, mp4Path);

    // Delete original file after successful conversion
    fs.unlinkSync(uploadedFilePath);

    logger.info('Deleted original non-MP4 video after conversion', {
      deletedFile: filename,
      operation: 'video_conversion'
    });

    return mp4Filename;
  } catch (error) {
    // If conversion fails, keep the original and log error
    logError('Video conversion failed, keeping original file', error, {
      originalFilename: filename,
      operation: 'video_conversion'
    });

    // Re-throw to let caller handle
    throw error;
  }
}
