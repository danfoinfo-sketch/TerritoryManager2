import React from 'react';
import { Loader2 } from 'lucide-react';

export function MapLoadingOverlay({ mapInitialized, mapLoaded }) {
  if (mapInitialized && mapLoaded) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '18px',
        color: '#666',
        zIndex: 1000,
        textAlign: 'center'
      }}
    >
      {!mapInitialized ? 'Initializing map...' : 'Loading map...'}
    </div>
  );
}

// Legacy loading component for ZIP operations
export function ZipLoadingOverlay({ loadingZips }) {
  if (!loadingZips) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(255,255,255,0.9)',
        padding: '16px 24px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      <span>Loading ZIP boundaries...</span>
    </div>
  );
}