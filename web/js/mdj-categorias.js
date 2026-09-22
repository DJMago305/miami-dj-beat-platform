/* Categorías de artista — UNA sola fuente para jobs.html y Configuración de cuenta (account-settings.html). 2026-09-21.
 *
 * REGLA DEL PO: cada artista tiene UNA categoría (no son compatibles entre sí: un DJ no es una Hora Loca; un DJ sí puede ser animador o
 * productor, eso son SUBcategorías) + sus subcategorías + el idioma con el que trabaja (es / en / bilingue).
 *
 * Datos guardados en dj_profiles:
 *   categoria         -> clave de esta lista (una sola)
 *   artist_specialty  -> «Familia · sub · sub» (mismo texto canónico que siempre; lo leen el perfil público y el hero)
 *   idiomas           -> text[] con es | en | bilingue (bilingue implica es+en)
 * "Familia" = valor de las casillas ocultas roles de jobs.html (contrato del alta, no cambia).
 */
(function () {
  'use strict';

  /* Tipos de Hora Loca: los 5 paquetes ya definidos en la plataforma (Robot, Brasil, Cubana, Character, Hadas) + los que describe la fuente
     especializada (horaloca.com.do «Tipos de hora loca») y los performers que ya existen como extras (zanqueros, batucada). */
  var HORA_LOCA = ['Robot LED', 'Brasil / Carnaval', 'Cubana', 'Caribeña / Tropical', 'Personajes / Superhéroes', 'Hadas y Fantasía',
                   'Circo Mágico', 'Zanqueros', 'Batucada', 'Mariachi', 'Neón / Glow', 'Retro (70s-90s)', 'Videojuegos Retro',
                   'Festival (estilo Coachella)', 'Bollywood / Árabe'];

  var CATEGORIAS = [
    { key: 'animador',     es: 'Animador',            en: 'Host / Animator',      family: 'MC y Presentadores',
      subs: ['Animador', 'Party Host', 'Event Host', 'Festival Host', 'Presenter', 'Announcer', 'Stage Host', 'Brand Ambassador'] },
    { key: 'bartender',    es: 'Bartender',           en: 'Bartender',            family: 'Staff',
      subs: ['Bartender', 'Flair Bartender', 'Mixologist'] },
    { key: 'cantante',     es: 'Cantante',            en: 'Singer',               family: 'Músicos en Vivo',
      subs: ['Singer'] },
    { key: 'dj',           es: 'DJ',                  en: 'DJ',                   family: 'DJ',
      subs: ['Open Format', 'Latin Format', 'Wedding', 'Corporate', 'Official', 'Resident', 'Warm-Up', 'Mobile', 'Club', 'Private Events', 'Festival', 'Luxury Events', 'Bilingual', 'Radio', 'Producer', 'DJ Host', 'Artistic Manager', 'Headliner', 'Opening', 'Closing', 'Support', 'Guest', 'Tour', 'Show', 'Scratch', 'Competition', 'Destination Wedding', 'Yacht Party'] },
    { key: 'fotografia',   es: 'Fotografía y Video',  en: 'Photo & Video',        family: 'Captura y Visuales',
      subs: ['Photographer', 'Videographer', 'Drone Operator', 'Content Creator', 'Live Streaming', 'Event Coverage', 'Photo Booth', '360 Booth', 'LED Visuals', 'VJ'] },
    { key: 'horaloca',     es: 'Hora Loca',           en: 'Hora Loca',            family: 'Hora Loca Experience',
      subs: HORA_LOCA },
    { key: 'mc',           es: 'MC',                  en: 'MC',                   family: 'MC y Presentadores',
      subs: ['MC', 'Master of Ceremonies', 'Bilingual MC', 'Wedding MC', 'Corporate MC'] },
    { key: 'mesero',       es: 'Mesero/a',            en: 'Waiter / Waitress',    family: 'Staff',
      subs: ['Waiter', 'Waitress'] },
    { key: 'musico',       es: 'Músico independiente', en: 'Independent musician', family: 'Músicos en Vivo',
      subs: ['Saxophonist', 'Violinist', 'Percussionist', 'Guitarist', 'Pianist', 'Drummer', 'Trumpet Player', 'Solo Musician'] },
    { key: 'orquesta',     es: 'Orquesta o Banda',    en: 'Orchestra / Band',     family: 'Músicos en Vivo',
      subs: ['Band', 'Duo', 'Trio', 'Orchestra'] },
    { key: 'payasos',      es: 'Payasos y Comediantes', en: 'Clowns & Comedians', family: 'Payasos',
      subs: ['Clown', 'Comedian', 'Kids Entertainer', 'Character Performer', 'Magic Show', 'Balloon Artist', 'Face Painter'] },
    { key: 'staff',        es: 'Staff de eventos',    en: 'Event staff',          family: 'Staff',
      subs: ['Event Coordinator', 'Event Manager', 'Production Assistant', 'Stage Manager', 'Security Staff', 'Brand Staff', 'Hospitality Staff', 'Registration Staff', 'Setup Crew', 'Breakdown Crew', 'Cook', 'Dishwasher', 'Cleaning Crew'] }
  ];

  /* Nombre canónico de cada familia = primera parte de artist_specialty (el que reconoce el perfil público). Clave = valor de la casilla en mayúsculas. */
  var FAMILY_CANON = {
    'DJ': 'DJ', 'HORA LOCA EXPERIENCE': 'Hora Loca Experience', 'MÚSICOS EN VIVO': 'Músicos en Vivo',
    'CAPTURA Y VISUALES': 'Captura y Visuales', 'MC Y PRESENTADORES': 'MC y Presentadores', 'STAFF': 'Staff', 'PAYASOS': 'Payasos & Comediantes'
  };
  /* Valor real de la casilla (roles) de cada familia */
  var FAMILY_CHECKBOX = { 'DJ': 'DJ', 'Hora Loca Experience': 'Hora Loca Experience', 'Músicos en Vivo': 'Músicos en Vivo',
    'Captura y Visuales': 'Captura y Visuales', 'MC y Presentadores': 'MC y Presentadores', 'Staff': 'Staff', 'Payasos': 'Payasos' };

  /* Nombre visible de las subcategorías que lo necesitan; lo GUARDADO es siempre el texto canónico */
  var SUB_LABEL = {
    'Bartender':       { es: 'Bartender clásico',          en: 'Classic bartender' },
    'Flair Bartender': { es: 'Flair bartender (show)',      en: 'Flair bartender (show)' },
    'Mixologist':      { es: 'Mixólogo',                   en: 'Mixologist' },
    'Magic Show':      { es: 'Show de magia',              en: 'Magic show' },
    'Balloon Artist':  { es: 'Globoflexia',               en: 'Balloon twisting' },
    'Face Painter':    { es: 'Pinta caritas',             en: 'Face painter' },
    'Producer':        { es: 'Productor musical',          en: 'Music producer' },
    'DJ Host':         { es: 'DJ animador (MC)',           en: 'DJ host (MC)' },
    'Robot LED':                    { es: 'Robot LED',                    en: 'LED robot' },
    'Brasil / Carnaval':            { es: 'Brasil / Carnaval',            en: 'Brazil / Carnival' },
    'Cubana':                       { es: 'Cubana',                       en: 'Cuban' },
    'Caribeña / Tropical':          { es: 'Caribeña / Tropical',          en: 'Caribbean / Tropical' },
    'Personajes / Superhéroes':     { es: 'Personajes / Superhéroes',     en: 'Characters / Superheroes' },
    'Hadas y Fantasía':             { es: 'Hadas y Fantasía',             en: 'Fairies & Fantasy' },
    'Circo Mágico':                 { es: 'Circo Mágico',                 en: 'Magic circus' },
    'Zanqueros':                    { es: 'Zanqueros',                    en: 'Stilt walkers' },
    'Batucada':                     { es: 'Batucada',                     en: 'Batucada' },
    'Mariachi':                     { es: 'Mariachi',                     en: 'Mariachi' },
    'Neón / Glow':                  { es: 'Neón / Glow',                  en: 'Neon / Glow' },
    'Retro (70s-90s)':              { es: 'Retro (70s-90s)',              en: 'Retro (70s-90s)' },
    'Videojuegos Retro':            { es: 'Videojuegos Retro',            en: 'Retro video games' },
    'Festival (estilo Coachella)':  { es: 'Festival (estilo Coachella)',  en: 'Festival (Coachella style)' },
    'Bollywood / Árabe':            { es: 'Bollywood / Árabe',            en: 'Bollywood / Arabic' }
  };
  var IDIOMAS = [ { v: 'es', es: 'Español', en: 'Spanish' }, { v: 'en', es: 'Inglés', en: 'English' }, { v: 'bilingue', es: 'Bilingüe', en: 'Bilingual' } ];

  var T = {
    es: { subs: 'Tus especialidades en', none: 'Esta categoría no tiene subcategorías: ya quedó elegida.',
          idioma: 'Idioma con el que trabajas', idiomaHint: 'Puedes marcar más de uno. Bilingüe = español e inglés.' },
    en: { subs: 'Your specialties in', none: 'This category has no subcategories: it is already selected.',
          idioma: 'Language you work in', idiomaHint: 'You can pick more than one. Bilingual = Spanish and English.' }
  };
  var CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  function lang() { return String(document.documentElement.lang || 'es').toLowerCase().slice(0, 2) === 'en' ? 'en' : 'es'; }
  function byKey(key) { key = String(key || '').toLowerCase(); return CATEGORIAS.filter(function (c) { return c.key === key; })[0] || null; }
  function nombre(c, l) { return c ? c[l || lang()] : ''; }
  function subNombre(s, l) { return SUB_LABEL[s] ? SUB_LABEL[s][l || lang()] : s; }
  function familiaCanon(c) { return c ? (c.family === 'Payasos' ? 'Payasos & Comediantes' : c.family) : ''; }

  /* Línea artist_specialty: «Familia · sub · sub» (+ nombre comercial si lo hay) */
  function buildSpecialty(catKey, subs, comercial) {
    var c = byKey(catKey); if (!c) return '';
    var parts = [familiaCanon(c)].concat(subs || []);
    if (comercial) parts.push(String(comercial).trim());
    return parts.filter(Boolean).join(' · ');
  }

  /* Bilingüe implica es+en; es+en juntos = bilingüe; uno concreto quita bilingüe */
  function toggleIdioma(arr, v) {
    var a = (arr || []).slice(), i = a.indexOf(v);
    if (i === -1) a.push(v); else a.splice(i, 1);
    if (v === 'bilingue' && a.indexOf('bilingue') !== -1) return ['bilingue'];
    if (a.indexOf('es') !== -1 && a.indexOf('en') !== -1) return ['bilingue'];
    if (a.indexOf('bilingue') !== -1 && (v === 'es' || v === 'en')) return [v];
    return a;
  }

  /* Categoría + subcategorías que ya tiene un artista, a partir de lo guardado. Sin `categoria` (cuentas viejas) se deduce de la
     familia y de las subcategorías; si es ambiguo devuelve cat:null (el artista elige). */
  function derivar(p) {
    p = p || {};
    var parts = String(p.artist_specialty || '').split('·').map(function (x) { return x.trim(); }).filter(Boolean);
    var head = (parts[0] || '').toUpperCase(), items = parts.slice(1);
    var cat = byKey(p.categoria);
    if (!cat && head) {
      cat = CATEGORIAS.filter(function (c) { return c.key === head.toLowerCase() || c.es.toUpperCase() === head || c.en.toUpperCase() === head; })[0] || null;
    }
    if (!cat && head) {
      var fam = null;
      Object.keys(FAMILY_CANON).forEach(function (k) {
        var canon = FAMILY_CANON[k].toUpperCase();
        if (head === canon || head === k || head.indexOf(k) === 0 || canon.indexOf(head) === 0) fam = fam || FAMILY_CANON[k];
      });
      if (fam) {
        var cands = CATEGORIAS.filter(function (c) { return familiaCanon(c) === fam; });
        if (cands.length === 1) cat = cands[0];
        else {
          var best = null, bestN = 0;
          cands.forEach(function (c) { var n = items.filter(function (x) { return c.subs.indexOf(x) !== -1; }).length; if (n > bestN) { best = c; bestN = n; } });
          cat = best;
        }
      }
    }
    var subs = cat ? items.filter(function (x) { return cat.subs.indexOf(x) !== -1; }) : [];
    return { cat: cat ? cat.key : null, subs: subs };
  }

  var stylesDone = false;
  function injectStyles() {
    if (stylesDone || document.getElementById('mdj-cat-styles')) return; stylesDone = true;
    var s = document.createElement('style'); s.id = 'mdj-cat-styles';
    s.textContent =
      '.mdj-catpick-box{margin-top:26px;padding:22px 24px 26px;border:1px solid rgba(197,160,89,.28);border-radius:16px;background:rgba(255,255,255,.03);scroll-margin-top:140px;}' +
      '.mdj-catpick-box[hidden]{display:none;}' +
      '.mdj-catpick-subs-title{margin:0 0 16px;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.6);}' +
      '.mdj-catpick-idiomas{margin-top:22px;}' +
      '.mdj-catpick-none{margin:0;font-size:13px;color:rgba(255,255,255,.5);}' +
      '.mdj-catpick-subgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px 16px;}' +
      '.mdj-catpick-sub{display:flex;align-items:center;gap:12px;padding:8px 6px;border:0;background:none;color:rgba(255,255,255,.75);font:600 14px/1.2 inherit;text-align:left;cursor:pointer;border-radius:10px;}' +
      '.mdj-catpick-sub:hover{background:rgba(255,255,255,.05);color:#fff;}' +
      '.mdj-catpick-sub:focus-visible{outline:2px solid var(--gold,#c5a059);outline-offset:2px;}' +
      '.mdj-catpick-circle{flex:none;width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.35);display:inline-flex;align-items:center;justify-content:center;color:transparent;transition:background .15s,border-color .15s;}' +
      '.mdj-catpick-sub.is-on{color:#fff;}' +
      '.mdj-catpick-sub.is-on .mdj-catpick-circle{background:#22c55e;border-color:#22c55e;color:#04210f;}' +
      '@media (prefers-reduced-motion:reduce){.mdj-catpick-circle{transition:none;}}';
    document.head.appendChild(s);
  }

  /* Dibuja los círculos (subcategorías + idioma) dentro de `box`.  st = { cat, subs[], idiomas[] };  h = { onSub(sub), onIdioma(v) } */
  function renderPanel(box, st, h) {
    injectStyles();
    if (!box) return;
    var c = byKey(st.cat), l = lang(), t = T[l];
    box.classList.add('mdj-catpick-box');
    if (!c) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false; box.innerHTML = '';
    var title = document.createElement('p'); title.className = 'mdj-catpick-subs-title'; title.textContent = t.subs + ' ' + nombre(c, l); box.appendChild(title);
    function circulo(attr, val, texto, on) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'mdj-catpick-sub' + (on ? ' is-on' : '');
      b.setAttribute(attr, val); b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.innerHTML = '<span class="mdj-catpick-circle" aria-hidden="true">' + CHECK + '</span><span class="mdj-catpick-subname"></span>';
      b.querySelector('.mdj-catpick-subname').textContent = texto;
      return b;
    }
    if (!c.subs.length) {
      var n = document.createElement('p'); n.className = 'mdj-catpick-none'; n.textContent = t.none; box.appendChild(n);
    } else {
      var grid = document.createElement('div'); grid.className = 'mdj-catpick-subgrid';
      c.subs.forEach(function (s) { grid.appendChild(circulo('data-sub', s, subNombre(s, l), (st.subs || []).indexOf(s) !== -1)); });
      box.appendChild(grid);
    }
    var sec = document.createElement('div'); sec.className = 'mdj-catpick-idiomas';
    var it = document.createElement('p'); it.className = 'mdj-catpick-subs-title'; it.textContent = t.idioma; sec.appendChild(it);
    var g2 = document.createElement('div'); g2.className = 'mdj-catpick-subgrid';
    IDIOMAS.forEach(function (i) { g2.appendChild(circulo('data-idioma', i.v, i[l], (st.idiomas || []).indexOf(i.v) !== -1)); });
    sec.appendChild(g2);
    var hint = document.createElement('p'); hint.className = 'mdj-catpick-none'; hint.style.marginTop = '8px'; hint.textContent = t.idiomaHint; sec.appendChild(hint);
    box.appendChild(sec);
    if (!box.__mdjWired) {
      box.__mdjWired = true;
      box.addEventListener('click', function (e) {
        var idi = e.target.closest && e.target.closest('.mdj-catpick-sub[data-idioma]');
        if (idi) { if (box.__mdjH && box.__mdjH.onIdioma) box.__mdjH.onIdioma(idi.getAttribute('data-idioma')); return; }
        var sub = e.target.closest && e.target.closest('.mdj-catpick-sub[data-sub]');
        if (sub && box.__mdjH && box.__mdjH.onSub) box.__mdjH.onSub(sub.getAttribute('data-sub'));
      });
    }
    box.__mdjH = h || {};
  }

  window.MDJ_CAT = {
    CATEGORIAS: CATEGORIAS, IDIOMAS: IDIOMAS, SUB_LABEL: SUB_LABEL, FAMILY_CANON: FAMILY_CANON,
    lang: lang, byKey: byKey, nombre: nombre, subNombre: subNombre, familiaCanon: familiaCanon,
    buildSpecialty: buildSpecialty, toggleIdioma: toggleIdioma, derivar: derivar, injectStyles: injectStyles, renderPanel: renderPanel
  };
  /* Compatibilidad con lo que ya leía jobs.html */
  window.MDJ_CATEGORIAS = CATEGORIAS;
  window.__mdjJobsFamilyCanon = FAMILY_CANON;
})();
