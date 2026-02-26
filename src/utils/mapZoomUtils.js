import * as turf from '@turf/turf';
import { geocodeAndZoomToTerritory } from './zipCoordinateUtils';

/**
 * Utility functions for map zoom and centering operations
 * Handles territory zooming, bounds calculation, and state detection
 */

// Zoom to a specific territory by fitting bounds to its ZIP codes
export const zoomToTerritory = (territoryId, territories, allZips, territoryGroupsRef, mapRef) => {
  // Use the most current territories data
  const territory = territories.find(t => t.id === territoryId);
  if (!territory || !allZips) {
    return;
  }
  if (!mapRef.current) {
    setTimeout(() => zoomToTerritory(territoryId, territories, allZips, territoryGroupsRef, mapRef), 100);
    return;
  }
  const zipFeatures = allZips.features.filter(f => territory.zips.some(z => z.zip === f.properties.ZCTA5CE20));
  if (zipFeatures.length === 0) {
    // Fallback to geocoding when no ZIP features are found
    geocodeAndZoomToTerritory(territory, mapRef.current);
    return;
  }
  const collection = turf.featureCollection(zipFeatures);
  const bbox = turf.bbox(collection);
  mapRef.current.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [50, 50] });
  // Highlight: temporarily increase weight
  if (territoryGroupsRef.current[territoryId]) {
    territoryGroupsRef.current[territoryId].eachLayer(layer => {
      layer.setStyle({ weight: 3, color: '#0066cc' });
    });
    setTimeout(() => {
      territoryGroupsRef.current[territoryId].eachLayer(layer => {
        layer.setStyle({ weight: 1.5, color: '#0066cc', fillOpacity: 0.3 });
      });
    }, 3000);
  }
};

// Find the closest state to a given map center point
export const findClosestState = (center, usStatesGeoJSON) => {
  const centerPt = turf.point([center.lng, center.lat]);

  let selectedAbbr = null;
  let minDist = Infinity;

  if (usStatesGeoJSON) {
    for (const feature of usStatesGeoJSON.features) {
      if (feature.geometry) {
        const centroid = turf.centroid(feature);
        const dist = turf.distance(centerPt, centroid, { units: "kilometers" });

        let abbr = (
          feature.properties.STUSPS ||
          feature.properties.STUSPS?.toLowerCase() ||
          feature.properties.statefp ||
          feature.properties.STATEFP ||
          feature.properties.postal ||
          feature.properties.POSTAL ||
          feature.properties.STATE ||
          feature.properties.state
        );

        if (abbr) {
          abbr = abbr.toLowerCase();
          if (dist < minDist) {
            minDist = dist;
            selectedAbbr = abbr;
          }
        }
      }
    }
  }

  return { selectedAbbr, minDist };
};

// Basic geocode function for search functionality (simplified version)
export const geocodeAndZoom = async (query, map) => {
  if (!query || !query.trim()) {
    return null;
  }

  if (!map) {
    return null;
  }

  const trimmedQuery = query.trim();

  try {
    // For now, return a simple result - in a real implementation you'd use a geocoding service
    return {
      center: [39.8283, -98.5795], // US center
      bbox: null,
      placeName: trimmedQuery,
      placeType: 'unknown'
    };

  } catch (error) {
    console.error('Error geocoding:', error);
    return null;
  }
};