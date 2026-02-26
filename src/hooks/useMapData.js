import { useEffect } from 'react';
import { useMapContext } from '../contexts/MapContext';

/**
 * Custom hook for managing map data loading and caching
 * Handles GeoJSON data for US states and ZIP codes, plus ZIP data caching
 */
export const useMapData = () => {
  const {
    setUsStatesGeoJSON,
    setAllZips,
    setLoadingZips,
    zipDataCache,
  } = useMapContext();

  // Load GeoJSON dynamically to avoid heap issues
  useEffect(() => {
    fetch('/data/us-states.geojson')
      .then(res => res.json())
      .then(data => setUsStatesGeoJSON(data))
      .catch(err => console.error('[STATES] Failed to load:', err));

    fetch('/data/us-zips.geojson')
      .then(res => res.json())
      .then(data => setAllZips(data))
      .catch(err => console.error('[ZIPS] Failed to load:', err));
  }, [setUsStatesGeoJSON, setAllZips]);

  return {
    zipDataCache,
  };
};