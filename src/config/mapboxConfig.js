// Mapbox configuration constants
export const MAPBOX_CONFIG = {
  ACCESS_TOKEN: import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'your-mapbox-token-here',
  VECTOR_SOURCE_ID: 'zip-codes-vector',
  VECTOR_SOURCE_URL: 'mapbox://thatdanman.1iwrf9m2',
  VECTOR_SOURCE_LAYER: 'tl_2025_us_zcta520_10percent-7qszeg',
  ZIP_PROPERTY: 'ZCTA5CE20',
  US_CENTER: [-98.5795, 39.8283],
  US_ZOOM: 4,
  MIN_ZOOM_ZIP_VISIBLE: 7
};

// Token validation
export const hasValidToken = MAPBOX_CONFIG.ACCESS_TOKEN &&
  MAPBOX_CONFIG.ACCESS_TOKEN !== 'your-mapbox-token-here' &&
  MAPBOX_CONFIG.ACCESS_TOKEN.length > 10;

if (!hasValidToken) {
  console.error('🗺️ INVALID MAPBOX TOKEN - Map will not load');
} else {
  console.log('🗺️ Mapbox access token configured:', hasValidToken ? 'YES' : 'NO/MISSING');
  console.log('🗺️ Token length:', MAPBOX_CONFIG.ACCESS_TOKEN.length, 'starts with pk.:', MAPBOX_CONFIG.ACCESS_TOKEN.startsWith('pk.'));
}