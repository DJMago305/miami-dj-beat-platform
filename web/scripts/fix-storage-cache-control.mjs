#!/usr/bin/env node
// web/scripts/fix-storage-cache-control.mjs — arregla el Cache-Control real de
// los videos en Supabase Storage (bucket "assets").
//
// CONTEXTO (docs/tickets/2026-09-27-URGENTE-costos-supabase-vercel-sobre-cuota.md,
// Caso 1): el egress cacheado de Supabase superó la cuota (correo del
// 2026-09-21, límite real 22-oct-2026). Diagnosticado con dos rondas de
// investigación: la primera (2026-09-22) editó el metadata de
// `storage.objects` directo por SQL/CLI — la columna quedó bien ("max-age=3600"),
// pero el endpoint público SIGUE sirviendo "cache-control: no-cache" en cada
// petición, confirmado hoy (2026-09-28) con curl real: 3 peticiones GET
// idénticas seguidas, las 3 transfirieron el archivo COMPLETO (52MB), cero
// ahorro. Según la documentación oficial de Supabase (Smart CDN, plan Pro —
// que esta cuenta ya tiene, activado automáticamente): "You can still control
// how long assets are stored in the browser using the cacheControl option
// WHEN UPLOADING a file" — es decir, el cacheControl real que ve el
// navegador se fija en el momento de subir/re-subir el archivo, vía el SDK o
// la API de Storage; NO se puede parchear después editando solo la fila de
// `storage.objects` por SQL. Por eso el intento anterior no funcionó.
//
// ESTE script re-sube cada video EN EL MISMO PATH (upsert:true) con
// cacheControl correcto, usando el SDK oficial (evita adivinar el mecanismo
// exacto del header crudo por HTTP). No cambia el contenido del video (baja
// los bytes actuales del propio endpoint público y los vuelve a subir tal
// cual) — solo corrige el header de caché real.
//
// ⚠️ Requiere la SERVICE ROLE KEY (nunca la anon/publishable) — por eso este
// hilo de Claude no lo corre: la clave de servicio no debe pasar por esta
// sesión. Corre este script TÚ MISMO, desde tu propia terminal:
//
//   npm install @supabase/supabase-js   (una sola vez, si no lo tienes)
//   SUPABASE_SERVICE_ROLE_KEY=<tu clave real> node web/scripts/fix-storage-cache-control.mjs --dry-run
//   SUPABASE_SERVICE_ROLE_KEY=<tu clave real> node web/scripts/fix-storage-cache-control.mjs
//
// --dry-run → solo lista qué haría, cero descargas/subidas. Sin --dry-run,
// SÍ descarga y re-sube de verdad (con upsert, revierte el contenido a
// ser byte-idéntico al actual — nunca lo cambia).
//
// La documentación de Supabase también advierte: "We do advise against
// overwriting files when possible, as the CDN will take some time to
// propagate the changes" (hasta 60s por archivo) — aceptable para una
// corrida única, no algo que se repita seguido.

// Import perezoso de @supabase/supabase-js (más abajo, dentro de main(), solo
// si NO es --dry-run) — así --dry-run corre siempre, incluso sin haber hecho
// `npm install` todavía, para poder probar la lista/lógica sin esa dependencia.

const SUPABASE_URL = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const BUCKET = "assets";
const NEW_CACHE_CONTROL = "604800"; // 1 semana — son videos de marketing estáticos, no cambian seguido.
const DRY_RUN = process.argv.includes("--dry-run");

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY_RUN && !SERVICE_ROLE_KEY) {
  console.error("[ERROR] Falta SUPABASE_SERVICE_ROLE_KEY. Corre con:\n  SUPABASE_SERVICE_ROLE_KEY=<tu clave real> node web/scripts/fix-storage-cache-control.mjs");
  process.exit(1);
}

// Lista exacta de los 99 videos reales (bucket "assets"), extraída de
// storage.objects el 2026-09-28 — todos con metadata cacheControl="max-age=3600"
// que el endpoint público ignora hoy. Si se sube un video nuevo después de
// esta lista, este script no lo toca (no hace daño, solo no lo incluye) —
// re-generar la lista con la consulta SQL del ticket si hace falta correrlo
// de nuevo más adelante.
const PATHS = [
  "audio/audio-mixer.mp4", "audio/dj-monitor.mp4", "audio/pa-large.mp4", "audio/pa-medium.mp4", "audio/pa-small.mp4", "audio/wireless-mic.mp4",
  "branding/intro-loader/miami-dj-beat-intro-enganche.mp4",
  "capture-visuals/drone.mp4", "capture-visuals/Espejo_Magico.mp4", "capture-visuals/Photo_Video_Booth_360.mp4", "capture-visuals/photo.mp4", "capture-visuals/video.mp4",
  "club-dj/videos/club-dj-hero.mp4",
  "corporate/videos/corporate-gala-hero.mp4", "corporate/videos/porsche-north-miami-hero.mp4",
  "DJ_Performance/seasonal_specials.mp4", "DJ_Performance/weddings_quinces.mp4",
  "DJMago IA/djmago-idle-boomerang.mp4", "DJMago IA/elixis_cazador.mp4",
  "eventos-venues-patrocinadores/reels/Baila_Con_Micho.mp4", "eventos-venues-patrocinadores/reels/Ebenezer_Family_Farm.mp4", "eventos-venues-patrocinadores/reels/El_Valle_Restaurante.mp4", "eventos-venues-patrocinadores/reels/Fashion_Show.mp4", "eventos-venues-patrocinadores/reels/Mojitos_calle_8.mp4", "eventos-venues-patrocinadores/reels/Sundowners_Key_Largo.mp4",
  "eventos-venues-patrocinadores/Venues Home/events-hero-optimized.mp4", "eventos-venues-patrocinadores/Venues Home/Venues_Home-Vidz.mp4",
  "festival-dj/videos/festival-stage-hero.mp4",
  "florida-keys/videos/sundowners-key-largo.mp4",
  "furniture-decor/backdrops.mp4", "furniture-decor/chairs.mp4", "furniture-decor/cocktail-tables.mp4", "furniture-decor/dining-tables.mp4", "furniture-decor/floral-decor.mp4", "furniture-decor/led-furniture.mp4", "furniture-decor/linens.mp4", "furniture-decor/tables.mp4",
  "home/Home for Miami DJ Beat.mp4",
  "hora-loca/hora-loca-brasil.mp4", "hora-loca/hora-loca-character.mp4", "hora-loca/hora-loca-cubana.mp4", "hora-loca/hora-loca-hadas.mp4", "hora-loca/hora-loca-hero.mp4", "hora-loca/hora-loca-robot.mp4",
  "inflatables/basic-castle.mp4", "inflatables/big-castle.mp4", "inflatables/lite-castle.mp4",
  "Jobs/Jobs Miami DJ Beat.mp4",
  "knowledge/Vinyl Loop for DJ Academy MDJB.mp4",
  "latin-dj/videos/clubs-nightlife-hero.mp4",
  "live-music/Live_Bandas_&_Orquestas .mp4", "live-music/live-percussion.mp4", "live-music/live-sax.mp4", "live-music/live-singer.mp4",
  "mc-club-host/mc-club-host.mp4", "mc-club-host/MC.mp4",
  "mc-dj/videos/mc-host-hero.mp4",
  "mdj-payasos/circo.mp4", "mdj-payasos/pallasos-gif.mp4", "mdj-payasos/Santaclous_Para_christmas.mp4", "mdj-payasos/show-de-pallasos.mp4",
  "mdj-staff-videos/Bartender.mp4", "mdj-staff-videos/Cheff.mp4", "mdj-staff-videos/Meseros.mp4",
  "private-family-dj/videos/family-events-hero.mp4", "private-family-dj/videos/private-parties-hero.mp4",
  "quinceanera/videos/quince-vals-clip-respaldo-vertical-blurpad.mp4", "quinceanera/videos/quince-vals-clip.mp4", "quinceanera/videos/quinceanera-hero.mp4",
  "seasonal-parties/halloween/halloween-hero.mp4", "seasonal-parties/halloween/halloween-party-full.mp4", "seasonal-parties/seasonal-specials-rooftop.mp4",
  "Special_Effects/Bubble_Haze.mp4", "Special_Effects/CO2.mp4", "Special_Effects/Dancin_Cloud.mp4", "Special_Effects/Iluminacion.mp4", "Special_Effects/Led_Dance_Floor.mp4", "Special_Effects/Moving_Head_Lights.mp4", "Special_Effects/pantalla_LED.mp4", "Special_Effects/Smoke_Machine.mp4", "Special_Effects/SNOW_MACHINE.mp4", "Special_Effects/SPARKULAR.mp4", "Special_Effects/Stadium_Confetti_Blowers.mp4",
  "Tent & Event Structures/full-box-truss.mp4", "Tent & Event Structures/goal-post-truss.mp4", "Tent & Event Structures/stage-large.mp4", "Tent & Event Structures/stage-medium.mp4", "Tent & Event Structures/stage-small.mp4", "Tent & Event Structures/ultra-truss-system.mp4",
  "tents/carpas-ac.mp4", "tents/carpas-main.mp4", "tents/carpas-white.mp4",
  "weddings/videos/weddings-hero.mp4",
];

function publicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;
}

async function main() {
  console.log(`MODE: ${DRY_RUN ? "DRY-RUN (nada se descarga ni se sube)" : "REAL"}`);
  console.log(`Bucket: ${BUCKET} — ${PATHS.length} archivos — cacheControl nuevo: ${NEW_CACHE_CONTROL} (1 semana)\n`);

  if (DRY_RUN) {
    PATHS.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    console.log(`\nRESUMEN: --dry-run — ${PATHS.length} archivo(s) se re-subirían. CERO descargas/subidas reales.`);
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ok = 0;
  let fail = 0;
  const failed = [];

  for (let i = 0; i < PATHS.length; i++) {
    const path = PATHS[i];
    const tag = `[${i + 1}/${PATHS.length}] ${path}`;
    try {
      const res = await fetch(publicUrl(path));
      if (!res.ok) throw new Error(`descarga falló: ${res.status}`);
      const blob = await res.blob();

      const { error } = await supabase.storage.from(BUCKET).update(path, blob, {
        cacheControl: NEW_CACHE_CONTROL,
        upsert: true,
        contentType: "video/mp4",
      });
      if (error) throw error;

      console.log(`✓ ${tag} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
      ok++;
    } catch (e) {
      console.error(`✗ ${tag} — ${e && e.message ? e.message : e}`);
      failed.push(path);
      fail++;
    }
    // Pausa corta entre archivos — nada de saturar el endpoint con 99 subidas seguidas.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nRESUMEN: ${ok} corregido(s), ${fail} fallido(s).`);
  if (failed.length) {
    console.log("Fallidos (revisar y reintentar solo estos):");
    failed.forEach((p) => console.log(`  - ${p}`));
  }
  console.log("\nNota: el CDN puede tardar hasta 60s por archivo en propagar el cambio a todos los centros de datos.");
}

main().catch((e) => {
  console.error(`[ERROR] ${e && e.message ? e.message : e}`);
  process.exit(1);
});
