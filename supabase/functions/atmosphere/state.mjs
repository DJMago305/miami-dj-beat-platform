// state.mjs — builds the AtmosphericState contract from location + time.
// Pure JS (runs in Deno + Node). M1 SKELETON: real astronomy, synthetic weather.
// The real weather provider (M3) replaces SYNTH / buildWeather — nothing else changes.
import { solarPosition, moonPhase, moonPhaseName, fmtLocal, dayTFromLocalHour } from "./astro.mjs";
import { constellations } from "./celestial.mjs";

// synthetic weather for the skeleton; M3 swaps this for a real provider adapter
const SYNTH = { key:"cloudy", label:"Mayormente nublado", cloud:0.55, storm:0, wind:0.35, rain:0, snow:0, fog:0,
  t:91, hum:65, wmph:11, dir:"ESE", vis:6, press:30.08, uv:8, uvl:"Muy Alto", logi:"ok" };

const diurnal = (h, base, sw=7) => Math.round(base + sw*Math.cos((h-15)*Math.PI/12));
const fmtHour = (h) => { h=((Math.round(h)%24)+24)%24; const ap=h<12?"am":"pm"; let x=h%12; if(x===0)x=12; return x+ap; };
const glyphFor = (key,night) => key==="storm"?"⛈️":key==="rain"?"🌧️":key==="snow"?"🌨️":key==="fog"?"🌫️":key==="overcast"?"☁️":key==="cloudy"?(night?"☁️":"⛅"):key==="wind"?(night?"🌬️":"🌤️"):(night?"🌙":"☀️");

export function buildState(lat, lon, tz, now = new Date(), place = null, weather = null) {
  const sun = solarPosition(now, lat, lon);
  const mp  = moonPhase(now);
  const localHour = (((now.getUTCHours() + now.getUTCMinutes()/60) + tz) % 24 + 24) % 24;
  const w = weather || SYNTH;                          // real provider result (M3) or synthetic fallback

  const temp = diurnal(localHour, w.t), hot = temp >= 88;
  const feels = temp + (w.hum>60 && temp>82 ? Math.round((w.hum-55)*0.28 + (temp-82)*0.6) : (temp<60?-3:0));
  const hi = diurnal(15, w.t), lo = diurnal(5, w.t);
  const srH = ((sun.sunriseUTCmin/60 + tz)%24+24)%24, ssH = ((sun.sunsetUTCmin/60 + tz)%24+24)%24;

  const hourly = [];
  for (let i=0;i<6;i++){ const h=localHour+i*3, night=(h%24)<srH||(h%24)>ssH;
    hourly.push({ h:i===0?"Ahora":fmtHour(h), glyph:glyphFor(w.key,night), t:diurnal(h,w.t)+"°" }); }

  return {
    meta: { provider: weather ? "live" : "skeleton-mock", astro:"deterministic-noaa", generatedAt: now.toISOString() },
    location: { name: place || `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon, tz },
    time: {
      dayT: dayTFromLocalHour(localHour), hour: +localHour.toFixed(3),
      sunElev: +sun.sunElevNorm.toFixed(4), azimuthDeg: +sun.azimuthDeg.toFixed(1),
      moonPhase: +mp.toFixed(4), moonPhaseName: moonPhaseName(mp),
      sunrise: fmtLocal(sun.sunriseUTCmin, tz), sunset: fmtLocal(sun.sunsetUTCmin, tz),
    },
    condition: { key:w.key, label:w.label, temp:temp+"°", feels:Math.round(feels)+"°", feelsHot:hot,
                 hi:"Máx: "+hi+"°", lo:"Mín: "+lo+"°" },
    drivers: { cloud:w.cloud, storm:w.storm, wind:w.wind, rain:w.rain, snow:w.snow||0, fog:w.fog },
    metrics: { humidity:w.hum+"%", windMph:w.wmph+" mph", windDir:w.dir, vis:w.vis+" mi",
               pressure:w.press.toFixed(2)+" inHg", uv:String(w.uv), uvLabel:w.uvl, uvHot:w.uv>=6 },
    hourly,
    event: { lead:"Día sin evento en agenda.", start:"Sin horario", end:"Sin horario", buffer:"—",
             loc: place || "—", sunset:"◔ "+fmtLocal(sun.sunsetUTCmin, tz), logi:w.logi },
    // AstronomyEngine · Phase A — real seasonal sky: which constellations are up + where
    sky: { sunAlt: +sun.elevationDeg.toFixed(1), constellations: constellations(now, lat, lon, sun.elevationDeg) },
  };
}

// self-test: node state.mjs
if (typeof process !== 'undefined' && process.argv && import.meta.url === `file://${process.argv[1]}`) {
  const s = buildState(25.91, -80.31, -4, new Date("2026-08-11T20:00:00Z"), "Miami Lakes, FL");
  console.log(JSON.stringify(s, null, 2));
}
