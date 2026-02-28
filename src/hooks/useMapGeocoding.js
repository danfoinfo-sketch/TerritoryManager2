import { useCallback } from 'react';
import { MAPBOX_CONFIG } from '../config/mapboxConfig';

export function useMapGeocoding(mapRef) {
  // Helper function to geocode a single location (returns coordinates without zooming)
  const geocodeLocation = useCallback(async (query) => {
    if (!query || !query.trim()) {
      return null;
    }

    const trimmedQuery = query.trim();

    try {
      const encodedQuery = encodeURIComponent(trimmedQuery);
      const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}&country=us&types=postcode,place,region&limit=1`;

      const response = await fetch(geocodingUrl);
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        console.log('❌ No geocoding results for:', trimmedQuery);
        return null;
      }

      const selectedFeature = data.features[0];
      console.log('✅ Geocoded', trimmedQuery, 'to:', selectedFeature.place_name, 'at', selectedFeature.center);

      return {
        center: selectedFeature.center, // [lng, lat]
        bbox: selectedFeature.bbox,
        placeName: selectedFeature.place_name
      };

    } catch (error) {
      console.error('Error geocoding location:', error);
      return null;
    }
  }, []);

  // Helper function to geocode a location and zoom to it using Mapbox Geocoding API
  const geocodeAndZoom = useCallback(async (query) => {
    if (!query || !query.trim()) {
      console.log('🔍 Empty search query, skipping geocode');
      return null;
    }

    if (!mapRef.current) {
      console.log('🔍 Map not ready for geocoding');
      return null;
    }

    const map = mapRef.current.getMap();
    const trimmedQuery = query.trim();
    console.log('🔍 Geocoding query:', trimmedQuery);

    try {
      // Encode the query for URL
      const encodedQuery = encodeURIComponent(trimmedQuery);

      // Build the geocoding URL
      const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_CONFIG.ACCESS_TOKEN}&country=us&types=postcode,place,region&limit=1`;

      console.log('🔍 Making geocoding request to:', geocodingUrl.replace(MAPBOX_CONFIG.ACCESS_TOKEN, '[TOKEN]'));

      const response = await fetch(geocodingUrl);
      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        console.log('🔍 No geocoding results found for:', trimmedQuery);
        return null;
      }

      console.log('🔍 Found', data.features.length, 'geocoding results');

      // Take the first result (limit=1 so should only be one)
      const selectedFeature = data.features[0];

      console.log('🔍 Selected geocoding result:', selectedFeature.place_name, 'Type:', selectedFeature.place_type);

      const [lng, lat] = selectedFeature.center;
      const bbox = selectedFeature.bbox;

      console.log('🔍 Geocoded center:', [lng, lat]);
      console.log('🔍 Geocoded bbox:', bbox);

      // If we have a bbox, use fitBounds for better zoom
      if (bbox && bbox.length === 4) {
        const [minLng, minLat, maxLng, maxLat] = bbox;
        map.fitBounds(
          [
            [minLng, minLat], // southwest
            [maxLng, maxLat]  // northeast
          ],
          {
            padding: 80, // Add padding around the bounds
            maxZoom: 14, // Don't zoom in too close
            duration: 1500 // Smooth animation
          }
        );
        console.log('🔍 Fitted bounds to geocoded result');
      } else {
        // Fallback to flyTo with center and reasonable zoom
        map.flyTo({
          center: [lng, lat],
          zoom: 10,
          duration: 1500
        });
        console.log('🔍 Flew to geocoded center (no bbox available)');
      }

      // Return the geocoded result for potential use
      return {
        center: [lng, lat],
        bbox: bbox,
        placeName: selectedFeature.place_name,
        placeType: selectedFeature.place_type
      };

    } catch (error) {
      console.error('🔍 Error geocoding:', error);
      return null;
    }
  }, []);

  // Helper function to get a quick center estimate for loading tiles
  const getQuickCenterEstimate = useCallback((territory) => {
    if (territory.zips.length === 0) return null;

    // Use the first ZIP code to estimate center
    const firstZip = territory.zips[0].zip.toString();
    const prefix = firstZip.substring(0, 3);

    // Estimate coordinates based on ZIP prefix (simplified regional mapping)
    const zipToCoords = {
      // Northeast
      '005': [-73.9, 40.7], '006': [-67.1, 18.2], '007': [-66.1, 18.4], '008': [-64.8, 17.7], '009': [-66.1, 18.4],
      '010': [-72.6, 42.2], '011': [-72.6, 42.1], '012': [-73.3, 42.4], '013': [-72.6, 42.6], '014': [-71.6, 42.6],
      '015': [-71.8, 42.2], '016': [-72.3, 42.3], '017': [-71.4, 42.4], '018': [-71.2, 42.6], '019': [-70.9, 42.5],
      '020': [-71.3, 42.1], '021': [-71.1, 42.4], '022': [-71.1, 42.4], '023': [-71.0, 41.9], '024': [-71.1, 42.3],
      '025': [-70.6, 41.7], '026': [-70.0, 41.7], '027': [-71.2, 41.8], '028': [-71.5, 41.8], '029': [-71.4, 41.8],
      '030': [-71.5, 43.0], '031': [-71.5, 43.0], '032': [-71.6, 43.3], '033': [-72.0, 43.3], '034': [-72.9, 42.8],
      '035': [-71.1, 44.3], '036': [-72.6, 42.8], '037': [-72.0, 43.3], '038': [-71.0, 43.3], '039': [-70.8, 43.2],
      '040': [-70.3, 43.9], '041': [-70.3, 43.7], '042': [-70.3, 44.3], '043': [-70.3, 44.3], '044': [-69.0, 45.0],
      '045': [-69.3, 44.2], '046': [-67.8, 44.9], '047': [-68.6, 47.0], '048': [-68.6, 44.3], '049': [-69.9, 44.9],
      '050': [-72.6, 43.8], '051': [-72.8, 43.0], '052': [-73.1, 42.9], '053': [-72.8, 43.1], '054': [-73.2, 44.5],
      '055': [-73.2, 44.5], '056': [-72.8, 44.3], '057': [-72.9, 43.6], '058': [-72.2, 44.9], '059': [-72.2, 44.9],
      '060': [-72.7, 41.8], '061': [-72.7, 41.8], '062': [-72.2, 41.8], '063': [-72.2, 41.7], '064': [-72.9, 41.3],
      '065': [-72.9, 41.3], '066': [-73.5, 41.1], '067': [-73.1, 41.6], '068': [-73.4, 41.2], '069': [-73.4, 41.2],
    };

    return zipToCoords[prefix] || [-98.5795, 39.8283]; // Default to US center
  }, []);

  return {
    geocodeLocation,
    geocodeAndZoom,
    getQuickCenterEstimate
  };
}