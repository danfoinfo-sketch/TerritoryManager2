import { useEffect, useLayoutEffect } from 'react';
import { useMapContext } from '../contexts/MapContext';

/**
 * Custom hook for managing map events and boundary mode changes
 * Handles resize observers, map move/zoom events, and boundary mode switching
 */
export const useMapEvents = () => {
  const {
    mapRef,
    wrapperRef,
    map,
    boundaryMode,
    zipLayerGroupRef,
    updateZipForCenter,
    currentLoadedStateAbbr,
    allZips,
    setLoadingZips,
    moveTimeoutRef,
  } = useMapContext();
  const moveTimeoutRef = useRef(null);

  // Resize observer for map container
  useEffect(() => {
    if (!wrapperRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    });
    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, [mapRef, wrapperRef]);

  // Map layout effect for initial setup
  useLayoutEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
      mapRef.current.addLayer(zipLayerGroupRef.current);
    }
  }, [mapRef, zipLayerGroupRef]);

  // Boundary mode changes
  useEffect(() => {
    if (!mapRef.current) return;
    const showZips = boundaryMode === "zips" || boundaryMode === "both";
    if (!showZips) {
      zipLayerGroupRef.current.clearLayers();
      setLoadingZips(false);
      return;
    }

    updateZipForCenter();
  }, [mapRef, allZips, boundaryMode, zipLayerGroupRef, updateZipForCenter, setLoadingZips]);

  // Map move/zoom events
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const showZips = boundaryMode === "zips" || boundaryMode === "both";
    if (!showZips) return;

    const handleMoveEnd = () => {
      clearTimeout(moveTimeoutRef.current);
      moveTimeoutRef.current = setTimeout(updateZipForCenter, 500);
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      clearTimeout(moveTimeoutRef.current);
    };
  }, [mapRef, boundaryMode, currentLoadedStateAbbr, allZips, updateZipForCenter]);

  // Map initialization effect
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
      mapRef.current.addLayer(zipLayerGroupRef.current);
    }
  }, [map, mapRef, zipLayerGroupRef]);

  return {};
};