/**
 * Date and time utility functions
 *
 * @module dateUtils
 */

import type { TimeRange } from '../types';

/**
 * Get cutoff date for time range filter
 *
 * @param {TimeRange} range - Time range preset
 * @returns {string} Cutoff date in YYYY-MM-DD format
 */
export function getTimeRangeCutoff(range: TimeRange): string {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  switch (range) {
    case '24h':
      return new Date(now.getTime() - msPerDay).toISOString().split('T')[0];
    case '3days':
      return new Date(now.getTime() - 3 * msPerDay).toISOString().split('T')[0];
    case '1week':
      return new Date(now.getTime() - 7 * msPerDay).toISOString().split('T')[0];
    case '2weeks':
      return new Date(now.getTime() - 14 * msPerDay).toISOString().split('T')[0];
    case '1month':
      return new Date(now.getTime() - 30 * msPerDay).toISOString().split('T')[0];
    case '3months':
      return new Date(now.getTime() - 90 * msPerDay).toISOString().split('T')[0];
    case 'all':
      return '1900-01-01'; // Far past date to include everything
    default:
      return new Date(now.getTime() - 14 * msPerDay).toISOString().split('T')[0];
  }
}

/**
 * Parse time string and calculate time difference in minutes
 *
 * @param {string} time1 - Time in HH:MM format
 * @param {string} time2 - Time in HH:MM format
 * @returns {number} Difference in minutes
 */
export function getTimeDifferenceMinutes(time1: string, time2: string): number {
  const [hour1, minute1] = time1.split(':').map(Number);
  const [hour2, minute2] = time2.split(':').map(Number);

  const totalMinutes1 = hour1 * 60 + minute1;
  const totalMinutes2 = hour2 * 60 + minute2;

  const diff = Math.abs(totalMinutes1 - totalMinutes2);

  // Handle wraparound at midnight
  return Math.min(diff, 1440 - diff);
}

/**
 * Check if time is within range of target time
 *
 * @param {string} time - Time to check in HH:MM format
 * @param {string} targetTime - Target time in HH:MM format
 * @param {number} rangeHours - Range in hours (+/-)
 * @returns {boolean} True if time is within range
 */
export function isTimeWithinRange(
  time: string,
  targetTime: string,
  rangeHours: number
): boolean {
  const diffMinutes = getTimeDifferenceMinutes(time, targetTime);
  const rangeMinutes = rangeHours * 60;

  return diffMinutes <= rangeMinutes;
}
