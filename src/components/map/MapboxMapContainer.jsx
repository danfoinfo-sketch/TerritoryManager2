/**
 * MAPBOX VECTOR TILES SETUP INSTRUCTIONS:
 *
 * 1. Check browser console after page loads
 * 2. Look for "🎯 DEBUG: ZIP tileset loaded successfully!"
 * 3. Find the correct layer name in "📋 Available source layers"
 * 4. Update VECTOR_SOURCE_LAYER constant below
 * 5. Check ZIP property in "🏷️ ZIP property value"
 * 6. Update ZIP_PROPERTY constant below
 * 7. Uncomment the layer creation code in onMapLoad()
 * 8. Layers show ZIPs between zoom 8-14 for clean UX (no flickering)
 * 9. Restart the dev server
 */

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
import { Loader2 } from "lucide-react";
import * as turf from "@turf/turf";
import { fetchZipPopulationAndHouses, apiCache } from "./censusApi";
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'your-mapbox-token-here';
const hasValidToken = MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN !== 'your-mapbox-token-here' && MAPBOX_ACCESS_TOKEN.length > 10;
console.log('🗺️ Mapbox access token configured:', hasValidToken ? 'YES' : 'NO/MISSING');
console.log('🗺️ Token length:', MAPBOX_ACCESS_TOKEN.length, 'starts with pk.:', MAPBOX_ACCESS_TOKEN.startsWith('pk.'));
console.log('🗺️ Token preview:', MAPBOX_ACCESS_TOKEN.substring(0, 10) + '...' + MAPBOX_ACCESS_TOKEN.substring(MAPBOX_ACCESS_TOKEN.length - 5));

if (!hasValidToken) {
  console.error('🗺️ INVALID MAPBOX TOKEN - Map will not load');
}
const US_CENTER = [-98.5795, 39.8283];
const US_ZOOM = 4;

export default forwardRef(function MapboxMapContainer({
  territories = [],
  activeTerritoryId,
  setActiveTerritoryId,
  addModeTerritoryId,
  addZipToActiveTerritory,
  showBoundaries = true,
}, ref) {
  const mapRef = useRef(null);
  const [loadingZips, setLoadingZips] = useState(false);
  const [popupInfo, setPopupInfo] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [territoryTooltip, setTerritoryTooltip] = useState(null); // For hover tooltips
  const [selectedTerritoryPopup, setSelectedTerritoryPopup] = useState(null); // For selected territory persistent tooltip

  // Track ZIPs currently being processed to prevent duplicate clicks
  const processingZipsRef = useRef(new Set());
  // Prevent rapid clicking during ZIP processing
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const [selectedZips, setSelectedZips] = useState([]); // Array of selected ZIP codes for filtering
  const [hoveredZip, setHoveredZip] = useState(null);
  const [tooltipZip, setTooltipZip] = useState(null);
  const localAddModeTerritoryIdRef = useRef(null); // Use ref for immediate access in click handler


  // Sync local addModeTerritoryId ref with prop
  useEffect(() => {
    console.log('🗺️ MapContainer addModeTerritoryId prop changed to:', addModeTerritoryId, '- updating ref');
    localAddModeTerritoryIdRef.current = addModeTerritoryId;
    console.log('🗺️ Ref updated to:', addModeTerritoryId);
  }, [addModeTerritoryId]);

  // ZIP limit tracking removed - using clean zoom-based visibility
  const [viewport, setViewport] = useState({
    longitude: US_CENTER[0],
    latitude: US_CENTER[1],
    zoom: US_ZOOM,
  });

// Constants for vector tiles - UPDATED BASED ON YOUR TILESET INSPECTION
const VECTOR_SOURCE_ID = 'zip-codes-vector';
const VECTOR_SOURCE_URL = 'mapbox://thatdanman.1iwrf9m2';
// ✅ CORRECTED: Based on console output
const VECTOR_SOURCE_LAYER = 'tl_2025_us_zcta520_10percent-7qszeg';
// ✅ CORRECTED: Based on console output (ZCTA5CE20)
const ZIP_PROPERTY = 'ZCTA5CE20';

  // Memoize the calculation of all selected ZIPs
  const allSelectedZips = useMemo(() => {
    const zips = [];
    territories.forEach(territory => {
      territory.zips.forEach(zipObj => {
        if (!zips.includes(zipObj.zip)) {
          zips.push(zipObj.zip);
        }
      });
    });
    return zips;
  }, [territories]);

  // Update selected ZIPs and highlighting when territories, active territory, or add mode changes
  useEffect(() => {
    console.log('🗺️ Territories/active/addMode changed - territories:', territories.length, 'active:', activeTerritoryId, 'addMode:', !!addModeTerritoryId, 'allSelectedZips:', allSelectedZips);

    // Find the territory to highlight
    let territoryToHighlight = null;

    if (addModeTerritoryId) {
      // In add mode - highlight the territory being edited
      territoryToHighlight = territories.find(t => t.id === addModeTerritoryId);
      console.log('🗺️ In add mode - highlighting territory being edited:', territoryToHighlight?.name);
    } else if (activeTerritoryId) {
      // Not in add mode but have active territory - highlight the selected territory
      territoryToHighlight = territories.find(t => t.id === activeTerritoryId);
      console.log('🗺️ Active territory selected - highlighting:', territoryToHighlight?.name);
    }

    if (!territoryToHighlight) {
      console.log('🗺️ No territory to highlight');
      return;
    }

    // Get ZIP codes from the territory
    const territoryZips = territoryToHighlight.zips.map(z => z.zip);

    // Comprehensive type safety check for ZIP properties
    if (territoryZips.length > 0) {
      console.log('ZIP property validation - First selected ZIP:', typeof territoryZips[0], territoryZips[0]);
      console.log('All selected ZIPs types:', territoryZips.map(zip => typeof zip));
      console.log('All selected ZIPs values:', territoryZips);

      // Ensure all ZIPs are strings (coerce if necessary)
      const normalizedZips = territoryZips.map(String);
      if (normalizedZips.length !== territoryZips.length ||
          !normalizedZips.every((zip, i) => zip === territoryZips[i])) {
        console.warn('🗺️ ZIP type coercion applied - was:', territoryZips, 'now:', normalizedZips);
      }
    }

    setSelectedZips(prevSelected => {
      // Only update if the arrays are actually different
      if (prevSelected.length === territoryZips.length &&
          prevSelected.every(zip => territoryZips.includes(zip))) {
        console.log('🗺️ selectedZips unchanged, skipping update');
        return prevSelected;
      }
      console.log('🗺️ Updating selectedZips to:', territoryZips);
      return territoryZips;
    });

    // Update map layers efficiently - batch operations and reduce repaints
    if (mapRef.current) {
      const map = mapRef.current.getMap();
      const normalizedZips = allSelectedZips.map(String);

      // Batch filter updates to reduce repaints
      const layersToUpdate = [
        { id: 'zip-highlight', filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', normalizedZips]] },
        { id: 'zip-border', filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', normalizedZips]] },
        { id: 'territory-mask', filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', normalizedZips]] },
        { id: 'territory-perimeter', filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', normalizedZips]] }
      ];

      layersToUpdate.forEach(({ id, filter }) => {
        if (map.getLayer(id)) {
          map.setFilter(id, filter);
        }
      });

      // Update outline layer visibility (optimized)
      if (map.getLayer('zip-outlines-new')) {
        if (normalizedZips.length > 0) {
          // Hide outlines for selected ZIPs using opacity
          map.setPaintProperty('zip-outlines-new', 'line-opacity', [
            'case',
            ['in', ['get', 'ZCTA5CE20'], ['literal', normalizedZips]],
            0.0, // Invisible for selected
            0.8  // Visible for others
          ]);
        } else {
          // Show all outlines when no ZIPs selected
          map.setPaintProperty('zip-outlines-new', 'line-opacity', 0.8);
        }
      }

      // Single repaint at the end
      map.triggerRepaint();
      console.log('🗺️ Updated all territory layers for', normalizedZips.length, 'ZIPs');
    }
  }, [territories, addModeTerritoryId, activeTerritoryId]);

  // ZIP limit checking removed - using zoom-based visibility instead for cleaner UX

  // Initialize map and setup vector tiles
  const onMapLoad = useCallback(() => {
    console.log('🗺️ onMapLoad called, mapRef exists:', !!mapRef.current);
    if (!mapRef.current) {
      console.error('🗺️ mapRef is null in onMapLoad');
      return;
    }

    const map = mapRef.current.getMap();
    console.log('🗺️ Map instance obtained:', !!map);

    // Force resize to ensure proper dimensions
    setTimeout(() => {
      console.log('🗺️ Forcing map resize');
      map.resize();
      map.triggerRepaint();
      console.log('🗺️ Map resized and repainted');
    }, 100);

    // Function to hide default Mapbox boundary layers (but keep state boundaries)
    const hideDefaultBoundaries = () => {
      // Get all layers and hide ALL boundary/border layers aggressively
      const allLayers = map.getStyle().layers;

      console.log('🗺️ hideDefaultBoundaries called, checking all layers... Total layers:', allLayers.length);

      // First, log ALL layers to see what's available
      allLayers.forEach(layer => {
        console.log('🗺️ ALL Layer:', layer.id, 'type:', layer.type, 'source:', layer.source);
      });

      // Find potential state boundary layers
      const stateBoundaryLayers = allLayers.filter(layer =>
        layer.id.includes('admin') ||
        layer.id.includes('state') ||
        layer.id.includes('boundary')
      );
      console.log('🗺️ Potential state boundary layers:', stateBoundaryLayers.map(l => ({ id: l.id, type: l.type, source: l.source })));

      // Specifically log admin layers
      const adminLayers = allLayers.filter(layer => layer.id.includes('admin'));
      console.log('🗺️ Admin layers found:', adminLayers.map(l => ({ id: l.id, type: l.type })));

      allLayers.forEach(layer => {
        console.log('🗺️ Processing layer:', layer.id, 'type:', layer.type);

        // Hide specific boundary/border layers EXCEPT our custom ones and state boundaries
        const shouldHide = (
          layer.id.includes('boundary') ||
          layer.id.includes('border') ||
          layer.id.includes('admin-1-boundary') ||
          layer.id.includes('admin-1-boundary-bg')
        ) &&
        !layer.id.includes('admin') &&    // Keep ALL admin layers (state/country boundaries)
        !layer.id.includes('state') &&    // Keep state-related layers
        layer.id !== 'zip-fills-new' &&
        layer.id !== 'zip-outlines-new' &&
        layer.id !== 'zip-highlight' &&
        layer.id !== 'zip-border' &&
        layer.id !== 'territory-perimeter';

        if (shouldHide && map.getLayer(layer.id)) {
          console.log('🗺️ HIDING layer:', layer.id, '(type:', layer.type, ')');
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        } else if (layer.id.includes('admin') || layer.id.includes('state')) {
          console.log('🗺️ KEEPING boundary layer:', layer.id, '(type:', layer.type, ')');
          // Explicitly set to visible in case it was hidden
          map.setLayoutProperty(layer.id, 'visibility', 'visible');
        }
      });

      // Final pass: ensure state boundaries are visible
      console.log('🗺️ Final pass: ensuring state boundaries are visible');
      allLayers.forEach(layer => {
        if ((layer.id.includes('admin') || layer.id.includes('state')) && map.getLayer(layer.id)) {
          map.setLayoutProperty(layer.id, 'visibility', 'visible');
          console.log('🗺️ FINAL: Set visibility=visible for:', layer.id);
        }
      });
    };

    // Function to add ZIP sources and layers (called on initial load and style changes)
    const addZipLayers = () => {
      console.log('🗺️ addZipLayers called, current zoom:', map.getZoom());

      // First, hide any default boundary layers
      hideDefaultBoundaries();

      // Debug: Check for existing boundary layers
      const allLayers = map.getStyle().layers;
      const boundaryLayers = allLayers.filter(layer =>
          layer.id.includes('boundary') ||
          layer.id.includes('admin') ||
          layer.id.includes('zip') ||
          layer.id.includes('zcta') ||
          layer.id.includes('state') ||
          layer.id === 'zip-border' ||
          layer.id === 'territory-perimeter'
      );
      if (boundaryLayers.length > 0) {
        console.log('🗺️ Found boundary/state layers:', boundaryLayers.map(l => ({
          id: l.id,
          type: l.type,
          visible: l.layout?.visibility !== 'none',
          minzoom: l.minzoom,
          maxzoom: l.maxzoom
        })));
      }

      // Remove any existing ZIP sources/layers first
      if (map.getSource(VECTOR_SOURCE_ID)) {
        console.log('🗺️ Removing existing ZIP source');
        map.removeSource(VECTOR_SOURCE_ID);
      }
      if (map.getLayer('zip-fills-new')) {
        console.log('🗺️ Removing existing zip-fills-new layer');
        map.removeLayer('zip-fills-new');
      }
      if (map.getLayer('zip-outlines-new')) {
        console.log('🗺️ Removing existing zip-outlines-new layer');
        map.removeLayer('zip-outlines-new');
      }
      if (map.getLayer('zip-highlight')) {
        console.log('🗺️ Removing existing zip-highlight layer');
        map.removeLayer('zip-highlight');
      }
      if (map.getLayer('zip-border')) {
        console.log('🗺️ Removing existing zip-border layer');
        map.removeLayer('zip-border');
      }
      if (map.getLayer('territory-perimeter')) {
        console.log('🗺️ Removing existing territory-perimeter layer');
        map.removeLayer('territory-perimeter');
      }

      // Add vector source for ZIP codes
    map.addSource(VECTOR_SOURCE_ID, {
      type: 'vector',
      url: VECTOR_SOURCE_URL
    });

    // DEBUG: Inspect tileset layers (run once only)
    let tilesetInspected = false;
    map.on('sourcedata', (e) => {
      if (e.sourceId === VECTOR_SOURCE_ID && e.isSourceLoaded && !tilesetInspected) {
        tilesetInspected = true; // Prevent repeated logging
        console.log('🎯 DEBUG: ZIP tileset loaded successfully!');
        const source = map.getSource(VECTOR_SOURCE_ID);
        if (source && source.vectorLayerIds) {
          console.log('📋 Available source layers:', source.vectorLayerIds);
        }

        // Only log feature inspection once, not on every map interaction
        setTimeout(() => {
          try {
            // Inspect fill features
            const fillFeatures = map.queryRenderedFeatures({
              layers: ['zip-fills-new']
            });
            if (fillFeatures && fillFeatures.length > 0) {
              console.log('🎨 Fill features found!');
              console.log('🏷️ ZIP property on fills:', fillFeatures[0].properties.ZCTA5CE20);
              console.log('🏷️ All properties on fills:', Object.keys(fillFeatures[0].properties));
            }

            // Inspect what source layers are actually available
            const source = map.getSource(VECTOR_SOURCE_ID);
            if (source && source.vectorLayerIds) {
              console.log('📋 All available source layers:', source.vectorLayerIds);
            }

            // Try to query the source directly for boundary features
            try {
              const boundaryFeatures = map.querySourceFeatures(VECTOR_SOURCE_ID, {
                sourceLayer: VECTOR_SOURCE_LAYER,
                filter: ['has', 'ZCTA5CE20'] // Only features with ZIP property
              });
              if (boundaryFeatures && boundaryFeatures.length > 0) {
                console.log('🔍 Boundary features with ZIP property found:', boundaryFeatures.length);
                console.log('🔍 First boundary feature properties:', boundaryFeatures[0].properties);
              } else {
                console.log('🔍 No boundary features with ZIP property found');
              }
            } catch (e) {
              console.log('🔍 Error querying source features:', e);
            }

          } catch (e) {
            console.log('🎨 Error inspecting features:', e);
          }
        }, 3000);
      }
    });

      // Add fill layer for ZIP polygons (only visible when zoomed in)
      map.addLayer({
        id: 'zip-fills-new',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': VECTOR_SOURCE_LAYER,
        minzoom: 8, // Only show fills when zoomed in enough
        paint: {
          'fill-color': '#888', // Default gray - highlights handled by separate layer
          'fill-opacity': 0.3 // Default opacity
        }
      });

      // Add highlight layer for selected ZIPs
      map.addLayer({
        id: 'zip-highlight',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': VECTOR_SOURCE_LAYER,
        filter: ['in', ['get', ZIP_PROPERTY], ['literal', selectedZips]], // Restore current selections
        paint: {
          'fill-color': '#00ff00', // Translucent green
          'fill-opacity': 0.5 // Semi-transparent
        }
      }, 'zip-fills-new');

      // Add territory mask fill layer RIGHT AFTER zip-highlight (covers any remaining internal lines)
      console.log('🗺️ Adding territory-mask layer right after zip-highlight');
      map.addLayer({
        id: 'territory-mask',
        type: 'fill',
        source: VECTOR_SOURCE_ID,
        'source-layer': VECTOR_SOURCE_LAYER,
        filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', selectedZips.map(String)]], // Only territory ZIPs (type-safe)
        paint: {
          'fill-color': '#00ff00', // Matches highlight color
          'fill-opacity': 0.65 // Strong enough to cover lines, still translucent
        }
      }, 'zip-highlight');

      // Add dark border around selected ZIPs
      map.addLayer({
        id: 'zip-border',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': VECTOR_SOURCE_LAYER,
        filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', selectedZips.map(String)]],
        paint: {
          'line-color': '#000000', // Black border
          'line-width': 2, // 2px width
          'line-opacity': 0.8 // Slightly transparent
        }
      }, 'territory-mask');

      // Add outline layer for ZIP boundaries (COMPLETELY EXCLUDE SELECTED ZIPS)
      console.log('🗺️ Adding zip-outlines-new layer (excluded for selected ZIPs)');
      map.addLayer({
        id: 'zip-outlines-new',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': VECTOR_SOURCE_LAYER,
        filter: ['!', ['in', ['get', 'ZCTA5CE20'], ['literal', selectedZips]]], // EXCLUDE selected ZIPs entirely
        minzoom: 8,
        paint: {
          'line-color': '#666',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            8, 0.2,
            12, 0.6
          ],
          'line-opacity': 0.8 // Visible for non-selected ZIPs only
        }
      }, 'zip-highlight');

      // Debug: Log initial filter state and inspect line features
      setTimeout(() => {
        console.log('Initial line layer filter:', map.getFilter('zip-outlines-new'));
        console.log('Initial line layer opacity:', map.getPaintProperty('zip-outlines-new', 'line-opacity'));

        // Inspect what properties are available on line features
        const lineFeatures = map.queryRenderedFeatures({
          layers: ['zip-outlines-new']
        });
        if (lineFeatures && lineFeatures.length > 0) {
          console.log('🔍 ZIP boundary line feature properties:', lineFeatures[0].properties);
          console.log('🔍 Available properties on boundary lines:', Object.keys(lineFeatures[0].properties));
          console.log('🔍 First 5 boundary line features:', lineFeatures.slice(0, 5).map(f => f.properties));
        } else {
          console.log('🔍 No boundary line features found to inspect');
        }
      }, 2000);
      console.log('🗺️ zip-outlines-new layer added as completely invisible, current zoom:', map.getZoom());

      // Add clean outer perimeter border (ONLY outer edge, no internal ZIP lines)
      map.addLayer({
        id: 'territory-perimeter',
        type: 'line',
        source: VECTOR_SOURCE_ID,
        'source-layer': VECTOR_SOURCE_LAYER,
        filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', selectedZips.map(String)]], // Only territory ZIPs
        paint: {
          'line-color': '#000000', // Black outer border
          'line-width': 4, // Slightly thicker 4px width for outer perimeter
          'line-opacity': 1.0 // Fully opaque
        },
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        }
      }, 'territory-mask'); // Add after territory-mask

      console.log('🗺️ Added territory-perimeter layer for clean outer border only');

      console.log('✅ ZIP layers re-added, selectedZips restored:', selectedZips);
    };

    // Hide default boundaries and add ZIP layers on initial load
    hideDefaultBoundaries();
    addZipLayers();

    // Re-add ZIP layers whenever the style changes (map.setStyle() resets sources/layers)
    map.on('style.load', () => {
      console.log('🎨 Map style changed, hiding boundaries and re-adding ZIP layers...');
      hideDefaultBoundaries();
      addZipLayers();

      // Re-setup event handlers after style change
    map.on('click', 'zip-fills-new', handleZipClick);

      // Re-setup hover handlers after style change
      map.on('mousemove', 'zip-highlight', (e) => {
        const features = e.features;
        if (features && features.length > 0) {
          const zipCode = features[0].properties[ZIP_PROPERTY];
          const territory = findTerritoryByZip(zipCode);

          if (territory) {
            const stats = calculateTerritoryStats(territory);
            setTerritoryTooltip({
              territory,
              stats,
              lngLat: e.lngLat
            });
            console.log('Showing tooltip for territory', territory.name, '- hover (style reload)');
          }
        }
      });

      map.on('mouseleave', 'zip-highlight', () => {
        setTerritoryTooltip(null);
      });

      map.on('click', (e) => {
        const clickedFeatures = map.queryRenderedFeatures(e.point, { layers: ['zip-fills-new'] });
        // Get current addModeTerritoryId from the latest props
        const currentAddModeId = localAddModeTerritoryIdRef.current;
        console.log('Map click - features:', clickedFeatures?.length || 0, 'addModeTerritoryId prop:', addModeTerritoryId, 'ref:', currentAddModeId, 'shiftKey:', e.originalEvent.shiftKey);
        if ((!clickedFeatures || clickedFeatures.length === 0) && !currentAddModeId && !e.originalEvent.shiftKey) {
          console.log('Background click - clearing all ZIP selections and active territory');
          setSelectedZips([]);
          // Also clear the active territory selection
          setActiveTerritoryId(null);
        if (map.getLayer('zip-highlight')) {
          map.setFilter('zip-highlight', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
        }
        if (map.getLayer('zip-border')) {
          map.setFilter('zip-border', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
        }
        if (map.getLayer('territory-mask')) {
          map.setFilter('territory-mask', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
        }
        if (map.getLayer('territory-perimeter')) {
          map.setFilter('territory-perimeter', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
          map.triggerRepaint();
        }
        // Update zip-outlines-new filter (clear all selections - show all lines)
        if (map.getLayer('zip-outlines-new')) {
          map.setFilter('zip-outlines-new', null); // Remove filter to show all lines
          map.setPaintProperty('zip-outlines-new', 'line-opacity', 0.8); // Restore normal opacity
          map.setLayoutProperty('zip-outlines-new', 'visibility', 'visible'); // Restore visibility

          console.log('Line layer filter/opacity applied — selected ZIPs excluded:', []);
          map.triggerRepaint();

          // Debug: Verify the update
          setTimeout(() => {
            try {
              console.log('Cleared line layer filter:', map.getFilter('zip-outlines-new'));
              console.log('Cleared line layer opacity:', map.getPaintProperty('zip-outlines-new', 'line-opacity'));
              console.log('Restored line layer visibility:', map.getLayoutProperty('zip-outlines-new', 'visibility'));
            } catch (error) {
              console.log('Debug check failed:', error.message);
            }
          }, 100);
        }

        // Force repaint for all territory layers
        console.log('Mask & outline updates applied - cleared all selections');
        map.triggerRepaint();
        if (map.getLayer('zip-border')) {
          map.setFilter('zip-border', ['in', ['get', ZIP_PROPERTY], ['literal', []]]);
          map.triggerRepaint();
        }
          setPopupInfo(null);
        }
      });
      map.on('zoomend', () => {
        const zoom = map.getZoom();
        console.log('Zoom changed to:', zoom, '- ZIP layers visible?', zoom >= 8 && zoom <= 16);
      });
    });

    // Setup click handlers for initial load
    map.on('click', 'zip-fills-new', handleZipClick);

    // Setup hover handlers for territory tooltips
    map.on('mousemove', 'zip-highlight', (e) => {
      const features = e.features;
      if (features && features.length > 0) {
        const zipCode = features[0].properties[ZIP_PROPERTY];
        const territory = findTerritoryByZip(zipCode);

        if (territory) {
          const stats = calculateTerritoryStats(territory);
          setTerritoryTooltip({
            territory,
            stats,
            lngLat: e.lngLat
          });
          console.log('Showing tooltip for territory', territory.name, '- hover');
        }
      }
    });

    map.on('mouseleave', 'zip-highlight', () => {
      setTerritoryTooltip(null);
    });

    // Clear selections when clicking elsewhere on map
    map.on('click', (e) => {
      const clickedFeatures = map.queryRenderedFeatures(e.point, { layers: ['zip-fills-new'] });
      // Get current addModeTerritoryId from the latest props
      const currentAddModeId = localAddModeTerritoryIdRef.current;
      console.log('Map click (style.load) - features:', clickedFeatures?.length || 0, 'addModeTerritoryId prop:', addModeTerritoryId, 'ref:', currentAddModeId, 'shiftKey:', e.originalEvent.shiftKey);
      if ((!clickedFeatures || clickedFeatures.length === 0) && !currentAddModeId && !e.originalEvent.shiftKey) {
        console.log('Background click - clearing all ZIP selections and active territory');
        setSelectedZips([]);
        // Also clear the active territory selection
        setActiveTerritoryId(null);
        map.setFilter('zip-highlight', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
        if (map.getLayer('zip-border')) {
          map.setFilter('zip-border', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
        }
        if (map.getLayer('territory-mask')) {
          map.setFilter('territory-mask', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
        }
        if (map.getLayer('territory-perimeter')) {
          map.setFilter('territory-perimeter', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
        }
        if (map.getLayer('territory-mask')) {
          map.setFilter('territory-mask', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
        }
        // Update zip-outlines-new filter (clear all selections - show all lines)
        if (map.getLayer('zip-outlines-new')) {
          map.setFilter('zip-outlines-new', null); // Remove filter to show all lines
          map.setPaintProperty('zip-outlines-new', 'line-opacity', 0.8); // Restore normal opacity
          map.setLayoutProperty('zip-outlines-new', 'visibility', 'visible'); // Restore visibility

          console.log('Line layer filter/opacity applied — selected ZIPs excluded:', []);
          map.triggerRepaint();

          // Debug: Verify the update
          setTimeout(() => {
            try {
              console.log('Cleared line layer filter:', map.getFilter('zip-outlines-new'));
              console.log('Cleared line layer opacity:', map.getPaintProperty('zip-outlines-new', 'line-opacity'));
              console.log('Restored line layer visibility:', map.getLayoutProperty('zip-outlines-new', 'visibility'));
            } catch (error) {
              console.log('Debug check failed:', error.message);
            }
          }, 100);
        }

        // Force repaint for all territory layers
        console.log('Mask & outline updates applied - cleared all selections');
        map.triggerRepaint();
        setPopupInfo(null);
      }
    });

    // Add zoom change listener
    map.on('zoomend', () => {
      const zoom = map.getZoom();
      console.log('Zoom changed to:', zoom, '- ZIP layers visible?', zoom >= 8 && zoom <= 16);
    });

    console.log('🎉 Mapbox vector tiles initialized! Layers should now be visible.');
  }, [selectedZips]);

  // Control boundary visibility based on showBoundaries prop
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();

    const visibility = showBoundaries ? 'visible' : 'none';
    console.log(`🗺️ Setting boundary visibility to: ${visibility}`);

    // Hide/show ZIP fill polygons
    if (map.getLayer('zip-fills-new')) {
      map.setLayoutProperty('zip-fills-new', 'visibility', visibility);
    }

    // Hide/show ZIP boundary lines
    if (map.getLayer('zip-outlines-new')) {
      map.setLayoutProperty('zip-outlines-new', 'visibility', visibility);
    }
  }, [showBoundaries]);

  // Helper function to find territory containing a ZIP
  const findTerritoryByZip = useCallback((zipCode) => {
    return territories.find(territory =>
      territory.zips.some(zipObj => zipObj.zip === zipCode)
    );
  }, [territories]);

  // Helper function to calculate territory stats
  const calculateTerritoryStats = useCallback((territory) => {
    const totalPopulation = territory.zips.reduce((sum, zipObj) => sum + (zipObj.pop || 0), 0);
    const totalHomes = territory.zips.reduce((sum, zipObj) => sum + (zipObj.standAloneHouses || 0), 0);
    return {
      population: totalPopulation,
      homes: totalHomes,
      zipCount: territory.zips.length
    };
  }, []);

  // Helper function to check if vector source is loaded
  const isVectorSourceLoaded = useCallback((map) => {
    try {
      const source = map.getSource(VECTOR_SOURCE_ID);
      if (!source) {
        console.log('🔍 Vector source not found');
        return false;
      }

      // Check if source has loaded tiles
      const sourceCache = source._source && source._source._tileCache;
      if (!sourceCache) {
        console.log('🔍 Vector source cache not available');
        return false;
      }

      // Check if we have any loaded tiles
      const loadedTiles = Object.keys(sourceCache._tiles || {});
      console.log('🔍 Vector source has', loadedTiles.length, 'loaded tiles');

      return loadedTiles.length > 0;
    } catch (error) {
      console.error('🔍 Error checking source loaded state:', error);
      return false;
    }
  }, []);

  // Helper function to wait for vector source to load
  const waitForVectorSource = useCallback((map, timeout = 5000) => {
    return new Promise((resolve) => {
      if (isVectorSourceLoaded(map)) {
        console.log('🔍 Vector source already loaded');
        resolve(true);
        return;
      }

      console.log('🔍 Waiting for vector source to load...');

      const checkLoaded = () => {
        if (isVectorSourceLoaded(map)) {
          console.log('🔍 Vector source loaded successfully');
          resolve(true);
          return;
        }

        // Continue waiting
        setTimeout(checkLoaded, 100);
      };

      // Start checking
      checkLoaded();

      // Timeout fallback
      setTimeout(() => {
        console.log('🔍 Vector source load timeout, proceeding with fallback');
        resolve(false);
      }, timeout);
    });
  }, [isVectorSourceLoaded]);

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
      const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_ACCESS_TOKEN}&country=us&types=postcode,place,region&limit=1`;

      console.log('🔍 Making geocoding request to:', geocodingUrl.replace(MAPBOX_ACCESS_TOKEN, '[TOKEN]'));

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

  // Helper function to get territory geometry and bounds from vector tiles
  const getTerritoryGeometry = useCallback(async (territory, map) => {
    console.log('🔍 Getting territory geometry for', territory.name, 'with', territory.zips.length, 'ZIPs');

    try {
      // Query all ZIP features that belong to this territory
      const territoryZips = territory.zips.map(zipObj => zipObj.zip.toString());
      console.log('🔍 Territory ZIPs:', territoryZips);

      // First, try a quick query to see if any features are available
      const initialFeatures = map.querySourceFeatures(VECTOR_SOURCE_ID, {
        sourceLayer: VECTOR_SOURCE_LAYER,
        filter: ['in', ['get', ZIP_PROPERTY], ['literal', territoryZips]]
      });

      if (initialFeatures.length > 0) {
        console.log('🔍 Found', initialFeatures.length, 'features immediately');
        // Process the features we found
        return processFeatures(initialFeatures, territory);
      }

      // No features found initially - wait for source to load
      console.log('🔍 No initial features found, waiting for source to load...');
      const sourceLoaded = await waitForVectorSource(map, 3000); // Wait up to 3 seconds

      if (!sourceLoaded) {
        console.log('🔍 Vector source still not loaded after waiting');
      }

      // Try query again after waiting
      const features = map.querySourceFeatures(VECTOR_SOURCE_ID, {
        sourceLayer: VECTOR_SOURCE_LAYER,
        filter: ['in', ['get', ZIP_PROPERTY], ['literal', territoryZips]]
      });

      console.log('🔍 After waiting, querySourceFeatures returned', features.length, 'features');

      // Debug: Log some sample features if found
      if (features.length > 0) {
        console.log('🔍 Sample feature properties:', features[0].properties);
        console.log('🔍 Sample feature geometry type:', features[0].geometry?.type);
        return processFeatures(features, territory);
      }

      // Still no features - try to fly to an estimated center to load relevant tiles
      console.log('🔍 Still no features found. Trying to load tiles by flying to estimated center...');

      // Quick geocoding to get an approximate center
      const quickCenter = getQuickCenterEstimate(territory);
      if (quickCenter) {
        console.log('🔍 Flying to estimated center to load tiles:', quickCenter);

        // Fly to the estimated center to load tiles
        map.flyTo({
          center: quickCenter,
          zoom: 6, // Low zoom to load broader area
          duration: 500 // Quick movement
        });

        // Wait a bit for tiles to load
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try one more query
        const finalFeatures = map.querySourceFeatures(VECTOR_SOURCE_ID, {
          sourceLayer: VECTOR_SOURCE_LAYER,
          filter: ['in', ['get', ZIP_PROPERTY], ['literal', territoryZips]]
        });

        console.log('🔍 After flying to center, found', finalFeatures.length, 'features');

        if (finalFeatures.length > 0) {
          return processFeatures(finalFeatures, territory);
        }
      }

      console.log('🔍 No features found even after trying to load tiles. Possible reasons:');
      console.log('🔍 - ZIP codes not in tileset');
      console.log('🔍 - ZIP code format mismatch');
      console.log('🔍 - Vector tileset configuration issue');

      // Try a broader query to see if any features are available at all
      const allFeatures = map.querySourceFeatures(VECTOR_SOURCE_ID, {
        sourceLayer: VECTOR_SOURCE_LAYER
      });
      console.log('🔍 Total features available in loaded tiles:', allFeatures.length);

      if (allFeatures.length > 0) {
        console.log('🔍 Sample ZIP codes in loaded tiles:', allFeatures.slice(0, 5).map(f => f.properties?.[ZIP_PROPERTY]));
      }

      console.log('🔍 Will use fallback geocoding');
      return null;

    } catch (error) {
      console.error('🔍 Error getting territory geometry:', error);
      return null;
    }
  }, [waitForVectorSource]);

  // Helper function to get a quick center estimate for loading tiles
  const getQuickCenterEstimate = useCallback((territory) => {
    if (territory.zips.length === 0) return null;

    // Use the first ZIP code to estimate center
    const firstZip = territory.zips[0].zip.toString();
    const prefix = firstZip.substring(0, 3);

    // Use the zipToCoords mapping for a quick estimate
    const zipToCoords = {
      '900': [34.05, -118.24], // Los Angeles
      '902': [34.05, -118.24], // LA area
      '904': [34.05, -118.24], // LA area
      '908': [33.83, -118.18], // Long Beach
      '910': [34.15, -118.12], // Pasadena
      '911': [34.15, -118.12], // Pasadena
      '912': [34.24, -118.54], // Glendale
      '913': [34.24, -118.54], // Glendale
      '914': [34.24, -118.54], // Glendale
      '915': [34.24, -118.54], // Glendale
      '916': [34.15, -118.37], // North Hollywood
      '917': [34.05, -117.75], // Pomona
      '918': [34.05, -117.75], // Pomona
      '919': [32.83, -116.77], // Chula Vista
      '920': [33.22, -117.34], // Escondido
      '921': [32.72, -117.16], // San Diego
      '922': [33.72, -116.22], // Palm Desert
      '923': [34.89, -116.95], // Victorville
      '924': [34.11, -117.30], // San Bernardino
      '925': [33.94, -117.40], // Riverside
      '926': [33.67, -117.82], // Newport Beach
      '927': [33.75, -117.87], // Orange
      '928': [33.83, -117.91], // Anaheim
    };

    return zipToCoords[prefix] || estimateCoordsFromZip(prefix);
  }, []);

  // Helper function to process found features
  const processFeatures = useCallback((features, territory) => {
    console.log('🔍 Processing', features.length, 'features for territory', territory.name);

    // Create GeoJSON FeatureCollection from the features
    const featureCollection = turf.featureCollection(features);
    console.log('🔍 Created feature collection with', featureCollection.features.length, 'features');

    // Union all polygons to get a single geometry representing the entire territory
    let unionGeometry;
    try {
      unionGeometry = turf.union(featureCollection);
      console.log('🔍 Successfully unioned territory polygons');
    } catch (unionError) {
      console.warn('🔍 Union failed, using first feature as fallback:', unionError);
      unionGeometry = featureCollection.features[0];
    }

    // Calculate bounding box and centroid
    const bbox = turf.bbox(unionGeometry);
    const centroid = turf.centroid(unionGeometry);

    console.log('🔍 Territory bounds:', bbox);
    console.log('🔍 Territory centroid:', centroid.geometry.coordinates);

    return {
      geometry: unionGeometry,
      bbox: bbox,
      centroid: centroid.geometry.coordinates, // [lng, lat]
      featureCount: features.length
    };
  }, []);

  // Handle window resize to ensure map resizes properly
  useEffect(() => {
    const handleResize = () => {
      console.log('🗺️ Window resized, resizing map');
      if (mapRef.current && mapRef.current.getMap) {
        const map = mapRef.current.getMap();
        if (map) {
          map.resize();
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Force map repaint when it loads
  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      console.log('🗺️ Map loaded, forcing repaints and resizes');
      const map = mapRef.current.getMap();
      if (map) {
        // Multiple resize and repaint calls to ensure it works
        map.resize();
        map.triggerRepaint();

        setTimeout(() => {
          map.resize();
          map.triggerRepaint();
        }, 500);

        setTimeout(() => {
          map.resize();
          map.triggerRepaint();
        }, 1000);
      }
    }
  }, [mapLoaded]);

  // Handle selected territory tooltip (persistent)
  useEffect(() => {
    (async () => {
      console.log('🔍 Selected territory tooltip useEffect triggered - activeTerritoryId:', activeTerritoryId, 'mapLoaded:', mapLoaded, 'addMode:', !!localAddModeTerritoryIdRef.current);
      console.log('🔍 Available territories:', territories.map(t => `${t.name} (id: ${t.id})`));
      console.log('🔍 mapRef.current exists:', !!mapRef.current);

      // Don't show territory tooltip in add mode - only show individual ZIP tooltips
      if (localAddModeTerritoryIdRef.current) {
        console.log('🔍 Skipping territory tooltip - in add mode');
        return;
      }

      if (!mapLoaded || !mapRef.current) {
        console.log('🔍 Early return from tooltip useEffect - conditions not met');
        return;
      }

      const map = mapRef.current.getMap();

    // Remove existing selected territory popup
    if (selectedTerritoryPopup) {
      selectedTerritoryPopup.remove();
      setSelectedTerritoryPopup(null);
    }

    // Clear any existing ZIP tooltip when showing territory tooltip
    setPopupInfo(null);

    // Create new popup for selected territory
    if (activeTerritoryId) {
      console.log('🔍 Looking for territory with id:', activeTerritoryId, '(type:', typeof activeTerritoryId, ') in territories:', territories.map(t => ({id: t.id, name: t.name, idType: typeof t.id})));
      const territory = territories.find(t => String(t.id) === String(activeTerritoryId));
      console.log('🔍 Found territory:', territory ? `${territory.name} (id: ${territory.id})` : 'NOT FOUND');

      // Double-check: make sure we found the right territory
      if (territory) {
        console.log('🔍 VERIFICATION: activeTerritoryId === territory.id?', String(activeTerritoryId) === String(territory.id));
        console.log('🔍 VERIFICATION: activeTerritoryId:', activeTerritoryId, 'territory.id:', territory.id);

        // Check if there are multiple territories with similar data
        const allMatching = territories.filter(t => String(t.id) === String(activeTerritoryId));
        console.log('🔍 VERIFICATION: Found', allMatching.length, 'territories with matching ID');
        if (allMatching.length > 1) {
          console.log('🔍 VERIFICATION: Multiple territories with same ID:', allMatching.map(t => `${t.name} (id: ${t.id})`));
        }
      } else {
        console.log('🔍 ERROR: No territory found with ID', activeTerritoryId);
        console.log('🔍 Available territory IDs:', territories.map(t => t.id));
      }

      if (!territory) {
        console.log('🔍 ERROR: Territory not found!');
        return;
      }

      if (territory.zips.length === 0) {
        console.log('🔍 Territory has no ZIPs, skipping tooltip');
        return;
      }

      console.log('🔍 Territory has', territory.zips.length, 'ZIPs');
      const stats = calculateTerritoryStats(territory);
      console.log('🔍 Territory stats - Population:', stats.population, 'Homes:', stats.homes, 'ZIPs:', stats.zipCount);

      // Position popup at the geocoded center of the territory's first ZIP
      let centerLat, centerLng;

      // Use geocoding to get accurate center for tooltip
      const firstZip = territory.zips[0].zip;
      console.log('🔍 Geocoding first ZIP for tooltip positioning:', firstZip);

      const geocodeResult = await geocodeAndZoom(firstZip, map);

      if (geocodeResult && geocodeResult.center) {
        // Use the geocoded center for tooltip positioning
        [centerLng, centerLat] = geocodeResult.center;
        console.log('🔍 Positioning tooltip at geocoded center:', [centerLng, centerLat]);
      } else {
        // Fallback to map center if geocoding fails
        const mapCenter = map.getCenter();
        centerLng = mapCenter.lng;
        centerLat = mapCenter.lat;
        console.log('🔍 Geocoding failed, using map center for tooltip:', [centerLng, centerLat]);
      }
      console.log('🔍 POPUP CONTENT PREP - Territory:', territory.name, 'Population:', stats.population, 'Homes:', stats.homes, 'ZIPs:', stats.zipCount);

      const popupHtml = `
        <div style="font-weight: bold; margin-bottom: 4px; color: #000;">${territory.name}</div>
        <div style="color: #000; font-weight: normal;">Population: ${stats.population.toLocaleString()}</div>
        <div style="color: #000; font-weight: normal;">Homes: ${stats.homes.toLocaleString()}</div>
        <div style="font-size: 0.9em; color: #666;">${stats.zipCount} ZIPs</div>
      `;

      console.log('🔍 Generated popup HTML:', popupHtml);

      try {
        console.log('🔍 Attempting to create popup...');
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          className: 'territory-selected-popup',
          offset: [15, 15] // Offset 15px east and 15px north (northeast positioning)
          // Note: draggable option removed - implementing custom drag functionality
        })
          .setLngLat([centerLng, centerLat])
          .setHTML(popupHtml)
          .addTo(map);

        console.log('🔍 Popup added to map at coordinates:', [centerLng, centerLat]);
        console.log('🔍 Popup element created:', !!popup.getElement());

        // Implement custom drag functionality
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let popupStartLngLat = [centerLng, centerLat];

        // Get popup element and set up drag listeners
        const popupElement = popup.getElement();
        if (popupElement) {
          console.log('🔍 Setting up drag listeners on popup element');

          // Mouse down - start dragging
          popupElement.addEventListener('mousedown', (e) => {
            console.log('🔍 Mousedown detected on tooltip - starting drag');
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            popupStartLngLat = popup.getLngLat().toArray();
            popupElement.style.cursor = 'grabbing';
            e.preventDefault();
            e.stopPropagation(); // Prevent map from getting the event
          });

          // Mouse move - drag the popup
          const handleMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;

            // Use map's built-in coordinate conversion for accurate dragging
            const currentLngLat = popupStartLngLat;
            const currentPoint = map.project(currentLngLat);

            // Move the point by the pixel delta
            const newPoint = [currentPoint.x + deltaX, currentPoint.y + deltaY];
            const newLngLat = map.unproject(newPoint);

            popup.setLngLat(newLngLat);
          };

          // Mouse up - stop dragging
          const handleMouseUp = () => {
            if (isDragging) {
              console.log('🔍 Mouse up - stopping drag');
              isDragging = false;
              const popupElement = popup.getElement();
              if (popupElement) {
                popupElement.style.cursor = 'default'; // Reset to default cursor
              }
            }
          };

          // Add global listeners for drag
          console.log('🔍 Adding global mousemove and mouseup listeners');
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);

          // Clean up listeners when popup closes
          popup.on('close', () => {
            console.log('🔍 Popup closed - removing drag listeners');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          });
        }

        setSelectedTerritoryPopup(popup);
        console.log('✅ Created and added draggable popup for', territory.name, 'at map center:', [centerLng, centerLat]);
      } catch (error) {
        console.error('❌ Error creating popup:', error);
        console.error('❌ mapboxgl available:', typeof mapboxgl);
        console.error('❌ mapboxgl.Popup available:', typeof mapboxgl?.Popup);
      }
    }
    })();
  }, [activeTerritoryId, territories, mapLoaded]);


  // Fallback: Force map to be considered loaded after 10 seconds
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (!mapLoaded) {
        console.log('🗺️ Fallback: Forcing map to be considered loaded after 10 seconds');
        setMapLoaded(true);
      }
    }, 10000); // 10 seconds

    return () => clearTimeout(fallbackTimer);
  }, [mapLoaded]);

  // Handle ZIP clicks (add/remove from territories)
  const handleZipClick = useCallback(async (e) => {
      const zipCode = e.features[0].properties[ZIP_PROPERTY];
    console.log('🖱️ ZIP click detected:', zipCode, 'localAddModeTerritoryId:', localAddModeTerritoryIdRef.current);

    // Prevent rapid clicking
    if (isProcessingZip) {
      console.log('🖱️ ZIP processing in progress, ignoring click');
      return;
    }

    // Prevent duplicate processing of the same ZIP
    if (processingZipsRef.current.has(zipCode)) {
      console.log('🖱️ ZIP already being processed, ignoring:', zipCode);
      return;
    }

    processingZipsRef.current.add(zipCode);
    setIsProcessingZip(true);

    try {
      // Add ZIP immediately with placeholder data for instant UI response
    console.log('🖱️ Adding ZIP immediately with placeholder data:', zipCode);
    addZipToActiveTerritory(zipCode, 0, 0, localAddModeTerritoryIdRef.current);

    // Fetch census data asynchronously (non-blocking)
    fetchZipPopulationAndHouses(zipCode).then(censusData => {
      console.log('🖱️ Got real census data asynchronously:', zipCode, censusData);
      // Update the ZIP with real data once it arrives (don't toggle, just update existing)
      addZipToActiveTerritory(zipCode, censusData.population, censusData.standAloneHouses, localAddModeTerritoryIdRef.current, true);

      // Update tooltip with real data
      setPopupInfo(currentPopup => {
        if (currentPopup && currentPopup.zip === zipCode) {
          console.log('🖱️ Updating tooltip with real census data:', censusData);
          return {
            ...currentPopup,
            population: censusData.population,
            standAloneHouses: censusData.standAloneHouses,
            estimated: false,
            loading: false
          };
        }
        return currentPopup; // Return unchanged if not matching
      });
    }).catch(censusError => {
      console.warn('🖱️ Census API failed asynchronously:', zipCode, censusError.message);
      // Update tooltip to show data unavailable
      setPopupInfo(currentPopup => {
        if (currentPopup && currentPopup.zip === zipCode) {
          console.log('🖱️ Updating tooltip to show data unavailable');
          return {
            ...currentPopup,
            population: 0,
            standAloneHouses: 0,
            estimated: true,
            loading: false
          };
        }
        return currentPopup; // Return unchanged if not matching
      });
    });

    // Show tooltip in add mode (immediate feedback)
    if (localAddModeTerritoryIdRef.current) {
      setPopupInfo({
        zip: zipCode,
        lngLat: e.lngLat,
        population: 0, // Placeholder initially
        standAloneHouses: 0,
        estimated: true, // Will be updated when real data arrives
      });
    }

      // Handle highlighting based on mode
      console.log('🖱️ Handling mode - localAddModeTerritoryId:', localAddModeTerritoryIdRef.current);
      if (!localAddModeTerritoryIdRef.current) {
        // Not in add mode - highlight just this ZIP and show tooltip
        console.log('🖱️ ENTERING: Not in add mode - highlighting single ZIP:', zipCode);
        // Comprehensive type safety check for single ZIP
        const normalizedZipCode = String(zipCode);
        console.log('Single ZIP validation - Original:', typeof zipCode, zipCode, 'Normalized:', typeof normalizedZipCode, normalizedZipCode);
        if (normalizedZipCode !== zipCode) {
          console.warn('🖱️ ZIP type coercion applied - was:', zipCode, 'now:', normalizedZipCode);
        }
        setSelectedZips([zipCode]);

        // Show tooltip for the selected ZIP (loading state until real data arrives)
        console.log('🖱️ Setting loading tooltip for ZIP:', zipCode);
        setPopupInfo({
          zip: zipCode,
          lngLat: e.lngLat,
          population: 0,
          standAloneHouses: 0,
          estimated: true,
          loading: true // Loading state
        });

        // Update the highlight layer filter immediately (type-safe)
        if (mapRef.current) {
          const map = mapRef.current.getMap();
          if (map.getLayer('zip-highlight')) {
            map.setFilter('zip-highlight', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', [normalizedZipCode]]]);
            console.log('🖱️ Updated highlight filter for single ZIP (type-safe):', normalizedZipCode);
            map.triggerRepaint();
            if (map.getLayer('zip-border')) {
              map.setFilter('zip-border', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', [normalizedZipCode]]]);
              console.log('🖱️ Updated border filter for single ZIP (type-safe):', normalizedZipCode);
            }
            // territory-border-halo disabled - no filter to set
            if (map.getLayer('territory-mask')) {
              map.setFilter('territory-mask', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', [normalizedZipCode]]]);
            }
            if (map.getLayer('territory-perimeter')) {
              map.setFilter('territory-perimeter', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', [normalizedZipCode]]]);
              console.log('🖱️ Updated territory layers (mask and perimeter) for single ZIP (type-safe):', normalizedZipCode);
              map.triggerRepaint();
            }
            // Update zip-outlines-new for single ZIP selection - multiple approaches
            if (map.getLayer('zip-outlines-new')) {
              // Approach 1: Filter exclusion
              map.setFilter('zip-outlines-new', ['!', ['in', ['get', 'ZCTA5CE20'], ['literal', [normalizedZipCode]]]]);

              // Approach 2: Opacity hiding
              map.setPaintProperty('zip-outlines-new', 'line-opacity', [
                'case',
                ['in', ['get', 'ZCTA5CE20'], ['literal', [normalizedZipCode]]],
                0.0, // COMPLETELY INVISIBLE
                0.8  // Visible for others
              ]);

              console.log('Line layer filter/opacity applied — selected ZIPs excluded:', [normalizedZipCode]);
              map.triggerRepaint();

              // Debug: Verify the update
              setTimeout(() => {
                try {
                  console.log('Updated line layer filter:', map.getFilter('zip-outlines-new'));
                  console.log('Updated line layer opacity:', map.getPaintProperty('zip-outlines-new', 'line-opacity'));

                  // Check visible lines
                  const visibleLines = map.queryRenderedFeatures({
                    layers: ['zip-outlines-new']
                  });
                  console.log('Visible boundary lines after single ZIP filter:', visibleLines ? visibleLines.length : 0);
                } catch (error) {
                  console.log('Debug check failed:', error.message);
                }
              }, 100);
            }

            // Log ZIP property type check
            console.log('Selected ZIP sample type/value:', typeof normalizedZipCode, normalizedZipCode);

            // Force repaint for all territory layers
            console.log('Mask & outline updates applied for single ZIP');
            map.triggerRepaint();
          }
        }
      } else {
        // In add mode - show ZIP tooltip anyway, territories useEffect will handle highlighting
        console.log('🖱️ In add mode - showing ZIP tooltip and territories useEffect will handle highlighting');
        const cachedData = apiCache.get(zipCode);
        const isEstimated = cachedData?.estimated || false;
        console.log('🖱️ Setting popup info for add mode:', { zip: zipCode, estimated: isEstimated });
        setPopupInfo({
          zip: zipCode,
          lngLat: e.lngLat,
          population: cachedData?.population || 0,
          standAloneHouses: cachedData?.standAloneHouses || 0,
          estimated: isEstimated,
          loading: !cachedData, // Show loading if no cached data
        });
      }

    } catch (error) {
      console.error('Failed to add ZIP:', error);
    } finally {
      // Remove from processing set and reset processing state
      processingZipsRef.current.delete(zipCode);
      setIsProcessingZip(false);
    }
  }, [addZipToActiveTerritory]);


  // Handle ZIP hover
  const handleZipHover = useCallback((e) => {
    const zipCode = e.features[0].properties[ZIP_PROPERTY];
    setHoveredZip(zipCode);

    // Change cursor to pointer
    if (mapRef.current) {
      mapRef.current.getMap().getCanvas().style.cursor = 'pointer';
    }
  }, []);

  const handleZipLeave = useCallback(() => {
    setHoveredZip(null);

    // Reset cursor
    if (mapRef.current) {
      mapRef.current.getMap().getCanvas().style.cursor = '';
    }
  }, []);


  // Handle clicking outside tooltip to close it
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popupInfo && !e.target.closest('.zip-tooltip')) {
        // Just close tooltip (highlights stay via selectedZips)
        setPopupInfo(null);
      }
    };

    if (popupInfo) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [popupInfo]);

  // Zoom to territory implementation
  const zoomToTerritory = useCallback(async (territoryId) => {
    console.log('🎯 zoomToTerritory called for', territoryId);

    const territory = territories.find(t => String(t.id) === String(territoryId));
    if (!territory) {
      console.log('🎯 Territory not found:', territoryId);
      return;
    }
    if (!mapRef.current) {
      console.log('🎯 Map not ready');
      return;
    }

    console.log('🎯 Found territory:', territory.name, 'with', territory.zips.length, 'ZIPs');

    if (territory.zips.length === 0) {
      console.log('🎯 Territory has no ZIPs - skipping zoom');
      return;
    }

    const map = mapRef.current.getMap();

    // Use the first ZIP code from the territory for geocoding
    const firstZip = territory.zips[0].zip;
    console.log('🎯 Using first ZIP for geocoding:', firstZip);

    // Use geocoding API to zoom to the territory location
    const geocodeResult = await geocodeAndZoom(firstZip, map);

    if (!geocodeResult) {
      console.log('🎯 Geocoding failed for territory, using fallback');
      // Fallback to the old geocoding approach if geocoding fails
      geocodeAndZoomToTerritory(territory, map);
    } else {
      console.log('🎯 Successfully zoomed to territory using geocoding');
    }
  }, [territories, geocodeAndZoom]);

  // Function to estimate coordinates for unknown ZIP prefixes based on USPS regions
  // This covers all 50 states with accurate regional mappings
  const estimateCoordsFromZip = (zipPrefix) => {
    const prefix = parseInt(zipPrefix);
    console.log(`Estimating coords for ZIP prefix: ${zipPrefix} -> ${prefix} (type: ${typeof prefix})`);

    // ZIP code regions by first digit (expanded to 3-digit ranges)
    // New England (Maine, New Hampshire, Vermont, Massachusetts, Rhode Island, Connecticut)
    if (prefix >= 0 && prefix <= 67) {
      // Maine (039-049)
      if (prefix >= 39 && prefix <= 49) {
        console.log(`Maine region: ${prefix} -> [45.0, -69.0]`);
        return [45.0, -69.0];
      }
      // New Hampshire (030-038, 050-052, 054-056, 058-059)
      if ((prefix >= 30 && prefix <= 38) || (prefix >= 50 && prefix <= 52) || (prefix >= 54 && prefix <= 56) || (prefix >= 58 && prefix <= 59)) {
        console.log(`New Hampshire region: ${prefix} -> [43.5, -71.5]`);
        return [43.5, -71.5];
      }
      // Vermont (050-059 except NH ranges)
      if (prefix >= 50 && prefix <= 59) {
        console.log(`Vermont region: ${prefix} -> [44.0, -72.5]`);
        return [44.0, -72.5];
      }
      // Massachusetts (010-027, 055)
      if ((prefix >= 10 && prefix <= 27) || prefix === 55) {
        console.log(`Massachusetts region: ${prefix} -> [42.0, -71.5]`);
        return [42.0, -71.5];
      }
      // Rhode Island (028-029)
      if (prefix >= 28 && prefix <= 29) {
        console.log(`Rhode Island region: ${prefix} -> [41.5, -71.5]`);
        return [41.5, -71.5];
      }
      // Connecticut (060-069)
      if (prefix >= 60 && prefix <= 69) {
        console.log(`Connecticut region: ${prefix} -> [41.5, -72.5]`);
        return [41.5, -72.5];
      }
      console.log(`Northeast (New England) region: ${prefix} -> [42.0, -71.0]`);
      return [42.0, -71.0];
    }
    // Mid-Atlantic (New York, New Jersey, Pennsylvania, Delaware, Maryland, DC)
    if (prefix >= 70 && prefix <= 99) {
      console.log(`Mid-Atlantic region: ${prefix} -> [40.0, -75.0]`);
      return [40.0, -75.0];
    }
    // 1xxx: Northeast/Mid-Atlantic
    if (prefix >= 100 && prefix <= 199) {
      console.log(`Northeast/Mid-Atlantic region: ${prefix} -> [39.5, -77.0]`);
      return [39.5, -77.0];
    }
    // 2xxx: Mid-Atlantic (VA, MD, DE, DC) and Southeast
    if (prefix >= 200 && prefix <= 249) {
      console.log(`Mid-Atlantic region: ${prefix} -> [38.5, -77.0]`);
      return [38.5, -77.0]; // Washington DC area
    }
    if (prefix >= 250 && prefix <= 289) {
      console.log(`North Carolina region: ${prefix} -> [35.0, -81.0]`);
      return [35.0, -81.0]; // North Carolina
    }
    if (prefix >= 290 && prefix <= 299) {
      console.log(`South Carolina region: ${prefix} -> [34.0, -81.0]`);
      return [34.0, -81.0]; // South Carolina
    }
    // 3xxx: Southeast/Gulf - split by state
    if (prefix >= 300 && prefix <= 319) {
      console.log(`Georgia region: ${prefix} -> [33.7, -84.4]`);
      return [33.7, -84.4]; // Atlanta area
    }
    if (prefix >= 320 && prefix <= 349) {
      console.log(`Florida region: ${prefix} -> [28.5, -81.4]`);
      return [28.5, -81.4]; // Orlando area
    }
    if (prefix >= 350 && prefix <= 369) {
      console.log(`Alabama region: ${prefix} -> [32.0, -86.0]`);
      return [32.0, -86.0]; // Alabama/Mobile area
    }
    if (prefix >= 370 && prefix <= 399) {
      console.log(`Tennessee region: ${prefix} -> [36.2, -86.8]`);
      return [36.2, -86.8]; // Nashville area
    }
    // 4xxx: Great Lakes - Indiana specific first
    if (prefix >= 460 && prefix <= 462) {
      console.log(`Central Indiana region: ${prefix} -> [40.1, -85.7]`);
      return [40.1, -85.7]; // Anderson/Frankfort area
    }
    if (prefix >= 463 && prefix <= 479) {
      console.log(`Central Indiana region: ${prefix} -> [40.1, -85.7]`);
      return [40.1, -85.7]; // Other central Indiana
    }
    if (prefix >= 473 && prefix <= 473) {
      console.log(`Eastern Indiana region: ${prefix} -> [40.2, -85.4]`);
      return [40.2, -85.4]; // Muncie/Richmond area
    }
    // 4xxx: Great Lakes (Michigan, Ohio, Illinois, Wisconsin, Minnesota)
    if (prefix >= 480 && prefix <= 499) {
      console.log(`Great Lakes region: ${prefix} -> [42.0, -87.0]`);
      return [42.0, -87.0];
    }
    // 4xxx: Other Great Lakes states
    if (prefix >= 400 && prefix <= 459) {
      console.log(`Great Lakes region: ${prefix} -> [42.0, -87.0]`);
      return [42.0, -87.0];
    }
    // 5xxx: Midwest (Iowa, Missouri, Minnesota) and Wisconsin
    if (prefix >= 500 && prefix <= 529) {
      console.log(`Midwest region: ${prefix} -> [41.0, -93.0]`);
      return [41.0, -93.0];
    }
    // Wisconsin (530-549)
    if (prefix >= 530 && prefix <= 549) {
      console.log(`Wisconsin region: ${prefix} -> [44.0, -89.5]`);
      return [44.0, -89.5];
    }
    // Minnesota (550-567)
    if (prefix >= 550 && prefix <= 567) {
      console.log(`Minnesota region: ${prefix} -> [45.5, -93.5]`);
      return [45.5, -93.5];
    }
    // South Dakota (570-577)
    if (prefix >= 570 && prefix <= 577) {
      console.log(`South Dakota region: ${prefix} -> [44.5, -100.0]`);
      return [44.5, -100.0];
    }
    // Virginia (220-246, but 220-229 are DC area)
    if (prefix >= 220 && prefix <= 229) {
      console.log(`Northern Virginia/DC region: ${prefix} -> [38.9, -77.0]`);
      return [38.9, -77.0]; // Northern Virginia/DC area
    }
    if (prefix >= 230 && prefix <= 246) {
      console.log(`Virginia region: ${prefix} -> [37.5, -77.5]`);
      return [37.5, -77.5]; // Richmond area
    }
    // North Dakota (580-589)
    if (prefix >= 580 && prefix <= 589) {
      console.log(`North Dakota region: ${prefix} -> [47.0, -100.5]`);
      return [47.0, -100.5];
    }
    // Montana (590-599)
    if (prefix >= 590 && prefix <= 599) {
      console.log(`Montana region: ${prefix} -> [46.5, -109.5]`);
      return [46.5, -109.5];
    }
    // 6xxx: Great Plains (KS, NE, SD, ND)
    if (prefix >= 600 && prefix <= 699) {
      console.log(`Great Plains region: ${prefix} -> [38.5, -97.0]`);
      return [38.5, -97.0];
    }
    // 7xxx: South Central (TX, OK, AR, LA)
    // 7xxx: South Central/Southwest
    if (prefix >= 700 && prefix <= 799) {
      console.log(`South Central/Southwest region: ${prefix} -> [33.0, -97.0]`);
      return [33.0, -97.0];
    }
    // 8xxx: Mountain West (includes Wyoming 82xxx-83xxx)
    if (prefix >= 800 && prefix <= 899) {
      console.log(`Mountain West region: ${prefix} -> [43.0, -108.0]`);
      return [43.0, -108.0]; // Wyoming/Casper area as representative for Mountain West
    }
    // 9xxx: Pacific West - split by state
    if (prefix >= 900 && prefix <= 961) {
      console.log(`California region: ${prefix} -> [37.0, -122.0]`);
      return [37.0, -122.0]; // California (San Francisco area)
    }
    if (prefix >= 970 && prefix <= 979) {
      console.log(`Oregon region: ${prefix} -> [45.5, -122.7]`);
      return [45.5, -122.7]; // Oregon (Portland area)
    }
    if (prefix >= 980 && prefix <= 994) {
      console.log(`Washington region: ${prefix} -> [47.6, -122.3]`);
      return [47.6, -122.3]; // Washington (Seattle area)
    }
    if (prefix >= 995 && prefix <= 999) {
      console.log(`Alaska region: ${prefix} -> [61.2, -149.9]`);
      return [61.2, -149.9]; // Alaska (Anchorage area)
    }

    // Special cases for territories
    if (prefix >= 967 && prefix <= 968) return [21.3, -157.8]; // Hawaii
    if (prefix >= 969 && prefix <= 969) return [13.4, 144.7]; // Northern Mariana Islands
    if (prefix >= 970 && prefix <= 979) return [18.2, -66.6]; // Puerto Rico
    if (prefix >= 980 && prefix <= 989) return [18.3, -64.9]; // US Virgin Islands
    if (prefix >= 990 && prefix <= 999) return [21.3, -157.8]; // American Samoa, Guam, etc.

    console.log(`Default region: ${prefix} -> [39.5, -98.35]`);
    return [39.5, -98.35]; // Geographic center of US (fallback)
  };

  // Fallback geocoding function for territories with missing ZIP features
  const geocodeAndZoomToTerritory = useCallback(async (territory, map) => {
    console.log('Attempting to geocode territory ZIPs for', territory.name);


    // Comprehensive ZIP code to coordinates mapping (first 3 digits)
    // Covers major metropolitan areas and known regions
    const zipToCoords = {
      // Texas Panhandle - more precise locations
      '790': [35.22, -101.83], // Amarillo area
      '791': [35.22, -101.83], // Amarillo
      '792': [34.18, -101.72], // Plainview/Snyder area
      '793': [33.58, -101.85], // Lubbock area
      '794': [33.58, -101.85], // Lubbock
      '795': [32.45, -99.73],  // Abilene area
      '796': [32.45, -99.73],  // Abilene
      '797': [31.99, -102.08], // Midland/Odessa

      // Additional Texas prefixes
      '798': [30.85, -104.02], // Fort Hancock area
      '799': [31.76, -106.49], // El Paso area

      // New Mexico
      '870': [35.08, -106.65], // Albuquerque area
      '871': [35.08, -106.65], // Albuquerque
      '872': [35.08, -106.65], // Albuquerque
      '873': [36.41, -107.05], // Crownpoint area
      '874': [36.73, -108.22], // Farmington area
      '875': [35.69, -105.94], // Santa Fe area
      '876': [36.75, -108.18], // Navajo Nation area
      '877': [34.41, -104.24], // Roswell area
      '878': [33.28, -108.87], // Truth or Consequences area
      '879': [32.78, -107.82], // Hillsboro area
      '880': [32.28, -106.75], // Las Cruces area
      '881': [33.41, -104.52], // Clovis/Portales area
      '882': [32.89, -103.13], // Hobbs area
      '883': [33.24, -105.66], // Ruidoso area
      '884': [36.75, -103.98], // Raton area

      // Kansas
      '660': [38.96, -94.78],  // Kansas City, KS area
      '661': [39.11, -94.76],  // Kansas City, KS
      '662': [38.96, -94.78],  // Overland Park area
      '664': [39.18, -96.60],  // Manhattan, KS area
      '665': [39.05, -95.68],  // Topeka area
      '666': [39.05, -95.68],  // Topeka
      '667': [37.43, -94.71],  // Pittsburg, KS area
      '668': [38.37, -95.65],  // Emporia area
      '669': [39.78, -99.33],  // Hays area
      '670': [37.69, -97.34],  // Wichita area
      '671': [37.69, -97.34],  // Wichita
      '672': [37.69, -97.34],  // Wichita
      '673': [37.41, -95.27],  // Independence area
      '674': [38.85, -97.61],  // Salina area
      '675': [38.37, -98.78],  // Hutchinson area
      '676': [39.36, -99.32],  // Hays area
      '677': [39.78, -99.33],  // Hays
      '678': [37.04, -100.93], // Liberal area
      '679': [37.04, -100.93], // Liberal

      // Arkansas
      '716': [33.45, -91.50], // Monticello area
      '717': [33.25, -92.70], // El Dorado area
      '718': [35.25, -90.70], // Jonesboro area
      '719': [34.50, -93.00], // Hot Springs area
      '720': [34.75, -92.30], // Little Rock area
      '721': [34.75, -92.30], // Little Rock
      '722': [34.75, -92.30], // Little Rock
      '723': [35.15, -90.20], // West Memphis area
      '724': [35.75, -89.95], // Blytheville area
      '725': [35.80, -91.65], // Batesville area
      '726': [36.25, -92.35], // Mountain Home area
      '727': [36.35, -94.20], // Fayetteville area
      '728': [35.30, -93.15], // Russellville area
      '729': [35.40, -94.45], // Fort Smith area
      '755': [33.45, -94.05], // Texarkana, AR area

      // North Carolina
      '270': [36.10, -80.25], // Winston-Salem area
      '271': [36.10, -80.25], // Winston-Salem
      '272': [35.80, -79.00], // Greensboro area
      '273': [35.80, -79.00], // Greensboro
      '274': [36.10, -79.90], // Greensboro
      '275': [35.80, -78.65], // Raleigh area
      '276': [35.80, -78.65], // Raleigh
      '277': [35.90, -78.90], // Durham area
      '278': [35.60, -77.40], // Greenville area
      '279': [36.00, -75.70], // Outer Banks area
      '280': [35.25, -80.90], // Charlotte area
      '281': [35.25, -80.90], // Charlotte
      '282': [35.25, -80.90], // Charlotte
      '283': [35.05, -79.00], // Fayetteville area
      '284': [34.25, -77.95], // Wilmington area
      '285': [34.75, -77.40], // Jacksonville area
      '286': [36.20, -81.70], // Hickory area
      '287': [35.60, -82.55], // Asheville area
      '288': [35.60, -82.55], // Asheville
      '289': [34.75, -76.90], // Morehead City area

      // Illinois
      '600': [42.10, -87.90], // Chicago northern suburbs
      '601': [41.90, -88.00], // Chicago western suburbs
      '602': [41.90, -87.90], // Chicago
      '603': [41.90, -87.90], // Chicago
      '604': [41.60, -87.70], // Chicago southern suburbs
      '605': [41.75, -88.25], // Aurora area
      '606': [41.90, -87.65], // Chicago
      '607': [41.90, -87.65], // Chicago
      '608': [41.70, -87.75], // Chicago
      '609': [40.50, -87.65], // Kankakee area
      '610': [42.25, -89.10], // Rockford area
      '611': [42.25, -89.10], // Rockford
      '612': [41.50, -90.50], // Moline area
      '613': [41.35, -88.85], // Ottawa area
      '614': [40.70, -89.60], // Peoria area
      '615': [40.70, -89.60], // Peoria
      '616': [40.70, -89.60], // Peoria
      '617': [40.45, -88.95], // Bloomington area
      '618': [40.10, -88.25], // Champaign/Urbana area
      '619': [39.80, -88.30], // Charleston area
      '620': [38.90, -90.20], // St. Louis area
      '621': [38.90, -90.20], // St. Louis
      '622': [38.60, -90.15], // St. Louis
      '623': [39.95, -91.35], // Quincy area
      '624': [39.10, -88.60], // Effingham area
      '625': [39.75, -89.65], // Springfield area
      '626': [39.75, -89.65], // Springfield
      '627': [39.75, -89.65], // Springfield
      '628': [38.00, -88.95], // Mount Vernon area
      '629': [37.75, -89.35], // Carbondale area

      // Maine
      '039': [43.0, -70.5], // Maine coastal (Portland area)
      '040': [43.5, -70.5], // Maine (Portland)
      '041': [43.5, -70.5], // Maine (Portland)
      '042': [44.5, -70.0], // Maine central (Auburn/Augusta area)
      '043': [44.5, -70.0], // Maine (Augusta)
      '044': [45.0, -69.0], // Maine northern (Bangor area)
      '045': [44.0, -69.5], // Maine mid-coast (Rockland area)
      '046': [44.5, -68.0], // Maine eastern (Bar Harbor area)
      '047': [46.5, -68.5], // Maine northern (Presque Isle area)
      '048': [44.0, -69.5], // Maine mid-coast
      '049': [44.5, -69.5], // Maine central (Waterville area)

      // Oklahoma - more precise
      '730': [35.47, -97.52],  // Oklahoma City metro
      '731': [35.47, -97.52],  // Oklahoma City
      '732': [35.47, -97.52],  // Oklahoma City
      '733': [35.47, -97.52],  // Oklahoma City
      '734': [34.00, -96.40],  // Durant/Sherman area
      '735': [34.62, -98.42],  // Lawton area
      '736': [35.52, -99.64],  // Clinton area
      '737': [36.40, -97.88],  // Enid area
      '738': [36.75, -99.90],  // Guymon area
      '739': [36.70, -101.40], // Boise City area
      '740': [36.06, -95.78],  // Tulsa area
      '741': [36.06, -95.78],  // Tulsa
      '742': [36.06, -95.78],  // Tulsa
      '743': [36.87, -94.88],  // Miami area
      '744': [35.75, -95.37],  // Muskogee area
      '745': [34.50, -95.60],  // McAlester area
      '746': [36.72, -97.08],  // Ponca City area
      '747': [33.99, -96.40],  // Durant
      '748': [35.50, -96.70],  // Prague/Seminole area
      '749': [35.92, -94.97],  // Tahlequah area

      // East Texas - Dallas/Fort Worth area
      '750': [32.78, -96.79],  // Dallas area
      '751': [32.35, -96.61],  // Corsicana/Ennis area
      '752': [32.78, -96.79],  // Dallas
      '753': [32.78, -96.79],  // Dallas
      '754': [33.14, -96.11],  // Greenville area
      '755': [33.43, -94.04],  // Texarkana area
      '756': [32.53, -94.76],  // Longview area
      '757': [31.76, -95.63],  // Palestine area
      '758': [31.76, -94.94],  // Nacogdoches area
      '759': [31.34, -94.73],  // Lufkin area

      // Fort Worth area
      '760': [32.73, -97.32],  // Fort Worth area
      '761': [32.73, -97.32],  // Fort Worth
      '762': [33.21, -97.13],  // Denton area
      '763': [33.91, -98.49],  // Wichita Falls area
      '764': [32.21, -98.23],  // Stephenville area
      '765': [31.08, -97.66],  // Temple/Killeen area
      '766': [31.55, -97.15],  // Waco area
      '767': [31.55, -97.15],  // Waco
      '768': [31.71, -98.98],  // Brownwood area
      '769': [31.46, -100.44], // San Angelo area

      // Houston/Gulf Coast area
      '770': [29.76, -95.36],  // Houston area
      '771': [29.76, -95.36],  // Houston
      '772': [29.76, -95.36],  // Houston
      '773': [30.02, -95.26],  // Conroe/North Houston area
      '774': [29.57, -95.55],  // Stafford/Sugar Land area
      '775': [29.78, -95.17],  // Pasadena/Baytown area
      '776': [30.08, -94.13],  // Beaumont area
      '777': [30.08, -94.13],  // Beaumont
      '778': [30.63, -96.34],  // College Station area
      '779': [28.81, -96.99],  // Victoria area

      // South Texas
      '780': [27.53, -99.50],  // Laredo area
      '781': [29.52, -98.28],  // San Antonio northern area
      '782': [29.42, -98.49],  // San Antonio
      '783': [27.77, -97.45],  // Kingsville/Corpus Christi area
      '784': [27.77, -97.45],  // Corpus Christi
      '785': [26.30, -98.16],  // McAllen area
      '786': [30.27, -97.74],  // Austin area
      '787': [30.27, -97.74],  // Austin
      '788': [29.21, -99.08],  // Uvalde area
      '760': [32.78, -96.79],  // Dallas/Fort Worth area
      '761': [32.78, -96.79],  // Fort Worth
      '762': [33.22, -97.13],  // Denton area
      '763': [33.92, -98.49],  // Wichita Falls area
      '764': [32.25, -98.22],  // Stephenville area
      '765': [31.12, -97.36],  // Temple/Killeen area
      '766': [31.55, -97.15],  // Waco area
      '786': [30.27, -97.74],  // Austin area
      '787': [30.27, -97.74],  // Austin
      '788': [29.21, -99.08],  // Uvalde area
      '789': [29.79, -96.95],  // West Point area

      // Wyoming
      '820': [41.14, -104.82], // Cheyenne area
      '821': [41.14, -104.82], // Cheyenne
      '822': [44.05, -105.35], // Newcastle area
      '823': [42.05, -104.18], // Wheatland area
      '824': [44.52, -109.06], // Thermopolis area
      '825': [43.03, -108.38], // Riverton area
      '826': [42.87, -106.31], // Casper area
      '827': [44.28, -105.50], // Gillette area
      '828': [44.28, -105.50], // Gillette
      '829': [41.59, -109.22], // Rock Springs area
      '830': [43.48, -110.76], // Jackson area
      '831': [41.31, -110.51], // Kemmerer area

      // Arizona
      '850': [33.45, -112.07], // Phoenix area
      '851': [33.25, -111.62], // Chandler area
      '852': [33.37, -111.92], // Mesa area
      '853': [33.57, -112.23], // Glendale area
      '854': [32.72, -114.62], // Yuma area
      '855': [34.16, -109.99], // Show Low area
      '856': [31.55, -110.25], // Tucson area
      '857': [32.22, -110.93], // Tucson
      '859': [34.13, -109.89], // Pinetop-Lakeside area
      '860': [35.19, -111.65], // Flagstaff area
      '863': [34.54, -112.47], // Prescott area
      '864': [35.03, -114.35], // Kingman area
      '865': [36.13, -109.58], // Chinle area

      // Washington state
      '980': [47.61, -122.33], // Seattle/Bellevue area
      '981': [47.61, -122.33], // Seattle
      '982': [48.05, -122.18], // Everett area
      '983': [47.18, -122.29], // Tacoma area
      '984': [47.25, -122.44], // Tacoma
      '985': [47.04, -122.90], // Olympia area
      '986': [45.64, -122.66], // Vancouver area
      '988': [47.42, -120.32], // Wenatchee area
      '989': [46.60, -120.51], // Yakima area
      '990': [47.67, -117.24], // Spokane area
      '991': [46.73, -117.18], // Pullman area
      '992': [47.67, -117.24], // Spokane
      '993': [46.21, -119.14], // Tri-Cities area
      '994': [46.42, -117.04], // Lewiston area

      // Virginia
      '220': [38.90, -77.04], // Washington DC area
      '221': [38.90, -77.04], // Washington DC
      '222': [38.90, -77.04], // Washington DC
      '223': [38.90, -77.04], // Washington DC
      '224': [38.26, -77.49], // Fredericksburg area
      '225': [38.30, -77.51], // Fredericksburg
      '226': [39.14, -78.17], // Winchester area
      '227': [38.68, -78.16], // Culpeper area
      '228': [38.42, -78.86], // Harrisonburg area
      '229': [38.03, -78.48], // Charlottesville area
      '230': [37.54, -77.43], // Richmond area
      '231': [37.54, -77.43], // Richmond
      '232': [37.54, -77.43], // Richmond
      '233': [36.85, -76.29], // Norfolk area
      '234': [36.85, -76.29], // Norfolk
      '235': [36.85, -76.29], // Norfolk
      '236': [37.08, -76.47], // Newport News area
      '237': [36.85, -76.29], // Portsmouth area
      '238': [37.23, -77.40], // Petersburg area
      '239': [37.27, -80.05], // Blacksburg area
      '240': [39.14, -78.17], // Winchester area
      '241': [37.27, -80.05], // Blacksburg
      '242': [36.69, -82.03], // Bristol area
      '243': [36.69, -82.03], // Bristol
      '244': [38.03, -78.48], // Charlottesville area
      '245': [37.41, -79.14], // Lynchburg area
      '246': [37.09, -81.82], // Bluefield area

      // North Carolina
      '270': [36.10, -80.25], // Winston-Salem area
      '271': [36.10, -80.25], // Winston-Salem
      '272': [35.80, -79.00], // Greensboro area
      '273': [35.80, -79.00], // Greensboro
      '274': [36.10, -79.90], // Greensboro
      '275': [35.80, -78.65], // Raleigh area
      '276': [35.80, -78.65], // Raleigh
      '277': [35.90, -78.90], // Durham area
      '278': [35.60, -77.40], // Greenville area
      '279': [36.00, -75.70], // Outer Banks area
      '280': [35.25, -80.90], // Charlotte area
      '281': [35.25, -80.90], // Charlotte
      '282': [35.25, -80.90], // Charlotte
      '283': [35.05, -79.00], // Fayetteville area
      '284': [34.25, -77.95], // Wilmington area
      '285': [34.75, -77.40], // Jacksonville area
      '286': [36.20, -81.70], // Hickory area
      '287': [35.60, -82.55], // Asheville area
      '288': [35.60, -82.55], // Asheville
      '289': [34.75, -76.90], // Morehead City area

      // South Carolina
      '290': [34.00, -81.03], // Columbia area
      '291': [34.00, -81.03], // Columbia
      '292': [34.00, -81.03], // Columbia
      '293': [34.95, -81.93], // Spartanburg area
      '294': [32.78, -79.93], // Charleston area
      '295': [34.39, -79.37], // Florence area
      '296': [34.85, -82.40], // Greenville area
      '297': [34.95, -81.93], // Rock Hill area
      '298': [33.50, -81.96], // Augusta area
      '299': [32.11, -80.88], // Hilton Head area

      // More specific South Carolina ZIP mappings
      '29040': [34.25, -81.62], // Winnsboro area
      '29044': [33.99, -81.24], // Gilbert area (near Lexington)
      '29062': [33.99, -81.24], // Lexington area
      '29078': [33.99, -81.24], // Lexington area
      '29128': [33.99, -81.24], // Pelion area (near Lexington)
      '29154': [34.39, -79.37], // Turbeville area (near Florence)

      // Georgia
      '300': [33.75, -84.39], // Atlanta area
      '301': [33.75, -84.39], // Atlanta
      '302': [33.58, -84.54], // Atlanta southern suburbs
      '303': [33.75, -84.39], // Atlanta
      '304': [32.08, -81.09], // Savannah area
      '305': [34.37, -83.82], // Gainesville area
      '306': [33.95, -83.37], // Athens area
      '307': [34.50, -84.87], // Calhoun area
      '308': [33.47, -82.01], // Augusta area
      '309': [33.47, -82.01], // Augusta
      '310': [32.84, -83.63], // Macon area
      '311': [32.84, -83.63], // Macon
      '312': [32.84, -83.63], // Macon
      '313': [31.97, -81.33], // Savannah area
      '314': [32.08, -81.09], // Savannah
      '315': [31.22, -82.42], // Valdosta area
      '316': [31.22, -82.42], // Valdosta
      '317': [30.83, -83.28], // Albany area
      '318': [32.47, -84.99], // Columbus area
      '319': [30.83, -81.39], // Jacksonville area (FL, but close to GA)

      // Alabama
      '350': [33.52, -86.80], // Birmingham area
      '351': [33.52, -86.80], // Birmingham area
      '352': [33.52, -86.80], // Birmingham
      '354': [33.20, -87.57], // Tuscaloosa area
      '355': [33.83, -87.28], // Jasper area
      '356': [34.80, -87.68], // Florence area
      '357': [34.66, -86.84], // Huntsville area
      '358': [34.73, -86.59], // Huntsville
      '359': [34.02, -85.99], // Gadsden area
      '360': [32.37, -86.30], // Montgomery area
      '361': [32.37, -86.30], // Montgomery
      '362': [33.65, -85.83], // Anniston area
      '363': [31.22, -85.39], // Dothan area
      '364': [31.32, -87.89], // Evergreen area
      '365': [30.69, -88.04], // Mobile area
      '366': [30.69, -88.04], // Mobile
      '367': [32.51, -87.88], // Selma area
      '368': [32.58, -85.48], // Opelika area
      '369': [32.34, -88.09], // Meridian area (MS, but close to AL)

      // Florida
      '320': [30.33, -81.66], // Jacksonville area
      '321': [29.21, -81.02], // Daytona Beach area
      '322': [30.33, -81.66], // Jacksonville
      '323': [30.44, -84.28], // Tallahassee area
      '324': [30.16, -85.66], // Panama City area
      '325': [30.42, -87.22], // Pensacola area
      '326': [29.65, -82.32], // Gainesville area
      '327': [28.80, -81.27], // Orlando area
      '328': [28.54, -81.38], // Orlando
      '329': [28.61, -80.81], // Melbourne area
      '330': [26.12, -80.15], // Fort Lauderdale area
      '331': [25.76, -80.19], // Miami area
      '332': [25.76, -80.19], // Miami
      '333': [26.12, -80.15], // Fort Lauderdale
      '334': [26.71, -80.05], // West Palm Beach area
      '335': [27.95, -82.46], // Tampa area
      '336': [27.95, -82.46], // Tampa
      '337': [27.77, -82.64], // St. Petersburg area
      '338': [28.03, -81.95], // Lakeland area
      '339': [26.64, -81.87], // Fort Myers area
      '341': [26.14, -81.79], // Naples area
      '342': [27.34, -82.53], // Sarasota area
      '344': [28.97, -82.46], // Ocala area
      '346': [28.23, -82.73], // New Port Richey area
      '347': [28.55, -81.59], // Orlando area
      '349': [27.45, -80.33], // Port St. Lucie area

      // Minnesota
      '550': [44.95, -93.1], // Minneapolis area
      '551': [44.95, -93.1], // St. Paul area
      '552': [44.95, -93.1], // Minneapolis
      '553': [45.1, -93.4], // Maple Grove area
      '554': [44.95, -93.1], // Minneapolis
      '555': [44.95, -93.1], // Minneapolis
      '556': [47.0, -91.7], // Gooseberry Falls area
      '557': [47.5, -92.5], // Virginia area
      '558': [46.8, -92.1], // Duluth area
      '559': [44.0, -92.5], // Rochester area
      '560': [44.2, -93.9], // Mankato area
      '561': [43.6, -96.0], // Worthington area (border with SD)
      '562': [45.1, -95.0], // Willmar area
      '563': [45.6, -94.2], // St. Cloud area
      '564': [46.4, -94.3], // Brainerd area
      '565': [46.8, -96.8], // Moorhead area
      '566': [47.5, -94.9], // Bemidji area
      '567': [48.6, -96.6], // Thief River Falls area

      // Nebraska
      '680': [41.25, -96.0], // Omaha area
      '681': [41.25, -96.0], // Omaha
      '683': [40.8, -96.7], // Lincoln area
      '684': [40.8, -96.7], // Lincoln
      '685': [40.8, -96.7], // Lincoln
      '686': [41.4, -97.4], // Columbus area
      '687': [42.5, -97.9], // Norfolk area
      '688': [40.7, -99.1], // Kearney area
      '689': [40.6, -98.4], // Hastings area
      '690': [40.2, -101.0], // McCook area
      '691': [41.1, -100.8], // North Platte area
      '692': [40.8, -101.7], // Alliance area
      '693': [41.9, -103.7], // Scottsbluff area

      // South Dakota
      '570': [43.55, -96.73], // Sioux Falls area
      '571': [43.55, -96.73], // Sioux Falls
      '572': [45.46, -98.49], // Aberdeen area
      '573': [44.37, -100.35], // Pierre area
      '574': [45.46, -98.49], // Aberdeen
      '575': [43.72, -99.32], // Winner area (Rosebud Sioux Reservation)
      '576': [45.67, -100.51], // Mobridge area
      '577': [44.08, -103.23], // Rapid City area
      '578': [44.37, -100.35], // Pierre
      '579': [44.37, -100.35], // Pierre
    };

    const coordinates = [];
    let foundZips = 0;

    // Try to get coordinates for each ZIP
    territory.zips.forEach(zipObj => {
      const fullZip = zipObj.zip.toString();
      const zipPrefix = fullZip.substring(0, 3);
      // First check for full 5-digit ZIP, then fall back to 3-digit prefix
      let coords = zipToCoords[fullZip] || zipToCoords[zipPrefix];

      if (coords) {
        coordinates.push(coords);
        foundZips++;
        const matchType = zipToCoords[fullZip] ? 'full ZIP' : 'prefix';
        console.log(`Found coords for ZIP ${zipObj.zip}: [${coords[0]}, ${coords[1]}] (${matchType}: ${zipToCoords[fullZip] ? fullZip : zipPrefix})`);
      } else {
        console.log(`No coords found for ZIP ${zipObj.zip} (prefix: ${zipPrefix}) - estimating from region`);
        // Estimate coordinates based on ZIP code regional patterns
        const estimatedCoords = estimateCoordsFromZip(zipPrefix);
        coordinates.push(estimatedCoords);
        foundZips++;
        console.log(`Estimated coords for ZIP ${zipObj.zip}: [${estimatedCoords[0]}, ${estimatedCoords[1]}]`);
      }
    });

    if (coordinates.length === 0) {
      console.log('No coordinates found for any ZIPs in territory - cannot zoom');
      return;
    }

    // Calculate a more intelligent center - use median instead of mean to avoid outliers
    const sortedLats = coordinates.map(c => c[0]).sort((a, b) => a - b);
    const sortedLngs = coordinates.map(c => c[1]).sort((a, b) => a - b);

    const midIndex = Math.floor(coordinates.length / 2);
    let centerLat = sortedLats[midIndex]; // Use median latitude
    let centerLng = sortedLngs[midIndex]; // Use median longitude

    // If we have many coordinates spread out, try to find a more central location
    if (coordinates.length > 3) {
      // Calculate the range
      const latRange = sortedLats[sortedLats.length - 1] - sortedLats[0];
      const lngRange = sortedLngs[sortedLngs.length - 1] - sortedLngs[0];

      console.log(`Coordinate spread - Lat range: ${latRange.toFixed(2)}°, Lng range: ${lngRange.toFixed(2)}°`);

      // If coordinates are very spread out, use a different approach
      if (latRange > 5 || lngRange > 5) {
        console.log('Coordinates are widely spread, using center of bounding box instead of median');

        // Use center of bounding box for widely spread territories
        const minLat = Math.min(...coordinates.map(c => c[0]));
        const maxLat = Math.max(...coordinates.map(c => c[0]));
        const minLng = Math.min(...coordinates.map(c => c[1]));
        const maxLng = Math.max(...coordinates.map(c => c[1]));

        centerLat = (minLat + maxLat) / 2;
        centerLng = (minLng + maxLng) / 2;

        console.log(`Using bounding box center: [${centerLat}, ${centerLng}]`);
      }
    }

    console.log(`Territory center calculated: [${centerLat}, ${centerLng}] from ${foundZips}/${territory.zips.length} ZIPs`);
    console.log(`All coordinates used:`, coordinates.slice(0, 10)); // Log first 10 to avoid spam
    if (coordinates.length > 10) {
      console.log(`... and ${coordinates.length - 10} more coordinates`);
    }

    // Determine appropriate zoom level based on coordinate spread
    let zoomLevel = 8;
    if (coordinates.length > 0) {
      const latRange = sortedLats[sortedLats.length - 1] - sortedLats[0];
      const lngRange = sortedLngs[sortedLngs.length - 1] - sortedLngs[0];
      const maxRange = Math.max(latRange, lngRange);

      // Adjust zoom based on spread
      if (maxRange < 0.5) zoomLevel = 10;      // Very tight cluster
      else if (maxRange < 1) zoomLevel = 9;    // Moderately tight
      else if (maxRange < 3) zoomLevel = 8;    // Normal spread
      else if (maxRange < 5) zoomLevel = 7;    // Wide spread
      else zoomLevel = 6;                      // Very wide spread

      console.log(`Auto-adjusted zoom level to ${zoomLevel} based on coordinate spread of ${maxRange.toFixed(2)}°`);
    }

    // Zoom to the calculated center
    map.flyTo({
      center: [centerLng, centerLat], // Note: Mapbox uses [lng, lat]
      zoom: zoomLevel,
      duration: 1500
    });

    console.log(`Flying to center: [${centerLng}, ${centerLat}] at zoom ${zoomLevel}`);

    console.log('Zoomed to territory center using improved geocoding fallback');
  }, [mapRef]);

  // Utility functions for mode control
  const enterAddMode = () => {
    setAddMode(true);
    console.log('Entered add mode - clicks will accumulate ZIP selections');
  };

  const exitAddMode = () => {
    setAddMode(false);
    console.log('Exited add mode - clicks will select single ZIPs');
  };

  // Expose methods
  useImperativeHandle(ref, () => ({
    zoomToTerritory,
    enterAddMode,
    exitAddMode,
    isInAddMode: () => !!localAddModeTerritoryIdRef.current,
    geocodeAndZoom,
  }));

  // Handle viewport changes
  const handleViewportChange = useCallback((newViewport) => {
    setViewport(newViewport);
    // No ZIP limit checking needed - zoom levels handle visibility
  }, []);

  console.log('🗺️ MapboxMapContainer rendering, mapLoaded:', mapLoaded);

  // Debug container dimensions (only once, not continuously)
  useEffect(() => {
    const checkDimensions = () => {
      const container = document.querySelector('.map-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        console.log('🗺️ Map container dimensions:', rect.width, 'x', rect.height, 'visible:', rect.width > 0 && rect.height > 0);
      } else {
        console.log('🗺️ Map container not found');
      }
    };

    // Only check once after a delay to let DOM settle
    const timeout = setTimeout(checkDimensions, 1000);

    return () => clearTimeout(timeout);
  }, []); // Empty dependency array - only run once

  const hasValidToken = MAPBOX_ACCESS_TOKEN && MAPBOX_ACCESS_TOKEN !== 'your-mapbox-token-here' && MAPBOX_ACCESS_TOKEN.length > 10;

  if (!hasValidToken) {
    return (
      <div
        className="map-container"
        style={{
          height: '100%',
          width: '100%',
          position: 'relative',
          backgroundColor: '#ffcccc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#cc0000',
          fontSize: '18px',
          fontWeight: 'bold',
          padding: '20px',
          textAlign: 'center'
        }}
      >
        ❌ Invalid Mapbox Access Token
        <br />
        <small style={{ fontSize: '14px', fontWeight: 'normal', marginTop: '10px' }}>
          Please check your VITE_MAPBOX_ACCESS_TOKEN environment variable
        </small>
      </div>
    );
  }

  return (
    <div
      className="map-container"
      style={{
        height: '100%',
        width: '100%',
        position: 'relative',
        backgroundColor: mapLoaded ? 'transparent' : '#f5f5dc' // Tan background while loading
      }}
    >
      {!mapLoaded && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '18px',
          color: '#666',
          zIndex: 1000
        }}>
          Loading map...
        </div>
      )}
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={viewport}
        onMove={handleViewportChange}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          minWidth: '400px'
        }}
        mapStyle="mapbox://styles/mapbox/navigation-guidance-day-v1"
        onLoad={() => {
          console.log('🗺️ Map onLoad callback fired');
          setMapLoaded(true);
          onMapLoad();
        }}
        onError={(e) => {
          console.error('🗺️ Map error:', e);
          setMapLoaded(false);
        }}
        onStyleLoad={() => {
          console.log('🗺️ Map style loaded');
        }}
        onStyleError={(e) => {
          console.error('🗺️ Map style error:', e);
          setMapLoaded(false);
        }}
        onSourceError={(e) => {
          console.error('🗺️ Map source error:', e);
          setMapLoaded(false);
        }}
        onTileError={(e) => {
          console.error('🗺️ Map tile error:', e);
          setMapLoaded(false);
        }}
        interactiveLayerIds={['zip-fills-new']}
      >
        <NavigationControl position="top-right" />

        {/* States layer removed temporarily - causing 404 */}
      </Map>

      {/* Loading indicator */}
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

      {/* ZIP info popup - positioned near click location */}
      {popupInfo && popupInfo.lngLat && mapRef.current && (
        <div
          className="zip-tooltip"
          style={{
            position: "absolute",
            zIndex: 9999,
            left: (() => {
              try {
                const point = mapRef.current.getMap().project([popupInfo.lngLat.lng, popupInfo.lngLat.lat]);
                // Position tooltip above and to the right of the click point
                return Math.max(10, point.x + 10); // Keep it on screen
              } catch (e) {
                console.warn('Error projecting coordinates:', e);
                return 100;
              }
            })(),
            top: (() => {
              try {
                const point = mapRef.current.getMap().project([popupInfo.lngLat.lng, popupInfo.lngLat.lat]);
                // Position tooltip above the click point
                return Math.max(10, point.y - 10); // Keep it on screen
              } catch (e) {
                console.warn('Error projecting coordinates:', e);
                return 100;
              }
            })(),
            background: "white",
            padding: "12px 16px",
            borderRadius: "6px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            fontSize: "13px",
            pointerEvents: "auto",
            zIndex: 1001,
            border: "1px solid #ccc",
            minWidth: "220px",
            maxWidth: "300px",
            transform: "translateY(-100%)" // Move up so it appears above the cursor
          }}
        >
          {popupInfo.loading ? (
            <div>
              <strong>ZIP: {popupInfo.zip}</strong><br/>
              <small>Loading census data...</small>
            </div>
          ) : popupInfo.estimated ? (
            <div>
              <strong>ZIP: {popupInfo.zip}</strong><br/>
              Population: ~{popupInfo.population?.toLocaleString()} <small style={{color: '#666'}}>(est.)</small><br/>
              Detached Homes: ~{popupInfo.standAloneHouses?.toLocaleString()} <small style={{color: '#666'}}>(est.)</small><br/>
              <small style={{color: '#666', fontSize: '0.8em'}}>No census data available</small>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  // Just close tooltip (highlight stays via selectedZips)
                  setPopupInfo(null);
                }}
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666'
                }}
                title="Close tooltip"
              >
                ×
              </button>
              <div style={{color: 'black'}}>
                <strong>ZIP: {popupInfo.zip}</strong><br/>
                Population: {popupInfo.population?.toLocaleString()}<br/>
                Detached Homes: {popupInfo.standAloneHouses?.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Territory hover tooltip */}
      {territoryTooltip && territoryTooltip.lngLat && mapRef.current && (
        <div
          className="territory-tooltip"
          style={{
            position: "absolute",
            left: (() => {
              try {
                const point = mapRef.current.getMap().project([territoryTooltip.lngLat.lng, territoryTooltip.lngLat.lat]);
                return point.x + 15; // Offset to the right of cursor
              } catch (e) {
                console.warn('Error projecting territory tooltip coordinates:', e);
                return 200;
              }
            })(),
            top: (() => {
              try {
                const point = mapRef.current.getMap().project([territoryTooltip.lngLat.lng, territoryTooltip.lngLat.lat]);
                return point.y - 10; // Above the cursor
              } catch (e) {
                console.warn('Error projecting territory tooltip coordinates:', e);
                return 200;
              }
            })(),
            background: "white",
            padding: "10px 14px",
            borderRadius: "6px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            fontSize: "13px",
            pointerEvents: "none", // Don't interfere with map interaction
            zIndex: 1002,
            border: "1px solid #ccc",
            minWidth: "180px",
            transform: "translateY(-100%)"
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {territoryTooltip.territory.name}
          </div>
          <div>Population: {territoryTooltip.stats.population.toLocaleString()}</div>
          <div>Homes: {territoryTooltip.stats.homes.toLocaleString()}</div>
          <div style={{ fontSize: '0.9em', color: '#666', marginTop: '2px' }}>
            {territoryTooltip.stats.zipCount} ZIPs
          </div>
        </div>
      )}

      {/* ZIP count warnings */}
      {selectedZips.size > 500 && (
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            left: "20px",
            background: "rgba(255,193,7,0.9)",
            color: "#000",
            padding: "12px 16px",
            borderRadius: "6px",
            fontSize: "14px",
            maxWidth: "300px",
            zIndex: 1000,
          }}
        >
          ⚠️ High ZIP count ({selectedZips.size}) may impact performance. Consider creating smaller territories.
        </div>
      )}

      {/* ZIP limit warnings removed - using clean zoom-based visibility */}
    </div>
  );
});