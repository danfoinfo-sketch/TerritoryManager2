/**
 * Map overlay components: ZIP popup, territory tooltip, invalid token message, warnings.
 */

import React from 'react';

export function MapInvalidTokenMessage() {
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

export function ZipInfoPopup({ popupInfo, mapRef, onClose }) {
  if (!popupInfo || !popupInfo.lngLat || !mapRef?.current) return null;

  const map = mapRef.current.getMap();
  let left = 100;
  let top = 100;
  try {
    const point = map.project([popupInfo.lngLat.lng, popupInfo.lngLat.lat]);
    left = Math.max(10, point.x + 10);
    top = Math.max(10, point.y - 10);
  } catch (e) {
    console.warn('Error projecting coordinates:', e);
  }

  return (
    <div
      className="zip-tooltip"
      style={{
        position: 'absolute',
        zIndex: 9999,
        left,
        top,
        background: 'white',
        padding: '12px 16px',
        borderRadius: '6px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        fontSize: '13px',
        pointerEvents: 'auto',
        border: '1px solid #ccc',
        minWidth: '220px',
        maxWidth: '300px',
        transform: 'translateY(-100%)'
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
          Population: ~{popupInfo.population?.toLocaleString()} <small style={{ color: '#666' }}>(est.)</small><br/>
          Detached Homes: ~{popupInfo.standAloneHouses?.toLocaleString()} <small style={{ color: '#666' }}>(est.)</small><br/>
          <small style={{ color: '#666', fontSize: '0.8em' }}>No census data available</small>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={onClose}
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
          <div style={{ color: 'black' }}>
            <strong>ZIP: {popupInfo.zip}</strong><br/>
            Population: {popupInfo.population?.toLocaleString()}<br/>
            Detached Homes: {popupInfo.standAloneHouses?.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

export function TerritoryHoverTooltip({ territoryTooltip, mapRef }) {
  if (!territoryTooltip || !territoryTooltip.lngLat || !mapRef?.current) return null;

  const map = mapRef.current.getMap();
  let left = 200;
  let top = 200;
  try {
    const point = map.project([territoryTooltip.lngLat.lng, territoryTooltip.lngLat.lat]);
    left = point.x + 15;
    top = point.y - 10;
  } catch (e) {
    console.warn('Error projecting territory tooltip coordinates:', e);
  }

  return (
    <div
      className="territory-tooltip"
      style={{
        position: 'absolute',
        left,
        top,
        background: 'white',
        padding: '10px 14px',
        borderRadius: '6px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        fontSize: '13px',
        pointerEvents: 'none',
        zIndex: 1002,
        border: '1px solid #ccc',
        minWidth: '180px',
        transform: 'translateY(-100%)'
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
  );
}

export function ZipCountWarning({ selectedZipsCount }) {
  if (selectedZipsCount <= 500) return null;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'rgba(255,193,7,0.9)',
        color: '#000',
        padding: '12px 16px',
        borderRadius: '6px',
        fontSize: '14px',
        maxWidth: '300px',
        zIndex: 1000
      }}
    >
      ⚠️ High ZIP count ({selectedZipsCount}) may impact performance. Consider creating smaller territories.
    </div>
  );
}
