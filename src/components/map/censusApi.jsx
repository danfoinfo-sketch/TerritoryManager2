// src/components/map/censusApi.jsx
const CENSUS_API_KEY = import.meta.env.VITE_CENSUS_API_KEY || '0a85b2c9a4ae36ec7479013358c9002da2149c34'; // Fallback to hardcoded key

// Cache for API results to avoid duplicate calls
export const apiCache = new Map();

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

    // 2022 ACS uses geography "zip code tabulation area" (not "zcta"); try it first
    let response = await fetch(`https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B25024_002E&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_API_KEY}`);

    // If that fails, try 2020 ACS (sometimes different geography support)
    if (!response.ok) {
      console.log(`2022 ACS failed for ${zip}, trying 2020 ACS...`);
      response = await fetch(`https://api.census.gov/data/2020/acs/acs5?get=B01003_001E,B25024_002E&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_API_KEY}`);
    }

    // If that fails, try 2020 Decennial Census
    if (!response.ok) {
      console.log(`2020 ACS failed for ${zip}, trying 2020 Decennial Census...`);
      response = await fetch(`https://api.census.gov/data/2020/dec/pl?get=P1_001N,H1_001N&for=zip%20code%20tabulation%20area:${zip}&key=${CENSUS_API_KEY}`);
    }

    // Last resort: try zcta shorthand (older endpoints)
    if (!response.ok) {
      console.log(`Trying zcta shorthand for ${zip}...`);
      response = await fetch(`https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B25024_002E&for=zcta:${zip}&key=${CENSUS_API_KEY}`);
    }

    if (!response.ok) {
      console.warn(`API returned ${response.status} for ZIP ${zip}`);
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    console.log(`Raw API response for ZIP ${zip}:`, data);

    if (!data || data.length < 2) {
      throw new Error('Invalid API response format');
    }

    // Parse data based on the API response format
    let population, standAloneHouses;

    // Check if this is Decennial Census data (different field names)
    if (data[0].includes('P1_001N')) {
      // 2020 Decennial Census: P1_001N = population, H1_001N = housing units
      population = parseInt(data[1][0]) || 0;
      standAloneHouses = parseInt(data[1][1]) || 0;
      console.log(`Using 2020 Decennial Census data for ZIP ${zip}`);
    } else {
      // ACS data: B01003_001E = population, B25024_002E = detached homes
      population = parseInt(data[1][0]) || 0;
      standAloneHouses = parseInt(data[1][1]) || 0;
      console.log(`Using ACS data for ZIP ${zip}`);
    }

    const result = { population, standAloneHouses };
    console.log(`Parsed data for ZIP ${zip}:`, result);

    // Cache successful results
    apiCache.set(zip, result);
    return result;

  } catch (error) {
    console.error(`Census API failed for ZIP ${zip}:`, error.message);
    throw new Error(`Failed to fetch census data for ZIP ${zip}: ${error.message}`);
  }
};