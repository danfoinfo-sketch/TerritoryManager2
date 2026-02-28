import { useCallback } from 'react';
import { MAPBOX_CONFIG } from '../config/mapboxConfig';

const { VECTOR_SOURCE_ID, VECTOR_SOURCE_URL, VECTOR_SOURCE_LAYER, ZIP_PROPERTY, MIN_ZOOM_ZIP_VISIBLE } = MAPBOX_CONFIG;

export function useMapLayers(mapRef, territories, activeTerritoryId, addModeTerritoryId, handleZipClick, findTerritoryByZip, calculateTerritoryStats, setTerritoryTooltip, setSelectedZips, setActiveTerritoryId, localAddModeTerritoryIdRef, ZIP_PROPERTY) {
  // Function to hide default Mapbox boundary layers (but keep state boundaries)
  const hideDefaultBoundaries = useCallback(() => {
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();
    const allLayers = map.getStyle().layers;

    console.log('🗺️ hideDefaultBoundaries called, checking all layers... Total layers:', allLayers.length);

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
        map.setLayoutProperty(layer.id, 'visibility', 'none');
        console.log('🗺️ HIDING boundary layer:', layer.id, 'type:', layer.type);
      } else if (layer.id.includes('admin') || layer.id.includes('state')) {
        // Ensure state boundaries are visible
        if (map.getLayer(layer.id)) {
          map.setLayoutProperty(layer.id, 'visibility', 'visible');
          console.log('🗺️ KEEPING boundary layer:', layer.id, 'type:', layer.type);
        }
      }
    });

    // Final pass: ensuring state boundaries are visible
    console.log('🗺️ Final pass: ensuring state boundaries are visible');
    const finalAdminLayers = allLayers.filter(layer =>
      (layer.id.includes('admin') || layer.id.includes('state')) &&
      !layer.id.includes('admin-1-boundary') &&
      !layer.id.includes('admin-1-boundary-bg')
    );

    finalAdminLayers.forEach(layer => {
      if (map.getLayer(layer.id)) {
        map.setLayoutProperty(layer.id, 'visibility', 'visible');
        console.log('🗺️ FINAL: Set visibility=visible for:', layer.id);
      }
    });

    console.log('🗺️ Found boundary/state layers:', finalAdminLayers.map(l => l.id));
  }, []);

  // Function to add ZIP layers and territory layers
  const addZipLayers = useCallback(() => {
    if (!mapRef.current) return;

    const map = mapRef.current.getMap();

    // Remove any existing ZIP sources/layers first
    if (map.getSource(VECTOR_SOURCE_ID)) {
      console.log('🗺️ Removing existing ZIP source');
      map.removeSource(VECTOR_SOURCE_ID);
    }
    ['zip-fills-new', 'zip-outlines-new', 'zip-highlight', 'zip-border', 'territory-perimeter', 'territory-mask'].forEach(layerId => {
      if (map.getLayer(layerId)) {
        console.log('🗺️ Removing existing layer:', layerId);
        map.removeLayer(layerId);
      }
    });

    // Add vector source for ZIP codes
    console.log('🗺️ Adding ZIP vector source:', VECTOR_SOURCE_ID, 'from:', VECTOR_SOURCE_URL);
    map.addSource(VECTOR_SOURCE_ID, {
      type: 'vector',
      url: VECTOR_SOURCE_URL
    });

    // Wait for source to load before adding layers
    map.on('sourcedata', (e) => {
      if (e.sourceId !== VECTOR_SOURCE_ID || !e.isSourceLoaded) return;
      // Only run once: layers already exist if zip-fills-new is present
      if (map.getLayer('zip-fills-new')) {
        return;
      }
        console.log('🗺️ ZIP tileset loaded successfully!');
        console.log('📋 Available source layers:', Object.keys(map.getSource(VECTOR_SOURCE_ID).vectorLayerIds || {}));

        // Add ZIP fill layer (only visible when zoomed in)
        map.addLayer({
          id: 'zip-fills-new',
          type: 'fill',
          source: VECTOR_SOURCE_ID,
          'source-layer': VECTOR_SOURCE_LAYER,
          minzoom: MIN_ZOOM_ZIP_VISIBLE,
          paint: {
            'fill-color': '#888',
            'fill-opacity': 0.3
          }
        });

        // Add ZIP highlight layer for selected territories
        const allSelectedZips = territories
          .filter(t => t.id === activeTerritoryId || t.id === addModeTerritoryId)
          .flatMap(t => t.zips || [])
          .map(zipObj => String(zipObj.zip ?? zipObj));

        console.log('🗺️ Adding territory layers for selected ZIPs:', allSelectedZips);

        map.addLayer({
          id: 'zip-highlight',
          type: 'fill',
          source: VECTOR_SOURCE_ID,
          'source-layer': VECTOR_SOURCE_LAYER,
          filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', allSelectedZips]],
          paint: {
            'fill-color': '#00ff00',
            'fill-opacity': 0.5
          }
        }, 'zip-fills-new');

        // Add territory mask fill layer (covers internal lines)
        console.log('🗺️ Adding territory-mask layer');
        map.addLayer({
          id: 'territory-mask',
          type: 'fill',
          source: VECTOR_SOURCE_ID,
          'source-layer': VECTOR_SOURCE_LAYER,
          filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', allSelectedZips]],
          paint: {
            'fill-color': '#ffffff',
            'fill-opacity': 0.8
          }
        }, 'zip-highlight');

        // Add ZIP outline layer (excludes selected ZIPs)
        console.log('🗺️ Adding zip-outlines-new layer');
        map.addLayer({
          id: 'zip-outlines-new',
          type: 'line',
          source: VECTOR_SOURCE_ID,
          'source-layer': VECTOR_SOURCE_LAYER,
          filter: ['!', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', allSelectedZips]]],
          minzoom: MIN_ZOOM_ZIP_VISIBLE,
          paint: {
            'line-color': '#666',
            'line-width': [
              'interpolate', ['linear'], ['zoom'],
              MIN_ZOOM_ZIP_VISIBLE, 0.24,
              10, 1.2,
              14, 2.4,
              16, 3.6
            ]
          }
        }, 'zip-highlight');

        // Add territory perimeter (outer boundary)
        map.addLayer({
          id: 'territory-perimeter',
          type: 'line',
          source: VECTOR_SOURCE_ID,
          'source-layer': VECTOR_SOURCE_LAYER,
          filter: ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', allSelectedZips]],
          paint: {
            'line-color': '#000000',
            'line-width': 3.6,
            'line-opacity': 0.8
          }
        }, 'zip-highlight');

        console.log('✅ ZIP layers re-added, selectedZips restored:', allSelectedZips);

        // Ensure only one click handler: remove any existing then add (sourcedata can fire multiple times)
        map.off('click', 'zip-fills-new');
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
          console.log('Map click - features:', clickedFeatures?.length || 0, 'addModeTerritoryId:', currentAddModeId, 'shiftKey:', e.originalEvent.shiftKey);
          if ((!clickedFeatures || clickedFeatures.length === 0) && !currentAddModeId && !e.originalEvent.shiftKey) {
            console.log('Background click - clearing all ZIP selections and active territory');
            setSelectedZips([]);
            // Also clear the active territory selection
            setActiveTerritoryId(null);

            // Clear all territory layer filters
            const layersToClear = ['zip-highlight', 'zip-border', 'territory-mask', 'territory-perimeter'];
            layersToClear.forEach(layerId => {
              if (map.getLayer(layerId)) {
                map.setFilter(layerId, ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', []]]);
              }
            });

            // Update zip-outlines-new filter (clear all selections - show all lines)
            if (map.getLayer('zip-outlines-new')) {
              map.setFilter('zip-outlines-new', null);
              map.setPaintProperty('zip-outlines-new', 'line-opacity', 0.8);
              map.setLayoutProperty('zip-outlines-new', 'visibility', 'visible');
              console.log('Line layer filter/opacity applied — selected ZIPs excluded:', []);
            }

            console.log('Mask & outline updates applied - cleared all selections');
            map.triggerRepaint();
          }
        });

        // Add zoom change listener
        map.on('zoomend', () => {
          const zoom = map.getZoom();
          console.log('Zoom changed to:', zoom, '- ZIP layers visible?', zoom >= 7 && zoom <= 16);
        });

        console.log('🎉 Mapbox vector tiles initialized! Layers should now be visible.');
    });
  }, [territories, activeTerritoryId, addModeTerritoryId, handleZipClick, findTerritoryByZip, calculateTerritoryStats, setTerritoryTooltip, setSelectedZips, setActiveTerritoryId, localAddModeTerritoryIdRef, ZIP_PROPERTY]);

  return {
    hideDefaultBoundaries,
    addZipLayers
  };
}