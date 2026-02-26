import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading spinner component displayed when ZIP boundaries are loading
 */
const MapLoadingSpinner = ({ loading }) => {
  if (!loading) return null;

  return (
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
  );
};

export default MapLoadingSpinner;