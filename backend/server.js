import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import { logger, logSuccess, logError } from './utils/logger.js';
import { reverseGeocode } from './utils/geocoding.js';
import { authenticateToken } from './utils/auth.js';
import { ensureMP4Format } from './utils/videoConverter.js';
import { uploadLimiter, apiLimiter } from './utils/rateLimiter.js';
import {
  transformFootageUrls,
  transformFootageListUrls,
  uploadFile,
  isCloudStorage,
  getFileUrl
} from './utils/storage.js';
import { isLambdaEnabled, invokeVideoProcessing } from './utils/lambda.js';
import authRoutes from './routes/authRoutes.js';
import messagingRoutes from './routes/messagingRoutes.js';
import {
  SERVER_CONFIG,
  FILE_CONFIG,
  VALIDATION_RULES,
  MESSAGES
} from './config/server.config.js';
import {
  initializeDatabase,
  migrateFromJson,
  getAllFootage,
  getFootageById,
  getFootageCount,
  createFootage,
  updateFootage,
  deleteFootage,
  getAllRequests,
  getRequestsByFootageId,
  createRequest,
  setEncodingProgress,
  getEncodingProgress,
  clearEncodingProgress
} from './utils/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Use Railway's injected PORT, fallback to 5000 for local dev
const PORT = process.env.PORT || 5000;

console.log('PORT:', process.env.PORT);

app.get('/', (req, res) => res.send('Hello World!'));

// Bind to all interfaces
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// CORS configuration with origin validation
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.) in development
    if (!origin && SERVER_CONFIG.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (SERVER_CONFIG.CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Log rejected origins for debugging
    logger.warn('CORS request rejected', {
      origin,
      allowedOrigins: SERVER_CONFIG.CORS_ORIGINS
    });
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded videos with proper CORS headers for cross-origin isolation
app.use('/uploads', (req, res, next) => {
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.set('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
}, express.static(path.join(__dirname, SERVER_CONFIG.UPLOAD_DIR)));

// Apply general API rate limiter to all /api routes
// Limit: 100 requests per IP per minute
app.use('/api', apiLimiter);

// Auth routes
app.use('/api/auth', authRoutes);

// Messaging routes
app.use('/api', messagingRoutes);

// Directory paths from configuration
const uploadsDir = path.join(__dirname, SERVER_CONFIG.UPLOAD_DIR);
const thumbnailsDir = path.join(__dirname, SERVER_CONFIG.THUMBNAILS_DIR);
const dataDir = path.join(__dirname, SERVER_CONFIG.DATA_DIR);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Get date-based subdirectory path for file storage
 * Creates directories like: 2026/01/10/
 *
 * @param {Date} date - Date to use for path generation (defaults to now)
 * @returns {string} Date-based path segment (e.g., "2026/01/10")
 */
function getDateBasedPath(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * Ensure date-based directory exists and return full path
 *
 * @param {string} baseDir - Base directory (uploadsDir or thumbnailsDir)
 * @param {Date} date - Date to use for path generation
 * @returns {string} Full path to date-based directory
 */
function ensureDateBasedDir(baseDir, date = new Date()) {
  const datePath = getDateBasedPath(date);
  const fullPath = path.join(baseDir, datePath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
}

// Database initialization happens in startServer() below

/**
 * Generate a single quality version of a video
 *
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path to output video
 * @param {Object} qualityConfig - Quality configuration {height, videoBitrate, audioBitrate, label}
 * @param {number} footageId - Footage ID for progress tracking
 * @param {number} videoDuration - Total video duration in seconds
 * @returns {Promise<void>}
 */
function generateQualityVersion(inputPath, outputPath, qualityConfig, footageId, videoDuration) {
  return new Promise((resolve, reject) => {
    const { height, videoBitrate, audioBitrate, label } = qualityConfig;

    const ffmpegArgs = [
      '-i', inputPath,
      '-vf', `scale=-2:${height}`,
      '-c:v', 'libx264',
      '-b:v', videoBitrate,
      '-maxrate', videoBitrate,
      '-bufsize', `${parseInt(videoBitrate) * 2}`,
      '-preset', 'faster',
      '-c:a', 'aac',
      '-b:a', audioBitrate,
      '-movflags', '+faststart',
      '-y',
      outputPath
    ];

    const process = spawn('ffmpeg', ffmpegArgs);
    let stderrData = '';

    // Initialize progress for this quality (fire-and-forget async)
    setEncodingProgress(footageId, label, 0, 'processing').catch(err =>
      logger.error('Failed to set initial encoding progress', { error: err.message }));

    process.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;

      // Parse FFmpeg standard output for time progress
      // Format: frame=  123 fps= 30 q=28.0 size=    5678kB time=00:00:12.34 bitrate=3765.4kbits/s
      // Regex matches: time=HH:MM:SS.SS or time=HH:MM:SS
      const timeMatch = chunk.match(/time=(\d{2}):(\d{2}):(\d{2})\.?(\d{2})?/);
      if (timeMatch && videoDuration > 0) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseFloat(timeMatch[3] + '.' + (timeMatch[4] || '00'));
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        const progress = Math.min(Math.round((currentTime / videoDuration) * 100), 100);

        // Log progress updates (use info so it's visible in logs)
        logger.info('FFmpeg encoding progress', {
          footageId,
          quality: label,
          currentTime: currentTime.toFixed(2),
          duration: videoDuration,
          progress
        });

        // Update progress in database (fire-and-forget async)
        setEncodingProgress(footageId, label, progress, 'processing').catch(err =>
          logger.error('Failed to update encoding progress', { error: err.message }));
      }
    });

    process.on('error', (error) => {
      // Mark as failed (fire-and-forget async)
      setEncodingProgress(footageId, label, 0, 'failed').catch(err =>
        logger.error('Failed to set failed encoding progress', { error: err.message }));
      reject(error);
    });

    process.on('close', (code) => {
      if (code !== 0) {
        // Mark as failed (fire-and-forget async)
        setEncodingProgress(footageId, label, 0, 'failed').catch(err =>
          logger.error('Failed to set failed encoding progress', { error: err.message }));
        reject(new Error(`FFmpeg exited with code ${code}: ${stderrData}`));
      } else {
        // Mark as complete (fire-and-forget async)
        setEncodingProgress(footageId, label, 100, 'completed').catch(err =>
          logger.error('Failed to set completed encoding progress', { error: err.message }));
        resolve();
      }
    });
  });
}

/**
 * Compress video in background generating multiple quality versions
 *
 * @param {number} footageId - ID of the footage to compress
 * @param {string} filename - Original filename
 */
async function compressVideoBackground(footageId, filename) {
  const inputPath = path.join(uploadsDir, filename);

  // Extract date path from filename (e.g., "2026/01/10" from "2026/01/10/video-xxx.mp4")
  // For backward compatibility, files without date path will have datePath = "."
  const datePath = path.dirname(filename);
  const baseFilename = path.basename(filename);

  // Verify input file exists
  if (!fs.existsSync(inputPath)) {
    logger.error('Original video file not found for background compression', {
      footageId,
      filename,
      inputPath,
      operation: 'compress_video_background'
    });
    return;
  }

  // Get video duration from database
  let videoDuration = 0;
  try {
    const footageItem = await getFootageById(footageId);
    videoDuration = footageItem?.duration || 0;
  } catch (error) {
    logger.warn('Could not get video duration for progress tracking', {
      footageId,
      error: error.message
    });
  }

  logger.info('Starting background video compression (multiple qualities)', {
    footageId,
    filename,
    inputSize: fs.statSync(inputPath).size,
    videoDuration,
    operation: 'compress_video_background'
  });

  // Define quality levels
  const qualities = [
    { label: '240p', height: 240, videoBitrate: '400k', audioBitrate: '64k' },
    { label: '360p', height: 360, videoBitrate: '800k', audioBitrate: '96k' },
    { label: '480p', height: 480, videoBitrate: '1200k', audioBitrate: '128k' },
    { label: '720p', height: 720, videoBitrate: '2500k', audioBitrate: '128k' },
    { label: '1080p', height: 1080, videoBitrate: '5000k', audioBitrate: '192k' }
  ];

  const qualityFilenames = {};
  const timestamp = Date.now();
  const randomId = Math.round(Math.random() * 1E9);

  try {
    // Create ID subfolder within the date directory for organized storage
    const baseDateDir = datePath !== '.' ? path.join(uploadsDir, datePath) : uploadsDir;
    const outputDir = path.join(baseDateDir, String(footageId));

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const quality of qualities) {
      const outputBasename = `${quality.label}-${timestamp}-${randomId}${path.extname(baseFilename)}`;
      const outputPath = path.join(outputDir, outputBasename);
      // Store full path with date prefix and ID folder for database
      const outputFilename = datePath !== '.'
        ? `${datePath}/${footageId}/${outputBasename}`
        : `${footageId}/${outputBasename}`;

      logger.info(`Generating ${quality.label} version`, {
        footageId,
        quality: quality.label,
        operation: 'generate_quality_version'
      });

      await generateQualityVersion(inputPath, outputPath, quality, footageId, videoDuration);

      // Verify output file was created
      if (fs.existsSync(outputPath)) {
        qualityFilenames[quality.label] = outputFilename;
        const outputStats = fs.statSync(outputPath);
        logger.info(`${quality.label} version generated successfully`, {
          footageId,
          quality: quality.label,
          size: outputStats.size,
          operation: 'generate_quality_version'
        });

        // Upload to R2 if cloud storage is enabled
        if (isCloudStorage()) {
          const r2Key = `videos/${outputFilename.replace(/\\/g, '/')}`;
          await uploadFile(outputPath, r2Key, 'video/mp4');
          fs.unlinkSync(outputPath); // Clean up local file after R2 upload
          logger.info(`${quality.label} uploaded to R2`, {
            footageId,
            quality: quality.label,
            r2Key,
            operation: 'upload_to_r2'
          });
        }

        // Update database immediately after each quality completes
        await updateFootage(footageId, {
          [`filename_${quality.label}`]: outputFilename.replace(/\\/g, '/'),
          // Update main filename to best available quality (prefer 720p, then 480p, then 1080p, then 360p, then 240p)
          filename: qualityFilenames['720p'] || qualityFilenames['480p'] || qualityFilenames['1080p'] || qualityFilenames['360p'] || qualityFilenames['240p'] || filename
        });

        logger.info(`Database updated with ${quality.label}`, {
          footageId,
          quality: quality.label,
          operation: 'update_quality_in_db'
        });
      }
    }

    const inputStats = fs.statSync(inputPath);

    logSuccess('Background video compression completed (all qualities)', {
      footageId,
      originalFilename: filename,
      originalSize: inputStats.size,
      qualities: Object.keys(qualityFilenames),
      operation: 'compress_video_background'
    });

    // Delete original uncompressed file after all quality versions are successfully generated
    try {
      fs.unlinkSync(inputPath);
      logger.info('Deleted original uncompressed footage file', {
        footageId,
        filename,
        deletedPath: inputPath,
        operation: 'delete_original_footage'
      });
    } catch (deleteError) {
      logError('Failed to delete original footage file', deleteError instanceof Error ? deleteError : new Error(String(deleteError)), {
        footageId,
        filename,
        inputPath,
        operation: 'delete_original_footage'
      });
    }

    // Clean up progress data after 1 minute (allow frontend to fetch final state)
    setTimeout(async () => {
      await clearEncodingProgress(footageId);
      logger.info('Cleaned up encoding progress data', { footageId });
    }, 60000);
  } catch (error) {
    logError('Failed to generate quality versions', error instanceof Error ? error : new Error(String(error)), {
      footageId,
      filename,
      operation: 'compress_video_background'
    });

    // Clean up any generated files on error
    Object.values(qualityFilenames).forEach(filename => {
      const filePath = path.join(uploadsDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }
}

// Configure multer for video uploads with date-based organization
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use date-based directory for better file organization
    const dateDir = ensureDateBasedDir(uploadsDir);
    // Store the date path in request for later use when saving to database
    if (!req.uploadDatePath) {
      req.uploadDatePath = getDateBasedPath();
    }
    cb(null, dateDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * FILE_CONFIG.RANDOM_SUFFIX_MAX);
    const prefix = file.fieldname === 'video' ? FILE_CONFIG.VIDEO_PREFIX : FILE_CONFIG.THUMBNAIL_PREFIX;
    cb(null, prefix + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: FILE_CONFIG.MAX_FILE_SIZE_BYTES
  },
  fileFilter: (req, file, cb) => {
    // Allow videos and images (for thumbnails)
    const isVideo = FILE_CONFIG.ALLOWED_VIDEO_TYPES.includes(file.mimetype);
    const isImage = FILE_CONFIG.ALLOWED_IMAGE_TYPES.includes(file.mimetype);

    if (isVideo || isImage) {
      cb(null, true);
    } else {
      cb(new Error(MESSAGES.INVALID_VIDEO_TYPE), false);
    }
  }
});

// API Routes

// Get all footage (with pagination support)
app.get('/api/footage', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 1000;
    const offset = parseInt(req.query.offset) || 0;

    const footage = await getAllFootage({ limit, offset });
    const total = await getFootageCount();

    logSuccess('Fetched all footage', {
      count: footage.length,
      total,
      limit,
      offset,
      operation: 'fetch_all_footage'
    });

    // Transform footage to include full URLs
    const transformedFootage = transformFootageListUrls(footage);

    // Return with pagination metadata if pagination params provided
    if (req.query.limit || req.query.offset) {
      res.json({
        data: transformedFootage,
        pagination: { total, limit, offset, hasMore: offset + footage.length < total }
      });
    } else {
      res.json(transformedFootage);
    }
  } catch (error) {
    logError('Failed to fetch footage from database', error, {
      operation: 'fetch_all_footage'
    });

    res.status(500).json({ error: 'Failed to fetch footage' });
  }
});

// Get single footage by ID
app.get('/api/footage/:id', async (req, res) => {
  try {
    const footageId = parseInt(req.params.id);
    const item = await getFootageById(footageId);

    if (!item) {
      logger.warn('Footage not found', {
        footageId: footageId,
        requestedId: req.params.id,
        operation: 'fetch_footage_by_id'
      });

      return res.status(404).json({ error: 'Footage not found' });
    }

    logSuccess('Fetched footage by ID', {
      footageId: item.id,
      filename: item.filename,
      operation: 'fetch_footage_by_id'
    });

    res.json(transformFootageUrls(item));
  } catch (error) {
    logError('Failed to fetch footage by ID', error, {
      requestedId: req.params.id,
      operation: 'fetch_footage_by_id'
    });

    res.status(500).json({ error: 'Failed to fetch footage' });
  }
});

// Get encoding progress for a footage item
app.get('/api/footage/:id/encoding-progress', async (req, res) => {
  try {
    const footageId = parseInt(req.params.id);
    const progress = await getEncodingProgress(footageId);

    logger.debug('Encoding progress fetched', {
      footageId,
      progress,
      operation: 'fetch_encoding_progress'
    });
    res.json(progress);
  } catch (error) {
    logError('Failed to fetch encoding progress', error, {
      requestedId: req.params.id,
      operation: 'fetch_encoding_progress'
    });
    res.status(500).json({ error: 'Failed to fetch encoding progress' });
  }
});

// Lambda webhook for video processing completion
// Called by Lambda function after processing completes
app.post('/api/webhooks/lambda/video-processed', async (req, res) => {
  try {
    // Verify webhook secret
    const webhookSecret = req.headers['x-webhook-secret'];
    if (process.env.WEBHOOK_SECRET && webhookSecret !== process.env.WEBHOOK_SECRET) {
      logger.warn('Invalid webhook secret', {
        operation: 'lambda_webhook_auth_failed'
      });
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const {
      footageId,
      status,
      results,
      mainFilename,
      filename_240p,
      filename_360p,
      filename_480p,
      filename_720p,
      filename_1080p,
      error: errorMessage
    } = req.body;

    if (!footageId) {
      return res.status(400).json({ error: 'Missing footageId' });
    }

    logger.info('Lambda webhook received', {
      footageId,
      status,
      operation: 'lambda_webhook_received'
    });

    if (status === 'completed') {
      // Update database with processed video paths
      const updateData = {
        processing_status: 'completed',
        filename: mainFilename || undefined,
        filename_240p: filename_240p || undefined,
        filename_360p: filename_360p || undefined,
        filename_480p: filename_480p || undefined,
        filename_720p: filename_720p || undefined,
        filename_1080p: filename_1080p || undefined
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) delete updateData[key];
      });

      await updateFootage(footageId, updateData);

      // Clear any encoding progress data
      await clearEncodingProgress(footageId);

      logSuccess('Video processing completed via Lambda', {
        footageId,
        qualities: Object.keys(results || {}).filter(k => results[k]?.success),
        operation: 'lambda_processing_completed'
      });

    } else if (status === 'failed') {
      await updateFootage(footageId, { processing_status: 'failed' });

      logError('Video processing failed via Lambda', new Error(errorMessage || 'Unknown error'), {
        footageId,
        operation: 'lambda_processing_failed'
      });
    }

    res.json({ success: true });

  } catch (error) {
    logError('Lambda webhook handler failed', error, {
      operation: 'lambda_webhook_error'
    });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Upload new footage (protected route - requires authentication)
// Rate limited: 20 uploads per IP per hour
app.post('/api/footage/upload', uploadLimiter, authenticateToken, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail_small', maxCount: 1 },
  { name: 'thumbnail_medium', maxCount: 1 },
  { name: 'thumbnail_large', maxCount: 1 }
]), async (req, res) => {
  try {
    if (!req.files || !req.files.video) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const videoFile = req.files.video[0];
    const thumbnailSmall = req.files.thumbnail_small ? req.files.thumbnail_small[0] : null;
    const thumbnailMedium = req.files.thumbnail_medium ? req.files.thumbnail_medium[0] : null;
    const thumbnailLarge = req.files.thumbnail_large ? req.files.thumbnail_large[0] : null;

    const { lat, lng, incidentDate, incidentTime, incidentType, description, duration, isGraphicContent, contentWarnings } = req.body;

    // Validate required fields
    if (!lat || !lng || !incidentDate || !incidentTime || !incidentType) {
      // Delete uploaded files if validation fails
      fs.unlinkSync(videoFile.path);
      if (thumbnailSmall) fs.unlinkSync(thumbnailSmall.path);
      if (thumbnailMedium) fs.unlinkSync(thumbnailMedium.path);
      if (thumbnailLarge) fs.unlinkSync(thumbnailLarge.path);
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Perform reverse geocoding to get actual location name
    const locationName = await reverseGeocode(parseFloat(lat), parseFloat(lng));

    // Convert video to MP4 if needed (handles AVI, MOV, MKV, WEBM, FLV)
    let finalVideoFilename;
    try {
      finalVideoFilename = await ensureMP4Format(videoFile.path, uploadsDir);

      logger.info('Video format ensured', {
        originalFilename: videoFile.filename,
        finalFilename: finalVideoFilename,
        operation: 'upload_footage'
      });
    } catch (error) {
      // If conversion fails, delete uploaded files and return error
      if (fs.existsSync(videoFile.path)) {
        fs.unlinkSync(videoFile.path);
      }
      if (thumbnailSmall) fs.unlinkSync(thumbnailSmall.path);
      if (thumbnailMedium) fs.unlinkSync(thumbnailMedium.path);
      if (thumbnailLarge) fs.unlinkSync(thumbnailLarge.path);

      logError('Video format conversion failed', error, {
        originalFilename: videoFile.filename,
        operation: 'upload_footage'
      });

      return res.status(500).json({
        error: 'Failed to process video format. Please ensure FFmpeg is installed or upload an MP4 file.'
      });
    }

    // Move thumbnails to date-based thumbnails directory if provided
    const thumbnailDateDir = ensureDateBasedDir(thumbnailsDir);
    const thumbnailDatePath = req.uploadDatePath || getDateBasedPath();

    let thumbnailSmallFilename = null;
    let thumbnailMediumFilename = null;
    let thumbnailLargeFilename = null;

    // Temporarily store thumbnails in date folder - will be moved to ID folder after DB insert
    if (thumbnailSmall) {
      const thumbnailDest = path.join(thumbnailDateDir, thumbnailSmall.filename);
      fs.renameSync(thumbnailSmall.path, thumbnailDest);
      thumbnailSmallFilename = thumbnailSmall.filename;
    }

    if (thumbnailMedium) {
      const thumbnailDest = path.join(thumbnailDateDir, thumbnailMedium.filename);
      fs.renameSync(thumbnailMedium.path, thumbnailDest);
      thumbnailMediumFilename = thumbnailMedium.filename;
    }

    if (thumbnailLarge) {
      const thumbnailDest = path.join(thumbnailDateDir, thumbnailLarge.filename);
      fs.renameSync(thumbnailLarge.path, thumbnailDest);
      thumbnailLargeFilename = thumbnailLarge.filename;
    }

    // Parse content warnings if provided
    let parsedContentWarnings = null;
    if (contentWarnings) {
      try {
        parsedContentWarnings = JSON.parse(contentWarnings);
      } catch (error) {
        logger.warn('Failed to parse content warnings', {
          contentWarnings,
          error: error.message
        });
      }
    }

    // Create new footage entry with date-based paths
    const videoDatePath = req.uploadDatePath || getDateBasedPath();
    const fullVideoFilename = `${videoDatePath}/${finalVideoFilename}`;

    const newFootage = await createFootage({
      user_id: req.user.id,
      filename: fullVideoFilename, // Includes date path (e.g., "2026/01/10/video-xxx.mp4")
      filename_compressed: null,
      thumbnail: thumbnailMediumFilename, // Default to medium for backward compatibility
      thumbnail_small: thumbnailSmallFilename,
      thumbnail_medium: thumbnailMediumFilename,
      thumbnail_large: thumbnailLargeFilename,
      location_name: locationName,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      incident_date: incidentDate,
      incident_time: incidentTime,
      incident_type: incidentType,
      description: description || null,
      duration: duration ? parseFloat(duration) : null,
      is_graphic_content: isGraphicContent === 'true',
      content_warnings: parsedContentWarnings,
      created_at: new Date().toISOString()
    });

    const newId = newFootage.id;

    // Create ID subfolder for thumbnails and move them there
    const thumbnailIdDir = path.join(thumbnailDateDir, String(newId));
    if (!fs.existsSync(thumbnailIdDir)) {
      fs.mkdirSync(thumbnailIdDir, { recursive: true });
    }

    // Move thumbnails to ID folder and upload to R2
    let finalThumbnailSmall = null;
    let finalThumbnailMedium = null;
    let finalThumbnailLarge = null;

    if (thumbnailSmallFilename) {
      const srcPath = path.join(thumbnailDateDir, thumbnailSmallFilename);
      const destPath = path.join(thumbnailIdDir, thumbnailSmallFilename);
      fs.renameSync(srcPath, destPath);
      finalThumbnailSmall = `${thumbnailDatePath}/${newId}/${thumbnailSmallFilename}`;

      if (isCloudStorage()) {
        await uploadFile(destPath, `thumbnails/${finalThumbnailSmall}`, 'image/jpeg');
        fs.unlinkSync(destPath);
      }
    }

    if (thumbnailMediumFilename) {
      const srcPath = path.join(thumbnailDateDir, thumbnailMediumFilename);
      const destPath = path.join(thumbnailIdDir, thumbnailMediumFilename);
      fs.renameSync(srcPath, destPath);
      finalThumbnailMedium = `${thumbnailDatePath}/${newId}/${thumbnailMediumFilename}`;

      if (isCloudStorage()) {
        await uploadFile(destPath, `thumbnails/${finalThumbnailMedium}`, 'image/jpeg');
        fs.unlinkSync(destPath);
      }
    }

    if (thumbnailLargeFilename) {
      const srcPath = path.join(thumbnailDateDir, thumbnailLargeFilename);
      const destPath = path.join(thumbnailIdDir, thumbnailLargeFilename);
      fs.renameSync(srcPath, destPath);
      finalThumbnailLarge = `${thumbnailDatePath}/${newId}/${thumbnailLargeFilename}`;

      if (isCloudStorage()) {
        await uploadFile(destPath, `thumbnails/${finalThumbnailLarge}`, 'image/jpeg');
        fs.unlinkSync(destPath);
      }
    }

    // Upload uncompressed video to R2 (in originals folder for Lambda processing)
    const localVideoPath = path.join(uploadsDir, videoDatePath, finalVideoFilename);
    const originalR2Key = `originals/${videoDatePath}/${newId}/${finalVideoFilename}`;

    if (isCloudStorage()) {
      await uploadFile(localVideoPath, originalR2Key, 'video/mp4');
      fs.unlinkSync(localVideoPath); // Clean up local file after R2 upload
      logger.info('Original video uploaded to R2', {
        footageId: newId,
        r2Key: originalR2Key,
        operation: 'upload_original_to_r2'
      });
    }

    // Update database with final paths including ID folder
    const finalVideoPath = `${videoDatePath}/${newId}/${finalVideoFilename}`;
    await updateFootage(newId, {
      filename: finalVideoPath,
      filename_original: originalR2Key, // Store original R2 key for Lambda processing
      thumbnail: finalThumbnailMedium,
      thumbnail_small: finalThumbnailSmall,
      thumbnail_medium: finalThumbnailMedium,
      thumbnail_large: finalThumbnailLarge
    });

    logSuccess('Footage uploaded successfully', {
      footageId: newId,
      filename: finalVideoFilename,
      originalR2Key: originalR2Key,
      thumbnailSmall: finalThumbnailSmall,
      thumbnailMedium: finalThumbnailMedium,
      thumbnailLarge: finalThumbnailLarge,
      locationName: locationName,
      incidentType: incidentType,
      incidentDate: incidentDate,
      fileSize: videoFile.size,
      operation: 'upload_footage'
    });

    res.json({
      success: true,
      id: newId,
      message: 'Footage uploaded successfully'
    });

    // Trigger video processing
    if (isCloudStorage() && isLambdaEnabled()) {
      // Cloud mode with Lambda - invoke Lambda for processing
      logger.info('Triggering Lambda for video processing', {
        footageId: newId,
        originalR2Key: originalR2Key,
        operation: 'trigger_lambda'
      });

      try {
        await updateFootage(newId, { processing_status: 'processing' });

        await invokeVideoProcessing({
          footageId: newId,
          originalR2Key: originalR2Key,
          outputBasePath: `${videoDatePath}/${newId}`,
          deleteOriginal: false // Keep original for potential re-processing
        });

        logger.info('Lambda invoked successfully', {
          footageId: newId,
          operation: 'lambda_invoked'
        });
      } catch (lambdaError) {
        logger.error('Failed to invoke Lambda, falling back to local processing', {
          footageId: newId,
          error: lambdaError.message,
          operation: 'lambda_fallback'
        });
        // Fall back to local processing on Lambda failure
        compressVideoBackground(newId, fullVideoFilename);
      }
    } else if (isCloudStorage()) {
      // Cloud mode without Lambda - local processing, upload results to R2
      logger.info('Lambda not configured, using local processing with R2 upload', {
        footageId: newId,
        operation: 'local_processing_r2'
      });
      await updateFootage(newId, { processing_status: 'processing' });
      compressVideoBackground(newId, fullVideoFilename);
    } else {
      // Local storage mode - use local processing
      logger.info('Using local video processing', {
        footageId: newId,
        filename: fullVideoFilename,
        operation: 'local_processing'
      });
      await updateFootage(newId, { processing_status: 'processing' });
      compressVideoBackground(newId, fullVideoFilename);
    }
  } catch (error) {
    logError('Failed to upload footage', error, {
      videoFilename: req.files?.video?.[0]?.filename,
      thumbnailSmall: req.files?.thumbnail_small?.[0]?.filename,
      thumbnailMedium: req.files?.thumbnail_medium?.[0]?.filename,
      thumbnailLarge: req.files?.thumbnail_large?.[0]?.filename,
      locationName: req.body.locationName,
      operation: 'upload_footage'
    });

    // Clean up uploaded files on error
    if (req.files) {
      if (req.files.video) {
        fs.unlinkSync(req.files.video[0].path);
        logger.info('Cleaned up uploaded video after error', {
          filename: req.files.video[0].filename
        });
      }
      if (req.files.thumbnail_small) {
        fs.unlinkSync(req.files.thumbnail_small[0].path);
        logger.info('Cleaned up uploaded thumbnail_small after error', {
          filename: req.files.thumbnail_small[0].filename
        });
      }
      if (req.files.thumbnail_medium) {
        fs.unlinkSync(req.files.thumbnail_medium[0].path);
        logger.info('Cleaned up uploaded thumbnail_medium after error', {
          filename: req.files.thumbnail_medium[0].filename
        });
      }
      if (req.files.thumbnail_large) {
        fs.unlinkSync(req.files.thumbnail_large[0].path);
        logger.info('Cleaned up uploaded thumbnail_large after error', {
          filename: req.files.thumbnail_large[0].filename
        });
      }
    }

    res.status(500).json({ error: 'Failed to upload footage' });
  }
});

// Delete footage (protected route - requires authentication)
app.delete('/api/footage/:id', authenticateToken, async (req, res) => {
  try {
    const footageId = parseInt(req.params.id);
    const footageItem = await getFootageById(footageId);

    if (!footageItem) {
      logger.warn('Delete footage failed - not found', {
        footageId,
        userId: req.user.id,
        operation: 'delete_footage'
      });
      return res.status(404).json({ error: 'Footage not found' });
    }

    // Check if user owns this footage or is moderator/admin
    const userRole = req.user.role || 'user';
    const isModerator = userRole === 'moderator' || userRole === 'admin';
    const isOwner = footageItem.user_id === req.user.id;

    if (!isOwner && !isModerator) {
      logger.warn('Delete footage failed - unauthorized', {
        footageId,
        footageUserId: footageItem.user_id,
        requestUserId: req.user.id,
        requestUserRole: userRole,
        operation: 'delete_footage'
      });
      return res.status(403).json({ error: 'You can only delete your own footage' });
    }

    // Delete video file
    const videoPath = path.join(uploadsDir, footageItem.filename);
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
      logger.info('Deleted video file', {
        footageId,
        filename: footageItem.filename
      });
    }

    // Delete thumbnail files (all sizes)
    const thumbnailFields = ['thumbnail_small', 'thumbnail_medium', 'thumbnail_large', 'thumbnail'];

    thumbnailFields.forEach(field => {
      if (footageItem[field]) {
        const thumbnailPath = path.join(thumbnailsDir, footageItem[field]);
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
          logger.info('Deleted thumbnail file', {
            footageId,
            field,
            filename: footageItem[field]
          });
        }
      }
    });

    // Remove from database
    await deleteFootage(footageId);

    logSuccess('Footage deleted successfully', {
      footageId,
      userId: req.user.id,
      filename: footageItem.filename,
      operation: 'delete_footage'
    });

    res.json({
      success: true,
      message: 'Footage deleted successfully'
    });
  } catch (error) {
    logError('Failed to delete footage', error, {
      footageId: req.params.id,
      userId: req.user?.id,
      operation: 'delete_footage'
    });

    res.status(500).json({ error: 'Failed to delete footage' });
  }
});

// Submit footage request
app.post('/api/footage/:id/request', async (req, res) => {
  try {
    const { name, email, reason, message } = req.body;
    const footageId = parseInt(req.params.id);

    // Validate required fields
    if (!name || !email || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if footage exists
    const footageItem = await getFootageById(footageId);
    if (!footageItem) {
      return res.status(404).json({ error: 'Footage not found' });
    }

    // Create new request
    const newRequest = await createRequest({
      footage_id: footageId,
      requester_name: name,
      requester_email: email,
      reason: reason,
      message: message || null,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    const newId = newRequest.id;

    logSuccess('Footage request submitted', {
      requestId: newId,
      footageId: footageId,
      requesterEmail: email,
      requesterName: name,
      reason: reason,
      operation: 'submit_request'
    });

    res.json({
      success: true,
      id: newId,
      message: 'Request submitted successfully'
    });
  } catch (error) {
    logError('Failed to submit footage request', error, {
      footageId: req.params.id,
      requesterEmail: req.body.email,
      reason: req.body.reason,
      operation: 'submit_request'
    });

    res.status(500).json({ error: 'Failed to submit request' });
  }
});

// Update footage description (moderator/admin only)
app.patch('/api/footage/:id/description', authenticateToken, async (req, res) => {
  try {
    const footageId = parseInt(req.params.id);
    const { description } = req.body;

    // Check user role
    const userRole = req.user.role || 'user';
    const isModerator = userRole === 'moderator' || userRole === 'admin';

    if (!isModerator) {
      logger.warn('Update footage failed - insufficient permissions', {
        footageId,
        userId: req.user.id,
        userRole,
        operation: 'update_footage_description'
      });
      return res.status(403).json({ error: 'Moderator or admin privileges required' });
    }

    const footageItem = await getFootageById(footageId);

    if (!footageItem) {
      logger.warn('Update footage failed - not found', {
        footageId,
        userId: req.user.id,
        operation: 'update_footage_description'
      });
      return res.status(404).json({ error: 'Footage not found' });
    }

    // Update description
    await updateFootage(footageId, { description: description || null });

    logSuccess('Footage description updated', {
      footageId,
      userId: req.user.id,
      userRole,
      operation: 'update_footage_description'
    });

    res.json({
      success: true,
      message: 'Description updated successfully',
      footage: transformFootageUrls({ ...footageItem, description: description || null })
    });
  } catch (error) {
    logError('Failed to update footage description', error, {
      footageId: req.params.id,
      userId: req.user?.id,
      operation: 'update_footage_description'
    });

    res.status(500).json({ error: 'Failed to update footage description' });
  }
});

// Get requests for a footage
app.get('/api/footage/:id/requests', async (req, res) => {
  try {
    const footageId = parseInt(req.params.id);
    const footageRequests = await getRequestsByFootageId(footageId);
    res.json(footageRequests);
  } catch (error) {
    logError('Failed to fetch footage requests', error, {
      footageId: req.params.id,
      operation: 'fetch_requests'
    });

    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

/**
 * Proxy OpenStreetMap tiles to avoid CORS issues with cross-origin isolation
 */
app.get('/api/tiles/:z/:x/:y.png', async (req, res) => {
  const { z, x, y } = req.params;
  const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  try {
    const response = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'DashWorld/1.0'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('Tile not found');
    }

    // Set appropriate headers
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error('Failed to proxy map tile', {
      z, x, y,
      error: error.message
    });
    res.status(500).send('Failed to load tile');
  }
});

/**
 * Proxy FFmpeg library files to avoid CORS issues with cross-origin isolation
 */
app.get('/api/ffmpeg/:version/:file', async (req, res) => {
  const { version, file } = req.params;
  const ffmpegUrl = `https://unpkg.com/@ffmpeg/core@${version}/dist/umd/${file}`;

  try {
    const response = await fetch(ffmpegUrl);

    if (!response.ok) {
      logger.error('FFmpeg file not found', { version, file, status: response.status });
      return res.status(response.status).send('FFmpeg file not found');
    }

    // Determine content type based on file extension
    let contentType = 'application/octet-stream';
    if (file.endsWith('.js')) {
      contentType = 'text/javascript';
    } else if (file.endsWith('.wasm')) {
      contentType = 'application/wasm';
    }

    // Set appropriate headers for cross-origin isolation
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year (immutable)
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Cross-Origin-Embedder-Policy', 'require-corp');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));

    logger.debug('FFmpeg file proxied successfully', { version, file, size: buffer.byteLength });
  } catch (error) {
    logger.error('Failed to proxy FFmpeg file', {
      version,
      file,
      error: error.message
    });
    res.status(500).send('Failed to load FFmpeg file');
  }
});

/**
 * Trim video server-side using FFmpeg
 *
 * @param {File} videoFile - Video file uploaded by user
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @returns {Promise<string>} Path to trimmed video file
 * @throws {Error} If FFmpeg is not installed or trimming fails
 */
app.post('/api/trim-video', upload.single('video'), async (req, res) => {
  const { startTime, endTime } = req.body;

  if (!req.file) {
    logger.warn('Trim video request missing file', {
      startTime,
      endTime,
      operation: 'trim_video'
    });
    return res.status(400).json({ error: 'No video file provided' });
  }

  if (!startTime || !endTime) {
    logger.warn('Trim video request missing time parameters', {
      filename: req.file.filename,
      startTime,
      endTime,
      operation: 'trim_video'
    });
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Start time and end time are required' });
  }

  const start = parseFloat(startTime);
  const end = parseFloat(endTime);
  const duration = end - start;

  if (start < 0 || end <= start || duration <= 0) {
    logger.warn('Invalid trim time parameters', {
      filename: req.file.filename,
      startTime: start,
      endTime: end,
      duration,
      operation: 'trim_video'
    });
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid time range' });
  }

  const inputPath = req.file.path;
  const outputFilename = `trimmed-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.filename)}`;
  const outputPath = path.join(uploadsDir, outputFilename);

  logger.info('Starting server-side video trim', {
    filename: req.file.filename,
    fileSize: req.file.size,
    startTime: start,
    endTime: end,
    duration,
    operation: 'trim_video'
  });

  // Check if FFmpeg is installed
  const ffmpegProcess = spawn('ffmpeg', ['-version']);
  let responded = false;

  ffmpegProcess.on('error', (error) => {
    if (responded) return;
    responded = true;

    logger.error('FFmpeg not installed or not in PATH', {
      error: error.message,
      operation: 'trim_video'
    });

    // Clean up uploaded file
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }

    return res.status(500).json({
      error: 'FFmpeg is not installed on the server. Please install FFmpeg to use video trimming.',
      details: 'Server-side video processing requires FFmpeg. Contact administrator.'
    });
  });

  ffmpegProcess.on('close', (code) => {
    if (responded) return;

    if (code !== 0) {
      responded = true;

      logger.error('FFmpeg version check failed', {
        exitCode: code,
        operation: 'trim_video'
      });

      // Clean up uploaded file
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }

      return res.status(500).json({
        error: 'FFmpeg check failed',
        details: 'Unable to verify FFmpeg installation'
      });
    }

    // FFmpeg is available, proceed with trimming
    logger.debug('FFmpeg verified, starting trim operation', {
      inputPath,
      outputPath,
      startTime: start,
      duration,
      operation: 'trim_video'
    });

    const trimProcess = spawn('ffmpeg', [
      '-ss', start.toString(),
      '-i', inputPath,
      '-t', duration.toString(),
      '-c', 'copy',
      '-y', // Overwrite output file if exists
      outputPath
    ]);

    let stderrData = '';

    trimProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    trimProcess.on('error', (error) => {
      logError('FFmpeg trim process error', error, {
        filename: req.file.filename,
        startTime: start,
        endTime: end,
        operation: 'trim_video'
      });

      // Clean up files
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      return res.status(500).json({
        error: 'Video trimming failed',
        details: error.message
      });
    });

    trimProcess.on('close', (trimCode) => {
      // Clean up original uploaded file
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
        logger.debug('Cleaned up original video file', {
          inputPath,
          operation: 'trim_video'
        });
      }

      if (trimCode !== 0) {
        logError('FFmpeg trim failed', new Error(`FFmpeg exited with code ${trimCode}`), {
          filename: req.file.filename,
          startTime: start,
          endTime: end,
          exitCode: trimCode,
          stderr: stderrData,
          operation: 'trim_video'
        });

        // Clean up output file if exists
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }

        return res.status(500).json({
          error: 'Video trimming failed',
          details: `FFmpeg exited with code ${trimCode}`
        });
      }

      // Verify output file exists
      if (!fs.existsSync(outputPath)) {
        logger.error('Trimmed video file not created', {
          outputPath,
          operation: 'trim_video'
        });

        return res.status(500).json({
          error: 'Trimmed video file was not created',
          details: 'FFmpeg completed but output file is missing'
        });
      }

      const outputStats = fs.statSync(outputPath);

      logSuccess('Video trimmed successfully', {
        originalFilename: req.file.filename,
        trimmedFilename: outputFilename,
        originalSize: req.file.size,
        trimmedSize: outputStats.size,
        startTime: start,
        endTime: end,
        duration,
        operation: 'trim_video'
      });

      res.json({
        success: true,
        filename: outputFilename,
        size: outputStats.size,
        message: 'Video trimmed successfully'
      });
    });
  });
});

/**
 * Compress video for web playback (max 1440p resolution)
 *
 * @param {number} footageId - ID of the footage to compress
 * @returns {Promise<Object>} Compressed video details
 * @throws {Error} If FFmpeg is not installed or compression fails
 */
app.post('/api/compress-video/:id', async (req, res) => {
  const footageId = parseInt(req.params.id);

  if (!footageId || isNaN(footageId)) {
    logger.warn('Invalid footage ID for compression', {
      requestedId: req.params.id,
      operation: 'compress_video'
    });
    return res.status(400).json({ error: 'Invalid footage ID' });
  }

  try {
    // Get footage metadata
    const footageItem = await getFootageById(footageId);

    if (!footageItem) {
      logger.warn('Footage not found for compression', {
        footageId,
        operation: 'compress_video'
      });
      return res.status(404).json({ error: 'Footage not found' });
    }

    // Check if already compressed
    if (footageItem.filename_compressed) {
      logger.info('Footage already compressed', {
        footageId,
        compressedFilename: footageItem.filename_compressed,
        operation: 'compress_video'
      });
      return res.json({
        success: true,
        filename: footageItem.filename_compressed,
        message: 'Video already compressed'
      });
    }

    const inputPath = path.join(uploadsDir, footageItem.filename);

    // Verify input file exists
    if (!fs.existsSync(inputPath)) {
      logger.error('Original video file not found', {
        footageId,
        inputPath,
        operation: 'compress_video'
      });
      return res.status(404).json({ error: 'Original video file not found' });
    }

    const outputFilename = `compressed-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(footageItem.filename)}`;
    const outputPath = path.join(uploadsDir, outputFilename);

    logger.info('Starting video compression', {
      footageId,
      filename: footageItem.filename,
      inputSize: fs.statSync(inputPath).size,
      operation: 'compress_video'
    });

    // FFmpeg compression with web optimization
    // - Max resolution: 1440p (2560x1440)
    // - Codec: H.264 (libx264) for best compatibility
    // - CRF 23: Good quality/size balance
    // - Preset: faster (good speed/compression tradeoff)
    // - Scale filter maintains aspect ratio
    const compressProcess = spawn('ffmpeg', [
      '-i', inputPath,
      '-vf', 'scale=\'min(2560,iw)\':\'min(1440,ih)\':force_original_aspect_ratio=decrease',
      '-c:v', 'libx264',
      '-crf', '23',
      '-preset', 'faster',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ]);

    let stderrData = '';

    compressProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    compressProcess.on('error', (error) => {
      logError('FFmpeg compression process error', error, {
        footageId,
        filename: footageItem.filename,
        operation: 'compress_video'
      });

      // Clean up output file if exists
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      return res.status(500).json({
        error: 'FFmpeg is not installed on the server',
        details: 'Video compression requires FFmpeg'
      });
    });

    compressProcess.on('close', (code) => {
      if (code !== 0) {
        logError('FFmpeg compression failed', new Error(`FFmpeg exited with code ${code}`), {
          footageId,
          filename: footageItem.filename,
          exitCode: code,
          stderr: stderrData,
          operation: 'compress_video'
        });

        // Clean up output file if exists
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }

        return res.status(500).json({
          error: 'Video compression failed',
          details: `FFmpeg exited with code ${code}`
        });
      }

      // Verify output file exists
      if (!fs.existsSync(outputPath)) {
        logger.error('Compressed video file not created', {
          footageId,
          outputPath,
          operation: 'compress_video'
        });

        return res.status(500).json({
          error: 'Compressed video file was not created',
          details: 'FFmpeg completed but output file is missing'
        });
      }

      const inputStats = fs.statSync(inputPath);
      const outputStats = fs.statSync(outputPath);

      // Update database with compressed filename (fire-and-forget async)
      updateFootage(footageId, { filename_compressed: outputFilename }).catch(err =>
        logger.error('Failed to update footage with compressed filename', { footageId, error: err.message }));

      logSuccess('Video compressed successfully', {
        footageId,
        originalFilename: footageItem.filename,
        compressedFilename: outputFilename,
        originalSize: inputStats.size,
        compressedSize: outputStats.size,
        compressionRatio: ((1 - (outputStats.size / inputStats.size)) * 100).toFixed(2) + '%',
        operation: 'compress_video'
      });

      res.json({
        success: true,
        filename: outputFilename,
        originalSize: inputStats.size,
        compressedSize: outputStats.size,
        compressionRatio: ((1 - (outputStats.size / inputStats.size)) * 100).toFixed(2) + '%',
        message: 'Video compressed successfully'
      });
    });
  } catch (error) {
    logError('Video compression error', error instanceof Error ? error : new Error(String(error)), {
      footageId,
      operation: 'compress_video'
    });

    res.status(500).json({
      error: 'Failed to compress video',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: MESSAGES.SERVER_HEALTHY, message: MESSAGES.SERVER_RUNNING });
});

// Test FFmpeg proxy
app.get('/api/test/ffmpeg', (req, res) => {
  res.json({
    message: 'FFmpeg proxy test endpoints',
    endpoints: {
      js: '/api/ffmpeg/0.12.6/ffmpeg-core.js',
      wasm: '/api/ffmpeg/0.12.6/ffmpeg-core.wasm'
    },
    instructions: 'Visit these URLs in your browser to test if files load correctly'
  });
});

/**
 * Start the server with database initialization
 */
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Attempt to migrate from JSON if needed (for backward compatibility)
    try {
      await migrateFromJson(dataDir);
    } catch (migrationError) {
      logger.warn('JSON migration skipped or failed', {
        error: migrationError.message
      });
    }

    // Start HTTP server
    app.listen(SERVER_CONFIG.PORT, () => {
      logger.info('Server started successfully', {
        port: SERVER_CONFIG.PORT,
        env: SERVER_CONFIG.NODE_ENV,
        uploadsDir: uploadsDir,
        thumbnailsDir: thumbnailsDir,
        dataDir: dataDir,
        serverUrl: `http://localhost:${SERVER_CONFIG.PORT}`,
        apiUrl: `http://localhost:${SERVER_CONFIG.PORT}/api`
      });

      // Keep user-friendly console output for development
      console.log(`\n🚗 Dash World Backend Server Running!`);
      console.log(`📍 API: http://localhost:${SERVER_CONFIG.PORT}/api`);
      console.log(`💾 Database: PostgreSQL`);
      console.log(`📂 Uploads: ${uploadsDir}\n`);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Server shutting down gracefully', {
    reason: 'SIGINT received'
  });

  console.log('\n👋 Server shut down gracefully');
  process.exit(0);
});
