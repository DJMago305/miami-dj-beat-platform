/* Página jobs.html — subcategorías + idioma de la categoría elegida. 2026-09-21.
 * Los DATOS y el dibujo de los círculos viven en web/js/mdj-categorias.js (compartido con Configuración de cuenta).
 *
 * REGLAS DEL PO:
 *  - UNA sola categoría, elegida SOLO desde el menú desplegable TRABAJOS (encabezado). Esta página muestra solo sus subcategorías.
 *  - Quien entra con su cuenta NO empieza de cero: se carga lo que ya configuró (categoría, subcategorías, idioma) desde dj_profiles.
 *
 * CONTRATO CON EL ALTA (no cambia): la categoría elegida marca UNA sola casilla oculta input[name="roles"] (su familia) y dispara 'change';
 * el resto del flujo (franja de roles, sessionStorage, auth.js -> dj_profiles) sigue igual. Además viaja la clave `categoria`.
 */
(function () {
  'use strict';
  var C = window.MDJ_CAT;
  if (!C) return;

  var state = { cat: null, subs: [], idiomas: [], touched: false, subsTouched: false };
  var T = {
    es: { noneTitle: 'Elige tu categoría', noneHint: 'Ábrela desde el menú TRABAJOS, arriba: DJ, Hora Loca, Orquesta, Bartender y más.', open: 'Ver categorías',
          catTitle: 'Tu categoría:', catHint: 'Ahora marca tus especialidades. Para cambiar de categoría, usa el menú TRABAJOS.' },
    en: { noneTitle: 'Choose your category', noneHint: 'Open it from the JOBS menu above: DJ, Hora Loca, Orchestra, Bartender and more.', open: 'See categories',
          catTitle: 'Your category:', catHint: 'Now mark your specialties. To change category, use the JOBS menu.' }
  };

  /* ── Puente con las casillas ocultas (familias): SOLO la de la categoría elegida queda marcada ── */
  function todasLasCasillas() {
    return document.querySelectorAll('#mdj-jobs-v3-loop .role-photo-card:not(.mdj-talent-loop-clone) input[name="roles"]');
  }
  function syncFamilies() {
    var c = C.byKey(state.cat);
    var list = todasLasCasillas();
    for (var i = 0; i < list.length; i++) {
      var cb = list[i], want = !!c && cb.value === c.family;
      if (cb.checked !== want) { cb.checked = want; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    var byFam = {};
    if (c) byFam[c.family.toUpperCase()] = state.subs.slice();
    window.__mdjJobsSubsByFamily = byFam;
    window.__mdjJobsIdiomas = state.idiomas.slice();
    window.__mdjJobsCategoria = state.cat;
    if (typeof window.updateJobsPortalRolesStrip === 'function') { try { window.updateJobsPortalRolesStrip(); } catch (e) { void e; } }
  }

  /* ── Pintado ───────────────────────────────────────────────────────────── */
  function renderHead() {
    var l = C.lang(), t = T[l], c = C.byKey(state.cat);
    var ttl = document.getElementById('mdj-catpick-title'), hint = document.getElementById('mdj-catpick-hint'), open = document.getElementById('mdj-catpick-open');
    if (ttl) ttl.textContent = c ? (t.catTitle + ' ' + C.nombre(c, l)) : t.noneTitle;
    if (hint) hint.textContent = c ? t.catHint : t.noneHint;
    if (open) { open.textContent = t.open; open.hidden = !!c; }
  }
  function renderSubs() {
    C.renderPanel(document.getElementById('mdj-cat-subs'), state, { onSub: toggleSub, onIdioma: toggleIdioma });
  }
  function scrollToSubs() {
    var box = document.getElementById('mdj-cat-subs'); if (!box || box.hidden) return;
    try {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var head = document.getElementById('mainHeader');
      var off = head ? head.getBoundingClientRect().height + 12 : 120;
      window.scrollTo({ top: Math.max(0, box.getBoundingClientRect().top + window.pageYOffset - off), behavior: reduce ? 'auto' : 'smooth' });
    } catch (e) { void e; }
  }

  /* ── Acciones ──────────────────────────────────────────────────────────── */
  function elegirCategoria(key) {
    var c = C.byKey(key); if (!c) return;
    state.touched = true;
    if (state.cat !== c.key) { state.cat = c.key; state.subs = []; state.subsTouched = false; }   // otra categoría: subs limpias (no son compatibles)
    try { if (/\/jobs\.html$/i.test(location.pathname)) history.replaceState(null, '', location.pathname + '?categoria=' + c.key + location.hash); } catch (e) { void e; }
    renderHead(); renderSubs(); syncFamilies(); scrollToSubs();
  }
  function toggleSub(sub) {
    if (!state.cat) return;
    state.touched = true; state.subsTouched = true;
    var i = state.subs.indexOf(sub);
    if (i === -1) state.subs.push(sub); else state.subs.splice(i, 1);
    renderSubs(); syncFamilies();
  }
  function toggleIdioma(v) {
    state.touched = true; state.idiomasTouched = true;
    state.idiomas = C.toggleIdioma(state.idiomas, v);
    renderSubs(); syncFamilies();
  }

  /* Lo que el artista YA configuró (su fila en dj_profiles). Devuelve { cat, subs, idiomas } o null si no hay sesión / no es artista. */
  async function cargarPerfil() {
    var sb = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
    if (!sb) return null;
    try {
      var ses = (await sb.auth.getSession()).data.session; if (!ses) return null;
      var r = await sb.from('dj_profiles').select('categoria, artist_specialty, idiomas').eq('user_id', ses.user.id).maybeSingle();
      var p = r && r.data; if (!p) return null;
      var d = C.derivar(p);
      return { cat: d.cat, subs: d.subs, idiomas: Array.isArray(p.idiomas) ? p.idiomas.slice() : [] };
    } catch (e) { return null; }
  }

  function abrirMenuTrabajos() {
    var a = document.querySelector('#mainNav [data-mdj-nav="jobs"]'); if (!a) return;
    try { a.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); a.focus(); } catch (e) { void e; }
  }

  function initUI() {
    var root = document.getElementById('mdj-catpick'); if (!root) return;
    C.injectStyles();
    root.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#mdj-catpick-open')) abrirMenuTrabajos(); });
    renderHead(); renderSubs();

    var q = '';
    try { q = String(new URLSearchParams(window.location.search).get('categoria') || '').toLowerCase(); } catch (e) { void e; }
    if (C.byKey(q)) elegirCategoria(q);                         // elegida desde el menú: se ve de inmediato (con o sin sesión)

    /* Con sesión: se completa con lo ya configurado; nadie empieza de cero */
    cargarPerfil().then(function (p) {
      if (!p) return;
      if (!state.idiomasTouched && p.idiomas.length) state.idiomas = p.idiomas;
      if (state.cat) {
        if (p.cat === state.cat && !state.subsTouched) state.subs = p.subs.slice();   // misma categoría que ya tenía: conserva sus subcategorías
      } else if (p.cat) {
        state.cat = p.cat; state.subs = p.subs.slice();                               // entró sin elegir: se muestra la suya
      }
      renderHead(); renderSubs(); syncFamilies();
    });

    /* El alta premarca casillas (categorías guardadas) de forma ASÍNCRONA: se repasa para que quede marcada SOLO la elegida */
    [300, 1200, 3000, 5000].forEach(function (ms) { setTimeout(function () { if (state.cat) syncFamilies(); }, ms); });
  }

  /* Desde el menú TRABAJOS (encabezado) estando ya en jobs.html: cambia la categoría sin recargar (reemplaza a la anterior). */
  window.mdjJobsElegirCategoria = function (key) { elegirCategoria(String(key || '').toLowerCase()); };
  window.mdjJobsCategoriaSeleccion = function () { return JSON.parse(JSON.stringify(state)); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI); else initUI();
})();
