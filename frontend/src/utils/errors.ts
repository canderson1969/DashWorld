/**
 * Custom error classes for Dash World application
 * Following Claude.md error handling guidelines
 */

/**
 * Base application error class
 */
export class DashWorldError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    const errorConstructor = Error as any;
    if (errorConstructor.captureStackTrace) {
      errorConstructor.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Video processing errors
 */
export class VideoProcessingError extends DashWorldError {
  constructor(operation: string, originalError?: Error, context?: Record<string, any>) {
    super(
      `Video processing failed during ${operation}: ${originalError?.message || 'Unknown error'}`,
      'VIDEO_PROCESSING_ERROR',
      500,
      {
        operation,
        originalError: originalError?.message,
        ...context,
      }
    );
  }
}

/**
 * Video trimming errors
 */
export class VideoTrimmingError extends DashWorldError {
  constructor(message: string, originalError?: Error, context?: Record<string, any>) {
    super(
      `Video trimming failed: ${message}`,
      'VIDEO_TRIMMING_ERROR',
      500,
      {
        originalError: originalError?.message,
        ...context,
      }
    );
  }
}

/**
 * Metadata extraction errors
 */
export class MetadataExtractionError extends DashWorldError {
  constructor(fileType: string, originalError?: Error, context?: Record<string, any>) {
    super(
      `Failed to extract metadata from ${fileType}`,
      'METADATA_EXTRACTION_ERROR',
      500,
      {
        fileType,
        originalError: originalError?.message,
        ...context,
      }
    );
  }
}

/**
 * File validation errors
 */
export class FileValidationError extends DashWorldError {
  constructor(field: string, message: string, context?: Record<string, any>) {
    super(
      `File validation failed for ${field}: ${message}`,
      'FILE_VALIDATION_ERROR',
      400,
      {
        field,
        ...context,
      }
    );
  }
}

/**
 * Network/API errors
 */
export class NetworkError extends DashWorldError {
  constructor(operation: string, originalError?: Error, context?: Record<string, any>) {
    super(
      `Network request failed during ${operation}: ${originalError?.message || 'Unknown error'}`,
      'NETWORK_ERROR',
      503,
      {
        operation,
        originalError: originalError?.message,
        ...context,
      }
    );
  }
}

/**
 * Upload errors
 */
export class UploadError extends DashWorldError {
  constructor(message: string, originalError?: Error, context?: Record<string, any>) {
    super(
      `Upload failed: ${message}`,
      'UPLOAD_ERROR',
      500,
      {
        originalError: originalError?.message,
        ...context,
      }
    );
  }
}

/**
 * Geolocation errors
 */
export class GeolocationError extends DashWorldError {
  constructor(message: string, code?: number, context?: Record<string, any>) {
    super(
      `Geolocation failed: ${message}`,
      'GEOLOCATION_ERROR',
      400,
      {
        geolocationErrorCode: code,
        ...context,
      }
    );
  }
}

/**
 * FFmpeg loading errors
 */
export class FFmpegLoadError extends DashWorldError {
  constructor(originalError?: Error, context?: Record<string, any>) {
    super(
      'Failed to load FFmpeg library. Please check your internet connection.',
      'FFMPEG_LOAD_ERROR',
      500,
      {
        originalError: originalError?.message,
        ...context,
      }
    );
  }
}

/**
 * Thumbnail generation errors
 */
export class ThumbnailGenerationError extends DashWorldError {
  constructor(originalError?: Error, context?: Record<string, any>) {
    super(
      'Failed to generate video thumbnail',
      'THUMBNAIL_GENERATION_ERROR',
      500,
      {
        originalError: originalError?.message,
        ...context,
      }
    );
  }
}

/**
 * Get user-friendly error message
 *
 * @param {Error} error - Error to get message from
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyErrorMessage(error: Error): string {
  if (error instanceof DashWorldError) {
    return error.message;
  }

  // Generic fallback messages
  if (error.message.includes('network') || error.message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (error.message.includes('quota') || error.message.includes('storage')) {
    return 'Storage quota exceeded. Please free up some space.';
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is operational (expected) or programming error
 *
 * @param {Error} error - Error to check
 * @returns {boolean} Whether error is operational
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof DashWorldError) {
    return error.isOperational;
  }
  return false;
}
