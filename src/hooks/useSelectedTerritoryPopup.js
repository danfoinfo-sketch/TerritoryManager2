/**
 * Manages the imperative mapboxgl.Popup for the selected territory.
 */

import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

export function useSelectedTerritoryPopup({
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
}) {
  useEffect(() => {
    (async () => {
      if (localAddModeTerritoryIdRef.current || !mapLoaded || !mapRef.current) return;

      const map = mapRef.current.getMap();
      if (selectedTerritoryPopup) {
        selectedTerritoryPopup.remove();
        setSelectedTerritoryPopup(null);
      }
      setPopupInfo(null);

      if (!activeTerritoryId) return;

      const territory = territories.find(t => String(t.id) === String(activeTerritoryId));
      if (!territory || territory.zips.length === 0) return;

      const stats = calculateTerritoryStats(territory);
      const firstZip = territory.zips[0].zip;
      const geocodeResult = await geocodeAndZoom(firstZip);
      let centerLng, centerLat;
      if (geocodeResult?.center) {
        [centerLng, centerLat] = geocodeResult.center;
      } else {
        const mapCenter = map.getCenter();
        centerLng = mapCenter.lng;
        centerLat = mapCenter.lat;
      }

      const popupHtml = `
        <div style="font-weight: bold; margin-bottom: 4px; color: #000;">${territory.name}</div>
        <div style="color: #000;">Population: ${stats.population.toLocaleString()}</div>
        <div style="color: #000;">Homes: ${stats.homes.toLocaleString()}</div>
        <div style="font-size: 0.9em; color: #666;">${stats.zipCount} ZIPs</div>
      `;

      try {
        const popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: false, className: 'territory-selected-popup', offset: [15, 15] })
          .setLngLat([centerLng, centerLat])
          .setHTML(popupHtml)
          .addTo(map);

        const popupElement = popup.getElement();
        if (popupElement) {
          let isDragging = false;
          let dragStartX = 0, dragStartY = 0;
          let popupStartLngLat = [centerLng, centerLat];

          popupElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            popupStartLngLat = popup.getLngLat().toArray();
            popupElement.style.cursor = 'grabbing';
            e.preventDefault();
            e.stopPropagation();
          });

          const handleMouseMove = (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            const currentPoint = map.project(popupStartLngLat);
            const newPoint = [currentPoint.x + deltaX, currentPoint.y + deltaY];
            popup.setLngLat(map.unproject(newPoint));
          };

          const handleMouseUp = () => {
            if (isDragging) {
              isDragging = false;
              if (popup.getElement()) popup.getElement().style.cursor = 'default';
            }
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
          popup.on('close', () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          });
        }

        setSelectedTerritoryPopup(popup);
      } catch (error) {
        console.error('Error creating selected territory popup:', error);
      }
    })();
  }, [activeTerritoryId, territories, mapLoaded]);
}
