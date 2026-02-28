import { useState, useRef } from 'react';

export function useMapState() {
  // Map loading and initialization state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);

  // Popup and tooltip state
  const [popupInfo, setPopupInfo] = useState(null);
  const [territoryTooltip, setTerritoryTooltip] = useState(null);
  const [selectedTerritoryPopup, setSelectedTerritoryPopup] = useState(null);

  // ZIP selection and interaction state
  const [selectedZips, setSelectedZips] = useState([]);
  const [hoveredZip, setHoveredZip] = useState(null);
  const [tooltipZip, setTooltipZip] = useState(null);

  // Processing state for ZIP operations
  const [loadingZips, setLoadingZips] = useState(false);
  const [isProcessingZip, setIsProcessingZip] = useState(false);
  const processingZipsRef = useRef(new Set());

  return {
    // Map state
    mapLoaded,
    setMapLoaded,
    mapInitialized,
    setMapInitialized,

    // Popup/tooltip state
    popupInfo,
    setPopupInfo,
    territoryTooltip,
    setTerritoryTooltip,
    selectedTerritoryPopup,
    setSelectedTerritoryPopup,

    // ZIP interaction state
    selectedZips,
    setSelectedZips,
    hoveredZip,
    setHoveredZip,
    tooltipZip,
    setTooltipZip,

    // Processing state
    loadingZips,
    setLoadingZips,
    isProcessingZip,
    setIsProcessingZip,
    processingZipsRef
  };
}