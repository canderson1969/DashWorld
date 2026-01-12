/**
 * AWS Lambda function for video processing
 *
 * Downloads uncompressed video from R2, generates multiple quality versions
 * using FFmpeg, uploads them back to R2, and notifies the backend.
 *
 * Environment Variables:
 * - R2_ACCOUNT_ID: Cloudflare R2 account ID
 * - R2_ACCESS_KEY_ID: R2 access key
 * - R2_SECRET_ACCESS_KEY: R2 secret key
 * - R2_BUCKET_NAME: R2 bucket name
 * - BACKEND_WEBHOOK_URL: URL to notify when processing completes
 * - WEBHOOK_SECRET: Secret for webhook authentication
 */

import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { createWriteStream, createReadStream, unlinkSync, mkdirSync, existsSync, statSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import https from 'https';
import http from 'http';

// Quality presets for video encoding
const QUALITY_PRESETS = [
  { label: '240p', height: 240, videoBitrate: '400k', audioBitrate: '64k' },
  { label: '360p', height: 360, videoBitrate: '800k', audioBitrate: '96k' },
  { label: '480p', height: 480, videoBitrate: '1200k', audioBitrate: '128k' },
  { label: '720p', height: 720, videoBitrate: '2500k', audioBitrate: '128k' },
  { label: '1080p', height: 1080, videoBitrate: '5000k', audioBitrate: '192k' }
];

// Initialize S3 client for R2
function getS3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });
}

/**
 * Download file from R2 to local /tmp directory
 *
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} key - R2 object key
 * @param {string} localPath - Local file path to save to
 */
async function downloadFromR2(s3Client, key, localPath) {
  console.log(`Downloading ${key} to ${localPath}`);

  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key
  });

  const response = await s3Client.send(command);
  await pipeline(response.Body, createWriteStream(localPath));

  const stats = statSync(localPath);
  console.log(`Downloaded ${stats.size} bytes`);
}

/**
 * Upload file to R2
 *
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} localPath - Local file path
 * @param {string} key - R2 object key
 * @param {string} contentType - MIME type
 */
async function uploadToR2(s3Client, localPath, key, contentType) {
  console.log(`Uploading ${localPath} to ${key}`);

  const stats = statSync(localPath);
  const fileStream = createReadStream(localPath);

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
    ContentLength: stats.size
  });

  await s3Client.send(command);
  console.log(`Uploaded ${stats.size} bytes to ${key}`);
}

/**
 * Delete file from R2
 *
 * @param {S3Client} s3Client - S3 client instance
 * @param {string} key - R2 object key
 */
async function deleteFromR2(s3Client, key) {
  console.log(`Deleting ${key} from R2`);

  const command = new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key
  });

  await s3Client.send(command);
  console.log(`Deleted ${key}`);
}

/**
 * Run FFmpeg to generate a quality version
 *
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path for output video
 * @param {Object} quality - Quality preset
 * @returns {Promise<void>}
 */
function runFFmpeg(inputPath, outputPath, quality) {
  return new Promise((resolve, reject) => {
    console.log(`Generating ${quality.label} version...`);

    const args = [
      '-i', inputPath,
      '-vf', `scale=-2:${quality.height}`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-b:v', quality.videoBitrate,
      '-maxrate', quality.videoBitrate,
      '-bufsize', `${parseInt(quality.videoBitrate) * 2}k`,
      '-c:a', 'aac',
      '-b:a', quality.audioBitrate,
      '-movflags', '+faststart',
      '-y',
      outputPath
    ];

    const ffmpeg = spawn('/opt/bin/ffmpeg', args);

    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log(`${quality.label} completed successfully`);
        resolve();
      } else {
        console.error(`FFmpeg failed for ${quality.label}:`, stderr.slice(-500));
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Send webhook notification to backend
 *
 * @param {Object} payload - Webhook payload
 */
async function notifyBackend(payload) {
  const webhookUrl = process.env.BACKEND_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('No webhook URL configured, skipping notification');
    return;
  }

  const url = new URL(webhookUrl);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const req = httpModule.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Webhook-Secret': process.env.WEBHOOK_SECRET || ''
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`Webhook response: ${res.statusCode} - ${data}`);
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Main Lambda handler
 *
 * Event payload:
 * {
 *   footageId: number,
 *   originalR2Key: string,      // e.g., "originals/2026/01/11/42/video-xxx.mp4"
 *   outputBasePath: string,     // e.g., "2026/01/11/42"
 *   deleteOriginal: boolean     // Whether to delete original after processing
 * }
 */
export async function handler(event) {
  console.log('Lambda invoked with event:', JSON.stringify(event));

  const { footageId, originalR2Key, outputBasePath, deleteOriginal = false } = event;

  if (!footageId || !originalR2Key || !outputBasePath) {
    throw new Error('Missing required parameters: footageId, originalR2Key, outputBasePath');
  }

  const s3Client = getS3Client();
  const tmpDir = '/tmp';
  const inputPath = path.join(tmpDir, 'input.mp4');
  const results = {};

  try {
    // Download original video from R2
    await downloadFromR2(s3Client, originalR2Key, inputPath);

    // Process each quality level
    for (const quality of QUALITY_PRESETS) {
      const outputFilename = `${quality.label}-${Date.now()}-${Math.round(Math.random() * 1e9)}.mp4`;
      const outputPath = path.join(tmpDir, outputFilename);
      const r2Key = `videos/${outputBasePath}/${outputFilename}`;

      try {
        // Generate quality version
        await runFFmpeg(inputPath, outputPath, quality);

        // Upload to R2
        await uploadToR2(s3Client, outputPath, r2Key, 'video/mp4');

        // Store result
        results[quality.label] = {
          filename: `${outputBasePath}/${outputFilename}`,
          r2Key: r2Key,
          success: true
        };

        // Clean up local file
        unlinkSync(outputPath);
        console.log(`${quality.label} processed and uploaded`);

      } catch (qualityError) {
        console.error(`Failed to process ${quality.label}:`, qualityError.message);
        results[quality.label] = {
          success: false,
          error: qualityError.message
        };
      }
    }

    // Clean up input file
    unlinkSync(inputPath);

    // Optionally delete original from R2
    if (deleteOriginal) {
      try {
        await deleteFromR2(s3Client, originalR2Key);
      } catch (deleteError) {
        console.error('Failed to delete original:', deleteError.message);
      }
    }

    // Determine best available quality for main filename
    const qualityPreference = ['720p', '480p', '1080p', '360p', '240p'];
    let mainFilename = null;
    for (const q of qualityPreference) {
      if (results[q]?.success) {
        mainFilename = results[q].filename;
        break;
      }
    }

    // Notify backend of completion
    const webhookPayload = {
      footageId,
      status: 'completed',
      results,
      mainFilename,
      filename_240p: results['240p']?.filename || null,
      filename_360p: results['360p']?.filename || null,
      filename_480p: results['480p']?.filename || null,
      filename_720p: results['720p']?.filename || null,
      filename_1080p: results['1080p']?.filename || null
    };

    await notifyBackend(webhookPayload);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Video processing completed',
        footageId,
        results
      })
    };

  } catch (error) {
    console.error('Processing failed:', error);

    // Notify backend of failure
    await notifyBackend({
      footageId,
      status: 'failed',
      error: error.message
    });

    throw error;
  }
}
