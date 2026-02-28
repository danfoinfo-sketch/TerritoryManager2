/**
 * Map business logic: territory lookup, geometry, vector source helpers, zoom/geocode.
 * Used by MapboxMapContainer and hooks.
 */

import { MAPBOX_CONFIG } from '../config/mapboxConfig';
import { findTerritoryByZip as findTerritoryByZipUtil, calculateTerritoryStats as calculateTerritoryStatsUtil } from './zipProcessing';
import { processFeatures as processFeaturesUtil } from './mapGeometry';
import { geocodeAndZoomToTerritory as geocodeAndZoomToTerritoryFallback } from './zipFallbackGeocode';

const { VECTOR_SOURCE_ID, VECTOR_SOURCE_LAYER, ZIP_PROPERTY } = MAPBOX_CONFIG;

// Re-export with (territories, zipCode) signature for container
export function findTerritoryByZip(territories, zipCode) {
  return findTerritoryByZipUtil(zipCode, territories);
}

export { calculateTerritoryStatsUtil as calculateTerritoryStats };

// Config-aware vector source helpers (container used VECTOR_SOURCE_ID from config)
export function isVectorSourceLoaded(map, vectorSourceId = VECTOR_SOURCE_ID) {
  try {
    const source = map.getSource(vectorSourceId);
    if (!source) {
      console.log('🔍 Vector source not found');
      return false;
    }
    const sourceCache = source._source && source._source._tileCache;
    if (!sourceCache) {
      console.log('🔍 Vector source cache not available');
      return false;
    }
    const loadedTiles = Object.keys(sourceCache._tiles || {});
    console.log('🔍 Vector source has', loadedTiles.length, 'loaded tiles');
    return loadedTiles.length > 0;
  } catch (error) {
    console.error('🔍 Error checking source loaded state:', error);
    return false;
  }
}

export function waitForVectorSource(map, timeout = 5000, vectorSourceId = VECTOR_SOURCE_ID) {
  return new Promise((resolve) => {
    if (isVectorSourceLoaded(map, vectorSourceId)) {
      console.log('🔍 Vector source already loaded');
      resolve(true);
      return;
    }
    console.log('🔍 Waiting for vector source to load...');
    const checkLoaded = () => {
      if (isVectorSourceLoaded(map, vectorSourceId)) {
        console.log('🔍 Vector source loaded successfully');
        resolve(true);
        return;
      }
      setTimeout(checkLoaded, 100);
    };
    checkLoaded();
    setTimeout(() => {
      console.log('🔍 Vector source load timeout, proceeding with fallback');
      resolve(false);
    }, timeout);
  });
}

export { processFeaturesUtil as processFeatures };

/**
 * Get territory geometry and bounds from vector tiles.
 * @param {Object} territory
 * @param {Object} map - Mapbox map instance
 * @param {Function} getQuickCenterEstimate - (territory) => [lng, lat] from useMapGeocoding
 */
export async function getTerritoryGeometry(territory, map, getQuickCenterEstimate) {
  console.log('🔍 Getting territory geometry for', territory.name, 'with', territory.zips.length, 'ZIPs');

  try {
    const territoryZips = territory.zips.map(zipObj => zipObj.zip.toString());
    console.log('🔍 Territory ZIPs:', territoryZips);

    const initialFeatures = map.querySourceFeatures(VECTOR_SOURCE_ID, {
      sourceLayer: VECTOR_SOURCE_LAYER,
      filter: ['in', ['get', ZIP_PROPERTY], ['literal', territoryZips]]
    });

    if (initialFeatures.length > 0) {
      console.log('🔍 Found', initialFeatures.length, 'features immediately');
      return processFeaturesUtil(initialFeatures, territory);
    }

    console.log('🔍 No initial features found, waiting for source to load...');
    const sourceLoaded = await waitForVectorSource(map, 3000);

    if (!sourceLoaded) {
      console.log('🔍 Vector source still not loaded after waiting');
    }

    const features = map.querySourceFeatures(VECTOR_SOURCE_ID, {
      sourceLayer: VECTOR_SOURCE_LAYER,
      filter: ['in', ['get', ZIP_PROPERTY], ['literal', territoryZips]]
    });

    console.log('🔍 After waiting, querySourceFeatures returned', features.length, 'features');

    if (features.length > 0) {
      console.log('🔍 Sample feature properties:', features[0].properties);
      return processFeaturesUtil(features, territory);
    }

    console.log('🔍 Still no features found. Trying to load tiles by flying to estimated center...');
    const quickCenter = getQuickCenterEstimate && getQuickCenterEstimate(territory);
    if (quickCenter) {
      console.log('🔍 Flying to estimated center to load tiles:', quickCenter);
      map.flyTo({
        center: quickCenter,
        zoom: 6,
        duration: 500
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      const finalFeatures = map.querySourceFeatures(VECTOR_SOURCE_ID, {
        sourceLayer: VECTOR_SOURCE_LAYER,
        filter: ['in', ['get', ZIP_PROPERTY], ['literal', territoryZips]]
      });
      console.log('🔍 After flying to center, found', finalFeatures.length, 'features');
      if (finalFeatures.length > 0) {
        return processFeaturesUtil(finalFeatures, territory);
      }
    }

    console.log('🔍 No features found. Will use fallback geocoding');
    const allFeatures = map.querySourceFeatures(VECTOR_SOURCE_ID, { sourceLayer: VECTOR_SOURCE_LAYER });
    console.log('🔍 Total features available in loaded tiles:', allFeatures.length);
    return null;
  } catch (error) {
    console.error('🔍 Error getting territory geometry:', error);
    return null;
  }
}

export { geocodeAndZoomToTerritoryFallback as geocodeAndZoomToTerritory };

/**
 * Zoom map to a territory by id.
 * @param {string|number} territoryId
 * @param {Object} opts - { territories, getMap, geocodeLocation, geocodeAndZoomToTerritory }
 */
export async function zoomToTerritory(territoryId, { territories, getMap, geocodeLocation, geocodeAndZoomToTerritory }) {
  console.log('🎯 zoomToTerritory called for', territoryId);

  const territory = territories.find(t => String(t.id) === String(territoryId));
  if (!territory) {
    console.log('🎯 Territory not found:', territoryId);
    return;
  }

  const map = getMap();
  if (!map) {
    console.log('🎯 Map not ready');
    return;
  }

  console.log('🎯 Found territory:', territory.name, 'with', territory.zips.length, 'ZIPs');

  if (territory.zips.length === 0) {
    console.log('🎯 Territory has no ZIPs - skipping zoom');
    return;
  }

  if (territory.zips.length > 1) {
    const geocodePromises = territory.zips.map(zipObj =>
      Promise.resolve(geocodeLocation(zipObj.zip)).then(r => r).catch(() => null)
    );
    const geocodeResults = await Promise.all(geocodePromises);
    const validResults = geocodeResults.filter(result => result !== null);

    if (validResults.length > 0) {
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      validResults.forEach(result => {
        const [lng, lat] = result.center;
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      });

      const lngRange = maxLng - minLng;
      const latRange = maxLat - minLat;
      const maxRange = Math.max(lngRange, latRange);

      let targetZoom = 10;
      if (maxRange < 0.01) targetZoom = 14;
      else if (maxRange < 0.1) targetZoom = 12;
      else if (maxRange < 1) targetZoom = 10;
      else if (maxRange < 5) targetZoom = 8;
      else targetZoom = 6;

      const lngBuffer = lngRange * 0.1;
      const latBuffer = latRange * 0.1;
      const bufferedBounds = [
        [minLng - lngBuffer, minLat - latBuffer],
        [maxLng + lngBuffer, maxLat + latBuffer]
      ];

      map.fitBounds(bufferedBounds, {
        padding: 100,
        maxZoom: Math.min(targetZoom, 10),
        duration: 1500
      });
      return;
    }
  }

  const firstZip = territory.zips[0].zip;
  console.log('🎯 Using single ZIP geocoding for:', firstZip);
  const geocodeResult = await geocodeLocation(firstZip);

  if (geocodeResult) {
    const [lng, lat] = geocodeResult.center;
    map.flyTo({
      center: [lng, lat],
      zoom: 9,
      duration: 1500
    });
  } else {
    console.log('🎯 Geocoding failed for territory, using coordinate fallback');
    await geocodeAndZoomToTerritory(territory, map);
  }
}
