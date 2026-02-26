import { useEffect, useCallback } from 'react';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { fetchZipPopulationAndHouses } from './censusApi';
import { useMapContext } from '../contexts/MapContext';

/**
 * Custom hook for managing map layers and ZIP boundary rendering
 * Handles ZIP layer loading, styling, click events, and territory visualization
 */
export const useMapLayers = () => {
  const {
    mapRef,
    allZips,
    territories,
    activeTerritoryId,
    addModeTerritoryId,
    addZipToActiveTerritory,
    boundaryMode,
    localTerritories,
    setLocalTerritories,
    loadingZips,
    setLoadingZips,
    zipLayerGroupRef,
    loadedZipLayers,
    territoryGroupsRef,
    currentLoadedStateAbbr,
    setCurrentLoadedStateAbbr,
    setUpdateZipForCenter,
    setLoadZipForStates,
  } = useMapContext();
  // Layer group refs
  const zipLayerGroupRef = useRef(L.layerGroup());
  const loadedZipLayers = useRef({});
  const territoryGroupsRef = useRef({});

  // State for current loaded state
  const [currentLoadedStateAbbr, setCurrentLoadedStateAbbr] = useState(null);

  // Refs for synced state
  const addModeRef = { current: addModeTerritoryId };
  const activeTerritoryIdRef = { current: activeTerritoryId };
  const localTerritoriesRef = { current: localTerritories };

  // Sync refs with context values
  useEffect(() => {
    addModeRef.current = addModeTerritoryId;
  }, [addModeTerritoryId]);

  useEffect(() => {
    activeTerritoryIdRef.current = activeTerritoryId;
  }, [activeTerritoryId]);

  useEffect(() => {
    localTerritoriesRef.current = localTerritories;
  }, [localTerritories]);

  // ZIP styling function
  const getZipStyle = useCallback((feature, isHovered = false) => {
    const baseStyle = {
      color: '#0066cc',
      weight: 1,
      opacity: 0.8,
      fillColor: '#0066cc',
      fillOpacity: 0.05,
    };
    const isSelected = localTerritoriesRef.current.some(t => t.zips.some(z => z.zip === feature.properties.ZCTA5CE20));
    if (isSelected) {
      return {
        ...baseStyle,
        fillOpacity: 0.4,
        fillColor: '#0066cc', // Consistent light blue highlight for all selected ZIPs
        color: '#0066cc',
        weight: 2,
      };
    }
    if (isHovered) {
      return {
        ...baseStyle,
        fillOpacity: 0.3,
        weight: 3,
        color: '#ffff00', // Yellow for hover
      };
    }
    return baseStyle;
  }, []);

  // Load ZIP boundaries for specific states
  const loadZipForStates = useCallback(async (stateAbbrs) => {
    if (!allZips || !mapRef.current) {
      setLoadingZips(false);
      return;
    }
    const map = mapRef.current;
    const bounds = map.getBounds();
    const boundsPolygon = L.polygon([
      [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
      [bounds.getNorthWest().lat, bounds.getNorthWest().lng],
      [bounds.getNorthEast().lat, bounds.getNorthEast().lng],
      [bounds.getSouthEast().lat, bounds.getSouthEast().lng],
    ]);
    let zipFeatures = allZips.features.filter(feature => {
      if (!feature.geometry) {
        return false;
      }
      // Check if ZIP is selected in any territory
      const isSelected = localTerritoriesRef.current.some(t => t.zips.some(z => z.zip === feature.properties.ZCTA5CE20));
      if (isSelected) return false; // Exclude selected ZIPs from base layer
      try {
        const intersects = turf.booleanIntersects(boundsPolygon.toGeoJSON(), feature);
        return intersects;
      } catch (error) {
        return false;
      }
    });
    if (zipFeatures.length === 0) {
      setLoadingZips(false);
      return;
    }
    zipLayerGroupRef.current.clearLayers();
    try {
      const geoJsonLayer = L.geoJSON(zipFeatures, {
        style: (feature) => getZipStyle(feature),
        onEachFeature: (feature, layer) => {
          layer.on('mouseover', () => {
            layer.setStyle(getZipStyle(feature, true));
          });
    layer.on('mouseout', () => {
      layer.setStyle(getZipStyle(feature));
    });
        layer.on('click', async () => {
        if (!addModeRef.current) {
      // Tooltip for info
      const zip = feature.properties.ZCTA5CE20;
      layer.bindTooltip(`ZIP: ${zip}<br>Loading data...`, { permanent: false }).openTooltip();
              try {
                const { population, standAloneHouses } = await fetchZipPopulationAndHouses(zip);
                layer.setTooltipContent(`ZIP: ${zip}<br>Population: ${population.toLocaleString()}<br>Homes: ${standAloneHouses.toLocaleString()}`);
              } catch (error) {
                layer.setTooltipContent(`ZIP: ${zip}<br>Data unavailable`);
              }
            return;
    }
        // Add or remove from territory (toggle)
    const zipCode = feature.properties.ZCTA5CE20;
    const territory = localTerritoriesRef.current.find(t => t.id === addModeRef.current);
    if (!territory) return;
    const alreadyAdded = territory.zips.some(z => z.zip === zipCode);
    try {
              const { population, standAloneHouses } = await fetchZipPopulationAndHouses(zipCode);
              if (alreadyAdded) {
        const newTerritories = localTerritoriesRef.current.map(t => t.id === addModeRef.current ? { ...t, zips: t.zips.filter(z => z.zip !== zipCode) } : t);
        setLocalTerritories(newTerritories);
        localTerritoriesRef.current = newTerritories;
        // Remove from territory layer group
        if (territoryGroupsRef.current[addModeRef.current]) {
          territoryGroupsRef.current[addModeRef.current].eachLayer(layer => {
            if (layer.feature && layer.feature.properties.ZCTA5CE20 === zipCode) {
              territoryGroupsRef.current[addModeRef.current].removeLayer(layer);
            }
          });
        }
      } else {
        const newTerritories = localTerritoriesRef.current.map(t => t.id === addModeRef.current ? { ...t, zips: [...t.zips, { zip: zipCode, pop: population, standAloneHouses }] } : t);
        setLocalTerritories(newTerritories);
        localTerritoriesRef.current = newTerritories;
                // Add to territory layer group
        if (!territoryGroupsRef.current[addModeRef.current]) {
          territoryGroupsRef.current[addModeRef.current] = L.layerGroup().addTo(mapRef.current);
        }
                const selectedStyle = {
                  color: '#0066cc', // Consistent light blue for all territories
                  weight: 1.5,
                  opacity: 0.8,
                  fillColor: '#0066cc',
                  fillOpacity: 0.3,
                };
                const selectedLayer = L.geoJSON(feature, { style: selectedStyle });
                territoryGroupsRef.current[addModeRef.current].addLayer(selectedLayer);
              }
              addZipToActiveTerritory(zipCode, population, standAloneHouses);
            } catch (error) {
              console.error('Failed to add ZIP:', error);
              return;
            }
          });
        }
      });
      geoJsonLayer.addTo(zipLayerGroupRef.current);
    } catch (error) {
      console.error('Error creating GeoJSON layer:', error);
    }
    setCurrentLoadedStateAbbr(stateAbbrs[0]);
    setLoadingZips(false);
  }, [allZips, mapRef, getZipStyle, setLocalTerritories, addZipToActiveTerritory, setLoadingZips]);

  // Set the functions in context so they can be used by other hooks
  useEffect(() => {
    setUpdateZipForCenter(() => updateZipForCenter);
    setLoadZipForStates(() => loadZipForStates);
  }, [updateZipForCenter, loadZipForStates, setUpdateZipForCenter, setLoadZipForStates]);

  // Update ZIP visibility based on map center and zoom
  const updateZipForCenter = useCallback(() => {
    if (!mapRef.current || !allZips) {
      return;
    }

    const map = mapRef.current;
    const zoom = map.getZoom();
    const showZips = boundaryMode === "zips" || boundaryMode === "both";

        if (!showZips || zoom < 8) {
      zipLayerGroupRef.current.clearLayers(); // Only clear base, territory groups persist
      loadedZipLayers.current = {};
      setCurrentLoadedStateAbbr(null);
      return;
    }

    // Clear old zip layers before adding new ones
    zipLayerGroupRef.current.clearLayers();
    loadedZipLayers.current = {};

    const center = map.getCenter();
    const centerPt = turf.point([center.lng, center.lat]);

    let selectedAbbr = null;
    let minDist = Infinity;

    // Find closest state to center (this logic was extracted from original)
    // This needs access to usStatesGeoJSON, so we'll need to pass it in
    // For now, implementing a basic version that will be enhanced later

    if (selectedAbbr) {
      setLoadingZips(true);
      loadZipForStates([selectedAbbr]).then(() => {
        setCurrentLoadedStateAbbr(selectedAbbr);
      });
    } else {
      setCurrentLoadedStateAbbr(null);
    }
  }, [mapRef, allZips, boundaryMode, loadZipForStates, setLoadingZips]);

  // Territory rendering effect
  useEffect(() => {
    if (!mapRef.current || !allZips) return;
    // Ensure all territory groups exist and are populated
    for (const territory of localTerritories) {
      if (!territoryGroupsRef.current[territory.id]) {
        territoryGroupsRef.current[territory.id] = L.layerGroup().addTo(mapRef.current);
      }
      // Clear and re-add all ZIPs for this territory
      territoryGroupsRef.current[territory.id].clearLayers();
      for (const zipObj of territory.zips) {
        const feature = allZips.features.find(f => f.properties.ZCTA5CE20 === zipObj.zip);
        if (feature) {
          const selectedStyle = {
            color: '#0066cc',
            weight: territory.id === activeTerritoryId ? 3 : 1.5,
            opacity: 0.8,
            fillColor: '#0066cc',
            fillOpacity: territory.id === activeTerritoryId ? 0.4 : 0.3,
          };
          const selectedLayer = L.geoJSON(feature, { style: selectedStyle });
          territoryGroupsRef.current[territory.id].addLayer(selectedLayer);
        }
      }
    }
    // Clear base ZIP layer to refresh unselected
    zipLayerGroupRef.current.clearLayers();
    updateZipForCenter();
  }, [localTerritories, allZips, activeTerritoryId, mapRef, updateZipForCenter]);

  return {};
};