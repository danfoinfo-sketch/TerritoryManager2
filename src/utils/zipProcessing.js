// Find territory containing a ZIP
export function findTerritoryByZip(zipCode, territories) {
  return territories.find(territory =>
    territory.zips.some(zipObj => zipObj.zip === zipCode)
  );
}

// Calculate territory stats
export function calculateTerritoryStats(territory) {
  const totalPopulation = territory.zips.reduce((sum, zipObj) => sum + (zipObj.pop || 0), 0);
  const totalHomes = territory.zips.reduce((sum, zipObj) => sum + (zipObj.standAloneHouses || 0), 0);
  return {
    population: totalPopulation,
    homes: totalHomes,
    zipCount: territory.zips.length
  };
}

// Check if vector source is loaded
export function isVectorSourceLoaded(map) {
  try {
    const source = map.getSource('zip-codes-vector');
    if (!source) {
      console.log('🔍 Vector source not found');
      return false;
    }

    // Check if source has loaded tiles
    const sourceCache = source._source && source._source._tileCache;
    if (!sourceCache) {
      console.log('🔍 Vector source cache not available');
      return false;
    }

    // Check if we have any loaded tiles
    const loadedTiles = Object.keys(sourceCache._tiles || {});
    console.log('🔍 Vector source has', loadedTiles.length, 'loaded tiles');

    return loadedTiles.length > 0;
  } catch (error) {
    console.error('🔍 Error checking source loaded state:', error);
    return false;
  }
}

// Wait for vector source to load
export function waitForVectorSource(map, timeout = 5000) {
  return new Promise((resolve) => {
    if (isVectorSourceLoaded(map)) {
      console.log('🔍 Vector source already loaded');
      resolve(true);
      return;
    }

    console.log('🔍 Waiting for vector source to load...');

    const checkLoaded = () => {
      if (isVectorSourceLoaded(map)) {
        console.log('🔍 Vector source loaded successfully');
        resolve(true);
        return;
      }

      // Continue waiting
      setTimeout(checkLoaded, 100);
    };

    // Start checking
    checkLoaded();

    // Timeout fallback
    setTimeout(() => {
      console.log('🔍 Vector source load timeout, proceeding with fallback');
      resolve(false);
    }, timeout);
  });
}