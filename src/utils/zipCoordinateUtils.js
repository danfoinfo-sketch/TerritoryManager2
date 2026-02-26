import { zipToCoords } from '../data/zipPrefixCoords';

/**
 * Utility functions for ZIP code coordinate estimation and territory geocoding
 */

/**
 * Estimate coordinates based on ZIP code regional patterns
 * Falls back to regional centers when specific ZIP coordinates aren't available
 */
export const estimateCoordsFromZip = (zipPrefix) => {
  // Get first digit to determine region
  const firstDigit = zipPrefix.charAt(0);

  // Regional fallbacks based on first digit of ZIP
  switch (firstDigit) {
    case '0': return [40.7, -74.0];  // Northeast (NY/NJ area)
    case '1': return [40.7, -74.0];  // Northeast
    case '2': return [40.7, -74.0];  // Northeast
    case '3': return [39.8, -75.0];  // Mid-Atlantic (DC/Pennsylvania)
    case '4': return [39.8, -75.0];  // Mid-Atlantic
    case '5': return [39.5, -98.5];  // Midwest (Great Plains)
    case '6': return [39.5, -98.5];  // Midwest
    case '7': return [35.5, -97.5];  // South Central (Texas/Oklahoma)
    case '8': return [35.5, -97.5];  // South Central
    case '9': return [37.5, -120.0]; // West Coast (California)
    default: return [39.5, -98.35];  // Geographic center of US (fallback)
  }
};

/**
 * Fallback geocoding function for territories with missing ZIP features
 * Uses ZIP code prefix mappings to estimate territory center and zoom level
 */
export const geocodeAndZoomToTerritory = (territory, map) => {
  const coordinates = [];
  let foundZips = 0;

  // Try to get coordinates for each ZIP
  territory.zips.forEach(zipObj => {
    const fullZip = zipObj.zip.toString();
    const zipPrefix = fullZip.substring(0, 3);
    // First check for full 5-digit ZIP, then fall back to 3-digit prefix
    let coords = zipToCoords[fullZip] || zipToCoords[zipPrefix];

    if (coords) {
      coordinates.push(coords);
      foundZips++;
    } else {
      // Estimate coordinates based on ZIP code regional patterns
      const estimatedCoords = estimateCoordsFromZip(zipPrefix);
      coordinates.push(estimatedCoords);
      foundZips++;
    }
  });

  if (coordinates.length === 0) {
    return;
  }

  // Calculate a more intelligent center - use median instead of mean to avoid outliers
  const sortedLats = coordinates.map(c => c[0]).sort((a, b) => a - b);
  const sortedLngs = coordinates.map(c => c[1]).sort((a, b) => a - b);

  const midIndex = Math.floor(coordinates.length / 2);
  let centerLat = sortedLats[midIndex]; // Use median latitude
  let centerLng = sortedLngs[midIndex]; // Use median longitude

  // If we have many coordinates spread out, try to find a more central location
  if (coordinates.length > 3) {
    // Calculate the range
    const latRange = sortedLats[sortedLats.length - 1] - sortedLats[0];
    const lngRange = sortedLngs[sortedLngs.length - 1] - sortedLngs[0];

    // If coordinates are very spread out, use a different approach
    if (latRange > 5 || lngRange > 5) {
      // Use center of bounding box for widely spread territories
      const minLat = Math.min(...coordinates.map(c => c[0]));
      const maxLat = Math.max(...coordinates.map(c => c[0]));
      const minLng = Math.min(...coordinates.map(c => c[1]));
      const maxLng = Math.max(...coordinates.map(c => c[1]));

      centerLat = (minLat + maxLat) / 2;
      centerLng = (minLng + maxLng) / 2;
    }
  }

  // Determine appropriate zoom level based on coordinate spread
  let zoomLevel = 8;
  if (coordinates.length > 0) {
    const latRange = sortedLats[sortedLats.length - 1] - sortedLats[0];
    const lngRange = sortedLngs[sortedLngs.length - 1] - sortedLngs[0];
    const maxRange = Math.max(latRange, lngRange);

    // Adjust zoom based on spread
    if (maxRange < 0.5) zoomLevel = 10;      // Very tight cluster
    else if (maxRange < 1) zoomLevel = 9;    // Moderately tight
    else if (maxRange < 3) zoomLevel = 8;    // Normal spread
    else if (maxRange < 5) zoomLevel = 7;    // Wide spread
    else zoomLevel = 6;                      // Very wide spread
  }

  // Zoom to the calculated center
  map.flyTo([centerLng, centerLat], zoomLevel, {
    duration: 1.5
  });
};