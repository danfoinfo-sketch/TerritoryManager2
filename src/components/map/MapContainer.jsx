import React, { useEffect, useLayoutEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { MapContainer as LeafletMap, TileLayer, GeoJSON, Popup, Marker, useMap } from "react-leaflet";
import { Loader2 } from "lucide-react";
import L from "leaflet";
import * as turf from "@turf/turf";
import { fetchZipPopulationAndHouses } from "./censusApi";

const US_CENTER = [39.8283, -98.5795];
const US_ZOOM = 4;

function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const timer0 = setTimeout(() => map.invalidateSize(false), 0);
    map.invalidateSize(false);

    const timer1 = setTimeout(() => map.invalidateSize(false), 100);
    const timer2 = setTimeout(() => map.invalidateSize(false), 300);
    const timer3 = setTimeout(() => map.invalidateSize(false), 600);

    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => map.invalidateSize(false), 200);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer0); clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);
  return null;
}

function DataChangeInvalidator({ savedZones }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(timer);
  }, [savedZones, map]);
  return null;
}

export default forwardRef(function MapContainerComponent({
  territories = [],
  activeTerritoryId,
  addModeTerritoryId,
  addZipToActiveTerritory,
    boundaryMode = "zips",
}, ref) {
  const territoriesRef = useRef(territories);
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const wrapperRef = useRef(null);
    const zipLayerGroupRef = useRef(L.layerGroup());
  const loadedZipLayers = useRef({});
  const territoryGroupsRef = useRef({});
    const addModeRef = useRef(addModeTerritoryId);
  const activeTerritoryIdRef = useRef(activeTerritoryId);
  const zipDataCache = useRef({});
  const [loadingZips, setLoadingZips] = useState(false);
  const [popupInfo, setPopupInfo] = useState(null);
  const [currentLoadedStateAbbr, setCurrentLoadedStateAbbr] = useState(null);
  const moveTimeoutRef = useRef(null);
    const [usStatesGeoJSON, setUsStatesGeoJSON] = useState(null);
    const [allZips, setAllZips] = useState(null);
  const [localTerritories, setLocalTerritories] = useState(territories);
  const localTerritoriesRef = useRef(localTerritories);

    useEffect(() => {
    addModeRef.current = addModeTerritoryId;
    territoriesRef.current = territories;
    activeTerritoryIdRef.current = activeTerritoryId;
  }, [addModeTerritoryId, territories, activeTerritoryId]);

  useEffect(() => {
    setLocalTerritories(territories);
  }, [territories]);

    useEffect(() => {
    localTerritoriesRef.current = localTerritories;
  }, [localTerritories]);

        const zoomToTerritory = (territoryId) => {
    console.log('DEBUG: zoomToTerritory called for', territoryId);
    // Use the most current territories data
    const territory = territories.find(t => t.id === territoryId);
    console.log('DEBUG: territory found:', territory ? territory.name : 'not found');
    if (!territory || !allZips) {
      console.log('DEBUG: missing territory or allZips:', !!territory, !!allZips);
      return;
    }
    if (!mapRef.current) {
      console.log('DEBUG: mapRef not ready, retrying in 100ms');
      setTimeout(() => zoomToTerritory(territoryId), 100);
      return;
    }
    const zipFeatures = allZips.features.filter(f => territory.zips.some(z => z.zip === f.properties.ZCTA5CE20));
    console.log('DEBUG: zipFeatures length:', zipFeatures.length, 'territory zips:', territory.zips.map(z => z.zip));
    if (zipFeatures.length === 0) {
      console.log('DEBUG: no zipFeatures, cannot zoom');
      return;
    }
    const collection = turf.featureCollection(zipFeatures);
    const bbox = turf.bbox(collection);
    console.log('DEBUG: bbox:', bbox);
    mapRef.current.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [50, 50] });
    console.log('DEBUG: map fitBounds called');
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

  useImperativeHandle(ref, () => ({
    zoomToTerritory,
  }));

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
  }, []);

  // Debug logs
  useEffect(() => {
    console.log('Map container offsetHeight:', mapRef.current?.offsetHeight);
  }, []);

const getZipStyle = (feature, isHovered = false) => {
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
};

  const loadZipForStates = async (stateAbbrs) => {
  if (!allZips || !mapRef.current) {
    console.log('DEBUG: allZips or mapRef not ready');
    setLoadingZips(false);
    return;
  }
  const map = mapRef.current;
  const bounds = map.getBounds();
  console.log('DEBUG: Map bounds:', bounds);
  const boundsPolygon = L.polygon([
    [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
    [bounds.getNorthWest().lat, bounds.getNorthWest().lng],
    [bounds.getNorthEast().lat, bounds.getNorthEast().lng],
    [bounds.getSouthEast().lat, bounds.getSouthEast().lng],
  ]);
  console.log('DEBUG: Bounds polygon GeoJSON:', boundsPolygon.toGeoJSON());
        let zipFeatures = allZips.features.filter(feature => {
    if (!feature.geometry) {
      console.log('DEBUG: Skipping feature with null geometry:', feature.properties?.ZCTA5CE20);
      return false;
    }
    // Check if ZIP is selected in any territory
    const isSelected = localTerritoriesRef.current.some(t => t.zips.some(z => z.zip === feature.properties.ZCTA5CE20));
    if (isSelected) return false; // Exclude selected ZIPs from base layer
    try {
      const intersects = turf.booleanIntersects(boundsPolygon.toGeoJSON(), feature);
      return intersects;
    } catch (error) {
      console.log('DEBUG: Error checking intersection for feature:', feature.properties?.ZCTA5CE20, error);
      return false;
    }
  });
  console.log('DEBUG: ZIP features after bounds filter:', zipFeatures.length);
  if (zipFeatures.length === 0) {
    console.log('DEBUG: No ZIP features to render');
    setLoadingZips(false);
    return;
  }
  zipLayerGroupRef.current.clearLayers();
  console.log('DEBUG: Clearing old layers');
  try {
    const geoJsonLayer = L.geoJSON(zipFeatures, {
  style: (feature) => getZipStyle(feature),
    onEachFeature: (feature, layer) => {
  layer.on('mouseover', () => {
    layer.setStyle(getZipStyle(feature, true));
  });
    layer.on('mouseout', () => {
    layer.setStyle(getZipStyle(feature));
    const zipCode = feature.properties.ZCTA5CE20;
    const isSelected = localTerritoriesRef.current.some(t => t.zips.some(z => z.zip === zipCode));
    console.log('Mouseout ZIP:', zipCode, 'isSelected:', isSelected);
  });
        layer.on('click', async () => {
    console.log('ZIP clicked:', feature.properties.ZCTA5CE20, 'addModeTerritoryId:', addModeRef.current);
        if (!addModeRef.current) {
      console.log('Not in add mode, showing tooltip');
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
        console.log('In add mode, processing toggle');
    console.log('addModeRef.current:', addModeRef.current);
    console.log('localTerritoriesRef.current:', localTerritoriesRef.current.map(t => ({ id: t.id, name: t.name })));
        // Add or remove from territory (toggle)
    const zipCode = feature.properties.ZCTA5CE20;
    const territory = localTerritoriesRef.current.find(t => t.id === addModeRef.current);
    console.log('Territory found:', territory ? territory.name : 'NOT FOUND');
    console.log('Territory found:', territory ? territory.name : null);
    if (!territory) return;
    const alreadyAdded = territory.zips.some(z => z.zip === zipCode);
    console.log('Already added:', alreadyAdded);
    try {
      const { population, standAloneHouses } = await fetchZipPopulationAndHouses(zipCode);
                  if (alreadyAdded) {
        console.log('Removing ZIP:', zipCode, 'Territory ZIPs now:', territory.zips.filter(z => z.zip !== zipCode).map(z => z.zip));
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
        console.log('Adding ZIP:', zipCode, 'Territory ZIPs now:', [...territory.zips.map(z => z.zip), zipCode]);
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
      console.log('Calling addZipToActiveTerritory with', zipCode, population, standAloneHouses);
      addZipToActiveTerritory(zipCode, population, standAloneHouses);
    } catch (error) {
      console.error('Failed to add ZIP:', error);
      return;
    }
  });
}
})
        geoJsonLayer.addTo(zipLayerGroupRef.current);
    console.log('DEBUG: GeoJSON layer added to group');
    console.log('DEBUG: Layer group layers count:', zipLayerGroupRef.current.getLayers().length);
    console.log('DEBUG: Map has layer group:', map.hasLayer(zipLayerGroupRef.current));
        
  } catch (error) {
    console.error('DEBUG: Error creating GeoJSON layer:', error);
  }
  setCurrentLoadedStateAbbr(stateAbbrs[0]);
  setLoadingZips(false);
  console.log('DEBUG: Finished loading ZIPs');
};

  const updateZipForCenter = () => {
    console.log('[ZIP LOAD] updateZipForCenter runs');
    if (!mapRef.current || !allZips) {
      console.log('[ZIP LOAD] No mapRef or allZips, returning');
      return;
    }

    const map = mapRef.current;
    const zoom = map.getZoom();
    const showZips = boundaryMode === "zips" || boundaryMode === "both";
    console.log(`[ZIP LOAD] Zoom: ${zoom}, showZips: ${showZips}, boundaryMode: ${boundaryMode}`);

        if (!showZips || zoom < 8) {
      console.log('[ZIP LOAD] Clearing zip layers: showZips false or zoom < 8');
      zipLayerGroupRef.current.clearLayers(); // Only clear base, territory groups persist
      loadedZipLayers.current = {};
      setCurrentLoadedStateAbbr(null);
      return;
    }

    // Clear old zip layers before adding new ones
    console.log('[ZIP LOAD] Clearing old zip layers');
    zipLayerGroupRef.current.clearLayers();
    loadedZipLayers.current = {};

    const center = map.getCenter();
    const centerPt = turf.point([center.lng, center.lat]);
    console.log('[ZIP LOAD] Center:', center, 'centerPt:', centerPt);

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

    console.log(`[ZIP LOAD] Selected state abbr: ${selectedAbbr}, minDist: ${minDist}`);

    if (selectedAbbr) {
      console.log(`[ZIP LOAD] Loading zips for state: ${selectedAbbr}`);
      setLoadingZips(true);
      loadZipForStates([selectedAbbr]).then(() => {
        console.log(`[ZIP LOAD] Finished loading zips for: ${selectedAbbr}`);
        setCurrentLoadedStateAbbr(selectedAbbr);
      });
    } else {
      console.log('[ZIP LOAD] No state selected, clearing abbr');
      setCurrentLoadedStateAbbr(null);
    }
  };

          useEffect(() => {
    if (!wrapperRef.current) return;
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    });
    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, [map]);

    useLayoutEffect(() => {
    if (mapRef.current) {
      console.log('mapRef.current exists?', !!mapRef.current);
      mapRef.current.invalidateSize();
      mapRef.current.addLayer(zipLayerGroupRef.current);
    }
  }, [mapRef.current]);

  useEffect(() => {
    if (!mapRef.current) return;
    console.log(`[BOUNDARY MODE] useEffect triggered, boundaryMode: ${boundaryMode}`);
    const showZips = boundaryMode === "zips" || boundaryMode === "both";
    if (!showZips) {
      console.log('[BOUNDARY MODE] clearing zip layers');
      zipLayerGroupRef.current.clearLayers();
      loadedZipLayers.current = {};
      setCurrentLoadedStateAbbr(null);
      console.log(`[VISIBILITY] Map has zip layer after clearing: ${mapRef.current ? mapRef.current.hasLayer(zipLayerGroupRef.current) : false}`);
      return;
    }

    updateZipForCenter();
    console.log(`[VISIBILITY] Map has zip layer after loading: ${mapRef.current ? mapRef.current.hasLayer(zipLayerGroupRef.current) : false}`);
  }, [mapRef.current, allZips, boundaryMode]);

      useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const showZips = boundaryMode === "zips" || boundaryMode === "both";
    console.log(`[MAP EVENT] moveend useEffect, showZips: ${showZips}`);
    if (!showZips) return;

    const handleMoveEnd = () => {
      console.log('[MAP EVENT] handleMoveEnd called');
      console.log('[MAP EVENT] Map moved/zoomed, triggering zip reload');
      clearTimeout(moveTimeoutRef.current);
      moveTimeoutRef.current = setTimeout(updateZipForCenter, 500);
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
      clearTimeout(moveTimeoutRef.current);
    };
    }, [mapRef.current, boundaryMode, currentLoadedStateAbbr, allZips]);

          

                                                        useEffect(() => {
console.log('Territories changed, updating territory groups');
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
}, [localTerritories, allZips, activeTerritoryId]);

    useEffect(() => {
    if (mapRef.current) {
      console.log('mapRef.current exists?', !!mapRef.current);
      mapRef.current.invalidateSize();
      mapRef.current.addLayer(zipLayerGroupRef.current);
    }
  }, [map]);

      const mapCreated = (map) => {
    mapRef.current = map;
    setMap(map);
    console.log('Map container height on init:', mapRef.current?.getSize().y);
    console.log('Wrapper ref height:', wrapperRef.current?.offsetHeight);
    map.invalidateSize(); // Force redraw after creation
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 300);
    const handleResize = () => map.invalidateSize();
        window.addEventListener('resize', handleResize);
  };

  // ... (rest of the functions: getZipStyle, loadZipForStates, etc.)

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

        

        {loadingZips && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(255,255,255,0.9)",
              padding: "16px 24px",
              borderRadius: "8px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Loading ZIP boundaries...</span>
          </div>
        )}
      </LeafletMap>
    </div>
  );
});