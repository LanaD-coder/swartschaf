// Shared CORS helper for all Edge Functions. Every function still verifies the
// caller's JWT internally, so a wide-open origin isn't directly exploitable
// without valid credentials — but there's no reason to leave every browser on
// the internet able to make cross-origin requests to these endpoints. This
// reflects back the request's Origin header only if it's on the allowlist,
// which is the standard secure CORS pattern (dynamic reflection, not a static
// header) — a single hardcoded origin would break local dev/testing, and `*`
// doesn't restrict anything at all.
const ALLOWED_ORIGINS = [
  'http://localhost:8081', // Expo dev server
  'http://localhost:5050', // local production-build testing (npx serve dist)
  'https://swartschaf.de',
  'https://www.swartschaf.de',
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.netlify.app')) return true; // Netlify deploy/preview URLs
  return false;
}

export function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}
