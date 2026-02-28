/**
 * Map event handlers: ZIP click, hover, leave, viewport change.
 * Used by MapboxMapContainer; handleZipClick is passed to useMapLayers.
 */

import { useCallback } from 'react';
import { fetchZipPopulationAndHouses, apiCache } from '../components/map/censusApi';
import { MAPBOX_CONFIG } from '../config/mapboxConfig';

const { ZIP_PROPERTY } = MAPBOX_CONFIG;

export function useMapEventHandlers({
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
}) {
  const handleZipClick = useCallback(async (e) => {
    const zipCode = e.features[0].properties[ZIP_PROPERTY];
    const zipStr = zipCode != null ? String(zipCode) : '';
    if (!zipStr) return;
    console.log('🖱️ ZIP click detected:', zipStr, 'localAddModeTerritoryId:', localAddModeTerritoryIdRef.current);

    if (isProcessingZip) {
      console.log('🖱️ ZIP processing in progress, ignoring click');
      return;
    }
    if (processingZipsRef.current.has(zipStr)) {
      console.log('🖱️ ZIP already being processed, ignoring:', zipStr);
      return;
    }

    processingZipsRef.current.add(zipStr);
    setIsProcessingZip(true);

    try {
      console.log('🖱️ Adding ZIP immediately with placeholder data:', zipStr);
      addZipToActiveTerritory(zipStr, 0, 0, localAddModeTerritoryIdRef.current);

      fetchZipPopulationAndHouses(zipStr).then(censusData => {
        console.log('🖱️ Got real census data asynchronously:', zipStr, censusData);
        addZipToActiveTerritory(zipStr, censusData.population, censusData.standAloneHouses, localAddModeTerritoryIdRef.current, true);
        setPopupInfo(currentPopup => {
          if (currentPopup && currentPopup.zip === zipStr) {
            return { ...currentPopup, population: censusData.population, standAloneHouses: censusData.standAloneHouses, estimated: false, loading: false };
          }
          return currentPopup;
        });
      }).catch(() => {
        setPopupInfo(currentPopup => {
          if (currentPopup && currentPopup.zip === zipStr) {
            return { ...currentPopup, population: 0, standAloneHouses: 0, estimated: true, loading: false };
          }
          return currentPopup;
        });
      });

      if (localAddModeTerritoryIdRef.current) {
        setPopupInfo({ zip: zipStr, lngLat: e.lngLat, population: 0, standAloneHouses: 0, estimated: true });
      }

      if (!localAddModeTerritoryIdRef.current) {
        const normalizedZipCode = zipStr;
        setSelectedZips([zipStr]);
        setPopupInfo({ zip: zipStr, lngLat: e.lngLat, population: 0, standAloneHouses: 0, estimated: true, loading: true });

        if (mapRef.current) {
          const map = mapRef.current.getMap();
          if (map.getLayer('zip-highlight')) {
            map.setFilter('zip-highlight', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', [normalizedZipCode]]]);
            map.triggerRepaint();
            if (map.getLayer('zip-border')) map.setFilter('zip-border', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', [normalizedZipCode]]]);
            if (map.getLayer('territory-mask')) map.setFilter('territory-mask', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', [normalizedZipCode]]]);
            if (map.getLayer('territory-perimeter')) {
              map.setFilter('territory-perimeter', ['in', ['to-string', ['get', ZIP_PROPERTY]], ['literal', [normalizedZipCode]]]);
              map.triggerRepaint();
            }
            if (map.getLayer('zip-outlines-new')) {
            map.setFilter('zip-outlines-new', ['!', ['in', ['to-string', ['get', 'ZCTA5CE20']], ['literal', [normalizedZipCode]]]]);
            map.setPaintProperty('zip-outlines-new', 'line-opacity', ['case', ['in', ['to-string', ['get', 'ZCTA5CE20']], ['literal', [normalizedZipCode]]], 0.0, 0.8]);
              map.triggerRepaint();
            }
            map.triggerRepaint();
          }
        }
      } else {
        const cachedData = apiCache.get(zipStr);
        setPopupInfo({
          zip: zipStr,
          lngLat: e.lngLat,
          population: cachedData?.population || 0,
          standAloneHouses: cachedData?.standAloneHouses || 0,
          estimated: cachedData?.estimated || false,
          loading: !cachedData
        });
      }
    } catch (error) {
      console.error('Failed to add ZIP:', error);
    } finally {
      processingZipsRef.current.delete(zipStr);
      setIsProcessingZip(false);
    }
  }, [addZipToActiveTerritory, isProcessingZip, setIsProcessingZip, setPopupInfo, setSelectedZips]);

  const handleZipHover = useCallback((e) => {
    const zipCode = e.features[0].properties[ZIP_PROPERTY];
    setHoveredZip(zipCode);
    if (mapRef.current) {
      mapRef.current.getMap().getCanvas().style.cursor = 'pointer';
    }
  }, [setHoveredZip]);

  const handleZipLeave = useCallback(() => {
    setHoveredZip(null);
    if (mapRef.current) {
      mapRef.current.getMap().getCanvas().style.cursor = '';
    }
  }, [setHoveredZip]);

  const handleViewportChange = useCallback((newViewport) => {
    setViewport(newViewport);
  }, [setViewport]);

  return {
    handleZipClick,
    handleZipHover,
    handleZipLeave,
    handleViewportChange
  };
}
