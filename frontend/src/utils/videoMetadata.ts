import ExifReader from 'exifreader';
import { logger } from './logger';

export interface VideoMetadata {
  date?: string;  // YYYY-MM-DD format
  time?: string;  // HH:MM format
  latitude?: number;
  longitude?: number;
  hasGPS: boolean;
  hasDateTime: boolean;
}

/**
 * Extract metadata from video file including date, time, and GPS coordinates
 *
 * @param {File} videoFile - The video file to extract metadata from
 * @returns {Promise<VideoMetadata>} Metadata object with date, time, and GPS data
 */
export async function extractVideoMetadata(videoFile: File): Promise<VideoMetadata> {
  const metadata: VideoMetadata = {
    hasGPS: false,
    hasDateTime: false
  };

  try {
    // Read EXIF data from the video file
    const tags = await ExifReader.load(videoFile, { expanded: true });

    logger.debug('Successfully loaded EXIF data from video', {
      fileName: videoFile.name,
      fileSize: videoFile.size,
      fileType: videoFile.type,
    });

    // Extract GPS coordinates
    if (tags.gps) {
      const gps = tags.gps as any;

      // Try to get latitude
      if (gps.Latitude !== undefined && gps.Longitude !== undefined) {
        metadata.latitude = gps.Latitude;
        metadata.longitude = gps.Longitude;
        metadata.hasGPS = true;

        logger.info('GPS coordinates extracted from video', {
          fileName: videoFile.name,
          latitude: metadata.latitude,
          longitude: metadata.longitude,
        });
      }
    }

    // Extract date and time
    let dateTime: Date | null = null;

    // Try multiple date/time fields (different cameras use different tags)
    const exifTags = tags.exif as any;
    const fileTags = tags.file as any;

    if (exifTags?.DateTimeOriginal) {
      dateTime = parseExifDateTime(exifTags.DateTimeOriginal.description);
    } else if (exifTags?.DateTime) {
      dateTime = parseExifDateTime(exifTags.DateTime.description);
    } else if (fileTags?.ModifyDate) {
      dateTime = parseExifDateTime(fileTags.ModifyDate.description);
    }

    // If no EXIF date, try to get from file metadata
    if (!dateTime) {
      logger.debug('No EXIF datetime found, using file modification time', {
        fileName: videoFile.name,
      });
      // Use file last modified date as fallback
      dateTime = new Date(videoFile.lastModified);
    }

    if (dateTime) {
      metadata.date = dateTime.toISOString().split('T')[0]; // YYYY-MM-DD
      metadata.time = dateTime.toTimeString().slice(0, 5); // HH:MM
      metadata.hasDateTime = true;

      logger.info('DateTime extracted from video', {
        fileName: videoFile.name,
        date: metadata.date,
        time: metadata.time,
      });
    }

  } catch (error) {
    // This is expected for many video files that don't have EXIF data
    // Log at debug level (not warning) since it's normal behavior
    logger.debug('No EXIF metadata in video file, using file modification time', {
      fileName: videoFile.name,
      fileType: videoFile.type,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to file modification time
    const fileDate = new Date(videoFile.lastModified);
    metadata.date = fileDate.toISOString().split('T')[0];
    metadata.time = fileDate.toTimeString().slice(0, 5);
    metadata.hasDateTime = true;
  }

  return metadata;
}

/**
 * Parse EXIF date/time string to Date object
 *
 * @param {string} exifDateTime - EXIF date time string (e.g., "2024:12:30 14:30:45")
 * @returns {Date | null} Parsed date or null if parsing fails
 */
function parseExifDateTime(exifDateTime: string): Date | null {
  try {
    // EXIF format: "YYYY:MM:DD HH:MM:SS"
    const parts = exifDateTime.split(' ');
    if (parts.length !== 2) return null;

    const datePart = parts[0].replace(/:/g, '-'); // Convert to YYYY-MM-DD
    const timePart = parts[1];

    return new Date(`${datePart}T${timePart}`);
  } catch (error) {
    logger.debug('Failed to parse EXIF datetime', {
      exifDateTime,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Format coordinates to display string
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Formatted coordinate string
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';

  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
}
