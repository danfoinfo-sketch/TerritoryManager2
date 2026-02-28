import { useLayoutEffect, useRef } from 'react';

export function useMapInitialization(mapRef, mapContainerRef, setMapInitialized) {
  const resizeObserverRef = useRef(null);

  const forceResize = (map, label) => {
    if (map) {
      const containerRect = mapContainerRef.current?.getBoundingClientRect();
      const computedStyle = mapContainerRef.current ? getComputedStyle(mapContainerRef.current) : null;
      console.log(`🗺️ ${label} - container rect:`, containerRect?.width, 'x', containerRect?.height);
      console.log(`🗺️ ${label} - computed style:`, computedStyle?.height, computedStyle?.width);
      console.log(`🗺️ ${label} - map canvas before:`, map.getCanvas().width, 'x', map.getCanvas().height);

      map.resize();

      console.log(`🗺️ ${label} - map canvas after:`, map.getCanvas().width, 'x', map.getCanvas().height);
      console.log(`🗺️ ${label} - map bounds:`, map.getBounds());
    }
  };

  // Aggressive map resize timing fix with ResizeObserver
  useLayoutEffect(() => {
    const trySetInitialized = () => {
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        if (map) {
          forceResize(map, 'Initial resize (immediate)');
          setMapInitialized(true);
        }
      }
    };

    // First resize after layout (map ref may not exist yet)
    const t1 = setTimeout(trySetInitialized, 50);

    // Second resize with longer delay
    const t2 = setTimeout(() => {
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        forceResize(map, 'Second resize (300ms)');
        setMapInitialized(true);
      }
    }, 300);

    // Third resize as safety net
    const t3 = setTimeout(() => {
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        forceResize(map, 'Third resize (600ms)');
        setMapInitialized(true);
      }
    }, 600);

    // Set up ResizeObserver - also mark initialized when container is observed so we recover if timeouts missed
    if (mapContainerRef.current && 'ResizeObserver' in window) {
      resizeObserverRef.current = new window.ResizeObserver(() => {
        if (mapRef.current) {
          const map = mapRef.current.getMap();
          forceResize(map, 'ResizeObserver triggered');
          setMapInitialized(true);
        }
      });
      resizeObserverRef.current.observe(mapContainerRef.current);
    }

    const handleWindowResize = () => {
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        forceResize(map, 'Window resize');
        setMapInitialized(true);
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', handleWindowResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [setMapInitialized]);

  return { forceResize };
}