/**
 * MDJ Dashboard Hub — CONECTOR (no reimplementa lógica).
 *
 * Cableado ya en dj-dashboard.html:
 *   Agenda  → #calendar-master, botones prev/next/today → mdjCalendarInstance
 *   Clima   → #booth-hero-container, weather-engine.js + event-weather.js
 *   Flujo   → switchDashTab('flow'), #metrics-range onchange → loadFlowData()
 *
 * Este archivo solo enlaza los módulos en el orden correcto al cargar.
 */
(function () {
    'use strict';

    var VERSION = '20260513-connect';

    function onDashboard() {
        return !!document.getElementById('tab-dashboard');
    }

    function startAgenda() {
        if (!document.getElementById('calendar-master') && !document.getElementById('agenda-calendar-master')) {
            return Promise.resolve();
        }
        if (window.mdjCalendarInstance) {
            try {
                window.mdjCalendarInstance.updateSize();
            } catch (_e) { /* noop */ }
            return Promise.resolve();
        }
        if (typeof window.mdjStartAgendaEngine === 'function') {
            return window.mdjStartAgendaEngine();
        }
        if (typeof initAgendaEngine === 'function') {
            return initAgendaEngine();
        }
        return Promise.resolve();
    }

    function startWeather() {
        window.__mdjWeatherLocked = false;
        if (typeof window.handleEventWeather !== 'function') return;
        if (!document.getElementById('booth-hero-container')) return;
        window.handleEventWeather();
    }

    function startFlowIfVisible() {
        var panel = document.getElementById('tab-flow');
        var qs = new URLSearchParams(window.location.search);
        var wantFlow = (qs.get('tab') === 'flow') || (panel && panel.classList.contains('active'));
        if (!wantFlow) return;
        if (typeof window.loadFlowData !== 'function') return;
        var mr = document.getElementById('metrics-range');
        window.loadFlowData(mr && mr.value ? mr.value : '1y');
    }

    function whenSessionReady(fn) {
        var sb = window.getSupabaseClient ? window.getSupabaseClient() : window.supabase;
        if (!sb || !sb.auth) {
            setTimeout(fn, 500);
            return;
        }
        sb.auth.getSession().then(function (res) {
            if (res.data && res.data.session) {
                fn();
                return;
            }
            if (sb.auth.onAuthStateChange) {
                var sub = sb.auth.onAuthStateChange(function (event, session) {
                    if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
                        try { sub.data.subscription.unsubscribe(); } catch (_e) { /* noop */ }
                        fn();
                    }
                });
            }
            setTimeout(fn, 1200);
        }).catch(function () {
            setTimeout(fn, 800);
        });
    }

    function connect() {
        if (!onDashboard()) return;

        void startAgenda().then(function () {
            if (window.mdjCalendarInstance) {
                try {
                    window.mdjCalendarInstance.updateSize();
                } catch (_e) { /* noop */ }
            }
            startWeather();
            whenSessionReady(startFlowIfVisible);
        });
    }

    document.addEventListener('djCalendarRendered', function () {
        setTimeout(function () {
            if (window.mdjCalendarInstance) {
                try {
                    window.mdjCalendarInstance.updateSize();
                } catch (_e) { /* noop */ }
            }
            startWeather();
        }, 120);
    });

    connect();

    window.MDJ_DASHBOARD_HUB = {
        version: VERSION,
        connect: connect,
        agenda: startAgenda,
        weather: startWeather,
        flow: startFlowIfVisible
    };
})();
