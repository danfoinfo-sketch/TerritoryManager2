# Population data on the live site

Population (and detached homes) comes from the Census Bureau API. It can fail on the **live site** if:

1. **Referrer restriction** – Your Census API key’s “Allowed Referrers” doesn’t include your production domain, so the browser request gets 403.
2. **No API key in build** – `VITE_CENSUS_API_KEY` isn’t set in your deployment environment, so the app has no key for direct calls.

## Fix: use the proxy (recommended)

The repo includes a **same-origin proxy** so the browser never talks to Census directly. That avoids referrer/CORS issues.

### Vercel

1. Deploy as usual (the `api/` folder is deployed as serverless functions).
2. In the project: **Settings → Environment Variables** add:
   - **Name:** `CENSUS_API_KEY`
   - **Value:** your Census API key (from https://api.census.gov/data/key_signup.html)
3. Redeploy. The app will call `/api/census-zip?zip=...` and the function will call Census with `CENSUS_API_KEY`.

### Other hosts (Netlify, etc.)

- **Option A:** Use a serverless function that calls Census and expose it at something like `https://your-site.com/api/census-zip`. Set `VITE_CENSUS_PROXY_URL=https://your-site.com/api` in your build env so the app uses that URL.
- **Option B:** Set `VITE_CENSUS_API_KEY` in your build environment and add your **production domain** to the key’s “Allowed Referrers” at https://api.census.gov/data/key_signup.html.

## Env reference

See `.env.example`. Summary:

- **VITE_CENSUS_API_KEY** – Used for direct Census calls (and as dev fallback). Set in build env for production if you’re not using the proxy.
- **VITE_USE_CENSUS_PROXY** – Set to `"false"` to disable the proxy and always call Census directly (default is use proxy when available).
- **VITE_CENSUS_PROXY_URL** – Override proxy base URL if it’s not at `/api` (e.g. Netlify function URL).
