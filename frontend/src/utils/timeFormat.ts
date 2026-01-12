/**
 * Convert 24-hour time format to 12-hour AM/PM format
 *
 * @param {string} time24 - Time in HH:MM format (e.g., "14:30")
 * @returns {string} Time in 12-hour AM/PM format (e.g., "2:30 PM")
 */
export function formatTimeTo12Hour(time24: string): string {
  if (!time24) return '';

  const [hoursStr, minutes] = time24.split(':');
  let hours = parseInt(hoursStr, 10);

  if (isNaN(hours)) return time24;

  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12; // Convert 0 to 12 for midnight, 13-23 to 1-11

  return `${hours}:${minutes} ${period}`;
}

/**
 * Format duration in seconds to readable string (e.g., "2:05" for 125 seconds)
 *
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string (MM:SS or HH:MM:SS)
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format incident type from database format to display format
 *
 * @param {string} incidentType - Incident type in database format (e.g., "side_swipe", "rear_end")
 * @returns {string} Formatted incident type for display (e.g., "Side Swipe", "Rear End")
 */
export function formatIncidentType(incidentType: string): string {
  if (!incidentType) return '';

  // Split by underscore and capitalize each word
  return incidentType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
