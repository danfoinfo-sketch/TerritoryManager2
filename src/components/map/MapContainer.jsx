import React, { useEffect, useImperativeHandle, forwardRef } from "react";
import { MapContainer as LeafletMap, TileLayer, GeoJSON } from "react-leaflet";

// Context
import { MapProvider, useMapContext } from '../../contexts/MapContext';

// Custom hooks
import { useMapData } from '../../hooks/useMapData';
import { useMapLayers } from '../../hooks/useMapLayers';
import { useMapEvents } from '../../hooks/useMapEvents';

// Utils
import { zoomToTerritory, geocodeAndZoom } from '../../utils/mapZoomUtils';

// Components
import MapLoadingSpinner from './MapLoadingSpinner';
import { MapInvalidator, DataChangeInvalidator, US_CENTER, US_ZOOM } from './MapInvalidators';

// Inner component that consumes context
const MapContainerInner = forwardRef(function MapContainerInner(props, ref) {
  // Get context values
  const {
    mapRef,
    wrapperRef,
    map,
    setMap,
    territories,
    setTerritories,
    activeTerritoryId,
    addModeTerritoryId,
    addZipToActiveTerritory,
    boundaryMode,
    localTerritories,
    setLocalTerritories,
    usStatesGeoJSON,
    allZips,
    loadingZips,
    territoryGroupsRef,
  } = useMapContext();

  // Use custom hooks (they now consume context internally)
  useMapData();
  useMapLayers();
  useMapEvents();

  // Sync local territories with prop changes
  useEffect(() => {
    setLocalTerritories(territories);
  }, [territories, setLocalTerritories]);

  // Expose zoomToTerritory via ref
  useImperativeHandle(ref, () => ({
    zoomToTerritory: (territoryId) =>
      zoomToTerritory(territoryId, territories, allZips, territoryGroupsRef, mapRef),
    geocodeAndZoom: (query) => geocodeAndZoom(query, mapRef.current),
  }));

  // Map creation callback
  const mapCreated = (map) => {
    mapRef.current = map;
    setMap(map);
    map.invalidateSize(); // Force redraw after creation
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 300);
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
  };

  return (
    <div ref={wrapperRef} style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      <LeafletMap
        id="map"
        ref={mapRef}
        center={US_CENTER}
        zoom={US_ZOOM}
        style={{ height: '100%', width: '100%' }}
        minZoom={3}
        maxZoom={19}
        zoomControl={true}
        scrollWheelZoom={true}
        preferCanvas={true}
        whenCreated={mapCreated}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />

        <MapInvalidator />
        <DataChangeInvalidator savedZones={territories} />

        {usStatesGeoJSON && (
          <GeoJSON
            data={usStatesGeoJSON}
            style={{
              color: "#2c3e50",
              weight: 2.5,
              opacity: 0.9,
              fill: false,
            }}
          />
        )}

        <MapLoadingSpinner loading={loadingZips} />
      </LeafletMap>
    </div>
  );
});

MapContainerInner.displayName = 'MapContainerInner';

// Main component that provides context
const MapContainerComponent = forwardRef(function MapContainerComponent({
  territories = [],
  activeTerritoryId,
  addModeTerritoryId,
  addZipToActiveTerritory,
  boundaryMode = "zips",
}, ref) {
  return (
    <MapProvider>
      <MapContextInitializer
        territories={territories}
        activeTerritoryId={activeTerritoryId}
        addModeTerritoryId={addModeTerritoryId}
        addZipToActiveTerritory={addZipToActiveTerritory}
        boundaryMode={boundaryMode}
      />
      <MapContainerInner ref={ref} />
    </MapProvider>
  );
});

MapContainerComponent.displayName = 'MapContainerComponent';

// Component to initialize context with props
function MapContextInitializer({
  territories,
  activeTerritoryId,
  addModeTerritoryId,
  addZipToActiveTerritory,
  boundaryMode,
}) {
  const {
    setTerritories,
    setActiveTerritoryId,
    setAddModeTerritoryId,
    setAddZipToActiveTerritory,
    setBoundaryMode,
    setLocalTerritories,
  } = useMapContext();

  // Initialize context with props
  useEffect(() => {
    setTerritories(territories);
    setActiveTerritoryId(activeTerritoryId);
    setAddModeTerritoryId(addModeTerritoryId);
    setAddZipToActiveTerritory(() => addZipToActiveTerritory);
    setBoundaryMode(boundaryMode);
    setLocalTerritories(territories);
  }, [
    territories,
    activeTerritoryId,
    addModeTerritoryId,
    addZipToActiveTerritory,
    boundaryMode,
    setTerritories,
    setActiveTerritoryId,
    setAddModeTerritoryId,
    setAddZipToActiveTerritory,
    setBoundaryMode,
    setLocalTerritories,
  ]);

  return null;
}

export default MapContainerComponent;