import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

/**
 * Storage configuration from environment variables
 */
const STORAGE_CONFIG = {
  provider: process.env.STORAGE_PROVIDER || 'local', // 'local' or 'r2'
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME || 'dashworld-uploads',
    publicUrl: process.env.R2_PUBLIC_URL // e.g., https://pub-xxx.r2.dev or custom domain
  },
  local: {
    uploadsDir: process.env.UPLOAD_DIR || '../uploads',
    thumbnailsDir: process.env.THUMBNAILS_DIR || '../uploads/thumbnails'
  }
};

/**
 * S3 client for Cloudflare R2
 */
let s3Client = null;

/**
 * Initialize S3 client for R2
 * @returns {S3Client} Configured S3 client
 */
function getS3Client() {
  if (s3Client) return s3Client;

  if (!STORAGE_CONFIG.r2.accountId || !STORAGE_CONFIG.r2.accessKeyId || !STORAGE_CONFIG.r2.secretAccessKey) {
    throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${STORAGE_CONFIG.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: STORAGE_CONFIG.r2.accessKeyId,
      secretAccessKey: STORAGE_CONFIG.r2.secretAccessKey
    }
  });

  logger.info('R2 storage client initialized', { accountId: STORAGE_CONFIG.r2.accountId });
  return s3Client;
}

/**
 * Check if using cloud storage
 * @returns {boolean} True if using R2, false if local
 */
export function isCloudStorage() {
  return STORAGE_CONFIG.provider === 'r2';
}

/**
 * Upload a file to storage
 *
 * @param {Buffer|string} fileData - File buffer or path to local file
 * @param {string} key - Storage key (e.g., 'videos/video-123.mp4')
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadFile(fileData, key, contentType) {
  if (STORAGE_CONFIG.provider === 'r2') {
    return uploadToR2(fileData, key, contentType);
  } else {
    return saveToLocal(fileData, key);
  }
}

/**
 * Upload file to Cloudflare R2
 *
 * @param {Buffer|string} fileData - File buffer or path
 * @param {string} key - Storage key
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} Public URL
 */
async function uploadToR2(fileData, key, contentType) {
  const client = getS3Client();
  const bucket = STORAGE_CONFIG.r2.bucketName;

  // If fileData is a path, read the file
  let body;
  if (typeof fileData === 'string' && fs.existsSync(fileData)) {
    body = fs.createReadStream(fileData);
  } else {
    body = fileData;
  }

  try {
    // Use Upload for large files (multipart upload)
    const upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      }
    });

    await upload.done();

    const publicUrl = `${STORAGE_CONFIG.r2.publicUrl}/${key}`;

    logger.info('File uploaded to R2', {
      key,
      bucket,
      contentType,
      url: publicUrl
    });

    return publicUrl;
  } catch (error) {
    logger.error('Failed to upload file to R2', {
      key,
      bucket,
      error: error.message
    });
    throw error;
  }
}

/**
 * Save file to local filesystem
 *
 * @param {Buffer|string} fileData - File buffer or source path
 * @param {string} key - Storage key (used as relative path)
 * @returns {Promise<string>} Relative path to file
 */
async function saveToLocal(fileData, key) {
  const baseDir = path.resolve(process.cwd(), STORAGE_CONFIG.local.uploadsDir);
  const filePath = path.join(baseDir, key);
  const dir = path.dirname(filePath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // If fileData is a path, copy the file
  if (typeof fileData === 'string' && fs.existsSync(fileData)) {
    fs.copyFileSync(fileData, filePath);
  } else {
    fs.writeFileSync(filePath, fileData);
  }

  logger.info('File saved locally', { key, path: filePath });

  // Return relative path for local storage
  return key;
}

/**
 * Delete a file from storage
 *
 * @param {string} key - Storage key to delete
 * @returns {Promise<void>}
 */
export async function deleteFile(key) {
  if (STORAGE_CONFIG.provider === 'r2') {
    return deleteFromR2(key);
  } else {
    return deleteFromLocal(key);
  }
}

/**
 * Delete file from R2
 *
 * @param {string} key - Storage key
 * @returns {Promise<void>}
 */
async function deleteFromR2(key) {
  const client = getS3Client();
  const bucket = STORAGE_CONFIG.r2.bucketName;

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key
    }));

    logger.info('File deleted from R2', { key, bucket });
  } catch (error) {
    logger.error('Failed to delete file from R2', {
      key,
      bucket,
      error: error.message
    });
    throw error;
  }
}

/**
 * Delete file from local filesystem
 *
 * @param {string} key - Relative path to file
 * @returns {Promise<void>}
 */
async function deleteFromLocal(key) {
  const baseDir = path.resolve(process.cwd(), STORAGE_CONFIG.local.uploadsDir);
  const filePath = path.join(baseDir, key);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    logger.info('File deleted locally', { key, path: filePath });
  }
}

/**
 * Get the public URL for a stored file
 *
 * @param {string} key - Storage key
 * @returns {string} Public URL or local path
 */
export function getFileUrl(key) {
  if (!key) return null;

  if (STORAGE_CONFIG.provider === 'r2') {
    return `${STORAGE_CONFIG.r2.publicUrl}/${key}`;
  } else {
    // For local storage, return path relative to uploads
    return `/uploads/${key}`;
  }
}

/**
 * Upload a video file with all its resolutions
 *
 * @param {Object} files - Object with resolution keys and file paths
 * @param {string} baseFilename - Base filename without resolution prefix
 * @returns {Promise<Object>} Object with resolution keys and URLs
 */
export async function uploadVideoFiles(files, baseFilename) {
  const results = {};

  for (const [resolution, filePath] of Object.entries(files)) {
    if (filePath && fs.existsSync(filePath)) {
      const key = `videos/${resolution}-${baseFilename}`;
      results[resolution] = await uploadFile(filePath, key, 'video/mp4');
    }
  }

  return results;
}

/**
 * Upload thumbnail files
 *
 * @param {Object} thumbnails - Object with size keys and file paths/buffers
 * @param {string} baseFilename - Base filename
 * @returns {Promise<Object>} Object with size keys and URLs
 */
export async function uploadThumbnails(thumbnails, baseFilename) {
  const results = {};

  for (const [size, data] of Object.entries(thumbnails)) {
    if (data) {
      const key = `thumbnails/${size}-${baseFilename}`;
      results[size] = await uploadFile(data, key, 'image/jpeg');
    }
  }

  return results;
}

/**
 * Delete all files associated with a footage entry
 *
 * @param {Object} footage - Footage object with filename fields
 * @returns {Promise<void>}
 */
export async function deleteFootageFiles(footage) {
  const filesToDelete = [
    footage.filename && `videos/${footage.filename}`,
    footage.filename_240p && `videos/${footage.filename_240p}`,
    footage.filename_360p && `videos/${footage.filename_360p}`,
    footage.filename_480p && `videos/${footage.filename_480p}`,
    footage.filename_720p && `videos/${footage.filename_720p}`,
    footage.filename_1080p && `videos/${footage.filename_1080p}`,
    footage.thumbnail && `thumbnails/${footage.thumbnail}`,
    footage.thumbnail_small && `thumbnails/${footage.thumbnail_small}`,
    footage.thumbnail_medium && `thumbnails/${footage.thumbnail_medium}`,
    footage.thumbnail_large && `thumbnails/${footage.thumbnail_large}`
  ].filter(Boolean);

  for (const key of filesToDelete) {
    try {
      await deleteFile(key);
    } catch (error) {
      logger.warn('Failed to delete file', { key, error: error.message });
    }
  }
}

/**
 * Transform a footage object to include full URLs for all file fields
 * Used when sending footage data to the frontend
 *
 * @param {Object} footage - Footage object from database
 * @returns {Object} Footage object with URL fields added
 */
export function transformFootageUrls(footage) {
  if (!footage) return null;

  const getVideoUrl = (filename) => {
    if (!filename) return null;
    if (STORAGE_CONFIG.provider === 'r2') {
      return `${STORAGE_CONFIG.r2.publicUrl}/videos/${filename}`;
    }
    return `/uploads/${filename}`;
  };

  const getThumbnailUrl = (filename) => {
    if (!filename) return null;
    if (STORAGE_CONFIG.provider === 'r2') {
      return `${STORAGE_CONFIG.r2.publicUrl}/thumbnails/${filename}`;
    }
    return `/uploads/thumbnails/${filename}`;
  };

  return {
    ...footage,
    // Video URLs
    video_url: getVideoUrl(footage.filename),
    video_url_240p: getVideoUrl(footage.filename_240p),
    video_url_360p: getVideoUrl(footage.filename_360p),
    video_url_480p: getVideoUrl(footage.filename_480p),
    video_url_720p: getVideoUrl(footage.filename_720p),
    video_url_1080p: getVideoUrl(footage.filename_1080p),
    // Thumbnail URLs
    thumbnail_url: getThumbnailUrl(footage.thumbnail),
    thumbnail_url_small: getThumbnailUrl(footage.thumbnail_small),
    thumbnail_url_medium: getThumbnailUrl(footage.thumbnail_medium),
    thumbnail_url_large: getThumbnailUrl(footage.thumbnail_large)
  };
}

/**
 * Transform an array of footage objects to include full URLs
 *
 * @param {Array} footageList - Array of footage objects
 * @returns {Array} Array with URL fields added
 */
export function transformFootageListUrls(footageList) {
  if (!Array.isArray(footageList)) return [];
  return footageList.map(transformFootageUrls);
}

export default {
  isCloudStorage,
  uploadFile,
  deleteFile,
  getFileUrl,
  uploadVideoFiles,
  uploadThumbnails,
  deleteFootageFiles,
  transformFootageUrls,
  transformFootageListUrls
};
