#!/usr/bin/env node
// web/scripts/reorganize-lighting-videos.mjs — mueve (rename real, sin
// descargar/re-subir bytes) los 2 videos de Moving Heads y Pantalla LED
// dentro del bucket "assets" de Supabase Storage, para que la carpeta real
// de Storage quede igual que la separación de categorías que ya existe en
// el sitio (lighting-dj.html vs led-screens-dj.html) y en la base de datos
// (columna `categoria` de service_catalog, migración 20260929020000).
//
// CONTEXTO (PO 2026-09-29): "necesitamos trabajar limpio dentro del depósito
// y dentro de Supabase, todo debe estar igual en ambas partes" -- hoy
// Special_Effects/Moving_Head_Lights.mp4 y Special_Effects/pantalla_LED.mp4
// viven mezclados con los videos de efectos especiales de verdad (humo,
// confetti, CO2, etc.), aunque ya NO comparten página ni categoría.
//
// Solo mueve estos 2 -- los demás videos de Special_Effects (Bubble_Haze,
// CO2, Dancin_Cloud, Led_Dance_Floor, Smoke_Machine, SNOW_MACHINE,
// SPARKULAR, Stadium_Confetti_Blowers, Iluminacion) SÍ son de efectos
// especiales de verdad y se quedan donde están -- reorganizarlos a todos
// es un trabajo más grande, aparte.
//
// ⚠️ Requiere la SERVICE ROLE KEY (nunca la anon/publishable) -- por eso
// este hilo de Claude no lo corre: la clave de servicio no debe pasar por
// esta sesión. Corre este script TÚ MISMO, desde tu propia terminal:
//
//   npm install @supabase/supabase-js   (una sola vez, si no lo tienes)
//   SUPABASE_SERVICE_ROLE_KEY=<tu clave real> node web/scripts/reorganize-lighting-videos.mjs --dry-run
//   SUPABASE_SERVICE_ROLE_KEY=<tu clave real> node web/scripts/reorganize-lighting-videos.mjs
//
// --dry-run → solo lista qué haría, cero movimientos reales.
//
// DESPUÉS de correrlo sin --dry-run, avisa -- este PR ya deja el HTML
// (lighting-dj.html, led-screens-dj.html) y rentals.js apuntando a las
// rutas NUEVAS (lighting/Moving_Head_Lights.mp4,
// led-screens/pantalla_LED.mp4), así que el video no se verá hasta que
// termines de correr esto.

const SUPABASE_URL = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const BUCKET = "assets";
const DRY_RUN = process.argv.includes("--dry-run");

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY_RUN && !SERVICE_ROLE_KEY) {
  console.error("[ERROR] Falta SUPABASE_SERVICE_ROLE_KEY. Corre con:\n  SUPABASE_SERVICE_ROLE_KEY=<tu clave real> node web/scripts/reorganize-lighting-videos.mjs");
  process.exit(1);
}

const MOVES = [
  { from: "Special_Effects/Moving_Head_Lights.mp4", to: "lighting/Moving_Head_Lights.mp4" },
  { from: "Special_Effects/pantalla_LED.mp4", to: "led-screens/pantalla_LED.mp4" },
];

async function main() {
  console.log(`MODE: ${DRY_RUN ? "DRY-RUN (nada se mueve)" : "REAL"}`);
  console.log(`Bucket: ${BUCKET} — ${MOVES.length} archivo(s) a mover:\n`);
  MOVES.forEach((m, i) => console.log(`  ${i + 1}. ${m.from}  ->  ${m.to}`));

  if (DRY_RUN) {
    console.log(`\nRESUMEN: --dry-run — ${MOVES.length} archivo(s) se moverían. CERO cambios reales.`);
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let ok = 0;
  let fail = 0;
  const failed = [];

  for (let i = 0; i < MOVES.length; i++) {
    const { from, to } = MOVES[i];
    const tag = `[${i + 1}/${MOVES.length}] ${from} -> ${to}`;
    try {
      const { error } = await supabase.storage.from(BUCKET).move(from, to);
      if (error) throw error;
      console.log(`✓ ${tag}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${tag} — ${e && e.message ? e.message : e}`);
      failed.push(from);
      fail++;
    }
  }

  console.log(`\nRESUMEN: ${ok} movido(s), ${fail} fallido(s).`);
  if (failed.length) console.log("Fallidos:", failed.join(", "));
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
