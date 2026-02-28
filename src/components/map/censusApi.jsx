// src/components/map/censusApi.jsx
// On the live site, use the same-origin proxy (/api/census-zip) to avoid Census API referrer/CORS issues.
// Set CENSUS_API_KEY in your host's env (e.g. Vercel) for the proxy. For direct calls, set VITE_CENSUS_API_KEY
// and add your production domain to the key's Allowed Referrers at https://api.census.gov/data/key_signup.html
const CENSUS_API_KEY = import.meta.env.VITE_CENSUS_API_KEY || '';
const USE_PROXY = import.meta.env.VITE_USE_CENSUS_PROXY !== 'false'; // use proxy by default in production
// Dev fallback so localhost works without .env (do not rely on this for production)
const DEV_FALLBACK_KEY = import.meta.env.DEV ? '0a85b2c9a4ae36ec7479013358c9002da2149c34' : '';
const KEY = CENSUS_API_KEY || DEV_FALLBACK_KEY;

function getProxyUrl(zip) {
  if (typeof window === 'undefined') return null;
  const base = import.meta.env.VITE_CENSUS_PROXY_URL || '';
  const path = base ? `${base.replace(/\/$/, '')}/census-zip` : '/api/census-zip';
  return `${path}?zip=${encodeURIComponent(zip)}`;
}

// Cache for API results to avoid duplicate calls
export const apiCache = new Map();

export const fetchCountyPopulation = async (stateFips, countyFips) => {
  try {
    const response = await fetch(
      `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E&for=county:${countyFips}&in=state:${stateFips}&key=${KEY}`
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
      `https://api.census.gov/data/2022/acs/acs5?get=B25024_002E&for=county:${countyFips}&in=state:${stateFips}&key=${KEY}`
    );
    const data = await response.json();
    return parseInt(data[1][0]) || 0;
  } catch (error) {
    console.error('Failed to fetch stand-alone houses:', error);
    return 0;
  }
};

export const fetchZipPopulationAndHouses = async (zip) => {
  if (apiCache.has(zip)) {
    return apiCache.get(zip);
  }

  if (!zip || zip.length !== 5 || isNaN(zip)) {
    throw new Error(`Invalid ZIP code format: ${zip}`);
  }

  const proxyUrl = getProxyUrl(zip);

  // Try same-origin proxy first (fixes population on live site when Census blocks by referrer)
  if (typeof window !== 'undefined' && USE_PROXY && proxyUrl) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const result = await res.json();
        apiCache.set(zip, result);
        return result;
      }
      if (res.status === 404 || res.status === 502 || res.status === 503) {
        console.warn(`Census proxy returned ${res.status} for ZIP ${zip}, falling back to direct call`);
      }
    } catch (proxyErr) {
      console.warn('Census proxy failed, falling back to direct call:', proxyErr.message);
    }
  }

  // Direct Census API call (requires key and allowed referrer for production domain)
  if (!KEY) {
    const msg = 'VITE_CENSUS_API_KEY not set. Set it in .env or use the /api/census-zip proxy with CENSUS_API_KEY on your server.';
    console.warn(msg);
    throw new Error(msg);
  }

  try {
    let response = await fetch(`https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B25024_002E&for=zip%20code%20tabulation%20area:${zip}&key=${KEY}`);

    // If that fails, try 2020 ACS (sometimes different geography support)
    if (!response.ok) {
      console.log(`2022 ACS failed for ${zip}, trying 2020 ACS...`);
      response = await fetch(`https://api.census.gov/data/2020/acs/acs5?get=B01003_001E,B25024_002E&for=zip%20code%20tabulation%20area:${zip}&key=${KEY}`);
    }

    // If that fails, try 2020 Decennial Census
    if (!response.ok) {
      console.log(`2020 ACS failed for ${zip}, trying 2020 Decennial Census...`);
      response = await fetch(`https://api.census.gov/data/2020/dec/pl?get=P1_001N,H1_001N&for=zip%20code%20tabulation%20area:${zip}&key=${KEY}`);
    }

    // Last resort: try zcta shorthand (older endpoints)
    if (!response.ok) {
      console.log(`Trying zcta shorthand for ${zip}...`);
      response = await fetch(`https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B25024_002E&for=zcta:${zip}&key=${KEY}`);
    }

    if (!response.ok) {
      if (response.status === 403) {
        console.warn(
          'Census API 403: Add your live site domain to the API key Allowed Referrers at https://api.census.gov/data/key_signup.html, or use the /api/census-zip proxy with CENSUS_API_KEY set on your server.'
        );
      }
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