/**
 * MDJ Dashboard Hub — CONECTOR Fase 1 (Agenda + clima en #tab-dashboard).
 */
(function () {
    'use strict';

    var VERSION = '20260513-fase1-agenda';

    function onDashboard() {
        return !!document.getElementById('tab-dashboard');
    }

    function calendarHasGrid() {
        var el = document.getElementById('calendar-master');
        return !!(el && el.querySelector('.fc-daygrid-body tr'));
    }

    function reflowAgenda() {
        if (!window.mdjCalendarInstance) return;
        try {
            window.mdjCalendarInstance.updateSize();
        } catch (_e) { /* noop */ }
    }

    function startAgenda() {
        if (!document.getElementById('calendar-master') && !document.getElementById('agenda-calendar-master')) {
            return Promise.resolve();
        }
        if (typeof window.FullCalendar === 'undefined') {
            console.warn('[MDJ Hub] FullCalendar no cargado');
            return Promise.resolve();
        }
        if (window.mdjCalendarInstance && calendarHasGrid()) {
            reflowAgenda();
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

    function refreshAgendaData() {
        if (!window.mdjCalendarInstance) return;
        try {
            if (typeof window.mdjCalendarInstance.refetchEvents === 'function') {
                window.mdjCalendarInstance.refetchEvents();
            }
            reflowAgenda();
        } catch (_e) { /* noop */ }
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
        var wantFlow = qs.get('tab') === 'flow' || (panel && panel.classList.contains('active'));
        if (!wantFlow || typeof window.loadFlowData !== 'function') return;
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
            setTimeout(fn, 1500);
        }).catch(function () {
            setTimeout(fn, 800);
        });
    }

    function connectAgendaTab() {
        if (!onDashboard()) return;

        void startAgenda().then(function () {
            reflowAgenda();
            startWeather();
            whenSessionReady(function () {
                refreshAgendaData();
                startWeather();
                startFlowIfVisible();
            });
        });

        setTimeout(function () {
            if (!calendarHasGrid()) void startAgenda();
            reflowAgenda();
            startWeather();
        }, 1800);
    }

    document.addEventListener('djCalendarRendered', function () {
        setTimeout(function () {
            reflowAgenda();
            startWeather();
        }, 120);
    });

    connectAgendaTab();

    window.MDJ_DASHBOARD_HUB = {
        version: VERSION,
        connect: connectAgendaTab,
        agenda: startAgenda,
        refreshAgenda: refreshAgendaData,
        weather: startWeather,
        flow: startFlowIfVisible
    };
})();
