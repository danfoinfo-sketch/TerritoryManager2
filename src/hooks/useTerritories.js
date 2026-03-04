import { useState, useCallback } from 'react';

const TERRITORY_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#f43f5e", "#22c55e", "#3b82f6", "#a855f7",
];

export function useTerritories(mapContainerRef) {
  // Territory state
  const [territories, setTerritories] = useState([]);
  const [activeTerritoryId, setActiveTerritoryId] = useState(null);
  const [addModeTerritoryId, setAddModeTerritoryId] = useState(null);

  // Territory management functions
  const createNewTerritory = useCallback(() => {
    console.log('Creating new territory. Current territories:', territories.map(t => ({ id: t.id, name: t.name })));
    const name = `Territory ${territories.length + 1}`;
    const territoryId = Date.now().toString();
    console.log('Creating new territory with ID:', territoryId, 'name:', name);
    const newTerritory = {
      id: territoryId,
      name,
      color: TERRITORY_COLORS[territories.length % TERRITORY_COLORS.length],
      zips: [],
    };
    const newTerritories = [...territories, newTerritory];
    console.log('New territories array:', newTerritories.map(t => ({ id: t.id, name: t.name, zips: t.zips.length })));
    setTerritories(newTerritories);
    setActiveTerritoryId(newTerritory.id);
    console.log('Set active territory to:', newTerritory.id);
    // Don't auto-enter add mode - user must click "Add ZIPs"
  }, [territories]);

  const handleUpdateTerritory = useCallback((id, name, color, zips) => {
    setTerritories(territories.map(t => t.id === id ? { ...t, name, color, zips: zips || t.zips } : t));
  }, [territories]);

  const handleDeleteTerritory = useCallback((id) => {
    setTerritories(territories.filter(t => t.id !== id));
    if (activeTerritoryId === id) setActiveTerritoryId(null);
    if (addModeTerritoryId === id) setAddModeTerritoryId(null);
  }, [territories, activeTerritoryId, addModeTerritoryId]);

  const handleSelectTerritory = useCallback((id) => {
    setActiveTerritoryId(id);
    if (mapContainerRef.current) {
      mapContainerRef.current.zoomToTerritory(id);
    }
  }, [mapContainerRef]);

  const handleSetAddModeTerritoryId = useCallback((value) => {
    console.log('🚨 useTerritories setAddModeTerritoryId called with:', value, 'previous value:', addModeTerritoryId, 'stack trace:', new Error().stack);
    setAddModeTerritoryId(value);
  }, [addModeTerritoryId]);

  const handleToggleTerritoryVisibility = useCallback((id) => {
    setTerritories(territories.map(t => t.id === id ? { ...t, visible: !t.visible } : t));
  }, [territories]);

  const addZipToActiveTerritory = useCallback((zip, population, homes, territoryId = null, updateExisting = false) => {
    const targetTerritoryId = territoryId || addModeTerritoryId;
    const zipStr = String(zip ?? '');
    console.log('🛠️ addZipToActiveTerritory function called with', zipStr, population, homes, 'targetTerritoryId:', targetTerritoryId, 'addModeTerritoryId:', addModeTerritoryId);
    if (!targetTerritoryId) {
      console.log('🛠️ No targetTerritoryId set, returning');
      return { action: 'none' };
    }
    console.log('🛠️ Adding ZIP to territory', targetTerritoryId);

    let actionTaken = 'none';

    setTerritories(prevTerritories => {
      console.log('🛠️ setTerritories called with prevTerritories:', prevTerritories.map(t => ({ id: t.id, name: t.name, zips: t.zips.length })));

      // Check if territory exists in current state
      const territoryExists = prevTerritories.some(t => t.id === targetTerritoryId);
      console.log('🛠️ Territory exists in current state:', territoryExists, 'territories length:', prevTerritories.length);

      if (!territoryExists) {
        console.log('🛠️ ERROR: Territory not found in current state!', targetTerritoryId);
        return prevTerritories; // Return unchanged state
      }

      return prevTerritories.map(t =>
        t.id === targetTerritoryId
          ? (() => {
              const existingIndex = t.zips.findIndex(z => String(z.zip) === zipStr);
            if (existingIndex === -1) {
              // ZIP not in territory - add it
              console.log('🛠️ Adding ZIP', zipStr, 'to territory', t.name);
              actionTaken = 'added';
              return { ...t, zips: [...t.zips, { zip: zipStr, pop: population, standAloneHouses: homes }] };
            } else if (updateExisting) {
              // ZIP exists and we're updating data - update it
              console.log('🛠️ Updating ZIP', zipStr, 'data in territory', t.name, 'population:', population, 'homes:', homes);
              actionTaken = 'updated';
              const newZips = [...t.zips];
              newZips[existingIndex] = { zip: zipStr, pop: population, standAloneHouses: homes };
              return { ...t, zips: newZips };
            } else {
              // ZIP exists: toggle remove (works in both add mode and normal mode)
              console.log('🛠️ Removing ZIP', zipStr, 'from territory', t.name);
              actionTaken = 'removed';
              const newZips = [...t.zips];
              newZips.splice(existingIndex, 1);
              return { ...t, zips: newZips };
            }
            })()
          : t
      );
    });

    return { action: actionTaken };
  }, [addModeTerritoryId]);

  const clearTerritories = useCallback(() => {
    setTerritories([]);
    setActiveTerritoryId(null);
    setAddModeTerritoryId(null);
  }, []);

  const getTerritoryStats = useCallback((territory) => {
    const zipPop = territory.zips.reduce((sum, z) => sum + (z.pop || 0), 0);
    const zipHouses = territory.zips.reduce((sum, z) => sum + (z.standAloneHouses || 0), 0);
    return {
      population: zipPop,
      standAloneHouses: zipHouses,
      zipCount: territory.zips.length,
    };
  }, []);

  return {
    // State
    territories,
    activeTerritoryId,
    addModeTerritoryId,

    // Actions
    createNewTerritory,
    handleUpdateTerritory,
    handleDeleteTerritory,
    handleSelectTerritory,
    handleSetAddModeTerritoryId,
    handleToggleTerritoryVisibility,
    addZipToActiveTerritory,
    clearTerritories,
    getTerritoryStats,

    // State setters (for compatibility)
    setTerritories,
    setActiveTerritoryId,
    setAddModeTerritoryId
  };
}