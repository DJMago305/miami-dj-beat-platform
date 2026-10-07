/* PUERTA DE LA SALA (pestaña SALAS / VENUES del portal comercial): lista de boletos del evento en vivo + escáner de QR.
   Flujo (pedido del PO 2026-10-07): la computadora de la recepción abre la lista del evento del día; el invitado llega con su QR (papel o teléfono);
   alguien lo escanea con la cámara de un teléfono o con un lector USB; en la computadora esa persona se pone en ROJO («ya pasó»), un contador dice cuántos
   han entrado y cuántos faltan, y cuando todos entraron se cierran las entradas.
   TODO pasa por funciones de la base que validan el local de la cuenta: venue_door_guests (lista; «team» sin teléfono ni correo), venue_door_summary (contador),
   venue_ticket_scan (escáner: solo el evento del día y solo con la puerta abierta), venue_event_set_doors (cerrar/reabrir: dueño y manager),
   venue_guest_set_checkin (marcar/deshacer a mano: dueño y manager). Esta pantalla solo las llama; aunque alguien manipule el navegador, la base manda.
   Sin ?. ni ?? (Safari 13). Todo texto de la base se pinta escapado.
   Uso:  mdjVenueDoor.init({ db, venueId, role, listBox, scanBox })   mdjVenueDoor.onShow('boletos'|'escaner')   mdjVenueDoor.openScanner(eventId?)   mdjVenueDoor.showEvent(eventId) */
(function (root) {
    'use strict';
    var UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    var S = { db: null, venue: null, role: null, listBox: null, scanBox: null, events: [], ev: null, guests: [], sum: null, seq: 0, timer: 0, filter: 'all', q: '', flash: {}, built: false,
              scan: { stream: null, det: null, mode: '', timer: 0, busy: false, last: '', lastAt: 0, starting: false, opening: false, hide: 0, ctx: null } };
    var SCAN_REASON = {
        already_used: 'Este pase ya fue utilizado.',
        invalid_event: 'Este ticket es de OTRO evento.',
        wrong_date: 'El escáner solo valida el evento del día.',
        doors_closed: 'Las entradas de este evento están cerradas.',
        cancelled: 'Ticket cancelado, reembolsado o en revisión.',
        order_not_found: 'Ticket no encontrado.'
    };

    function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function ymdNY(d) { try { return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } catch (e) { return d.toISOString().slice(0, 10); } }
    function diaDeNegocio() { return ymdNY(new Date(Date.now() - 6 * 3600 * 1000)); }       // mismo criterio que venue_business_day() en la base: el día va de las 6:00 a las 6:00
    function fechaLarga(ymd) { try { return new Date(String(ymd).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-US', { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return String(ymd || ''); } }
    function fmtHora(ts) { try { return new Date(ts).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }
    function norm(t) { return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function puedeGestionar() { return S.role === 'owner' || S.role === 'manager'; }
    function $(id) { return document.getElementById(id); }

    function css() {
        if ($('vd-css')) return;
        var st = document.createElement('style'); st.id = 'vd-css';
        st.textContent = [
            '.vd-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 14px}',
            '.vd-bar select,.vd-bar input[type=search],.vd-reader{font:inherit;font-size:14px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.35);color:#fff;min-width:0}',
            '.vd-bar select{flex:1 1 260px}.vd-bar input[type=search]{flex:1 1 200px}.vd-reader{flex:1 1 240px;border-color:rgba(197,160,89,.45)}',
            '.vd-btn{font:inherit;font-size:13px;font-weight:800;letter-spacing:.03em;padding:10px 16px;border-radius:10px;border:1px solid rgba(197,160,89,.5);background:rgba(197,160,89,.12);color:#c5a059;cursor:pointer;white-space:nowrap}',
            '.vd-btn:hover{background:rgba(197,160,89,.26);color:#fff}.vd-btn[disabled]{opacity:.45;cursor:default}',
            '.vd-btn.go{background:#1f7a45;border-color:#1f7a45;color:#fff}.vd-btn.go:hover{background:#17633a}',
            '.vd-btn.stop{background:#b3261e;border-color:#b3261e;color:#fff}.vd-btn.stop:hover{background:#8f1d17}',
            '.vd-btn.pulse{animation:vdp 1.4s ease-in-out infinite}@keyframes vdp{50%{box-shadow:0 0 0 6px rgba(179,38,30,.35)}}',
            '.vd-count{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 10px}',
            '.vd-count div{padding:12px 14px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);text-align:center}',
            '.vd-count b{display:block;font-size:clamp(26px,4vw,44px);line-height:1.05;color:#fff;font-variant-numeric:tabular-nums}',
            '.vd-count small{display:block;margin-top:4px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.6)}',
            '.vd-count .in b{color:#e2554b}.vd-count .left b{color:#5fd68a}',
            '.vd-prog{height:8px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin:0 0 12px}.vd-prog i{display:block;height:100%;background:#e2554b;transition:width .4s}',
            '.vd-state{margin:0 0 12px;padding:10px 14px;border-radius:10px;font-size:13.5px;font-weight:700}',
            '.vd-state.closed{background:rgba(179,38,30,.18);border:1px solid rgba(226,85,75,.6);color:#ffb4ad}.vd-state.done{background:rgba(31,122,69,.2);border:1px solid rgba(95,214,138,.5);color:#bff0d1}',
            '.vd-chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}',
            '.vd-chips button{font:inherit;font-size:12.5px;font-weight:700;padding:7px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:transparent;color:rgba(255,255,255,.7);cursor:pointer}',
            '.vd-chips button[aria-pressed=true]{border-color:#c5a059;color:#c5a059;background:rgba(197,160,89,.14)}',
            '.vd-row{display:grid;grid-template-columns:1.4fr 1.1fr 1.4fr auto;align-items:center;gap:12px;padding:11px 14px;margin:0 0 6px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.03);font-size:14px}',
            '.vd-row.in{border-color:rgba(226,85,75,.6);background:rgba(226,85,75,.13)}.vd-row.void{opacity:.5}',
            '.vd-row.vd-flash{animation:vdf 2.4s ease-out}@keyframes vdf{0%{background:rgba(226,85,75,.75);transform:scale(1.015)}100%{background:rgba(226,85,75,.13);transform:none}}',
            '.vd-n{font-weight:800;word-break:break-word}.vd-l{color:rgba(255,255,255,.75)}.vd-c{color:rgba(255,255,255,.55);font-size:12.5px;word-break:break-word}',
            '.vd-st{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:rgba(255,255,255,.55);white-space:nowrap}.vd-row.in .vd-st{color:#e2554b}',
            '.vd-mini{font:inherit;font-size:12px;font-weight:800;padding:6px 10px;border-radius:8px;border:1px solid rgba(197,160,89,.5);background:transparent;color:#c5a059;cursor:pointer;margin-left:10px}',
            '.vd-mini.undo{border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.6)}',
            '.vd-empty{padding:40px 16px;text-align:center;color:rgba(255,255,255,.6);border:1px dashed rgba(255,255,255,.18);border-radius:12px}',
            '.vd-live{font-size:11.5px;color:rgba(255,255,255,.5);margin:6px 0 0}.vd-live i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#5fd68a;margin-right:6px;vertical-align:middle}',
            '@media (max-width:760px){.vd-row{grid-template-columns:1fr auto}.vd-c,.vd-l{grid-column:1/-1}.vd-count b{font-size:28px}}',
            /* Pantalla completa: solo la lista, sin cabecera ni menús */
            'html body.vd-kiosk #mainHeader.header.mdj-header-unified,html body.vd-kiosk #mainHeader,body.vd-kiosk .cc-hero,body.vd-kiosk .cc-side,body.vd-kiosk .cc-eyebrow,body.vd-kiosk footer{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}',
            'body.vd-kiosk .cc-shell{grid-template-columns:minmax(0,1fr)!important}body.vd-kiosk .cc-wrap,body.vd-kiosk main{max-width:none!important;width:100%!important;margin:0!important;padding:16px 28px!important}',
            'body.vd-kiosk{padding-top:0!important}',
            /* Escáner */
            '#vd-scan{position:fixed;inset:0;z-index:10000;background:#05070c;color:#fff;display:none;flex-direction:column}#vd-scan.open{display:flex}',
            '.vd-scan-top{display:flex;gap:10px;align-items:center;padding:12px 14px;background:#0c111b;border-bottom:1px solid rgba(255,255,255,.14);flex-wrap:wrap}',
            '.vd-scan-top select{flex:1 1 220px;min-width:0;font:inherit;font-size:14px;padding:9px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:#151b28;color:#fff}',
            '.vd-scan-top button{cursor:pointer;font:inherit;font-size:14px;font-weight:800;color:#fff;background:#3a4150;border:0;border-radius:8px;padding:10px 16px}',
            '.vd-scan-stage{position:relative;flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;background:#000}',
            '.vd-scan-stage video{width:100%;height:100%;object-fit:cover}',
            '.vd-scan-frame{position:absolute;width:min(70vw,320px);aspect-ratio:1;border:3px solid rgba(255,255,255,.85);border-radius:18px;box-shadow:0 0 0 9999px rgba(0,0,0,.35);pointer-events:none}',
            '.vd-scan-msg{position:absolute;left:12px;right:12px;bottom:12px;text-align:center;font-size:13px;line-height:1.5;background:rgba(0,0,0,.65);border-radius:10px;padding:10px 12px}',
            '.vd-scan-manual{display:flex;gap:8px;padding:10px 14px;background:#0c111b;border-top:1px solid rgba(255,255,255,.14)}',
            '.vd-scan-manual input{flex:1 1 auto;min-width:0;font:inherit;font-size:14px;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:#151b28;color:#fff}',
            '.vd-scan-manual button{cursor:pointer;font:inherit;font-size:14px;font-weight:800;color:#fff;background:#1f7a45;border:0;border-radius:8px;padding:10px 16px}',
            '#vd-result{position:fixed;inset:0;z-index:10001;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px;color:#fff;cursor:pointer}',
            '#vd-result.show{display:flex}#vd-result.ok{background:#12803c}#vd-result.bad{background:#b3261e}',
            '#vd-result .big{font-size:64px;line-height:1;margin-bottom:14px}#vd-result h2{margin:0 0 8px;font-size:30px}#vd-result p{margin:4px 0;font-size:18px;line-height:1.45;max-width:30em}',
            '#vd-result .tap{margin-top:22px;font-size:12px;opacity:.8;letter-spacing:.08em;text-transform:uppercase}'
        ].join('\n');
        document.head.appendChild(st);
    }

    // ── Eventos del local (SOLO de este venue_id; la base lo filtra por RLS y aquí se vuelve a comprobar) ──
    async function loadEvents() {
        var hoy = diaDeNegocio(), desde = ymdNY(new Date(Date.now() - 45 * 86400000));
        var r = await S.db.from('venue_events').select('id,title,event_date,status,doors_closed_at,venue_rooms!inner(venue_id,name)')
            .eq('venue_rooms.venue_id', S.venue).neq('status', 'cancelled').gte('event_date', desde).order('event_date', { ascending: true }).limit(200);
        var rows = ((r && r.data) || []).filter(function (e) { return e.venue_rooms && e.venue_rooms.venue_id === S.venue; });
        if (r && r.error && /doors_closed_at/.test(r.error.message || '')) {   // el SQL de la puerta aún no está aplicado: se sigue sin «cerrar entradas»
            var r2 = await S.db.from('venue_events').select('id,title,event_date,status,venue_rooms!inner(venue_id,name)').eq('venue_rooms.venue_id', S.venue).neq('status', 'cancelled').gte('event_date', desde).order('event_date', { ascending: true }).limit(200);
            rows = ((r2 && r2.data) || []).filter(function (e) { return e.venue_rooms && e.venue_rooms.venue_id === S.venue; });
        }
        S.events = rows.sort(function (a, b) {                       // hoy primero, luego lo que viene, luego lo pasado (lo más reciente primero)
            var ha = a.event_date === hoy ? 0 : (a.event_date > hoy ? 1 : 2), hb = b.event_date === hoy ? 0 : (b.event_date > hoy ? 1 : 2);
            if (ha !== hb) return ha - hb;
            return ha === 2 ? String(b.event_date).localeCompare(String(a.event_date)) : String(a.event_date).localeCompare(String(b.event_date));
        });
        if (!S.ev || !S.events.some(function (e) { return e.id === S.ev; })) S.ev = S.events.length ? S.events[0].id : null;
        return S.events;
    }
    function evObj(id) { return S.events.filter(function (e) { return e.id === id; })[0] || null; }
    function evLabel(e) {
        var hoy = diaDeNegocio(), room = e.venue_rooms && e.venue_rooms.name ? ' · ' + e.venue_rooms.name : '';
        return (e.event_date === hoy ? 'HOY · ' : '') + (e.title || 'Evento') + ' · ' + (e.event_date ? fechaLarga(e.event_date) : 'sin fecha') + room;
    }

    // ── Pantalla completa (modo puerta: solo la lista, sin cabecera ni menús) ──
    function enFull() { return document.body.classList.contains('vd-kiosk'); }
    function pedirFull() { var d = document.documentElement; try { if (d.requestFullscreen) return d.requestFullscreen(); if (d.webkitRequestFullscreen) return d.webkitRequestFullscreen(); } catch (e) { /* sin API: queda el modo sin cabecera */ } }
    function salirFull() { try { if (document.exitFullscreen && document.fullscreenElement) return document.exitFullscreen(); if (document.webkitExitFullscreen && document.webkitFullscreenElement) return document.webkitExitFullscreen(); } catch (e) { /* ok */ } }
    function setFull(on) {
        document.body.classList.toggle('vd-kiosk', !!on);
        if (on) pedirFull(); else salirFull();
        var b = $('vd-full'); if (b) b.textContent = on ? 'Salir de pantalla completa' : 'Pantalla completa';
        var b2 = $('vd-scan-full'); if (b2) b2.textContent = on ? 'Salir de pantalla completa' : 'Pantalla completa';
    }
    function onFullChange() {
        var fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (!fs && enFull() && S.fsEntered) { S.fsEntered = false; setFull(false); }       // Esc del navegador: se sale también del modo puerta
        if (fs) S.fsEntered = true;
    }
    document.addEventListener('fullscreenchange', onFullChange);
    document.addEventListener('webkitfullscreenchange', onFullChange);

    // ── Panel «Boletos» ──
    function buildList() {
        var b = S.listBox; if (!b) return;
        b.innerHTML =
            '<div class="vd-bar"><select id="vd-event" aria-label="Evento"></select>' +
            '<button type="button" class="vd-btn" id="vd-full">Pantalla completa</button></div>' +
            '<div class="vd-bar"><input type="text" id="vd-reader" class="vd-reader" placeholder="Lector USB: dispara aquí" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Lector de códigos USB">' +
            '<button type="button" class="vd-btn go" id="vd-open-scan">📷 Escáner</button>' +
            '<button type="button" class="vd-btn" id="vd-doors" hidden></button></div>' +
            '<div id="vd-state"></div>' +
            '<div class="vd-count"><div class="in"><b id="vd-n-in">–</b><small>Dentro</small></div><div class="left"><b id="vd-n-left">–</b><small>Faltan</small></div><div><b id="vd-n-total">–</b><small>Total</small></div></div>' +
            '<div class="vd-prog"><i id="vd-bar-in" style="width:0"></i></div>' +
            '<div class="vd-bar"><input type="search" id="vd-q" placeholder="Buscar por nombre, mesa o asiento…" aria-label="Buscar invitado"></div>' +
            '<div class="vd-chips" role="group" aria-label="Filtro"><button type="button" data-f="all" aria-pressed="true">Todos</button><button type="button" data-f="left" aria-pressed="false">Faltan</button><button type="button" data-f="in" aria-pressed="false">Dentro</button></div>' +
            '<div id="vd-list"></div><p class="vd-live"><i></i><span id="vd-live-t">En vivo: se actualiza solo cada pocos segundos.</span></p>';
        $('vd-event').addEventListener('change', function () { S.ev = this.value; S.guests = []; S.sum = null; S.flash = {}; S.sig = ''; S.err = ''; renderAll(); refresh(false); });
        $('vd-full').addEventListener('click', function () { setFull(!enFull()); });
        $('vd-open-scan').addEventListener('click', function () { openScanner(S.ev); });
        $('vd-doors').addEventListener('click', toggleDoors);
        $('vd-q').addEventListener('input', function () { S.q = this.value; renderRows(); });
        [].forEach.call(b.querySelectorAll('.vd-chips button'), function (x) { x.addEventListener('click', function () { S.filter = x.getAttribute('data-f'); [].forEach.call(b.querySelectorAll('.vd-chips button'), function (y) { y.setAttribute('aria-pressed', y === x ? 'true' : 'false'); }); renderRows(); }); });
        $('vd-list').addEventListener('click', function (e) {
            var t = e.target.closest ? e.target.closest('button[data-g]') : null; if (!t || t.disabled) return;
            t.disabled = true; setCheckin(t.getAttribute('data-g'), t.getAttribute('data-in') === '1');
        });
        var rd = $('vd-reader');
        rd.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var v = rd.value; rd.value = ''; hideResult(); S.scan.last = ''; if (String(v).trim()) handle(v, S.ev); } });
        // Lector USB en la computadora: lo que «teclea» el lector cae en su campo aunque el foco esté en un botón o en la página.
        document.addEventListener('keydown', function (e) {
            if (!S.listBox || S.listBox.offsetParent === null || e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
            var t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
            if ($('vd-scan') && $('vd-scan').classList.contains('open')) return;
            var r = $('vd-reader'); if (r) r.focus();
        }, true);
        S.built = true;
    }
    function fillSelect() {
        var sel = $('vd-event'); if (!sel) return;
        sel.innerHTML = S.events.length ? S.events.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(evLabel(e)) + '</option>'; }).join('') : '<option value="">Sin eventos todavía</option>';
        if (S.ev) sel.value = S.ev;
    }
    function renderAll() { renderCounter(); renderRows(); }
    function counts() {
        var tot = 0, inn = 0;
        S.guests.forEach(function (g) { if (g.status !== 'void') { tot++; if (g.status === 'checked_in') inn++; } });
        if (S.sum && S.sum.ok) return { total: S.sum.total, inside: S.sum.inside, pending: S.sum.pending };    // el resumen de la base manda; la lista local cubre la espera
        return { total: tot, inside: inn, pending: tot - inn };
    }
    function renderCounter() {
        var c = counts(), e = evObj(S.ev), closed = !!(S.sum && S.sum.closed) || !!(e && e.doors_closed_at);
        var has = !!S.sum || S.guests.length;
        $('vd-n-in').textContent = has ? c.inside : '–'; $('vd-n-left').textContent = has ? c.pending : '–'; $('vd-n-total').textContent = has ? c.total : '–';
        $('vd-bar-in').style.width = (c.total ? Math.round(c.inside * 100 / c.total) : 0) + '%';
        var st = $('vd-state'), db = $('vd-doors');
        var puede = S.sum && S.sum.ok ? !!S.sum.can_close : puedeGestionar();
        db.hidden = !(puede && e && S.sum && S.sum.ok);
        db.className = 'vd-btn' + (closed ? '' : (c.total > 0 && c.pending === 0 ? ' stop pulse' : ' stop'));
        db.textContent = closed ? 'Reabrir entradas' : 'Cerrar entradas';
        var hoy = diaDeNegocio(), msg = '';
        if (closed) msg = '<div class="vd-state closed">🔒 Entradas CERRADAS' + (S.sum && S.sum.doors_closed_at ? ' a las ' + esc(fmtHora(S.sum.doors_closed_at)) : '') + ': el escáner no valida más. ' + (puede ? 'Pulsa «Reabrir entradas» si hace falta.' : '') + '</div>';
        else if (has && c.total > 0 && c.pending === 0) msg = '<div class="vd-state done">✔ Invitados completos: todos ya entraron.' + (puede ? ' Puedes cerrar las entradas.' : '') + '</div>';
        else if (e && e.event_date && e.event_date !== hoy) msg = '<div class="vd-state" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:rgba(255,255,255,.8)">Este evento no es de hoy (' + esc(fechaLarga(e.event_date)) + '): la lista se puede consultar, pero el escáner solo valida el evento del día.</div>';
        st.innerHTML = msg;
        var ob = $('vd-open-scan'); if (ob) ob.disabled = !(e && e.event_date === hoy);
        ob.title = ob.disabled ? 'El escáner solo valida el evento del día' : '';
    }
    function renderRows() {
        var box = $('vd-list'); if (!box) return;
        var q = norm(S.q), f = S.filter;
        var rows = S.guests.filter(function (g) {
            if (f === 'in' && g.status !== 'checked_in') return false;
            if (f === 'left' && g.status !== 'issued') return false;
            return !q || [g.guest_name, g.label, g.guest_phone, g.guest_email, String(g.guest_id).slice(0, 8)].some(function (x) { return norm(x).indexOf(q) >= 0; });
        });
        if (S.err) { box.innerHTML = '<div class="vd-empty">' + esc(S.err) + '</div>'; return; }
        if (!rows.length) { box.innerHTML = '<div class="vd-empty">' + (S.guests.length ? 'Nadie coincide con el filtro.' : (S.ev ? 'Este evento todavía no tiene boletos vendidos.' : 'Todavía no hay eventos. Crea el primero en «Resumen».')) + '</div>'; return; }
        var gest = puedeGestionar();
        box.innerHTML = rows.map(function (g) {
            var inn = g.status === 'checked_in', vd = g.status === 'void';
            var st = vd ? 'Anulado' : (inn ? 'Adentro' + (g.checked_in_at ? ' · ' + fmtHora(g.checked_in_at) : '') : 'Pendiente');
            var btn = (gest && !vd) ? '<button type="button" class="vd-mini ' + (inn ? 'undo' : '') + '" data-g="' + esc(g.guest_id) + '" data-in="' + (inn ? '0' : '1') + '">' + (inn ? 'Deshacer' : 'Marcar ingreso') + '</button>' : '';
            var contacto = [g.guest_phone, g.guest_email].filter(Boolean).join(' · ');
            return '<div class="vd-row' + (inn ? ' in' : '') + (vd ? ' void' : '') + (S.flash[g.guest_id] ? ' vd-flash' : '') + '" data-id="' + esc(g.guest_id) + '"><span class="vd-n">' + esc(g.guest_name || 'Sin nombre') + '</span>' +
                '<span class="vd-l">' + esc(g.label || '') + '</span><span class="vd-c">' + esc(contacto) + '</span><span><span class="vd-st">' + esc(st) + '</span>' + btn + '</span></div>';
        }).join('');
        S.flash = {};
    }

    // ── Lectura en vivo: lista + contador. Una carga a la vez; si llega otra mientras tanto, la vieja no pinta. ──
    async function refresh(silent) {
        if (!S.db || !S.ev) { if (S.built) renderAll(); return; }
        var my = ++S.seq, ev = S.ev;
        var g = null, s = null;
        try {
            var res = await Promise.all([S.db.rpc('venue_door_guests', { p_event_id: ev }), S.db.rpc('venue_door_summary', { p_event_id: ev })]);
            g = res[0]; s = res[1];
        } catch (e) { g = { error: e }; }
        if (my !== S.seq || ev !== S.ev) return;
        var live = $('vd-live-t');
        if (!g || g.error) {
            var em = String((g && g.error && g.error.message) || '');
            var sinSql = /venue_door_guests/.test(em) && /exist|find|schema/i.test(em);
            S.err = sinSql ? 'Falta aplicar el SQL de la puerta (20261007_venue_salas_seguridad_y_crear_evento.sql): hasta entonces la lista no puede mostrarse.' : '';
            if (live) live.textContent = sinSql ? S.err : 'Sin conexión: reintentando…';
            if (S.built) renderRows();
            return;
        }
        S.err = '';
        var prev = {}; S.guests.forEach(function (x) { prev[x.guest_id] = x.status; });
        var nuevo = (g.data || []).map(function (x) { return x; });
        var nsum = (s && !s.error && s.data && s.data.ok) ? s.data : null;
        if (live) live.textContent = 'En vivo · actualizado ' + fmtHora(new Date());
        var sig = JSON.stringify(nuevo) + JSON.stringify(nsum) + ev;
        if (sig === S.sig && S.guests.length === nuevo.length) return;               // nada cambió: no se vuelve a dibujar (evita parpadeos y pérdida del foco)
        S.sig = sig;
        if (S.guests.length) nuevo.forEach(function (x) { if (x.status === 'checked_in' && prev[x.guest_id] && prev[x.guest_id] !== 'checked_in') S.flash[x.guest_id] = true; });
        S.guests = nuevo;
        S.sum = nsum;
        if (S.sum) { var eo = evObj(ev); if (eo) eo.doors_closed_at = S.sum.doors_closed_at || null; }
        if (S.built) renderAll();
    }
    function startPolling() {
        if (S.timer) return;
        S.timer = setInterval(function () {
            if (document.visibilityState !== 'visible') return;
            var listaVisible = S.listBox && S.listBox.offsetParent !== null;
            var scanAbierto = $('vd-scan') && $('vd-scan').classList.contains('open');
            if (S.ev && (listaVisible || scanAbierto)) refresh(true);
        }, 3000);
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && S.listBox && S.listBox.offsetParent !== null) refresh(true); });
    }

    async function toggleDoors() {
        var e = evObj(S.ev); if (!e || !S.sum) return;
        var cerrar = !S.sum.closed, c = counts();
        if (cerrar && c.pending > 0 && !window.confirm('Todavía faltan ' + c.pending + ' persona' + (c.pending === 1 ? '' : 's') + ' por entrar. ¿Cerrar las entradas de todos modos?')) return;
        var b = $('vd-doors'); b.disabled = true;
        var r = await S.db.rpc('venue_event_set_doors', { p_event_id: S.ev, p_closed: cerrar });
        b.disabled = false;
        if (r.error || !r.data || !r.data.ok) { window.alert(r.error && /no_autorizado/.test(r.error.message || '') ? 'Tu cuenta no puede cerrar ni abrir las entradas.' : 'No se pudo cambiar el estado de las entradas. Intenta de nuevo.'); return; }
        e.doors_closed_at = r.data.doors_closed_at || null;
        refresh(true);
    }
    async function setCheckin(guestId, mark) {
        var r = await S.db.rpc('venue_guest_set_checkin', { p_guest_id: guestId, p_checked_in: mark });
        if (r.error) { window.alert(/not_allowed/.test(r.error.message || '') ? 'Tu cuenta no tiene permiso para esto en este local.' : 'No se pudo registrar. Intenta de nuevo.'); }
        else if (r.data && !r.data.ok) { window.alert(r.data.code === 'already_used' ? 'Ese pase ya había ingresado.' : r.data.code === 'not_checked_in' ? 'Ese pase todavía no había ingresado.' : r.data.code === 'cancelled' ? 'Ese pase está anulado.' : 'No se pudo registrar.'); }
        if (mark) S.flash[guestId] = true;
        refresh(true);
    }

    // ── Resultado en pantalla (verde/rojo) + sonido ──
    function beep(ok) {
        try {
            var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
            var ctx = S.scan.ctx || (S.scan.ctx = new AC()); if (ctx.state === 'suspended') ctx.resume();
            var t0 = ctx.currentTime;
            (ok ? [[880, 0, .16]] : [[220, 0, .18], [220, .26, .18]]).forEach(function (n) {
                var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = n[0]; o.type = ok ? 'sine' : 'square';
                g.gain.value = .18; o.connect(g); g.connect(ctx.destination); o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2]);
            });
        } catch (e) { /* sin sonido */ }
        try { if (navigator.vibrate) navigator.vibrate(ok ? [120] : [220, 90, 220]); } catch (e2) { /* ok */ }
    }
    function ensureOverlays() {
        if ($('vd-result')) return;
        var r = document.createElement('div'); r.id = 'vd-result'; r.setAttribute('role', 'alert'); r.addEventListener('click', hideResult); document.body.appendChild(r);
        var m = document.createElement('div'); m.id = 'vd-scan'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Escáner de puerta');
        m.innerHTML = '<div class="vd-scan-top"><select id="vd-scan-event" aria-label="Evento de esta puerta"></select><button type="button" id="vd-scan-full">Pantalla completa</button><button type="button" id="vd-scan-close">Cerrar</button></div>' +
            '<div class="vd-scan-stage"><video id="vd-scan-video" playsinline muted></video><div class="vd-scan-frame"></div><div class="vd-scan-msg" id="vd-scan-msg"></div></div>' +
            '<div class="vd-scan-manual"><input type="text" id="vd-scan-input" placeholder="Lector USB: dispara aquí · o pega el enlace/código del ticket" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" id="vd-scan-go">Validar</button></div>';
        document.body.appendChild(m);
        $('vd-scan-close').addEventListener('click', closeScanner);
        $('vd-scan-full').addEventListener('click', function () { setFull(!enFull()); });
        $('vd-scan-event').addEventListener('change', function () { S.ev = this.value; S.guests = []; S.sum = null; S.sig = ''; refresh(true); focusReader(); });
        $('vd-scan-go').addEventListener('click', function () { var i = $('vd-scan-input'), v = i.value; i.value = ''; S.scan.last = ''; if (!String(v).trim()) { focusReader(); return; } hideResult(); handle(v, $('vd-scan-event').value); });
        $('vd-scan-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('vd-scan-go').click(); });
        document.addEventListener('keydown', function (e) {
            if (!m.classList.contains('open') || e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
            var t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA') return;
            var i = $('vd-scan-input'); if (i) i.focus();
        }, true);
        window.addEventListener('pagehide', stopCamera);
        document.addEventListener('visibilitychange', function () {
            if (!m.classList.contains('open')) return;
            if (document.hidden) stopCamera(); else if (!S.scan.stream && !S.scan.starting) startCamera();
        });
        document.addEventListener('click', function () { try { if (S.scan.ctx && S.scan.ctx.state === 'suspended') S.scan.ctx.resume(); } catch (e) { /* ok */ } }, true);
    }
    function showResult(ok, title, lines) {
        var box = $('vd-result');
        box.className = 'show ' + (ok ? 'ok' : 'bad');
        box.innerHTML = '<div class="big">' + (ok ? '✔' : '✖') + '</div><h2>' + esc(title) + '</h2>' + (lines || []).filter(Boolean).map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '<div class="tap">Toca para continuar</div>';
        beep(ok);
        clearTimeout(S.scan.hide); S.scan.hide = setTimeout(hideResult, ok ? 2200 : 3400);
    }
    function focusReader() {
        try {
            if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
                var open = $('vd-scan') && $('vd-scan').classList.contains('open');
                var i = open ? $('vd-scan-input') : (S.listBox && S.listBox.offsetParent !== null ? $('vd-reader') : null); if (i) i.focus();
            }
        } catch (e) { /* ok */ }
    }
    function hideResult() { clearTimeout(S.scan.hide); var b = $('vd-result'); if (b) b.className = ''; S.scan.busy = false; focusReader(); }

    // Valida un código (URL https://…/t/<uuid> o el UUID plano) contra el evento elegido; la base decide (local, día, puerta abierta, pase usado).
    async function handle(raw, eventId) {
        if (S.scan.busy || !S.db) return;
        ensureOverlays();
        var m = UUID_RE.exec(String(raw || '')), now = Date.now();
        if (!m) { if (raw !== S.scan.last || now - S.scan.lastAt > 3000) { S.scan.last = raw; S.scan.lastAt = now; S.scan.busy = true; showResult(false, 'QR no reconocido', ['No es un ticket de Miami DJ Beat.']); } return; }
        var id = m[0].toLowerCase();
        if (id === S.scan.last && now - S.scan.lastAt < 4000) return;           // la cámara lee el mismo QR muchas veces: una sola vez
        S.scan.last = id; S.scan.lastAt = now;
        if (!eventId) { S.scan.busy = true; showResult(false, 'Elige el evento', ['Selecciona el evento de esta puerta.']); return; }
        S.scan.busy = true;
        var res = null, err = null;
        try { var r = await S.db.rpc('venue_ticket_scan', { p_order_id: id, p_event_id: eventId, p_qty: 1 }); res = r.data; err = r.error; } catch (e) { err = e; }
        if (err || !res) {
            var em = String((err && err.message) || '');
            showResult(false, 'Sin validar', [em.indexOf('not_allowed') >= 0 ? 'Tu cuenta no tiene permiso para validar en este local.' : 'No se pudo validar. Intenta de nuevo.']); return;
        }
        var nombre = res.reservation_name || 'Invitado';
        var pl = (res.pass && Array.isArray(res.items) && res.items[0] && res.items[0].label) ? String(res.items[0].label) : '';
        if (res.ok) {
            if (res.pass && res.guest_id) {                                       // la fila se pone roja al instante, sin esperar a la próxima lectura
                S.guests.forEach(function (g) { if (g.guest_id === res.guest_id) { g.status = 'checked_in'; g.checked_in_at = res.checked_in_at || new Date().toISOString(); S.flash[g.guest_id] = true; } });
                S.sig = '';                                                        // la próxima lectura vuelve a dibujar con lo que diga la base
                if (S.built) renderRows();
            }
            showResult(true, 'Ingreso registrado', [nombre, pl, 'Ingresaron: ' + res.checked_in_qty + ' de ' + res.total_qty]);
            refresh(true); return;
        }
        refresh(true);
        if (res.code === 'wrong_date') { showResult(false, 'Evento fuera de fecha', ['El escáner solo valida el evento del día.', res.event_date ? 'Este evento es del ' + fechaLarga(res.event_date) + '.' : 'Este evento no tiene fecha.']); return; }
        if (res.code === 'doors_closed') { showResult(false, 'Entradas cerradas', ['Este evento ya cerró sus entradas.', 'El dueño o el manager puede reabrirlas desde «Boletos».']); return; }
        if (res.code === 'invalid_event' && res.ticket_event_date) { showResult(false, 'Ticket de otra fecha', [res.pass ? nombre : '', (res.ticket_event_title || 'Otro evento') + ' · ' + fechaLarga(res.ticket_event_date), 'No es el evento de hoy.']); return; }
        var hora = res.code === 'already_used' && res.checked_in_at ? 'Ya ingresó a las ' + fmtHora(res.checked_in_at) : '';
        showResult(false, res.code === 'already_used' ? (res.pass ? 'Este pase ya fue utilizado' : 'Ya ingresaron todas las entradas') : (SCAN_REASON[res.code] ? SCAN_REASON[res.code].replace(/\.$/, '') : 'Rechazado'), [nombre === 'Invitado' && !res.pass ? '' : nombre, pl, hora]);
    }

    // ── Cámara (BarcodeDetector nativo o jsQR de respaldo para Safari/iPhone) ──
    var _cv = null;
    function decodeJs(src) {
        if (typeof window.jsQR !== 'function') return '';
        var w0 = src.videoWidth || src.width, h0 = src.videoHeight || src.height; if (!w0 || !h0) return '';
        var sc = Math.min(1, 640 / w0), w = Math.round(w0 * sc), h = Math.round(h0 * sc);
        if (!_cv) _cv = document.createElement('canvas'); if (_cv.width !== w) _cv.width = w; if (_cv.height !== h) _cv.height = h;
        var ctx = _cv.getContext('2d'); ctx.drawImage(src, 0, 0, w, h);
        var r = window.jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
        return r && r.data ? String(r.data) : '';
    }
    async function tick() {
        var v = $('vd-scan-video'); if (S.scan.busy || !v || v.readyState < 2) return;
        var ev = $('vd-scan-event').value;
        if (S.scan.mode === 'js') { try { var code = decodeJs(v); if (code) handle(code, ev); } catch (e) { /* ok */ } return; }
        if (!S.scan.det) return;
        try { var found = await S.scan.det.detect(v); if (found && found.length) handle(found[0].rawValue, ev); } catch (e) { /* ok */ }
    }
    function msg(t) { var m = $('vd-scan-msg'); if (!m) return; m.textContent = t || ''; m.style.display = t ? '' : 'none'; }
    async function startCamera() {
        if (S.scan.starting || S.scan.stream) return;
        S.scan.starting = true;
        var v = $('vd-scan-video');
        try {
            if (!window.isSecureContext) { msg('La cámara solo funciona con HTTPS. Abre esta página desde la dirección segura (https://) o usa el lector / pega el código abajo.'); return; }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg('Este navegador no permite usar la cámara. Usa un lector USB o pega el código abajo.'); return; }
            var nativeOk = false;
            if ('BarcodeDetector' in window) { try { var fm = await window.BarcodeDetector.getSupportedFormats(); nativeOk = !fm || fm.indexOf('qr_code') !== -1; } catch (eB) { nativeOk = false; } }
            if (nativeOk) { S.scan.det = new window.BarcodeDetector({ formats: ['qr_code'] }); S.scan.mode = 'native'; }
            else if (typeof window.jsQR === 'function') { S.scan.det = null; S.scan.mode = 'js'; }
            else { msg('Este navegador no puede leer códigos QR con la cámara. Usa un lector USB o pega el código abajo.'); return; }
            var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            if (!$('vd-scan').classList.contains('open') || document.hidden) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
            S.scan.stream = stream; v.srcObject = stream; await v.play();
            msg('Apunta la cámara al QR del ticket.');
            clearInterval(S.scan.timer); S.scan.timer = setInterval(tick, 250);
        } catch (e) {
            var n = e && e.name;
            if (S.scan.stream) { S.scan.stream.getTracks().forEach(function (t) { t.stop(); }); S.scan.stream = null; }
            msg(n === 'NotAllowedError' ? 'Permiso de cámara denegado en el navegador. Actívalo en los ajustes del sitio, o usa el lector / pega el código abajo.'
                : n === 'NotReadableError' ? 'La cámara está ocupada por otra aplicación o pestaña. Ciérrala y vuelve a abrir el escáner.'
                : n === 'NotFoundError' ? 'No se detectó cámara en este dispositivo. Usa un lector USB o pega el código abajo.'
                : 'No se pudo abrir la cámara (' + (n || 'error') + '). Usa el lector o pega el código abajo.');
        } finally { S.scan.starting = false; }
    }
    function stopCamera() {
        clearInterval(S.scan.timer); S.scan.timer = 0;
        if (S.scan.stream) { S.scan.stream.getTracks().forEach(function (t) { t.stop(); }); S.scan.stream = null; }
        var v = $('vd-scan-video'); if (v) { try { v.pause(); } catch (e) { /* ok */ } v.srcObject = null; }
    }
    // El escáner SOLO ofrece el evento del día (la base lo impone igual: 'wrong_date').
    async function openScanner(eventId) {
        if (!S.db || S.scan.opening) return;
        ensureOverlays();
        var m = $('vd-scan'); if (m.classList.contains('open')) return;
        S.scan.opening = true;
        try {
            m.classList.add('open'); S.scan.busy = false; S.scan.last = ''; S.scan.lastAt = 0;
            try { var AC = window.AudioContext || window.webkitAudioContext; if (AC && !S.scan.ctx) S.scan.ctx = new AC(); if (S.scan.ctx && S.scan.ctx.state === 'suspended') S.scan.ctx.resume(); } catch (e) { /* ok */ }
            msg('Cargando eventos…');
            try { await loadEvents(); } catch (e2) { /* se usa lo que haya */ }
            var hoy = diaDeNegocio(), deHoy = S.events.filter(function (e) { return e.event_date === hoy; });
            var sel = $('vd-scan-event');
            sel.innerHTML = deHoy.length ? deHoy.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc('HOY · ' + (e.title || 'Evento') + (e.venue_rooms && e.venue_rooms.name ? ' · ' + e.venue_rooms.name : '') + (e.doors_closed_at ? ' · CERRADO' : '')) + '</option>'; }).join('') : '<option value="">Sin evento hoy</option>';
            if (eventId && deHoy.some(function (e) { return e.id === eventId; })) sel.value = eventId; else if (deHoy.length) sel.value = deHoy[0].id;
            if (sel.value) { S.ev = sel.value; refresh(true); }
            focusReader();
            if (!deHoy.length) { msg('No hay ningún evento hoy: el escáner solo valida el evento del día. La lista de boletos sigue disponible.'); return; }
            startCamera();
        } finally { S.scan.opening = false; }
    }
    function closeScanner() {
        stopCamera(); hideResult();
        var m = $('vd-scan'); if (m) m.classList.remove('open');
        if (S.listBox && S.listBox.offsetParent !== null) { fillSelect(); refresh(true); }
    }

    // ── Panel «Escáner» del menú lateral: botón grande + el evento del día ──
    function buildScanPanel() {
        var b = S.scanBox; if (!b) return;
        b.innerHTML = '<div id="vd-sp-info" class="cc-res-meta">Cargando…</div><div class="vd-bar"><button type="button" class="vd-btn go" id="vd-sp-open">📷 Abrir escáner</button><button type="button" class="vd-btn" id="vd-sp-full">Pantalla completa</button></div>' +
            '<p class="cc-hint">Valida los códigos QR con la cámara del teléfono o con un lector USB conectado a la computadora. Solo vale el evento del día: los tickets de otras fechas se rechazan.</p>';
        $('vd-sp-open').addEventListener('click', function () { openScanner(null); });
        $('vd-sp-full').addEventListener('click', function () { setFull(!enFull()); });
    }
    async function paintScanPanel() {
        var info = $('vd-sp-info'); if (!info) return;
        try { await loadEvents(); } catch (e) { /* ok */ }
        var hoy = diaDeNegocio(), deHoy = S.events.filter(function (e) { return e.event_date === hoy; });
        info.innerHTML = deHoy.length ? 'Evento de hoy: <b>' + deHoy.map(function (e) { return esc(e.title || 'Evento'); }).join(' · ') + '</b>' : 'No hay ningún evento hoy: el escáner solo valida el evento del día.';
        $('vd-sp-open').disabled = !deHoy.length;
    }

    // ── API ──
    async function onShow(which) {
        if (!S.db) return;
        if (which === 'boletos') {
            if (!S.built) buildList();
            try { await loadEvents(); } catch (e) { /* ok */ }
            fillSelect(); renderAll(); refresh(false); focusReader();
        } else if (which === 'escaner') {
            if (!$('vd-sp-info')) buildScanPanel();
            paintScanPanel();
        }
    }
    function init(o) {
        S.db = o.db; S.venue = o.venueId; S.role = o.role; S.listBox = o.listBox; S.scanBox = o.scanBox;
        css(); ensureOverlays(); startPolling();
    }
    // Abre la lista de boletos en un evento concreto (desde «Resumen»).
    function showEvent(id) { S.ev = id; S.guests = []; S.sum = null; S.sig = ''; S.err = ''; if (S.built) { fillSelect(); renderAll(); refresh(false); } }
    root.mdjVenueDoor = { init: init, onShow: onShow, openScanner: openScanner, showEvent: showEvent, diaDeNegocio: diaDeNegocio };
})(typeof window !== 'undefined' ? window : this);
