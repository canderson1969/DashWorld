/**
 * Coordinate validation utilities
 *
 * @module coordinateValidation
 */

/**
 * Validate latitude value
 *
 * @param {number} lat - Latitude to validate
 * @returns {boolean} True if valid latitude
 */
export function isValidLatitude(lat: number): boolean {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude value
 *
 * @param {number} lng - Longitude to validate
 * @returns {boolean} True if valid longitude
 */
export function isValidLongitude(lng: number): boolean {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
}

/**
 * Validate coordinate pair
 *
 * @param {number} lat - Latitude to validate
 * @param {number} lng - Longitude to validate
 * @returns {boolean} True if both coordinates are valid
 */
export function isValidCoordinatePair(lat: number, lng: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

/**
 * Validate coordinate pair and throw error if invalid
 *
 * @param {number} lat - Latitude to validate
 * @param {number} lng - Longitude to validate
 * @throws {Error} If coordinates are invalid
 */
export function validateCoordinates(lat: number, lng: number): void {
  if (!isValidLatitude(lat)) {
    throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90.`);
  }
  if (!isValidLongitude(lng)) {
    throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180.`);
  }
}
