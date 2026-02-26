// src/components/map/censusApi.jsx
const CENSUS_API_KEY = import.meta.env.VITE_CENSUS_API_KEY || '0a85b2c9a4ae36ec7479013358c9002da2149c34'; // Fallback to hardcoded key

// Cache for API results to avoid duplicate calls
const apiCache = new Map();

export const fetchCountyPopulation = async (stateFips, countyFips) => {
  try {
    const response = await fetch(
      `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E&for=county:${countyFips}&in=state:${stateFips}&key=${CENSUS_API_KEY}`
    );
    const data = await response.json();
    return parseInt(data[1][0]) || 0;
  } catch (error) {
    console.error('Failed to fetch county population:', error);
    return 0;
  }
};

export const fetchStandAloneHouses = async (stateFips, countyFips) => {
  try {
    const response = await fetch(
      `https://api.census.gov/data/2022/acs/acs5?get=B25024_002E&for=county:${countyFips}&in=state:${stateFips}&key=${CENSUS_API_KEY}`
    );
    const data = await response.json();
    return parseInt(data[1][0]) || 0;
  } catch (error) {
    console.error('Failed to fetch stand-alone houses:', error);
    return 0;
  }
};

export const fetchZipPopulationAndHouses = async (zip) => {
  // Check cache first
  if (apiCache.has(zip)) {
    console.log(`Using cached data for ZIP: ${zip}`);
    return apiCache.get(zip);
  }

  // Basic validation - allow ZIP codes that start with 0
  if (!zip || zip.length !== 5 || isNaN(zip)) {
    console.log(`Skipping API for invalid ZIP: ${zip}`);
    throw new Error(`Invalid ZIP code format: ${zip}`);
  }

  try {
    console.log(`Fetching census data for ZIP: ${zip}`);
    // Try multiple Census API endpoints for better coverage
    let response;
    let apiSuccess = false;

    // Try ZCTA first (most specific)
    try {
      response = await fetch(`https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B25024_002E&for=zcta:${zip}&key=${CENSUS_API_KEY}`);
      if (response.ok) {
        apiSuccess = true;
      }
    } catch (e) {
      console.log(`ZCTA failed for ${zip}, trying alternatives...`);
    }

    // If ZCTA fails, try ZIP Code Tabulation Area
    if (!apiSuccess) {
      try {
        response = await fetch(`https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B25024_002E&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_API_KEY}`);
        if (response.ok) {
          apiSuccess = true;
        }
      } catch (e) {
        console.log(`ZIP Code Tabulation Area failed for ${zip}`);
      }
    }

    // If both fail, try to get county-level data for the ZIP's area
    if (!apiSuccess) {
      console.log(`No direct ZIP data available for ${zip}, census data may not exist for this area`);
      throw new Error(`ZIP code ${zip} not found in Census database`);
    }

    const data = await response.json();
    console.log(`Raw API response for ZIP ${zip}:`, data);

    if (!data || data.length < 2) {
      throw new Error('Invalid API response format');
    }

    const population = parseInt(data[1][0]) || 0;
    const standAloneHouses = parseInt(data[1][1]) || 0;

    const result = { population, standAloneHouses };
    console.log(`Parsed data for ZIP ${zip}:`, result);

    // Cache successful results
    apiCache.set(zip, result);
    return result;

  } catch (error) {
    console.error(`Census API failed for ZIP ${zip}:`, error.message);

    // Provide more helpful error messages
    if (error.message.includes('ZIP code') && error.message.includes('not found')) {
      throw new Error(`ZIP code ${zip} is not in the Census database. This often happens for rural or newly created ZIP codes.`);
    } else if (error.message.includes('400')) {
      throw new Error(`ZIP code ${zip} data not available. The Census Bureau doesn't maintain data for all ZIP codes.`);
    } else {
      throw new Error(`Failed to fetch census data for ZIP ${zip}: ${error.message}`);
    }
  }
};