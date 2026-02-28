import * as turf from '@turf/turf';

// Process found features and calculate territory geometry
export function processFeatures(features, territory) {
  console.log('🔍 Processing', features.length, 'features for territory', territory.name);

  // Create GeoJSON FeatureCollection from the features
  const featureCollection = turf.featureCollection(features);
  console.log('🔍 Created feature collection with', featureCollection.features.length, 'features');

  // Union all polygons to get a single geometry representing the entire territory
  let unionGeometry;
  try {
    unionGeometry = turf.union(featureCollection);
    console.log('🔍 Union successful, geometry type:', unionGeometry.geometry.type);
  } catch (unionError) {
    console.warn('🔍 Union failed, using first feature instead:', unionError.message);
    unionGeometry = features[0]; // Fallback to first feature
  }

  // Calculate bounding box and centroid
  const bbox = turf.bbox(unionGeometry);
  const centroid = turf.centroid(unionGeometry);

  console.log('🔍 Territory bounds:', bbox);
  console.log('🔍 Territory center:', centroid.geometry.coordinates);

  return {
    geometry: unionGeometry,
    bbox: bbox,
    centroid: centroid.geometry.coordinates,
    featureCount: features.length
  };
}

// Get territory geometry and bounds from vector tiles
export async function getTerritoryGeometry(territory, map, waitForVectorSource, isVectorSourceLoaded) {
  console.log('🔍 Getting territory geometry for', territory.name, 'with', territory.zips.length, 'ZIPs');

  try {
    // Query all ZIP features that belong to this territory
    const territoryZips = territory.zips.map(zipObj => zipObj.zip.toString());
    console.log('🔍 Territory ZIPs:', territoryZips);

    // First, try a quick query to see if any features are available
    const initialFeatures = map.querySourceFeatures('zip-codes-vector', {
      sourceLayer: 'tl_2025_us_zcta520_10percent-7qszeg',
      filter: ['in', ['get', 'ZCTA5CE20'], ['literal', territoryZips]]
    });

    if (initialFeatures.length > 0) {
      console.log('🔍 Found', initialFeatures.length, 'features immediately');
      // Process the features we found
      return processFeatures(initialFeatures, territory);
    }

    // No features found initially - wait for source to load
    console.log('🔍 No initial features found, waiting for source to load...');
    const sourceLoaded = await waitForVectorSource(map, 3000); // Wait up to 3 seconds

    if (!sourceLoaded) {
      console.log('🔍 Vector source still not loaded after waiting');
    }

    // Try query again after waiting
    const features = map.querySourceFeatures('zip-codes-vector', {
      sourceLayer: 'tl_2025_us_zcta520_10percent-7qszeg',
      filter: ['in', ['get', 'ZCTA5CE20'], ['literal', territoryZips]]
    });

    console.log('🔍 After waiting, querySourceFeatures returned', features.length, 'features');

    // Debug: Log some sample features if found
    if (features.length > 0) {
      console.log('🔍 Sample feature properties:', features[0].properties);
      console.log('🔍 Sample feature geometry type:', features[0].geometry?.type);
      return processFeatures(features, territory);
    }

    // Still no features - try to fly to an estimated center to load relevant tiles
    console.log('🔍 Still no features found. Trying to load tiles by flying to estimated center...');

    // Quick geocoding to get an approximate center
    const quickCenter = getQuickCenterEstimate(territory);
    if (quickCenter) {
      console.log('🔍 Flying to estimated center to load tiles:', quickCenter);

      // Fly to the estimated center to load tiles
      map.flyTo({
        center: quickCenter,
        zoom: 6, // Low zoom to load broader area
        duration: 500 // Quick movement
      });

      // Wait a bit for tiles to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try one more query
      const finalFeatures = map.querySourceFeatures('zip-codes-vector', {
        sourceLayer: 'tl_2025_us_zcta520_10percent-7qszeg',
        filter: ['in', ['get', 'ZCTA5CE20'], ['literal', territoryZips]]
      });

      console.log('🔍 After flying to center, found', finalFeatures.length, 'features');

      if (finalFeatures.length > 0) {
        return processFeatures(finalFeatures, territory);
      }
    }

    console.log('🔍 No features found even after trying to load tiles. Possible reasons:');
    console.log('🔍 - ZIP codes not in tileset');
    console.log('🔍 - ZIP code format mismatch');
    console.log('🔍 - Vector tileset configuration issue');

    // Try a broader query to see if any features are available at all
    const allFeatures = map.querySourceFeatures('zip-codes-vector', {
      sourceLayer: 'tl_2025_us_zcta520_10percent-7qszeg'
    });
    console.log('🔍 Total features available in loaded tiles:', allFeatures.length);

    if (allFeatures.length > 0) {
      console.log('🔍 Sample ZIP codes in loaded tiles:', allFeatures.slice(0, 5).map(f => f.properties?.ZCTA5CE20));
    }

    console.log('🔍 Will use fallback geocoding');
    return null;

  } catch (error) {
    console.error('🔍 Error getting territory geometry:', error);
    return null;
  }
}