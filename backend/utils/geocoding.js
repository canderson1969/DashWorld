import { logger } from './logger.js';

/**
 * Perform reverse geocoding to get address from coordinates
 *
 * @param {number} lat - Latitude coordinate
 * @param {number} lng - Longitude coordinate
 * @returns {Promise<string>} Formatted location name (e.g., "Market St & 5th St, SF")
 * @throws {Error} If geocoding request fails
 */
export async function reverseGeocode(lat, lng) {
  try {
    // Use OpenStreetMap Nominatim API for reverse geocoding (free, no API key needed)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DashWorld/1.0' // Nominatim requires a User-Agent header
      }
    });

    if (!response.ok) {
      logger.warn('Reverse geocoding API request failed', {
        statusCode: response.status,
        lat,
        lng
      });
      return formatFallbackLocation(lat, lng);
    }

    const data = await response.json();

    if (!data || !data.address) {
      logger.warn('Reverse geocoding returned no address data', {
        lat,
        lng,
        response: data
      });
      return formatFallbackLocation(lat, lng);
    }

    const address = data.address;
    const locationName = formatLocationName(address);

    logger.info('Reverse geocoding successful', {
      lat,
      lng,
      locationName,
      rawAddress: address
    });

    return locationName;
  } catch (error) {
    logger.error('Reverse geocoding failed', error, {
      lat,
      lng,
      operation: 'reverse_geocode'
    });

    return formatFallbackLocation(lat, lng);
  }
}

/**
 * Format address data into a readable location name
 *
 * @param {Object} address - Address object from Nominatim API
 * @returns {string} Formatted location string
 */
function formatLocationName(address) {
  // Try to build intersection format (e.g., "Market St & 5th St, SF")
  const road = address.road || address.street;
  const city = address.city || address.town || address.village;
  const state = address.state;

  // If we have a road name, use it
  if (road) {
    // Try to include neighborhood or suburb for more context
    const neighborhood = address.neighbourhood || address.suburb;

    // Format: "Street Name, City" or "Street Name, Neighborhood, City"
    let parts = [road];

    if (neighborhood && neighborhood !== city) {
      parts.push(neighborhood);
    }

    if (city) {
      // Abbreviate common city names
      const cityAbbrev = abbreviateCity(city, state);
      parts.push(cityAbbrev);
    }

    return parts.join(', ');
  }

  // Fallback: use whatever we have
  if (city) {
    return `${city}, ${state || ''}`.trim();
  }

  return address.display_name || 'Unknown location';
}

/**
 * Abbreviate common city names
 *
 * @param {string} city - Full city name
 * @param {string} state - State name
 * @returns {string} Abbreviated city name
 */
function abbreviateCity(city, state) {
  const abbreviations = {
    'San Francisco': 'SF',
    'Los Angeles': 'LA',
    'New York': 'NY',
    'Washington': 'DC'
  };

  return abbreviations[city] || city;
}

/**
 * Format fallback location when geocoding fails
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} Formatted coordinates
 */
function formatFallbackLocation(lat, lng) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
