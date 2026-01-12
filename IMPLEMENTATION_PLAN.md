# Dash World - Detailed Implementation Plan

**Date:** 2025-12-30
**Current Compliance:** 65%
**Target Compliance:** 85% (4 weeks)

This document lists all code changes to be implemented, organized by priority. Review this plan before implementation begins.

---

## P0 - CRITICAL (Week 1: 9-13 hours total)

### Fix 1.1: Add JSDoc to Backend Functions
**Priority:** P0 - Critical
**Estimated Time:** 2-3 hours
**File:** `backend/server.js`
**Claude.MD Principle:** "Every function must have JSDoc with @param, @returns, @throws"

#### Function 1: readFootageDb() (Line ~50)

**Current Code:**
```javascript
function readFootageDb() {
  const data = fs.readFileSync(footageDbPath, 'utf8');
  return JSON.parse(data);
}
```

**Fixed Code:**
```javascript
/**
 * Read all footage metadata from JSON database file
 *
 * @returns {Array<Object>} Array of footage objects containing id, filename, location, thumbnail, etc.
 * @throws {Error} If database file cannot be read
 * @throws {SyntaxError} If JSON is malformed
 */
function readFootageDb() {
  const data = fs.readFileSync(footageDbPath, 'utf8');
  return JSON.parse(data);
}
```

**Justification:** Claude.MD requires documentation to make code contracts clear and aid maintenance.

---

#### Function 2: writeFootageDb() (Line ~55)

**Current Code:**
```javascript
function writeFootageDb(data) {
  fs.writeFileSync(footageDbPath, JSON.stringify(data, null, 2));
}
```

**Fixed Code:**
```javascript
/**
 * Write footage metadata array to JSON database file
 *
 * @param {Array<Object>} data - Array of footage objects to persist
 * @throws {Error} If file write fails
 * @throws {TypeError} If data cannot be stringified
 */
function writeFootageDb(data) {
  fs.writeFileSync(footageDbPath, JSON.stringify(data, null, 2));
}
```

---

#### Function 3: readRequestsDb() (Line ~59)

**Current Code:**
```javascript
function readRequestsDb() {
  const data = fs.readFileSync(requestsDbPath, 'utf8');
  return JSON.parse(data);
}
```

**Fixed Code:**
```javascript
/**
 * Read all footage request records from JSON database file
 *
 * @returns {Array<Object>} Array of request objects containing id, footage_id, requester info, etc.
 * @throws {Error} If database file cannot be read
 * @throws {SyntaxError} If JSON is malformed
 */
function readRequestsDb() {
  const data = fs.readFileSync(requestsDbPath, 'utf8');
  return JSON.parse(data);
}
```

---

#### Function 4: writeRequestsDb() (Line ~64)

**Current Code:**
```javascript
function writeRequestsDb(data) {
  fs.writeFileSync(requestsDbPath, JSON.stringify(data, null, 2));
}
```

**Fixed Code:**
```javascript
/**
 * Write request records array to JSON database file
 *
 * @param {Array<Object>} data - Array of request objects to persist
 * @throws {Error} If file write fails
 * @throws {TypeError} If data cannot be stringified
 */
function writeRequestsDb(data) {
  fs.writeFileSync(requestsDbPath, JSON.stringify(data, null, 2));
}
```

---

### Fix 1.2: Add JSDoc to Frontend API Functions
**Priority:** P0 - Critical
**Estimated Time:** 2 hours
**File:** `frontend/src/api.ts`

#### Function 1: getAllFootage() (Line ~28)

**Current Code:**
```typescript
export async function getAllFootage(): Promise<Footage[]> {
  const response = await fetch(`${API_BASE_URL}/footage`);
  if (!response.ok) {
    throw new Error('Failed to fetch footage');
  }
  return response.json();
}
```

**Fixed Code:**
```typescript
/**
 * Fetch all footage entries from the API
 *
 * @returns {Promise<Footage[]>} Promise resolving to array of all footage records with metadata
 * @throws {Error} If API request fails or returns non-OK status
 */
export async function getAllFootage(): Promise<Footage[]> {
  const response = await fetch(`${API_BASE_URL}/footage`);
  if (!response.ok) {
    throw new Error('Failed to fetch footage');
  }
  return response.json();
}
```

---

#### Function 2: getFootageById() (Line ~37)

**Current Code:**
```typescript
export async function getFootageById(id: number): Promise<Footage> {
  const response = await fetch(`${API_BASE_URL}/footage/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch footage');
  }
  return response.json();
}
```

**Fixed Code:**
```typescript
/**
 * Fetch single footage entry by ID
 *
 * @param {number} id - The footage ID to retrieve
 * @returns {Promise<Footage>} Promise resolving to footage object with metadata
 * @throws {Error} If footage not found (404) or request fails
 */
export async function getFootageById(id: number): Promise<Footage> {
  const response = await fetch(`${API_BASE_URL}/footage/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch footage');
  }
  return response.json();
}
```

---

#### Function 3: uploadFootage() (Line ~46)

**Current Code:**
```typescript
export async function uploadFootage(formData: FormData): Promise<{ success: boolean; id: number; message: string }> {
  const response = await fetch(`${API_BASE_URL}/footage/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload footage');
  }
  return response.json();
}
```

**Fixed Code:**
```typescript
/**
 * Upload new footage with video file, thumbnail, and metadata
 *
 * @param {FormData} formData - FormData containing video, thumbnail, and metadata fields
 * @returns {Promise<{success: boolean, id: number, message: string}>} Upload result with new footage ID
 * @throws {Error} If upload fails due to validation, file size, or server error
 */
export async function uploadFootage(formData: FormData): Promise<{ success: boolean; id: number; message: string }> {
  const response = await fetch(`${API_BASE_URL}/footage/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload footage');
  }
  return response.json();
}
```

---

#### Function 4: submitFootageRequest() (Line ~59)

**Current Code:**
```typescript
export async function submitFootageRequest(
  footageId: number,
  requestData: {
    name: string;
    email: string;
    reason: string;
    message?: string;
  }
): Promise<{ success: boolean; id: number; message: string }> {
  const response = await fetch(`${API_BASE_URL}/footage/${footageId}/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData),
  });
  if (!response.ok) {
    throw new Error('Failed to submit request');
  }
  return response.json();
}
```

**Fixed Code:**
```typescript
/**
 * Submit a request for access to unblurred footage
 *
 * @param {number} footageId - The ID of the footage being requested
 * @param {Object} requestData - Request details
 * @param {string} requestData.name - Requester's full name
 * @param {string} requestData.email - Requester's email address
 * @param {string} requestData.reason - Reason for request (involved, witness, representative, other)
 * @param {string} [requestData.message] - Optional additional message
 * @returns {Promise<{success: boolean, id: number, message: string}>} Request submission result
 * @throws {Error} If request submission fails or footage not found
 */
export async function submitFootageRequest(
  footageId: number,
  requestData: {
    name: string;
    email: string;
    reason: string;
    message?: string;
  }
): Promise<{ success: boolean; id: number; message: string }> {
  const response = await fetch(`${API_BASE_URL}/footage/${footageId}/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData),
  });
  if (!response.ok) {
    throw new Error('Failed to submit request');
  }
  return response.json();
}
```

---

#### Function 5: getFootageRequests() (Line ~78)

**Current Code:**
```typescript
export async function getFootageRequests(footageId: number): Promise<FootageRequest[]> {
  const response = await fetch(`${API_BASE_URL}/footage/${footageId}/requests`);
  if (!response.ok) {
    throw new Error('Failed to fetch requests');
  }
  return response.json();
}
```

**Fixed Code:**
```typescript
/**
 * Fetch all requests for a specific footage entry
 *
 * @param {number} footageId - The footage ID to get requests for
 * @returns {Promise<FootageRequest[]>} Promise resolving to array of request objects
 * @throws {Error} If API request fails or footage not found
 */
export async function getFootageRequests(footageId: number): Promise<FootageRequest[]> {
  const response = await fetch(`${API_BASE_URL}/footage/${footageId}/requests`);
  if (!response.ok) {
    throw new Error('Failed to fetch requests');
  }
  return response.json();
}
```

---

#### Function 6: checkHealth() (Line ~87)

**Current Code:**
```typescript
export async function checkHealth(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json();
}
```

**Fixed Code:**
```typescript
/**
 * Check API server health status
 *
 * @returns {Promise<{status: string, message: string}>} Health check response
 * @throws {Error} If server is unreachable or unhealthy
 */
export async function checkHealth(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json();
}
```

---

### Fix 1.3: Add JSDoc to Frontend Utility Function
**Priority:** P0 - Critical
**Estimated Time:** 15 minutes
**File:** `frontend/src/DashWorld.tsx`

#### Function: generateThumbnail() (Line ~6)

**Current Code:**
```typescript
const generateThumbnail = (videoFile: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // ... implementation
  });
};
```

**Fixed Code:**
```typescript
/**
 * Generate a thumbnail image from a video file by extracting a frame
 *
 * @param {File} videoFile - The video file to generate thumbnail from
 * @returns {Promise<Blob>} Promise resolving to JPEG image blob (max 1280px width, 0.85 quality)
 * @throws {Error} If thumbnail generation fails or video cannot be loaded
 */
const generateThumbnail = (videoFile: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate thumbnail'));
          URL.revokeObjectURL(video.src);
        },
        'image/jpeg',
        0.85
      );
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
      URL.revokeObjectURL(video.src);
    };

    video.src = URL.createObjectURL(videoFile);
    video.load();
  });
};
```

---

### Fix 2: Implement Structured Logging with Winston
**Priority:** P0 - Critical
**Estimated Time:** 3-4 hours
**Claude.MD Principle:** "Use structured logging with winston/pino, include entity IDs and context"

#### Step 2.1: Install Winston

**Command:**
```bash
cd backend
npm install winston
```

---

#### Step 2.2: Create Logger Utility

**New File:** `backend/utils/logger.js`

```javascript
import winston from 'winston';

/**
 * Winston logger instance with structured logging configuration
 *
 * Logs to console (simple format) and files (JSON format)
 * - error.log: ERROR level and above
 * - combined.log: All levels
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'dash-world-backend' },
  transports: [
    // Write all errors to error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Log successful operation with context
 *
 * @param {string} message - Description of successful operation
 * @param {Object} meta - Additional context (entity IDs, relevant data)
 */
export function logSuccess(message, meta = {}) {
  logger.info(message, meta);
}

/**
 * Log error with full context before throwing
 *
 * @param {string} message - Description of what failed
 * @param {Error} error - The error object
 * @param {Object} meta - Additional context (entity IDs, operation details)
 */
export function logError(message, error, meta = {}) {
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...meta
  });
}
```

---

#### Step 2.3: Replace console.log in server.js

**File:** `backend/server.js`

**Change 1: Import logger at top of file**

**Current Code:**
```javascript
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
```

**Fixed Code:**
```javascript
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { logger, logSuccess, logError } from './utils/logger.js';
```

---

**Change 2: Server startup log (Line ~265)**

**Current Code:**
```javascript
app.listen(PORT, () => {
  console.log(`\n🚗 Dash World Backend Server Running!`);
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`📁 Uploads directory: ${uploadsDir}\n`);
});
```

**Fixed Code:**
```javascript
app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    uploadsDir: uploadsDir,
    thumbnailsDir: thumbnailsDir,
    dataDir: dataDir,
    serverUrl: `http://localhost:${PORT}`,
    apiUrl: `http://localhost:${PORT}/api`
  });

  // Keep user-friendly console output for development
  console.log(`\n🚗 Dash World Backend Server Running!`);
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api\n`);
});
```

---

**Change 3: GET /api/footage error (Line ~99)**

**Current Code:**
```javascript
app.get('/api/footage', (req, res) => {
  try {
    const footage = readFootageDb();
    res.json(footage);
  } catch (error) {
    console.error('Error fetching footage:', error);
    res.status(500).json({ error: 'Failed to fetch footage' });
  }
});
```

**Fixed Code:**
```javascript
app.get('/api/footage', (req, res) => {
  try {
    const footage = readFootageDb();

    logSuccess('Fetched all footage', {
      count: footage.length,
      operation: 'fetch_all_footage'
    });

    res.json(footage);
  } catch (error) {
    logError('Failed to fetch footage from database', error, {
      dbPath: footageDbPath,
      operation: 'fetch_all_footage'
    });

    res.status(500).json({ error: 'Failed to fetch footage' });
  }
});
```

---

**Change 4: GET /api/footage/:id error (Line ~110)**

**Current Code:**
```javascript
app.get('/api/footage/:id', (req, res) => {
  try {
    const footage = readFootageDb();
    const item = footage.find(f => f.id === parseInt(req.params.id));

    if (!item) {
      return res.status(404).json({ error: 'Footage not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Error fetching footage:', error);
    res.status(500).json({ error: 'Failed to fetch footage' });
  }
});
```

**Fixed Code:**
```javascript
app.get('/api/footage/:id', (req, res) => {
  try {
    const footage = readFootageDb();
    const footageId = parseInt(req.params.id);
    const item = footage.find(f => f.id === footageId);

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

    res.json(item);
  } catch (error) {
    logError('Failed to fetch footage by ID', error, {
      requestedId: req.params.id,
      dbPath: footageDbPath,
      operation: 'fetch_footage_by_id'
    });

    res.status(500).json({ error: 'Failed to fetch footage' });
  }
});
```

---

**Change 5: POST /api/footage/upload error (Line ~186)**

**Current Code:**
```javascript
} catch (error) {
  console.error('Error uploading footage:', error);
  // Cleanup files if they were uploaded
  if (req.files) {
    if (req.files.video) fs.unlinkSync(req.files.video[0].path);
    if (req.files.thumbnail) fs.unlinkSync(req.files.thumbnail[0].path);
  }
  res.status(500).json({ error: 'Failed to upload footage' });
}
```

**Fixed Code:**
```javascript
} catch (error) {
  logError('Failed to upload footage', error, {
    videoFilename: req.files?.video?.[0]?.filename,
    thumbnailFilename: req.files?.thumbnail?.[0]?.filename,
    locationName: req.body.locationName,
    operation: 'upload_footage'
  });

  // Cleanup files if they were uploaded
  if (req.files) {
    if (req.files.video) {
      fs.unlinkSync(req.files.video[0].path);
      logger.info('Cleaned up uploaded video after error', {
        filename: req.files.video[0].filename
      });
    }
    if (req.files.thumbnail) {
      fs.unlinkSync(req.files.thumbnail[0].path);
      logger.info('Cleaned up uploaded thumbnail after error', {
        filename: req.files.thumbnail[0].filename
      });
    }
  }

  res.status(500).json({ error: 'Failed to upload footage' });
}
```

**Add success log after upload (Line ~175):**

**Current Code:**
```javascript
    footage.push(newFootage);
    writeFootageDb(footage);

    res.json({
      success: true,
      id: newId,
      message: 'Footage uploaded successfully'
    });
```

**Fixed Code:**
```javascript
    footage.push(newFootage);
    writeFootageDb(footage);

    logSuccess('Footage uploaded successfully', {
      footageId: newId,
      filename: videoFile.filename,
      thumbnailFilename: thumbnailFilename,
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
```

---

**Change 6: POST /api/footage/:id/request error (Line ~230)**

**Current Code:**
```javascript
} catch (error) {
  console.error('Error submitting request:', error);
  res.status(500).json({ error: 'Failed to submit request' });
}
```

**Fixed Code:**
```javascript
} catch (error) {
  logError('Failed to submit footage request', error, {
    footageId: req.params.id,
    requesterEmail: req.body.email,
    reason: req.body.reason,
    operation: 'submit_request'
  });

  res.status(500).json({ error: 'Failed to submit request' });
}
```

**Add success log (Line ~220):**

**Current Code:**
```javascript
    requests.push(newRequest);
    writeRequestsDb(requests);

    res.json({
      success: true,
      id: newId,
      message: 'Request submitted successfully'
    });
```

**Fixed Code:**
```javascript
    requests.push(newRequest);
    writeRequestsDb(requests);

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
```

---

**Change 7: GET /api/footage/:id/requests error (Line ~250)**

**Current Code:**
```javascript
} catch (error) {
  console.error('Error fetching requests:', error);
  res.status(500).json({ error: 'Failed to fetch requests' });
}
```

**Fixed Code:**
```javascript
} catch (error) {
  logError('Failed to fetch footage requests', error, {
    footageId: req.params.id,
    dbPath: requestsDbPath,
    operation: 'fetch_requests'
  });

  res.status(500).json({ error: 'Failed to fetch requests' });
}
```

---

#### Step 2.4: Create logs directory

**New Directory:** `backend/logs/`

**File:** `backend/logs/.gitkeep` (empty file to track directory)

**File:** `backend/.gitignore` (add logs to gitignore)

```
node_modules/
logs/*.log
```

---

### Fix 3: Extract Configuration Constants
**Priority:** P0 - Critical
**Estimated Time:** 2-3 hours
**Claude.MD Principle:** "Extract magic numbers to named constants, use environment variables"

#### Step 3.1: Create Backend Configuration

**New File:** `backend/config/server.config.js`

```javascript
/**
 * Server configuration constants
 *
 * Uses environment variables with sensible defaults for local development
 */
export const SERVER_CONFIG = {
  // Server settings
  PORT: parseInt(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Directory paths
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  THUMBNAILS_DIR: process.env.THUMBNAILS_DIR || './uploads/thumbnails',
  DATA_DIR: process.env.DATA_DIR || './data',

  // Database files
  FOOTAGE_DB_FILE: 'footage.json',
  REQUESTS_DB_FILE: 'requests.json',

  // CORS settings
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

/**
 * File upload configuration
 */
export const FILE_CONFIG = {
  // File size limits
  MAX_FILE_SIZE_BYTES: 250 * 1024 * 1024, // 250MB
  MAX_FILE_SIZE_MB: 250,

  // File naming
  VIDEO_PREFIX: 'video-',
  THUMBNAIL_PREFIX: 'thumbnail-',
  RANDOM_SUFFIX_MAX: 1E9,

  // Allowed MIME types
  ALLOWED_VIDEO_TYPES: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi'
  ],

  ALLOWED_IMAGE_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png'
  ]
};

/**
 * Validation rules
 */
export const VALIDATION_RULES = {
  // Coordinate ranges
  LATITUDE_MIN: -90,
  LATITUDE_MAX: 90,
  LONGITUDE_MIN: -180,
  LONGITUDE_MAX: 180,

  // String length limits
  LOCATION_NAME_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 1000,
  REQUESTER_NAME_MAX_LENGTH: 100,
  REQUESTER_EMAIL_MAX_LENGTH: 100,
  REQUEST_MESSAGE_MAX_LENGTH: 1000,

  // Incident types
  VALID_INCIDENT_TYPES: [
    'collision',
    'near_miss',
    'rear_end',
    'side_swipe',
    'other'
  ],

  // Request reasons
  VALID_REQUEST_REASONS: [
    'involved',
    'witness',
    'representative',
    'other'
  ]
};

/**
 * API response messages
 */
export const MESSAGES = {
  // Success messages
  FOOTAGE_UPLOADED: 'Footage uploaded successfully',
  REQUEST_SUBMITTED: 'Request submitted successfully',

  // Error messages
  NO_VIDEO_FILE: 'No video file uploaded',
  INVALID_VIDEO_TYPE: 'Only video files are allowed',
  FILE_TOO_LARGE: `File size exceeds ${FILE_CONFIG.MAX_FILE_SIZE_MB}MB limit`,
  MISSING_REQUIRED_FIELDS: 'Missing required fields',
  FOOTAGE_NOT_FOUND: 'Footage not found',
  INVALID_COORDINATES: 'Invalid coordinates',
  INVALID_INCIDENT_TYPE: 'Invalid incident type',
  INVALID_REQUEST_REASON: 'Invalid request reason',

  // Server messages
  SERVER_RUNNING: 'Dash World API is running',
  SERVER_HEALTHY: 'ok'
};
```

---

#### Step 3.2: Update server.js to use configuration

**File:** `backend/server.js`

**Change 1: Import configuration**

**Current Code:**
```javascript
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
```

**Fixed Code:**
```javascript
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import { logger, logSuccess, logError } from './utils/logger.js';
import {
  SERVER_CONFIG,
  FILE_CONFIG,
  VALIDATION_RULES,
  MESSAGES
} from './config/server.config.js';
```

---

**Change 2: Replace hardcoded values in directory setup (Line ~15)**

**Current Code:**
```javascript
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const thumbnailsDir = path.join(__dirname, '../uploads/thumbnails');
const dataDir = path.join(__dirname, './data');
```

**Fixed Code:**
```javascript
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Directory paths from configuration
const uploadsDir = path.join(__dirname, SERVER_CONFIG.UPLOAD_DIR);
const thumbnailsDir = path.join(__dirname, SERVER_CONFIG.THUMBNAILS_DIR);
const dataDir = path.join(__dirname, SERVER_CONFIG.DATA_DIR);
```

---

**Change 3: Replace hardcoded database paths (Line ~35)**

**Current Code:**
```javascript
const footageDbPath = path.join(dataDir, 'footage.json');
const requestsDbPath = path.join(dataDir, 'requests.json');
```

**Fixed Code:**
```javascript
const footageDbPath = path.join(dataDir, SERVER_CONFIG.FOOTAGE_DB_FILE);
const requestsDbPath = path.join(dataDir, SERVER_CONFIG.REQUESTS_DB_FILE);
```

---

**Change 4: Replace multer configuration (Line ~70)**

**Current Code:**
```javascript
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});
```

**Fixed Code:**
```javascript
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
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
```

---

**Change 5: Replace error messages in upload route (Line ~125)**

**Current Code:**
```javascript
if (!req.files || !req.files.video) {
  return res.status(400).json({ error: 'No video file uploaded' });
}

// Validate required fields
if (!locationName || !lat || !lng || !incidentDate || !incidentTime || !incidentType) {
  fs.unlinkSync(videoFile.path);
  if (thumbnailFile) fs.unlinkSync(thumbnailFile.path);
  return res.status(400).json({ error: 'Missing required fields' });
}
```

**Fixed Code:**
```javascript
if (!req.files || !req.files.video) {
  return res.status(400).json({ error: MESSAGES.NO_VIDEO_FILE });
}

// Validate required fields
if (!locationName || !lat || !lng || !incidentDate || !incidentTime || !incidentType) {
  fs.unlinkSync(videoFile.path);
  if (thumbnailFile) fs.unlinkSync(thumbnailFile.path);
  return res.status(400).json({ error: MESSAGES.MISSING_REQUIRED_FIELDS });
}

// Validate incident type
if (!VALIDATION_RULES.VALID_INCIDENT_TYPES.includes(incidentType)) {
  fs.unlinkSync(videoFile.path);
  if (thumbnailFile) fs.unlinkSync(thumbnailFile.path);
  return res.status(400).json({ error: MESSAGES.INVALID_INCIDENT_TYPE });
}
```

---

**Change 6: Replace PORT in server listen (Line ~265)**

**Current Code:**
```javascript
app.listen(PORT, () => {
```

**Fixed Code:**
```javascript
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

  console.log(`\n🚗 Dash World Backend Server Running!`);
  console.log(`📍 Server: http://localhost:${SERVER_CONFIG.PORT}`);
  console.log(`📊 API: http://localhost:${SERVER_CONFIG.PORT}/api\n`);
});
```

---

**Change 7: Update health check message (Line ~92)**

**Current Code:**
```javascript
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Dash World API is running'
  });
});
```

**Fixed Code:**
```javascript
app.get('/api/health', (req, res) => {
  res.json({
    status: MESSAGES.SERVER_HEALTHY,
    message: MESSAGES.SERVER_RUNNING
  });
});
```

---

#### Step 3.3: Create Frontend Configuration

**New File:** `frontend/src/config/constants.ts`

```typescript
/**
 * API configuration
 */
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  UPLOAD_TIMEOUT_MS: 300000, // 5 minutes for large video uploads
  DEFAULT_TIMEOUT_MS: 30000   // 30 seconds for other requests
} as const;

/**
 * Thumbnail generation configuration
 */
export const THUMBNAIL_CONFIG = {
  MAX_WIDTH: 1280,
  MAX_HEIGHT: 720,
  QUALITY: 0.85,
  SEEK_TIME_SECONDS: 1,
  FORMAT: 'image/jpeg'
} as const;

/**
 * File upload constraints
 */
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE_BYTES: 250 * 1024 * 1024, // 250MB
  MAX_FILE_SIZE_MB: 250,
  ALLOWED_VIDEO_EXTENSIONS: ['.mp4', '.mov', '.avi'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/quicktime', 'video/x-msvideo']
} as const;

/**
 * Map configuration
 */
export const MAP_CONFIG = {
  DEFAULT_CENTER: [37.7749, -122.4194] as [number, number], // San Francisco
  DEFAULT_ZOOM: 12,
  MARKER_ZOOM: 15,
  TILE_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
} as const;

/**
 * UI constants
 */
export const UI_CONSTANTS = {
  // Incident type emojis
  INCIDENT_EMOJIS: ['🚗', '🚙', '🚕', '🚐', '🚓', '🚑'] as const,

  // Date/time formats
  DATE_FORMAT: 'YYYY-MM-DD',
  TIME_FORMAT: 'HH:mm',
  DISPLAY_DATE_FORMAT: 'MMM D, YYYY',
  DISPLAY_TIME_FORMAT: 'h:mm A',

  // Incident types
  INCIDENT_TYPES: [
    { value: 'collision', label: 'Collision' },
    { value: 'near_miss', label: 'Near Miss' },
    { value: 'rear_end', label: 'Rear End' },
    { value: 'side_swipe', label: 'Side Swipe' },
    { value: 'other', label: 'Other' }
  ] as const,

  // Request reasons
  REQUEST_REASONS: [
    { value: 'involved', label: 'I was involved in the incident' },
    { value: 'witness', label: 'I witnessed the incident' },
    { value: 'representative', label: 'Legal/Insurance representative' },
    { value: 'other', label: 'Other reason' }
  ] as const
} as const;

/**
 * Privacy notice text
 */
export const PRIVACY_NOTICE = {
  UPLOAD_WARNING: 'Please ensure all license plates and faces are blurred before uploading to protect privacy.',
  REQUEST_INFO: 'Requests for unblurred footage will be reviewed. You may be asked to provide proof of involvement.'
} as const;
```

---

#### Step 3.4: Update api.ts to use configuration

**File:** `frontend/src/api.ts`

**Change 1: Import and use config**

**Current Code:**
```typescript
const API_BASE_URL = 'http://localhost:5000/api';
```

**Fixed Code:**
```typescript
import { API_CONFIG } from './config/constants';

const API_BASE_URL = API_CONFIG.BASE_URL;
```

---

#### Step 3.5: Update DashWorld.tsx to use configuration

**File:** `frontend/src/DashWorld.tsx`

**Change 1: Import configuration**

Add to imports at top of file:
```typescript
import {
  THUMBNAIL_CONFIG,
  UPLOAD_CONFIG,
  MAP_CONFIG,
  UI_CONSTANTS,
  PRIVACY_NOTICE
} from './config/constants';
```

---

**Change 2: Update generateThumbnail (Line ~24)**

**Current Code:**
```typescript
video.onseeked = () => {
  const maxWidth = 1280;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;
  context?.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(
    (blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate thumbnail'));
      URL.revokeObjectURL(video.src);
    },
    'image/jpeg',
    0.85
  );
};
```

**Fixed Code:**
```typescript
video.onseeked = () => {
  const scale = Math.min(1, THUMBNAIL_CONFIG.MAX_WIDTH / video.videoWidth);
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;
  context?.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(
    (blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate thumbnail'));
      URL.revokeObjectURL(video.src);
    },
    THUMBNAIL_CONFIG.FORMAT,
    THUMBNAIL_CONFIG.QUALITY
  );
};

video.onloadeddata = () => {
  video.currentTime = Math.min(THUMBNAIL_CONFIG.SEEK_TIME_SECONDS, video.duration / 2);
};
```

---

**Change 3: Update privacy disclaimer (find in UploadPage component)**

**Current Code:**
```typescript
<div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
  <p className="text-sm text-amber-800">
    ⚠️ <strong>Privacy Notice:</strong> Please ensure all license plates and faces are blurred before uploading to protect privacy.
  </p>
</div>
```

**Fixed Code:**
```typescript
<div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
  <p className="text-sm text-amber-800">
    ⚠️ <strong>Privacy Notice:</strong> {PRIVACY_NOTICE.UPLOAD_WARNING}
  </p>
</div>
```

---

**Change 4: Update incident emojis (find around line 781)**

**Current Code:**
```typescript
const thumbnails = ["🚗", "🚙", "🚕", "🚐", "🚓", "🚑"];
const randomEmoji = thumbnails[Math.floor(Math.random() * thumbnails.length)];
```

**Fixed Code:**
```typescript
const randomEmoji = UI_CONSTANTS.INCIDENT_EMOJIS[
  Math.floor(Math.random() * UI_CONSTANTS.INCIDENT_EMOJIS.length)
];
```

---

**Change 5: Update map configuration (find in map initialization)**

**Current Code:**
```typescript
const map = L.map(mapContainer.current).setView([37.7749, -122.4194], 12);
```

**Fixed Code:**
```typescript
const map = L.map(mapContainer.current).setView(MAP_CONFIG.DEFAULT_CENTER, MAP_CONFIG.DEFAULT_ZOOM);
```

---

#### Step 3.6: Create .env.example files

**New File:** `backend/.env.example`

```
# Server Configuration
PORT=5000
NODE_ENV=development

# Directory Paths
UPLOAD_DIR=../uploads
THUMBNAILS_DIR=../uploads/thumbnails
DATA_DIR=./data

# CORS
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info
```

---

**New File:** `frontend/.env.example`

```
# API Configuration
VITE_API_URL=http://localhost:5000/api
```

---

### Summary of P0 Fixes

**Total Estimated Time: 9-13 hours**

1. ✅ JSDoc for backend functions (2-3 hours)
2. ✅ JSDoc for frontend functions (2 hours)
3. ✅ JSDoc for utility function (15 minutes)
4. ✅ Winston structured logging (3-4 hours)
5. ✅ Configuration extraction (2-3 hours)

**Expected Compliance After P0:** 65% → 75%

---

## P1 - HIGH PRIORITY (Week 2: 11-15 hours total)

### Fix 4: Create Custom Error Classes
**Priority:** P1 - High
**Estimated Time:** 3-4 hours
**Claude.MD Principle:** "Use custom error classes with context, fail hard"

#### Step 4.1: Create Error Classes

**New File:** `backend/errors/BaseError.js`

```javascript
/**
 * Base error class for all custom application errors
 */
export class BaseError extends Error {
  /**
   * Create a base error
   *
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Object} context - Additional context data
   */
  constructor(message, statusCode = 500, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   *
   * @returns {Object} Error response object
   */
  toJSON() {
    return {
      error: this.message,
      name: this.name,
      statusCode: this.statusCode,
      ...(process.env.NODE_ENV === 'development' && { context: this.context })
    };
  }
}
```

---

**New File:** `backend/errors/FootageNotFoundError.js`

```javascript
import { BaseError } from './BaseError.js';

/**
 * Error thrown when footage with given ID cannot be found
 */
export class FootageNotFoundError extends BaseError {
  /**
   * Create a footage not found error
   *
   * @param {number} footageId - The ID that was not found
   */
  constructor(footageId) {
    super(`Footage with ID ${footageId} not found`, 404, { footageId });
    this.footageId = footageId;
  }
}
```

---

**New File:** `backend/errors/ValidationError.js`

```javascript
import { BaseError } from './BaseError.js';

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends BaseError {
  /**
   * Create a validation error
   *
   * @param {string} field - The field that failed validation
   * @param {string} message - Description of validation failure
   * @param {*} value - The invalid value (optional)
   */
  constructor(field, message, value = undefined) {
    const fullMessage = `Validation failed for ${field}: ${message}`;
    super(fullMessage, 400, { field, value });
    this.field = field;
    this.value = value;
  }
}
```

---

**New File:** `backend/errors/DatabaseError.js`

```javascript
import { BaseError } from './BaseError.js';

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends BaseError {
  /**
   * Create a database error
   *
   * @param {string} operation - The operation that failed (read, write, etc.)
   * @param {Error} originalError - The original error that was caught
   * @param {Object} context - Additional context
   */
  constructor(operation, originalError, context = {}) {
    const message = `Database ${operation} operation failed: ${originalError.message}`;
    super(message, 500, { operation, originalError: originalError.message, ...context });
    this.operation = operation;
    this.originalError = originalError;
  }
}
```

---

**New File:** `backend/errors/FileUploadError.js`

```javascript
import { BaseError } from './BaseError.js';

/**
 * Error thrown when file upload fails
 */
export class FileUploadError extends BaseError {
  /**
   * Create a file upload error
   *
   * @param {string} reason - Why the upload failed
   * @param {Object} fileInfo - Information about the file
   */
  constructor(reason, fileInfo = {}) {
    const message = `File upload failed: ${reason}`;
    super(message, 400, { reason, ...fileInfo });
    this.reason = reason;
    this.fileInfo = fileInfo;
  }
}
```

---

**New File:** `backend/errors/index.js`

```javascript
/**
 * Centralized error exports
 */
export { BaseError } from './BaseError.js';
export { FootageNotFoundError } from './FootageNotFoundError.js';
export { ValidationError } from './ValidationError.js';
export { DatabaseError } from './DatabaseError.js';
export { FileUploadError } from './FileUploadError.js';
```

---

#### Step 4.2: Create Error Handler Middleware

**New File:** `backend/middleware/errorHandler.js`

```javascript
import { BaseError } from '../errors/index.js';
import { logError } from '../utils/logger.js';

/**
 * Express error handling middleware
 *
 * Catches all errors, logs them, and sends appropriate responses
 *
 * @param {Error} err - The error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function errorHandler(err, req, res, next) {
  // Log the error with context
  logError('Request error', err, {
    path: req.path,
    method: req.method,
    statusCode: err.statusCode || 500,
    errorName: err.name
  });

  // Handle custom application errors
  if (err instanceof BaseError) {
    return res.status(err.statusCode).json(err.toJSON());
  }

  // Handle multer file upload errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: `File upload error: ${err.message}`,
      name: 'FileUploadError'
    });
  }

  // Handle unknown errors
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    error: message,
    name: err.name || 'Error'
  });
}
```

---

#### Step 4.3: Update server.js to use custom errors

**File:** `backend/server.js`

**Change 1: Import errors**

```javascript
import {
  FootageNotFoundError,
  ValidationError,
  DatabaseError,
  FileUploadError
} from './errors/index.js';
import { errorHandler } from './middleware/errorHandler.js';
```

---

**Change 2: Update readFootageDb to throw DatabaseError**

**Current Code:**
```javascript
function readFootageDb() {
  const data = fs.readFileSync(footageDbPath, 'utf8');
  return JSON.parse(data);
}
```

**Fixed Code:**
```javascript
function readFootageDb() {
  try {
    const data = fs.readFileSync(footageDbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new DatabaseError('read', error, { dbPath: footageDbPath });
  }
}
```

---

**Change 3: Update writeFootageDb to throw DatabaseError**

**Current Code:**
```javascript
function writeFootageDb(data) {
  fs.writeFileSync(footageDbPath, JSON.stringify(data, null, 2));
}
```

**Fixed Code:**
```javascript
function writeFootageDb(data) {
  try {
    fs.writeFileSync(footageDbPath, JSON.stringify(data, null, 2));
  } catch (error) {
    throw new DatabaseError('write', error, { dbPath: footageDbPath });
  }
}
```

---

**Change 4: Update GET /api/footage/:id to use FootageNotFoundError**

**Current Code:**
```javascript
if (!item) {
  logger.warn('Footage not found', { ... });
  return res.status(404).json({ error: 'Footage not found' });
}
```

**Fixed Code:**
```javascript
if (!item) {
  throw new FootageNotFoundError(footageId);
}
```

---

**Change 5: Update POST /api/footage/upload to use ValidationError**

**Current Code:**
```javascript
if (!req.files || !req.files.video) {
  return res.status(400).json({ error: MESSAGES.NO_VIDEO_FILE });
}
```

**Fixed Code:**
```javascript
if (!req.files || !req.files.video) {
  throw new FileUploadError('No video file provided');
}
```

---

**Current Code:**
```javascript
if (!locationName || !lat || !lng || !incidentDate || !incidentTime || !incidentType) {
  fs.unlinkSync(videoFile.path);
  if (thumbnailFile) fs.unlinkSync(thumbnailFile.path);
  return res.status(400).json({ error: MESSAGES.MISSING_REQUIRED_FIELDS });
}
```

**Fixed Code:**
```javascript
// Validate required fields
if (!locationName) {
  throw new ValidationError('locationName', 'Location name is required');
}
if (!lat) {
  throw new ValidationError('lat', 'Latitude is required');
}
if (!lng) {
  throw new ValidationError('lng', 'Longitude is required');
}
if (!incidentDate) {
  throw new ValidationError('incidentDate', 'Incident date is required');
}
if (!incidentTime) {
  throw new ValidationError('incidentTime', 'Incident time is required');
}
if (!incidentType) {
  throw new ValidationError('incidentType', 'Incident type is required');
}
```

---

**Change 6: Add error handler middleware at end of server.js**

Add before `app.listen()`:

```javascript
// Error handling middleware (must be last)
app.use(errorHandler);
```

---

### Fix 5: Add TypeScript Prop Interfaces to React Components
**Priority:** P1 - High
**Estimated Time:** 2-3 hours
**File:** `frontend/src/DashWorld.tsx`
**Claude.MD Principle:** "Explicit types for all function parameters"

#### Component 1: UploadPage

**Current Code:**
```typescript
const UploadPage = ({ onBack, onUploadComplete }) => {
```

**Fixed Code:**
```typescript
interface UploadPageProps {
  onBack: () => void;
  onUploadComplete?: () => Promise<void>;
}

const UploadPage = ({ onBack, onUploadComplete }: UploadPageProps) => {
```

---

#### Component 2: VideoDetailPage

**Current Code:**
```typescript
const VideoDetailPage = ({ footage, onBack, onRequestFootage }) => {
```

**Fixed Code:**
```typescript
interface VideoDetailPageProps {
  footage: FootageData;
  onBack: () => void;
  onRequestFootage: () => void;
}

const VideoDetailPage = ({ footage, onBack, onRequestFootage }: VideoDetailPageProps) => {
```

---

#### Component 3: RequestFormPage

**Current Code:**
```typescript
const RequestFormPage = ({ footage, onBack, onSubmit }) => {
```

**Fixed Code:**
```typescript
interface RequestFormPageProps {
  footage: FootageData;
  onBack: () => void;
  onSubmit: () => void;
}

const RequestFormPage = ({ footage, onBack, onSubmit }: RequestFormPageProps) => {
```

---

#### Component 4: RequestSentPage

**Current Code:**
```typescript
const RequestSentPage = ({ onClose }) => {
```

**Fixed Code:**
```typescript
interface RequestSentPageProps {
  onClose: () => void;
}

const RequestSentPage = ({ onClose }: RequestSentPageProps) => {
```

---

#### Fix 5.1: Add missing thumbnail field to Footage interface

**File:** `frontend/src/api.ts`

**Current Code:**
```typescript
export interface Footage {
  id: number;
  filename: string;
  location_name: string;
  lat: number;
  lng: number;
  incident_date: string;
  incident_time: string;
  incident_type: string;
  description: string | null;
  created_at: string;
}
```

**Fixed Code:**
```typescript
export interface Footage {
  id: number;
  filename: string;
  thumbnail: string | null;
  location_name: string;
  lat: number;
  lng: number;
  incident_date: string;
  incident_time: string;
  incident_type: string;
  description: string | null;
  created_at: string;
}
```

---

### Fix 6: Split Monolithic Files into Modules
**Priority:** P1 - High
**Estimated Time:** 6-8 hours
**Claude.MD Principle:** "Files should be <300 lines, single responsibility"

#### Step 6.1: Extract Backend Services

**New File:** `backend/services/footageService.js`

```javascript
import { ValidationError } from '../errors/index.js';
import { VALIDATION_RULES } from '../config/server.config.js';
import { logSuccess } from '../utils/logger.js';

/**
 * Footage business logic service
 */
export class FootageService {
  /**
   * Create new footage service
   *
   * @param {Object} repository - Footage repository for data operations
   */
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Validate footage metadata
   *
   * @param {Object} metadata - Footage metadata to validate
   * @throws {ValidationError} If validation fails
   */
  validateMetadata(metadata) {
    const { locationName, lat, lng, incidentType } = metadata;

    // Validate coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || latitude < VALIDATION_RULES.LATITUDE_MIN || latitude > VALIDATION_RULES.LATITUDE_MAX) {
      throw new ValidationError('latitude', `Must be between ${VALIDATION_RULES.LATITUDE_MIN} and ${VALIDATION_RULES.LATITUDE_MAX}`, lat);
    }

    if (isNaN(longitude) || longitude < VALIDATION_RULES.LONGITUDE_MIN || longitude > VALIDATION_RULES.LONGITUDE_MAX) {
      throw new ValidationError('longitude', `Must be between ${VALIDATION_RULES.LONGITUDE_MIN} and ${VALIDATION_RULES.LONGITUDE_MAX}`, lng);
    }

    // Validate incident type
    if (!VALIDATION_RULES.VALID_INCIDENT_TYPES.includes(incidentType)) {
      throw new ValidationError('incidentType', `Must be one of: ${VALIDATION_RULES.VALID_INCIDENT_TYPES.join(', ')}`, incidentType);
    }

    // Validate string lengths
    if (locationName && locationName.length > VALIDATION_RULES.LOCATION_NAME_MAX_LENGTH) {
      throw new ValidationError('locationName', `Cannot exceed ${VALIDATION_RULES.LOCATION_NAME_MAX_LENGTH} characters`);
    }
  }

  /**
   * Create new footage entry
   *
   * @param {Object} videoFile - Uploaded video file object
   * @param {Object} thumbnailFile - Uploaded thumbnail file object (optional)
   * @param {Object} metadata - Footage metadata
   * @returns {Object} Created footage object
   * @throws {ValidationError} If metadata validation fails
   */
  async createFootage(videoFile, thumbnailFile, metadata) {
    this.validateMetadata(metadata);

    const newFootage = {
      filename: videoFile.filename,
      thumbnail: thumbnailFile ? thumbnailFile.filename : null,
      location_name: metadata.locationName,
      lat: parseFloat(metadata.lat),
      lng: parseFloat(metadata.lng),
      incident_date: metadata.incidentDate,
      incident_time: metadata.incidentTime,
      incident_type: metadata.incidentType,
      description: metadata.description || null,
      created_at: new Date().toISOString()
    };

    const created = this.repository.create(newFootage);

    logSuccess('Footage created', {
      footageId: created.id,
      filename: videoFile.filename,
      thumbnailFilename: thumbnailFile?.filename,
      locationName: metadata.locationName,
      incidentType: metadata.incidentType,
      operation: 'create_footage'
    });

    return created;
  }

  /**
   * Get all footage entries
   *
   * @returns {Array<Object>} All footage entries
   */
  getAllFootage() {
    return this.repository.findAll();
  }

  /**
   * Get footage by ID
   *
   * @param {number} id - Footage ID
   * @returns {Object} Footage object
   * @throws {FootageNotFoundError} If footage not found
   */
  getFootageById(id) {
    return this.repository.findById(id);
  }
}
```

---

**New File:** `backend/repositories/footageRepository.js`

```javascript
import { FootageNotFoundError, DatabaseError } from '../errors/index.js';
import fs from 'fs';

/**
 * Footage data access layer
 */
export class FootageRepository {
  /**
   * Create footage repository
   *
   * @param {string} dbPath - Path to footage database JSON file
   */
  constructor(dbPath) {
    this.dbPath = dbPath;
  }

  /**
   * Read footage database from disk
   *
   * @returns {Array<Object>} Array of footage objects
   * @throws {DatabaseError} If read fails
   */
  _read() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new DatabaseError('read', error, { dbPath: this.dbPath });
    }
  }

  /**
   * Write footage database to disk
   *
   * @param {Array<Object>} data - Footage array to write
   * @throws {DatabaseError} If write fails
   */
  _write(data) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new DatabaseError('write', error, { dbPath: this.dbPath });
    }
  }

  /**
   * Generate next available ID
   *
   * @param {Array<Object>} footage - Current footage array
   * @returns {number} Next ID
   */
  _generateId(footage) {
    return footage.length > 0 ? Math.max(...footage.map(f => f.id)) + 1 : 1;
  }

  /**
   * Find all footage entries
   *
   * @returns {Array<Object>} All footage
   */
  findAll() {
    return this._read();
  }

  /**
   * Find footage by ID
   *
   * @param {number} id - Footage ID
   * @returns {Object} Footage object
   * @throws {FootageNotFoundError} If not found
   */
  findById(id) {
    const footage = this._read();
    const item = footage.find(f => f.id === id);

    if (!item) {
      throw new FootageNotFoundError(id);
    }

    return item;
  }

  /**
   * Create new footage entry
   *
   * @param {Object} footageData - Footage data (without ID)
   * @returns {Object} Created footage with ID
   */
  create(footageData) {
    const footage = this._read();
    const newId = this._generateId(footage);

    const newFootage = {
      id: newId,
      ...footageData
    };

    footage.push(newFootage);
    this._write(footage);

    return newFootage;
  }
}
```

---

(continued in next message due to length...)

Would you like me to continue with the rest of the P1 and P2 fixes? This document is already quite comprehensive at over 2000 lines. I can either:

1. Continue with the remaining P1 and P2 fixes in the same file
2. Create a second implementation plan file for P1 (remaining) and P2 fixes
3. Stop here and let you review the P0 and partial P1 fixes first

What would you prefer?