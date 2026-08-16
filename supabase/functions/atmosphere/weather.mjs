// weather.mjs — pluggable REAL weather providers (M3).
// Pick with env WEATHER_PROVIDER = 'openweather' | 'weatherkit' | '' (synthetic).
// ALL keys/credentials live ONLY here via env — they NEVER reach the browser.
// Returns a normalized condition (same shape as SYNTH); on any failure -> SYNTH.

export const SYNTH = { key:'cloudy', label:'Mayormente nublado', cloud:0.55, storm:0, wind:0.35, rain:0, snow:0, fog:0,
  t:91, hum:65, wmph:11, dir:'ESE', vis:6, press:30.08, uv:8, uvl:'Muy Alto', logi:'ok' };

const env = (k) => (typeof Deno !== 'undefined' && Deno.env && Deno.env.get(k)) ||
  (typeof process !== 'undefined' && process.env && process.env[k]) || undefined;

const cToF = (c) => c * 9 / 5 + 32;
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const degToDir = (d) => ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((d%360)+360)%360/22.5)%16];
const uvLabel = (u) => u>=11?'Extremo':u>=8?'Muy Alto':u>=6?'Alto':u>=3?'Moderado':'Bajo';
const logiFor = (dr) => dr.storm>0.5?'alert':(dr.rain>0||dr.fog>0.4||dr.wind>0.8?'watch':'ok');

// ===================== OpenWeather =====================
export async function openWeather(lat, lon){
  const key = env('OPENWEATHER_API_KEY'); if(!key) throw new Error('no OPENWEATHER_API_KEY');
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&lang=es&appid=${key}`;
  const r = await fetch(url); if(!r.ok) throw new Error('openweather '+r.status);
  return mapOpenWeather(await r.json());
}
export function mapOpenWeather(d){
  const id = d.weather?.[0]?.id ?? 800;
  const dr = owmDrivers(id);
  return { ...dr, label: cap(d.weather?.[0]?.description) || dr.label,
    t: Math.round(d.main?.temp ?? 80), hum: Math.round(d.main?.humidity ?? 60),
    wmph: Math.round(d.wind?.speed ?? 0), dir: degToDir(d.wind?.deg ?? 0),
    vis: +(((d.visibility ?? 16000)/1609.34).toFixed(1)),
    press: +((d.main?.pressure ?? 1013)*0.02953).toFixed(2),   // hPa -> inHg
    uv: 0, uvl: '—',                                           // UV needs One Call v3
    logi: logiFor(dr) };
}
// OpenWeather condition id -> shader drivers (0..1)  https://openweathermap.org/weather-conditions
function owmDrivers(id){
  if(id>=200 && id<300) return {key:'storm',    cloud:1.00, storm:0.9,  wind:0.75, rain:1.0, snow:0.0, fog:0.18};
  if((id>=300&&id<400)||(id>=500&&id<600)){ const heavy=id>=502;
                        return {key:'rain',     cloud:0.90, storm:0.15, wind:0.45, rain:heavy?0.9:0.6, snow:0.0, fog:0.14}; }
  if(id>=600 && id<700){ const heavy=id>=602;
                        return {key:'snow',     cloud:0.92, storm:0.0,  wind:0.30, rain:0.0, snow:heavy?0.95:0.7, fog:0.20}; }
  if(id>=700 && id<800) return {key:'fog',      cloud:0.40, storm:0.0,  wind:0.10, rain:0.0, snow:0.0, fog:0.72};
  if(id===800)          return {key:'clear',    cloud:0.10, storm:0.0,  wind:0.20, rain:0.0, snow:0.0, fog:0.0};
  if(id===801||id===802)return {key:'cloudy',   cloud:0.50, storm:0.0,  wind:0.35, rain:0.0, snow:0.0, fog:0.0};
  return                       {key:'overcast', cloud:0.92, storm:0.0,  wind:0.40, rain:0.0, snow:0.0, fog:0.0};    // 803, 804
}

// ===================== Apple WeatherKit =====================
export async function weatherKit(lat, lon){
  const teamId=env('WEATHERKIT_TEAM_ID'), keyId=env('WEATHERKIT_KEY_ID'),
        serviceId=env('WEATHERKIT_SERVICE_ID'), p8=env('WEATHERKIT_PRIVATE_KEY');
  if(!teamId||!keyId||!serviceId||!p8) throw new Error('missing WeatherKit env');
  const jwt = await weatherKitJWT(teamId, keyId, serviceId, p8);
  const url = `https://weatherkit.apple.com/api/v1/weather/es/${lat}/${lon}?dataSets=currentWeather`;
  const r = await fetch(url, { headers: { Authorization: 'Bearer '+jwt } });
  if(!r.ok) throw new Error('weatherkit '+r.status);
  return mapWeatherKit((await r.json()).currentWeather || {});
}
export function mapWeatherKit(cw){
  const dr = wkDrivers(cw.conditionCode ?? 'Clear');
  return { ...dr, t: Math.round(cToF(cw.temperature ?? 27)), hum: Math.round((cw.humidity ?? 0.6)*100),
    wmph: Math.round((cw.windSpeed ?? 0)*0.621371), dir: degToDir(cw.windDirection ?? 0),
    vis: +(((cw.visibility ?? 16000)/1609.34).toFixed(1)),
    press: +((cw.pressure ?? 1013)*0.02953).toFixed(2),
    uv: cw.uvIndex ?? 0, uvl: uvLabel(cw.uvIndex ?? 0), logi: logiFor(dr) };
}
// WeatherKit conditionCode -> drivers  https://developer.apple.com/documentation/weatherkit/weathercondition
function wkDrivers(c){ c=String(c);
  if(/Thunderstorm|Tornado|Hurricane|TropicalStorm/i.test(c)) return {key:'storm',    label:'Tormenta',              cloud:1.00, storm:0.9, wind:0.75, rain:1.0, fog:0.18};
  if(/Rain|Drizzle|Showers/i.test(c))                         return {key:'rain',     label:'Lluvia',                cloud:0.90, storm:0.15,wind:0.45, rain:0.7, fog:0.14};
  if(/Blizzard|HeavySnow/i.test(c))                           return {key:'snow',     label:'Nevada intensa',        cloud:0.95, storm:0.0, wind:0.55, rain:0.0, snow:0.95, fog:0.22};
  if(/Snow|Sleet|Flurries|Wintry|Hail|Ice/i.test(c))         return {key:'snow',     label:'Nieve',                 cloud:0.92, storm:0.0, wind:0.30, rain:0.0, snow:0.7,  fog:0.20};
  if(/Fog|Haze|Smoke/i.test(c))                               return {key:'fog',      label:'Niebla',                cloud:0.40, storm:0.0, wind:0.10, rain:0.0, fog:0.72};
  if(/PartlyCloudy|MostlyClear/i.test(c))                     return {key:'cloudy',   label:'Parcialmente nublado',  cloud:0.45, storm:0.0, wind:0.35, rain:0.0, fog:0.0};
  if(/MostlyCloudy|Cloudy/i.test(c))                          return {key:'overcast', label:'Cubierto',              cloud:0.92, storm:0.0, wind:0.40, rain:0.0, fog:0.0};
  if(/Windy|Breezy|Blustery/i.test(c))                        return {key:'wind',     label:'Ventoso',               cloud:0.45, storm:0.0, wind:1.0,  rain:0.0, fog:0.0};
  return                                                             {key:'clear',    label:'Despejado',             cloud:0.10, storm:0.0, wind:0.20, rain:0.0, fog:0.0};
}
// WeatherKit JWT (ES256), signed with the .p8 via WebCrypto (works in Deno + Node 18+)
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
function pemToDer(pem){ const b=pem.replace(/-----[^-]+-----/g,'').replace(/\s/g,''); const bin=atob(b); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i); return u.buffer; }
export async function weatherKitJWT(teamId, keyId, serviceId, p8){
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(p8), {name:'ECDSA', namedCurve:'P-256'}, false, ['sign']);
  const now = Math.floor(Date.now()/1000);
  const header  = { alg:'ES256', kid:keyId, id:`${teamId}.${serviceId}`, typ:'JWT' };
  const payload = { iss:teamId, iat:now, exp:now+3600, sub:serviceId };
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const sig = await crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64url(sig)}`;
}

// ===================== dispatcher =====================
export async function fetchWeather(lat, lon){
  const provider = (env('WEATHER_PROVIDER')||'').toLowerCase();
  try {
    if(provider==='openweather') return await openWeather(lat, lon);
    if(provider==='weatherkit')  return await weatherKit(lat, lon);
  } catch (_e) { /* fall through */ }
  return null;                                    // no provider configured / failure -> buildState uses its SYNTH (meta.provider = 'skeleton-mock')
}
