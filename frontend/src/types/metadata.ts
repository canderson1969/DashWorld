/**
 * Video metadata types
 *
 * @module metadata
 */

export interface Metadata {
  location: { lat: number; lng: number; source: string } | null;
  timestamp: Date;
  hasGPS: boolean;
  hasCorrectTime: boolean;
  duration: number;
  resolution: string;
}
