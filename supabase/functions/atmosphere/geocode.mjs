// geocode.mjs — server-side reverse geocoding (lat/lon -> human place name).
// The key lives ONLY here via env (reuses OPENWEATHER_API_KEY) — it NEVER reaches
// the browser. Returns a display string or null (then buildState falls back to
// "lat, lon"). Pure/isomorphic: runs in Deno (Edge Function) and Node.

const env = (k) => (typeof Deno !== 'undefined' && Deno.env && Deno.env.get(k)) ||
  (typeof process !== 'undefined' && process.env && process.env[k]) || undefined;

// US state name -> USPS abbreviation, so we can render "Miami Lakes, FL".
const US_ST = { Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',
  Connecticut:'CT',Delaware:'DE','District of Columbia':'DC',Florida:'FL',Georgia:'GA',Hawaii:'HI',
  Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',
  Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',
  Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM',
  'New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',
  Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',
  Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',
  Wisconsin:'WI',Wyoming:'WY' };

// Shape a geo record ({name, state, country}) into a display name.
export function formatPlace(g) {
  if (!g || !g.name) return null;
  const city = g.name;
  if (g.country === 'US') {
    const st = US_ST[g.state] || g.state;
    return st ? `${city}, ${st}` : city;
  }
  return g.country ? `${city}, ${g.country}` : city;
}

export async function reverseGeocode(lat, lon) {
  const key = env('OPENWEATHER_API_KEY'); if (!key) return null;
  try {
    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${key}`;
    const r = await fetch(url); if (!r.ok) return null;
    const arr = await r.json();
    return formatPlace(Array.isArray(arr) ? arr[0] : null);
  } catch (_e) { return null; }
}

// self-test: node geocode.mjs
if (typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`) {
  console.log('US:', formatPlace({ name: 'Miami Lakes', state: 'Florida', country: 'US' }));
  console.log('non-US:', formatPlace({ name: 'Berlin', state: 'Berlin', country: 'DE' }));
  console.log('no name:', formatPlace({ country: 'US' }));
  reverseGeocode(25.91, -80.31).then(v => console.log('reverseGeocode (no key -> null):', v));
}
