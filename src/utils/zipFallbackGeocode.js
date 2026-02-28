/**
 * Fallback geocoding for territories when vector tiles have no features.
 * Uses ZIP prefix lookup and estimateCoordsFromZip; mapbox uses [lng, lat], internal coords [lat, lng].
 */

import { estimateCoordsFromZip } from './zipCoordinateUtils';

/**
 * Geocode territory ZIPs via lookup/estimate and fly map to center.
 * @param {Object} territory - { name, zips: [{ zip }] }
 * @param {Object} map - Mapbox map instance
 */
export async function geocodeAndZoomToTerritory(territory, map) {
  console.log('Attempting to geocode territory ZIPs for', territory.name);

  const coordinates = [];
  let foundZips = 0;

  territory.zips.forEach(zipObj => {
    const fullZip = zipObj.zip.toString();
    const zipPrefix = fullZip.length >= 3 ? fullZip.substring(0, 3) : fullZip;
    const coordsLngLat = estimateCoordsFromZip(zipPrefix);
    const coords = [coordsLngLat[1], coordsLngLat[0]]; // [lat, lng] for internal use
    coordinates.push(coords);
    foundZips++;
    console.log(`Found/estimated coords for ZIP ${zipObj.zip}: [${coords[0]}, ${coords[1]}]`);
  });

  if (coordinates.length === 0) {
    console.log('No coordinates found for any ZIPs in territory - cannot zoom');
    return;
  }

  const sortedLats = coordinates.map(c => c[0]).sort((a, b) => a - b);
  const sortedLngs = coordinates.map(c => c[1]).sort((a, b) => a - b);

  const midIndex = Math.floor(coordinates.length / 2);
  let centerLat = sortedLats[midIndex];
  let centerLng = sortedLngs[midIndex];

  if (coordinates.length > 3) {
    const latRange = sortedLats[sortedLats.length - 1] - sortedLats[0];
    const lngRange = sortedLngs[sortedLngs.length - 1] - sortedLngs[0];

    if (latRange > 5 || lngRange > 5) {
      const minLat = Math.min(...coordinates.map(c => c[0]));
      const maxLat = Math.max(...coordinates.map(c => c[0]));
      const minLng = Math.min(...coordinates.map(c => c[1]));
      const maxLng = Math.max(...coordinates.map(c => c[1]));
      centerLat = (minLat + maxLat) / 2;
      centerLng = (minLng + maxLng) / 2;
    }
  }

  let zoomLevel = 8;
  if (coordinates.length > 0) {
    const latRange = sortedLats[sortedLats.length - 1] - sortedLats[0];
    const lngRange = sortedLngs[sortedLngs.length - 1] - sortedLngs[0];
    const maxRange = Math.max(latRange, lngRange);
    if (maxRange < 0.5) zoomLevel = 10;
    else if (maxRange < 1) zoomLevel = 9;
    else if (maxRange < 3) zoomLevel = 8;
    else if (maxRange < 5) zoomLevel = 7;
    else zoomLevel = 6;
  }

  map.flyTo({
    center: [centerLng, centerLat],
    zoom: zoomLevel,
    duration: 1500
  });

  console.log('Zoomed to territory center using fallback geocoding');
}
