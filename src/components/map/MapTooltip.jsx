import React from 'react';

export function ZipPopupTooltip({ popupInfo, setPopupInfo, mapRef }) {
  if (!popupInfo || !popupInfo.lngLat) {
    return null;
  }

  const { lngLat, zip, population, standAloneHouses, estimated, loading, error } = popupInfo;

  return (
    <div
      className="zip-tooltip"
      style={{
        position: 'absolute',
        zIndex: 9999,
        left: (() => {
          try {
            const point = mapRef.current.getMap().project([lngLat.lng, lngLat.lat]);
            return Math.max(10, point.x + 10);
          } catch (e) {
            console.warn('Error projecting coordinates:', e);
            return 100;
          }
        })(),
        top: (() => {
          try {
            const point = mapRef.current.getMap().project([lngLat.lng, lngLat.lat]);
            return Math.max(10, point.y - 10);
          } catch (e) {
            console.warn('Error projecting coordinates:', e);
            return 100;
          }
        })(),
        background: 'white',
        padding: '12px 16px',
        borderRadius: '6px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        fontSize: '13px',
        pointerEvents: 'auto',
        maxWidth: '200px',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        ZIP Code: {zip}
      </div>

      {loading ? (
        <div style={{ color: '#666', fontStyle: 'italic' }}>
          Loading data...
        </div>
      ) : error ? (
        <div style={{ color: '#d32f2f' }}>
          Error loading data
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '4px' }}>
            <strong>Population:</strong> {population || 'N/A'}
            {estimated && <span style={{ fontSize: '11px', color: '#666' }}> (est.)</span>}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Homes:</strong> {standAloneHouses || 'N/A'}
            {estimated && <span style={{ fontSize: '11px', color: '#666' }}> (est.)</span>}
          </div>
          <button
            onClick={() => setPopupInfo(null)}
            style={{
              background: '#f5f5f5',
              border: '1px solid #ddd',
              borderRadius: '3px',
              padding: '4px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              float: 'right'
            }}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}

export function TerritoryTooltip({ territoryTooltip, mapRef }) {
  if (!territoryTooltip) {
    return null;
  }

  const { territory, stats, lngLat } = territoryTooltip;

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 9999,
        left: (() => {
          try {
            const point = mapRef.current.getMap().project([lngLat.lng, lngLat.lat]);
            return Math.max(10, point.x + 10);
          } catch (e) {
            return 100;
          }
        })(),
        top: (() => {
          try {
            const point = mapRef.current.getMap().project([lngLat.lng, lngLat.lat]);
            return Math.max(10, point.y - 10);
          } catch (e) {
            return 100;
          }
        })(),
        background: 'white',
        padding: '12px 16px',
        borderRadius: '6px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        fontSize: '13px',
        maxWidth: '250px',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        {territory.name}
      </div>
      <div style={{ marginBottom: '4px' }}>
        <strong>ZIP Codes:</strong> {stats.zipCount}
      </div>
      <div style={{ marginBottom: '4px' }}>
        <strong>Population:</strong> {stats.population?.toLocaleString() || 'N/A'}
      </div>
      <div>
        <strong>Homes:</strong> {stats.homes?.toLocaleString() || 'N/A'}
      </div>
    </div>
  );
}