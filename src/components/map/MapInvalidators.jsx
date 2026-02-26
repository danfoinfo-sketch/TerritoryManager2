import React, { useEffect } from "react";
import { useMap } from "react-leaflet";

// Map center and zoom constants
export const US_CENTER = [39.8283, -98.5795];
export const US_ZOOM = 4;

/**
 * Component that invalidates map size on various triggers to ensure proper rendering
 */
export function MapInvalidator() {
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

/**
 * Component that invalidates map size when data changes
 */
export function DataChangeInvalidator({ savedZones }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(timer);
  }, [savedZones, map]);
  return null;
}