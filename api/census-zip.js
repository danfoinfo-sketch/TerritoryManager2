/**
 * Vercel serverless proxy for Census Bureau API.
 * Use this on the live site so population requests are same-origin (no CORS/referrer issues).
 *
 * Set CENSUS_API_KEY in Vercel Project Settings → Environment Variables.
 * Request: GET /api/census-zip?zip=12345
 * Response: { population, standAloneHouses }
 */
const CENSUS_API_KEY = process.env.CENSUS_API_KEY || process.env.VITE_CENSUS_API_KEY;

const CENSUS_URLS = [
  (z) => `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B25024_002E&for=zip%20code%20tabulation%20area:${z}&key=${CENSUS_API_KEY}`,
  (z) => `https://api.census.gov/data/2020/acs/acs5?get=B01003_001E,B25024_002E&for=zip%20code%20tabulation%20area:${z}&key=${CENSUS_API_KEY}`,
  (z) => `https://api.census.gov/data/2020/dec/pl?get=P1_001N,H1_001N&for=zip%20code%20tabulation%20area:${z}&key=${CENSUS_API_KEY}`,
  (z) => `https://api.census.gov/data/2022/acs/acs5?get=B01003_001E,B25024_002E&for=zcta:${z}&key=${CENSUS_API_KEY}`,
];

async function fetchFromCensus(zip) {
  for (const urlFn of CENSUS_URLS) {
    const res = await fetch(urlFn(zip));
    if (!res.ok) continue;
    const data = await res.json();
    if (!data || data.length < 2) continue;
    if (data[0].includes('P1_001N')) {
      return { population: parseInt(data[1][0]) || 0, standAloneHouses: parseInt(data[1][1]) || 0 };
    }
    return { population: parseInt(data[1][0]) || 0, standAloneHouses: parseInt(data[1][1]) || 0 };
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const zip = req.query.zip;
  if (!zip || zip.length !== 5 || isNaN(zip)) {
    return res.status(400).json({ error: 'Invalid zip' });
  }

  if (!CENSUS_API_KEY) {
    console.error('CENSUS_API_KEY not set in server environment');
    return res.status(503).json({ error: 'Census API not configured' });
  }

  try {
    const result = await fetchFromCensus(zip);
    if (result) return res.status(200).json(result);
    return res.status(404).json({ error: 'No data for this ZIP' });
  } catch (e) {
    console.error('Census proxy error:', e.message);
    return res.status(502).json({ error: e.message || 'Census request failed' });
  }
}
