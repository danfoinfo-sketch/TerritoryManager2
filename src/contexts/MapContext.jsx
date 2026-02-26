import React, { createContext, useContext, useRef, useState } from 'react';

/**
 * Context for sharing map state across components and hooks
 * Eliminates prop drilling in map-related hooks
 */
const MapContext = createContext();

/**
 * MapProvider component that provides all map-related state
 */
export const MapProvider = ({ children }) => {
  // Map refs
  const mapRef = useRef(null);
  const wrapperRef = useRef(null);

  // Map state
  const [map, setMap] = useState(null);

  // Territory state
  const [territories, setTerritories] = useState([]);
  const [activeTerritoryId, setActiveTerritoryId] = useState(null);
  const [addModeTerritoryId, setAddModeTerritoryId] = useState(null);
  const [localTerritories, setLocalTerritories] = useState([]);
  const [boundaryMode, setBoundaryMode] = useState("zips");

  // Function props (passed down from parent)
  const [addZipToActiveTerritory, setAddZipToActiveTerritory] = useState(() => () => {});

  // Data loading state (from useMapData)
  const [usStatesGeoJSON, setUsStatesGeoJSON] = useState(null);
  const [allZips, setAllZips] = useState(null);
  const [loadingZips, setLoadingZips] = useState(false);
  const zipDataCache = useRef({});

  // Layer refs (from useMapLayers)
  const zipLayerGroupRef = useRef(null);
  const loadedZipLayers = useRef({});
  const territoryGroupsRef = useRef({});
  const [currentLoadedStateAbbr, setCurrentLoadedStateAbbr] = useState(null);

  // Event state (from useMapEvents)
  const moveTimeoutRef = useRef(null);

  // Layer functions (will be set by useMapLayers)
  const [updateZipForCenter, setUpdateZipForCenter] = useState(() => () => {});
  const [loadZipForStates, setLoadZipForStates] = useState(() => () => () => {});

  const contextValue = {
    // Map refs
    mapRef,
    wrapperRef,
    map,
    setMap,

    // Territory state
    territories,
    setTerritories,
    activeTerritoryId,
    setActiveTerritoryId,
    addModeTerritoryId,
    setAddModeTerritoryId,
    localTerritories,
    setLocalTerritories,
    boundaryMode,
    setBoundaryMode,

    // Function props
    addZipToActiveTerritory,
    setAddZipToActiveTerritory,

    // Data loading state
    usStatesGeoJSON,
    setUsStatesGeoJSON,
    allZips,
    setAllZips,
    loadingZips,
    setLoadingZips,
    zipDataCache,

    // Layer refs
    zipLayerGroupRef,
    loadedZipLayers,
    territoryGroupsRef,
    currentLoadedStateAbbr,
    setCurrentLoadedStateAbbr,

    // Event state
    moveTimeoutRef,

    // Layer functions
    updateZipForCenter,
    setUpdateZipForCenter,
    loadZipForStates,
    setLoadZipForStates,
  };

  return (
    <MapContext.Provider value={contextValue}>
      {children}
    </MapContext.Provider>
  );
};

/**
 * Hook to consume map context
 */
export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error('useMapContext must be used within a MapProvider');
  }
  return context;
};