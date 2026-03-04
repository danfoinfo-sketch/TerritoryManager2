/**
 * MapboxMapContainer - orchestration only; business logic and UI extracted to hooks/utils/overlays.
 */

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import Map, { NavigationControl } from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
import { MAPBOX_CONFIG } from '../../config/mapboxConfig';
import { injectGlobalStyles } from '../../config/globalStyles';
import { useMapState } from '../../hooks/useMapState';
import { useMapInitialization } from '../../hooks/useMapInitialization';
import { useMapLayers } from '../../hooks/useMapLayers';
import { useMapGeocoding } from '../../hooks/useMapGeocoding';
import { useMapEventHandlers } from '../../hooks/useMapEventHandlers';
import { useSelectedTerritoryPopup } from '../../hooks/useSelectedTerritoryPopup';
import {
  findTerritoryByZip,
  calculateTerritoryStats,
  zoomToTerritory as zoomToTerritoryUtil,
  geocodeAndZoomToTerritory
} from '../../utils/mapBusinessLogic';
import { MapLoadingOverlay, ZipLoadingOverlay } from './MapLoadingOverlay';
import { MapInvalidTokenMessage, ZipInfoPopup, TerritoryHoverTooltip, ZipCountWarning } from './MapOverlays';
import 'mapbox-gl/dist/mapbox-gl.css';

injectGlobalStyles();

const { VECTOR_SOURCE_ID, VECTOR_SOURCE_URL, VECTOR_SOURCE_LAYER, ZIP_PROPERTY, US_CENTER, US_ZOOM } = MAPBOX_CONFIG;

export default forwardRef(function MapboxMapContainer({
  territories = [],
  activeTerritoryId,
  setActiveTerritoryId,
  addModeTerritoryId,
  setAddModeTerritoryId,
  addZipToActiveTerritory,
  showBoundaries = true
}, ref) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const localAddModeTerritoryIdRef = useRef(null);

  // Keep ref in sync so click handler (registered once on map load) always sees current add-mode territory
  localAddModeTerritoryIdRef.current = addModeTerritoryId;

  const mapState = useMapState();
  const {
    mapLoaded, setMapLoaded,
    mapInitialized, setMapInitialized,
    popupInfo, setPopupInfo,
    territoryTooltip, setTerritoryTooltip,
    selectedTerritoryPopup, setSelectedTerritoryPopup,
    selectedZips, setSelectedZips,
    hoveredZip, setHoveredZip,
    isProcessingZip, setIsProcessingZip,
    processingZipsRef
  } = mapState;

  const [viewport, setViewport] = useState({
    longitude: US_CENTER[0],
    latitude: US_CENTER[1],
    zoom: US_ZOOM
  });

  const findTerritoryByZipCurried = useCallback((zipCode) => findTerritoryByZip(territories, zipCode), [territories]);

  const eventHandlers = useMapEventHandlers({
    mapRef,
    localAddModeTerritoryIdRef,
    isProcessingZip,
    setIsProcessingZip,
    processingZipsRef,
    addZipToActiveTerritory,
    setPopupInfo,
    setSelectedZips,
    setHoveredZip,
    setViewport
  });
  const { handleZipClick, handleZipHover, handleZipLeave, handleViewportChange } = eventHandlers;

  const { forceResize } = useMapInitialization(mapRef, mapContainerRef, setMapInitialized);

  const { hideDefaultBoundaries, addZipLayers } = useMapLayers(
    mapRef,
    territories,
    activeTerritoryId,
    addModeTerritoryId,
    handleZipClick,
    findTerritoryByZipCurried,
    calculateTerritoryStats,
    setTerritoryTooltip,
    setSelectedZips,
    setActiveTerritoryId,
    localAddModeTerritoryIdRef,
    ZIP_PROPERTY
  );

  const { geocodeLocation, geocodeAndZoom, getQuickCenterEstimate } = useMapGeocoding(mapRef);

  useSelectedTerritoryPopup({
    mapRef,
    mapLoaded,
    activeTerritoryId,
    territories,
    localAddModeTerritoryIdRef,
    selectedTerritoryPopup,
    setSelectedTerritoryPopup,
    setPopupInfo,
    calculateTerritoryStats,
    geocodeAndZoom
  });

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    console.log('🎨 Territory highlighting update - activeTerritoryId:', activeTerritoryId, 'addModeTerritoryId:', addModeTerritoryId);

    const territoryToHighlight = addModeTerritoryId
      ? territories.find(t => t.id === addModeTerritoryId)
      : activeTerritoryId
        ? territories.find(t => t.id === activeTerritoryId)
        : null;

    // If no territory is selected, show all territories; otherwise show the selected territory
    const zips = territoryToHighlight
      ? (territoryToHighlight.zips || []).map(z => String(z.zip ?? z))
      : territories.flatMap(t => (t.zips || []).map(z => String(z.zip ?? z)));

    console.log('🎨 Highlighting zips:', zips.length, territoryToHighlight ? 'single territory' : 'all territories');

    const map = mapRef.current.getMap();
    const layers = ['zip-highlight', 'territory-mask', 'territory-perimeter'];
    const filter = ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', zips]];
    layers.forEach(id => { if (map.getLayer(id)) map.setFilter(id, filter); });
    if (map.getLayer('zip-outlines-new')) map.setFilter('zip-outlines-new', ['!', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', zips]]]);
    map.triggerRepaint();
  }, [territories, addModeTerritoryId, activeTerritoryId, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current.getMap();
    const visibility = showBoundaries ? 'visible' : 'none';
    if (map.getLayer('zip-fills-new')) map.setLayoutProperty('zip-fills-new', 'visibility', visibility);
    if (map.getLayer('zip-outlines-new')) map.setLayoutProperty('zip-outlines-new', 'visibility', visibility);
  }, [showBoundaries, mapLoaded]);

  const onMapLoad = useCallback(() => {
    if (!mapRef.current) return;
    hideDefaultBoundaries();
    addZipLayers();
  }, [hideDefaultBoundaries, addZipLayers]);

  const zoomToTerritory = useCallback(async (territoryId) => {
    await zoomToTerritoryUtil(territoryId, {
      territories,
      getMap: () => mapRef.current?.getMap(),
      geocodeLocation,
      geocodeAndZoomToTerritory
    });
  }, [territories, geocodeLocation]);

  const enterAddMode = useCallback((territoryId) => {
    if (setAddModeTerritoryId) setAddModeTerritoryId(territoryId);
  }, [setAddModeTerritoryId]);

  const exitAddMode = useCallback(() => {
    if (setAddModeTerritoryId) setAddModeTerritoryId(null);
  }, [setAddModeTerritoryId]);

  useImperativeHandle(ref, () => ({
    zoomToTerritory,
    enterAddMode,
    exitAddMode,
    isInAddMode: () => !!localAddModeTerritoryIdRef.current,
    geocodeAndZoom
  }));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupInfo && !e.target.closest('.zip-tooltip')) setPopupInfo(null);
    };
    if (popupInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [popupInfo, setPopupInfo]);

  const hasValidToken = MAPBOX_CONFIG.ACCESS_TOKEN && MAPBOX_CONFIG.ACCESS_TOKEN !== 'your-mapbox-token-here' && MAPBOX_CONFIG.ACCESS_TOKEN.length > 10;
  if (!hasValidToken) return <MapInvalidTokenMessage />;

  return (
    <div
      ref={mapContainerRef}
      className="map-container"
      style={{
        height: '100%', width: '100%', position: 'relative',
        backgroundColor: mapLoaded ? 'transparent' : '#f5f5dc',
        minHeight: '400px', minWidth: '400px', display: 'block'
      }}
    >
      <MapLoadingOverlay mapInitialized={mapInitialized} mapLoaded={mapLoaded} />

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_CONFIG.ACCESS_TOKEN}
        initialViewState={viewport}
        onMove={handleViewportChange}
        onClick={(e) => {
          // Prevent map clicks from affecting territory selection
          console.log('🗺️ Map clicked at:', e.lngLat, 'features:', e.features);
          // Don't allow map clicks to clear territory selection
        }}
        style={{ width: '100%', height: '100%', minHeight: '400px', minWidth: '400px' }}
        mapStyle="mapbox://styles/mapbox/navigation-guidance-day-v1"
        onLoad={() => {
          setMapInitialized(true);
          setMapLoaded(true);
          onMapLoad();
        }}
        onError={() => setMapLoaded(false)}
        onStyleError={() => setMapLoaded(false)}
        onSourceError={() => setMapLoaded(false)}
        onTileError={() => setMapLoaded(false)}
        interactiveLayerIds={['zip-fills-new']}
      >
        <NavigationControl position="top-right" />
      </Map>

      <ZipLoadingOverlay loadingZips={mapState.loadingZips} />

      <ZipInfoPopup popupInfo={popupInfo} mapRef={mapRef} onClose={() => setPopupInfo(null)} />
      <TerritoryHoverTooltip territoryTooltip={territoryTooltip} mapRef={mapRef} />
      <ZipCountWarning selectedZipsCount={Array.isArray(selectedZips) ? selectedZips.length : 0} />
    </div>
  );
});
