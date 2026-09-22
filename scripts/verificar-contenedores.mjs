#!/usr/bin/env node
// Verificación de CONTENEDORES (Artista/Staff/Owner ≠ Cliente). Uso: node scripts/verificar-contenedores.mjs
// Sale con código 1 si hay una violación GRAVE. Mapa oficial y razones: docs/contenedores-y-rutas.md
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const leer = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const fallos = [];   // graves: rompen el aislamiento
const avisos = [];   // a revisar: cruces conocidos o dudosos

// ── Contenedores ────────────────────────────────────────────────────────────
const CLIENTE = ['web/client-account.html', 'web/client-portal.html', 'web/client-billing.html', 'web/client-portal.js'];
const ARTISTA_STAFF = ['account-settings.html', 'dj-dashboard.html', 'staff.html', 'staff-admin.html', 'staff-agenda.html', 'staff-order.html', 'account-profile.html'];
const PAGINAS_ARTISTA_STAFF = ARTISTA_STAFF.map((n) => n);

// Líneas que SÍ pueden nombrar páginas del otro contenedor: las que EXPULSAN al rol equivocado del portal del cliente.
const PERMITIDA = /from_client_portal|role-guard|ROLE_HOME/;

const quitarComentarios = (linea) => linea.replace(/^\s*(\/\/|\*|<!--).*/, '');

// C1 (GRAVE): ninguna página/JS del cliente enlaza o navega a una página del artista/staff/owner.
for (const arch of CLIENTE) {
  const txt = leer(arch);
  if (txt === null) continue;
  txt.split('\n').forEach((linea, i) => {
    const l = quitarComentarios(linea);
    for (const pag of PAGINAS_ARTISTA_STAFF) {
      if (l.includes(pag) && !PERMITIDA.test(l)) {
        // solo cuenta si es un destino de navegación (href, location, open, url)
        if (/href\s*=|location|window\.open|\.href|url|replace\(/.test(l) || l.includes('./' + pag)) {
          fallos.push(`C1 ${arch}:${i + 1} el CONTENEDOR CLIENTE apunta a «${pag}» (contenedor artista/staff): ${l.trim().slice(0, 110)}`);
        }
      }
    }
  });
}

// C2 (GRAVE): cada hoja protegida carga role-guard con su rol.
const exigeGuarda = [
  ['web/account-settings.html', /role-guard\.js[^>]*data-role="dj"[^>]*data-client-home="\.\/client-account\.html"/, 'account-settings.html debe cargar role-guard con data-role="dj" y data-client-home="./client-account.html"'],
  ['web/dj-dashboard.html', /role-guard\.js[^>]*data-role="dj"/, 'dj-dashboard.html debe cargar role-guard con data-role="dj"'],
  ['web/client-account.html', /role-guard\.js[^>]*data-role="client"/, 'client-account.html debe cargar role-guard con data-role="client"'],
  ['web/client-billing.html', /role-guard\.js[^>]*data-role="client"/, 'client-billing.html debe cargar role-guard con data-role="client"'],
];
for (const [arch, re, msg] of exigeGuarda) {
  const t = leer(arch);
  if (t === null) { fallos.push(`C2 ${arch} no existe`); continue; }
  if (!re.test(t)) fallos.push(`C2 ${arch}: ${msg}`);
}
// La hoja del artista/staff nace oculta hasta que la guarda decide.
{
  const t = leer('web/account-settings.html') || '';
  if (!/data-mdj-guard/.test(t)) fallos.push('C2 account-settings.html: falta el estado oculto data-mdj-guard hasta que role-guard decida');
}

// C3 (GRAVE): el login corrige por rol el destino de ?redirect=; el rol desconocido cae en CLIENTE.
{
  const lg = leer('web/login.html') || '';
  if (!/containerAwareTarget\(redirect,\s*user\)/.test(lg)) fallos.push('C3 login.html: el destino de ?redirect= debe pasar por containerAwareTarget(redirect, user)');
  const au = leer('web/auth.js') || '';
  const m = au.match(/function mdjLoginSafeFallbackUrl[\s\S]*?\n\}/);
  if (!m) fallos.push('C3 auth.js: no se encontró mdjLoginSafeFallbackUrl');
  else {
    const ultimo = m[0].trim().split('\n').filter((x) => /return '\.\/[a-z-]+\.html'/.test(x)).pop() || '';
    if (/account-settings\.html/.test(ultimo)) fallos.push('C3 auth.js: el rol DESCONOCIDO no puede caer en account-settings.html (contenedor artista); debe ser el del cliente');
  }
}

// C4 (GRAVE): el buscador del encabezado manda al cliente a SU configuración.
{
  const hs = leer('web/header-smart-search.js') || '';
  if (/isClient\s*\?\s*'\.\/account-settings\.html'/.test(hs)) fallos.push("C4 header-smart-search.js: 'settings' del cliente apunta a account-settings.html");
  if (!/jwtRole/.test(hs)) fallos.push('C4 header-smart-search.js: falta el respaldo por rol del JWT (un cliente no tiene fila en dj_profiles)');
}

// C5 (GRAVE): el portal del cliente expulsa también al ARTISTA.
{
  const cp = leer('web/client-portal.js') || '';
  if (!/_cpRole === 'artist'/.test(cp)) fallos.push("C5 client-portal.js: falta expulsar al rol artista/dj/talent del portal del cliente");
}


// C6 (GRAVE): user_type lo escribe el propio usuario → NUNCA decide permisos. Solo se lee vía mdjUserTypeLegacy (auth.js)
// o como respaldo explícito en las pocas líneas de la lista blanca. Edge functions: prohibido leerlo para permisos.
{
  const LECTURA = /user_metadata[^;\n]{0,60}user_type|user_metadata,\s*['"]user_type['"]/;
  const BLANCA = [
    ['web/auth.js', /mdjGet\(user\.user_metadata, 'user_type'\)/],          // resolver (solo sin rol de servidor) + helper
    ['web/role-guard.js', /user_metadata\.user_type/],                        // respaldo sin auth.js; rol de servidor va primero
    ['web/account-settings.html', /user_type/],
  ];
  const archivos = [...readdirSync('web').filter((f) => /\.(js|html)$/.test(f)).map((f) => 'web/' + f),
                    ...readdirSync('supabase/functions').map((d) => `supabase/functions/${d}/index.ts`)];
  for (const arch of archivos) {
    const txt = leer(arch); if (txt === null) continue;
    txt.split('\n').forEach((linea, i) => {
      const l = quitarComentarios(linea);
      if (!LECTURA.test(l) && !/user_metadata\?\.user_type/.test(l)) return;
      if (/user_type\s*[:=]\s*['"]|updateUser|signUp|data:\s*\{/.test(l)) return;        // ESCRITURA en el alta: permitido
      if (/!appR\b|!appRole\b|appRole\s*\?\s*''|mdjUserTypeLegacy/.test(l)) return;       // solo sin rol de servidor
      if (/mdjb-shared-header|mdj-identity/.test(arch) && /!app/.test(txt.split('\n').slice(Math.max(0, i - 1), i + 2).join(' '))) return;
      if (BLANCA.some(([a, re]) => a === arch && re.test(l))) return;
      fallos.push(`C6 ${arch}:${i + 1} lee user_type para decidir (lo escribe el usuario): ${l.trim().slice(0, 100)}`);
    });
  }
}


// C8 (GRAVE): la hoja del artista/staff/owner NO escribe en client_profiles (así nacían los perfiles duales),
// y el alta al iniciar sesión nunca crea client_profiles al staff/owner.
{
  const as = leer('web/account-settings.html') || '';
  if (/handleClientSettingsSubmit\s*=|window\.handleClientSettingsSubmit\(/.test(as)) fallos.push('C8 account-settings.html: reapareció handleClientSettingsSubmit (escribe client_profiles desde la hoja del artista)');
  if (/client_profiles['"]\)\s*\.(insert|upsert|update)/.test(as)) fallos.push('C8 account-settings.html: escribe en client_profiles');
  const au = leer('web/auth.js') || '';
  if (!/rawRole === 'owner'\) return;/.test(au)) fallos.push("C8 auth.js: mdjEnsureAuthProfileRows debe excluir al owner (si no, se le crea client_profiles)");
}


// C9 (GRAVE): UNA sola lista de categorías (web/js/mdj-categorias.js). El desplegable TRABAJOS (encabezado) debe tener las mismas claves y el mismo orden;
// jobs.html y Configuración de cuenta deben USARLA (window.MDJ_CAT) y no reintroducir una taxonomía propia.
{
  const hdr = leer('web/mdjb-shared-header.js') || '';
  const cat = leer('web/js/mdj-categorias.js') || '';
  const bloqueHdr = (hdr.split('mdjJobsDropdown')[1] || '').split('var panel = null')[0];
  const kH = [...bloqueHdr.matchAll(/key:\s*'([a-z]+)'/g)].map((m) => m[1]);
  const kC = [...(cat.split('var CATEGORIAS = [')[1] || '').split('/* Nombre canónico')[0].matchAll(/key:\s*'([a-z]+)'/g)].map((m) => m[1]);
  if (!kH.length || !kC.length) fallos.push('C9 no se pudieron leer las categorías del menú Trabajos o de mdj-categorias.js');
  else if (kH.join(',') !== kC.join(',')) fallos.push(`C9 categorías distintas: menú=[${kH.join(',')}] mdj-categorias=[${kC.join(',')}]`);
  const as = leer('web/account-settings.html') || '';
  if (/CAT_TAXONOMY/.test(as) || !/window\.MDJ_CAT/.test(as)) fallos.push('C9 account-settings.html debe usar window.MDJ_CAT (sin taxonomía propia)');
  const jc = leer('web/js/jobs-categorias.js') || '';
  if (!/window\.MDJ_CAT/.test(jc) || /var CATEGORIAS\s*=/.test(jc)) fallos.push('C9 jobs-categorias.js debe usar window.MDJ_CAT (sin lista propia)');
  const db = ["animador","bartender","cantante","dj","fotografia","horaloca","mc","mesero","musico","orquesta","payasos","staff"];
  if (kC.length && kC.slice().sort().join(',') !== db.slice().sort().join(',')) fallos.push('C9 las claves de mdj-categorias.js no coinciden con el check de dj_profiles.categoria en la base');
}


// C10 (GRAVE): toda página de servicio debe tener el botón «Regresar» (script compartido web/js/mdj-back-button.js + <body data-mdj-back>).
{
  const PAGINAS = ['weddings','club-dj','corporate','private-family-dj','seasonal-parties','mc-dj','hora-loca','capture-visuals-dj','payasos-dj','live-musicians-dj','staff-dj',
    'flair-bartender-miami','dj-miami','event-entertainment-miami','pro-audio-dj','lighting-dj','furniture-dj','special-effects-dj','tents-dj','stages-dj','inflatables-dj','quinceanera','festival-dj','wedding-planning'];
  for (const n of PAGINAS) {
    const t = leer(`web/${n}.html`); if (t === null) { fallos.push(`C10 falta la página web/${n}.html`); continue; }
    if (!/<body[^>]*data-mdj-back="/.test(t) || !/mdj-back-button\.js/.test(t)) fallos.push(`C10 web/${n}.html sin botón «Regresar» (data-mdj-back + mdj-back-button.js)`);
  }
}

// C7 (GRAVE): base de datos. Si hay acceso (SUPABASE_DB_URL + psql) ejecuta public.mdj_auditar_roles(); si no, lo avisa.
{
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    avisos.push('BD no verificada: define SUPABASE_DB_URL y vuelve a correr (o ejecuta `select * from public.mdj_auditar_roles();` en el SQL editor). Script: supabase/scripts/20260921_auditoria_roles_bd.sql');
  } else {
    try {
      const out = execFileSync('psql', [url, '-At', '-F', '|', '-c', 'select gravedad, problema, detalle from public.mdj_auditar_roles()'], { encoding: 'utf8' });
      out.split('\n').filter(Boolean).forEach((r) => {
        const [g, p, d] = r.split('|');
        (g === 'GRAVE' ? fallos : avisos).push(`C7 BD ${p}: ${d}`);
      });
    } catch (e) { fallos.push('C7 BD: no se pudo ejecutar la auditoría (' + String(e.message).split('\n')[0] + ')'); }
  }
}

// AVISOS: cruces artista/staff → cliente que existen por diseño; se listan para decisión, no rompen.
for (const arch of ARTISTA_STAFF.map((n) => 'web/' + n)) {
  const txt = leer(arch);
  if (txt === null) continue;
  txt.split('\n').forEach((linea, i) => {
    const l = quitarComentarios(linea);
    if (/client-portal\.html|client-account\.html/.test(l) && /href\s*=|window\.open|\.href|location/.test(l)) {
      avisos.push(`A ${arch}:${i + 1} el contenedor artista/staff enlaza al CLIENTE: ${l.trim().slice(0, 100)}`);
    }
  });
}

console.log('── Verificación de contenedores ──');
console.log(`Graves: ${fallos.length}   Avisos (cruces por diseño a revisar): ${avisos.length}`);
fallos.forEach((f) => console.log('  ✗ ' + f));
avisos.slice(0, 12).forEach((a) => console.log('  ! ' + a));
if (avisos.length > 12) console.log(`  … y ${avisos.length - 12} avisos más`);
if (fallos.length) { console.log('\nRESULTADO: FALLA — hay un hueco entre contenedores.'); process.exit(1); }
console.log('\nRESULTADO: OK — ningún hueco grave entre contenedores.');
