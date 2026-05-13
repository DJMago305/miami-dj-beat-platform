// web/js/agenda-engine.js
// NÚCLEO FASE 3: Motor Avanzado JSONB
// FASE 2: Inteligencia de día (misma lógica que el motor de eventos) + panel inferior.

(function () {
    const HOLIDAYS_US_2026 = {
        '2026-02-14': { es: 'San Valentín', en: "Valentine's Day" },
        '2026-03-17': { es: 'San Patricio', en: "St. Patrick's Day" },
        '2026-04-03': { es: 'Viernes Santo', en: 'Good Friday' },
        '2026-04-05': { es: 'Pascua', en: 'Easter' },
        '2026-05-05': { es: 'Cinco de Mayo', en: 'Cinco de Mayo' },
        '2026-05-25': { es: 'Memorial Day', en: 'Memorial Day' },
        '2026-07-04': { es: 'Independencia', en: 'Independence Day' },
        '2026-09-07': { es: 'Labor Day', en: 'Labor Day' },
        '2026-10-31': { es: 'Halloween', en: 'Halloween' },
        '2026-11-26': { es: 'Acción de Gracias', en: 'Thanksgiving' },
        '2026-12-25': { es: 'Navidad', en: 'Christmas' },
        '2026-12-31': { es: 'Fin de Año', en: "New Year's Eve" }
    };
    const MDJ_AGENDA_HOLIDAYS_US_2026 = HOLIDAYS_US_2026;

    function mdjGetAgendaContext(profile) {
        const p = profile && typeof profile === 'object' ? profile : {};
        const weekly = p.weekly_schedule || {};
        const isDbResident = p.is_resident === true;
        const availSched = p.availability_schedule && typeof p.availability_schedule === 'object' ? p.availability_schedule : null;
        const vacJsonStart = availSched && availSched.vacation_start;
        const vacJsonEnd = availSched && availSched.vacation_end;
        const availability = (availSched && availSched.schedule) || {};
        const recurring = (availSched && Array.isArray(availSched.recurring_days)) ? availSched.recurring_days : [];
        const mapR = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
        const recurringSet = new Set();
        recurring.forEach(function (r) {
            let n;
            if (typeof r === 'string') n = mapR[r.toLowerCase()] ?? Number(r);
            else n = Number(r);
            if (Number.isInteger(n) && n >= 0 && n <= 6) recurringSet.add(n);
        });
        const availabilityDatesSet = new Set(
            Array.isArray(p.availability) ? p.availability.filter(Boolean) : []
        );
        const activeDaysStr = p.active_days || '';
        const activeDaysArr = activeDaysStr
            .split(',')
            .map(function (x) { return x.trim(); })
            .filter(Boolean)
            .map(Number);
        const customH = p.special_days || p.custom_holidays || '';
        const customHolidaysArr = customH.split(',').map(function (x) { return x.trim(); }).filter(Boolean);

        return {
            p,
            weekly,
            isDbResident,
            vacationColStart: p.vacation_start || null,
            vacationColEnd: p.vacation_end || null,
            vacJsonStart,
            vacJsonEnd,
            availability,
            recurringSet,
            availabilityDatesSet,
            activeDaysArr,
            customHolidaysArr
        };
    }

    /**
     * Misma prioridad relativa que el bucle de events() para un único YYYY-MM-DD.
     * Expone capas y un tag principal para UI (badges / glow).
     */
    window.mdjIntelligenceForDate = function (dateStr, profile) {
        const empty = {
            dateStr: dateStr,
            formatted: dateStr,
            primaryTag: 'rest',
            badgeLabel: 'Sin perfil / día libre',
            dayType: 'descanso',
            dayTypeLabel: 'Descanso o no configurado',
            details: ['Carga el perfil (Supabase) o conecta sesión para ver agenda real.'],
            glowRgb: '100, 116, 139',
            layers: {}
        };
        if (!dateStr || typeof dateStr !== 'string') return empty;

        const curLang = (typeof localStorage !== 'undefined' && localStorage.getItem('mdjpro_lang')) || 'en';
        const c = mdjGetAgendaContext(profile);
        const p = c.p;
        const parts = dateStr.split('-').map(Number);
        if (parts.length !== 3) return empty;
        const dLocal = new Date(parts[0], parts[1] - 1, parts[2]);
        const day = dLocal.getDay();
        const dayStrKey = String(day);
        const formatted = dLocal.toLocaleDateString(curLang === 'en' ? 'en-US' : 'es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const vacJsonStart = c.vacJsonStart;
        const vacJsonEnd = c.vacJsonEnd;
        const inVacCol =
            c.vacationColStart &&
            c.vacationColEnd &&
            dateStr >= c.vacationColStart &&
            dateStr <= c.vacationColEnd;
        const inVacJson = vacJsonStart && vacJsonEnd && dateStr >= vacJsonStart && dateStr <= vacJsonEnd;
        const isVacation = inVacCol || inVacJson;

        const daySlot = c.availability[dateStr] || null;
        const isBlockedSlot = daySlot && daySlot.status === 'blocked';
        const privateEvts =
            daySlot && Array.isArray(daySlot.events)
                ? daySlot.events.filter(function (e) { return (e.status || '').toUpperCase() !== 'CANCELLED'; })
                : [];
        const hasRecurring = c.recurringSet.has(day);
        const onAvailList = c.availabilityDatesSet.has(dateStr);
        const dailyShifts = (c.weekly[dayStrKey] || []).filter(function (s) { return s && s.enabled; });
        const activeDayOpen = c.activeDaysArr.indexOf(day) >= 0 && p.available !== false;
        const holiday = holidayLabelForDate(dateStr, c, curLang);

        if (inVacation) {
            return {
                dateStr,
                formatted,
                primaryTag: 'vacaciones',
                badgeLabel: 'Bloqueado (vacaciones)',
                dayType: 'vacaciones',
                dayTypeLabel: 'Vacaciones / blackout',
                details: [
                    'Rango en perfil: vacation_start / vacation_end o availability_schedule.vacation_*.'
                ],
                glowRgb: '255, 107, 107',
                layers: { vacation: true }
            };
        }

        const details = [];
        if (holiday) {
            details.push(holiday.label);
        }
        if (isBlockedSlot) {
            return {
                dateStr,
                formatted,
                primaryTag: 'blocked',
                badgeLabel: 'Bloqueado',
                dayType: 'trabajo',
                dayTypeLabel: 'Bloqueado (agenda manual)',
                details: details.concat(['Día bloqueado en availability_schedule.']),
                glowRgb: '239, 68, 68',
                layers: { holiday: holiday, blocked: true }
            };
        }
        if (privateEvts.length) {
            return {
                dateStr,
                formatted,
                primaryTag: 'private_event',
                badgeLabel: 'Evento privado',
                dayType: 'evento',
                dayTypeLabel: 'Evento / fiesta en agenda',
                details: privateEvts.map(function (e) {
                    return (e.title || e.venue || 'Evento') + (e.from ? ' · ' + e.from : '');
                }),
                glowRgb: '59, 130, 246',
                layers: { privateEvents: privateEvts, holiday: holiday }
            };
        }
        if (hasRecurring) {
            return {
                dateStr,
                formatted,
                primaryTag: 'residency',
                badgeLabel: 'Residencia',
                dayType: 'trabajo',
                dayTypeLabel: 'Residencia (día recurrente)',
                details: details.concat(['Día recurrente (availability_schedule.recurring_days).']),
                glowRgb: '197, 160, 89',
                layers: { residency: true, holiday: holiday }
            };
        }
        if (onAvailList) {
            return {
                dateStr,
                formatted,
                primaryTag: 'residency',
                badgeLabel: 'Marca de disponibilidad',
                dayType: 'mixto',
                dayTypeLabel: 'Bloqueo / residencia (lista availability)',
                details: details.concat(['Fecha en array profile.availability.']),
                glowRgb: '197, 160, 89',
                layers: { availabilityList: true, holiday: holiday }
            };
        }
        if (dailyShifts.length) {
            const lines = dailyShifts.map(function (s) {
                return (
                    (s.slot_type === 'day' ? 'Día' : 'Noche') +
                    (s.venue_name ? ' · ' + s.venue_name : '') +
                    (s.start_time ? ' ' + s.start_time : '') +
                    (s.end_time ? '–' + s.end_time : '') +
                    (s.is_resident ? ' (residente)' : '')
                );
            });
            return {
                dateStr,
                formatted,
                primaryTag: c.isDbResident || dailyShifts.some(function (s) { return s.is_resident; })
                    ? 'residency'
                    : 'work',
                badgeLabel: 'Turnos (weekly_schedule)',
                dayType: 'trabajo',
                dayTypeLabel: 'Trabajo programado',
                details: details.concat(lines),
                glowRgb: '34, 197, 94',
                layers: { weeklyShifts: dailyShifts, holiday: holiday }
            };
        }
        if (activeDayOpen) {
            return {
                dateStr,
                formatted,
                primaryTag: c.isDbResident ? 'residency' : 'available',
                badgeLabel: c.isDbResident ? 'Disponible (perfil residente)' : 'Disponible (active_days)',
                dayType: 'trabajo',
                dayTypeLabel: c.isDbResident ? 'Disponible (marca residente genérica)' : 'Día de trabajo (plantilla activa)',
                details: details.concat(
                    c.isDbResident
                        ? ['Perfil: is_resident; slot genérico.']
                        : ['Día incluido en active_days; perfil available !== false.']
                ),
                glowRgb: c.isDbResident ? '197, 160, 89' : '34, 197, 94',
                layers: { openDay: true, holiday: holiday }
            };
        }

        return {
            dateStr,
            formatted,
            primaryTag: holiday ? 'feriado' : 'rest',
            badgeLabel: holiday ? 'Feriado' : 'Descanso',
            dayType: holiday ? 'feriado' : 'descanso',
            dayTypeLabel: holiday ? 'Feriado' : 'Sin actividad configurada',
            details: holiday
                ? [holiday.label]
                : [
                    'Sin turno en weekly_schedule, fuera de active_days o available en false (si aplica).',
                    'weekly_schedule, availability_schedule, active_days, vacaciones: revisa panel Config agenda.'
                ],
            glowRgb: holiday ? '197, 160, 89' : '100, 116, 139',
            layers: { rest: true, holiday: holiday }
        };
    };

    function holidayLabelForDate(dateStr, c, curLang) {
        const h = MDJ_AGENDA_HOLIDAYS_US_2026[dateStr];
        if (h) {
            return { label: h[curLang === 'en' ? 'en' : 'es'] + ' (USA / calendario motor)' };
        }
        if (c.customHolidaysArr && c.customHolidaysArr.indexOf(dateStr) >= 0) {
            return { label: 'Día personal / festivo (special_days o custom_holidays)' };
        }
        return null;
    }

    window.mdjRenderAgendaDetailPanel = function (intel, cellEventPayloads) {
        const pl = (cellEventPayloads && cellEventPayloads.length) ? cellEventPayloads : [];
        const tagToBadge = {
            available: { bg: 'rgba(34,197,94,0.15)', b: 'rgba(34,197,94,0.45)', t: 'Disponible' },
            work: { bg: 'rgba(34,197,94,0.12)', b: 'rgba(34,197,94,0.35)', t: 'Trabajo' },
            private_event: { bg: 'rgba(59,130,246,0.15)', b: 'rgba(59,130,246,0.5)', t: 'Evento privado' },
            blocked: { bg: 'rgba(239,68,68,0.12)', b: 'rgba(239,68,68,0.45)', t: 'Bloqueado' },
            vacaciones: { bg: 'rgba(239,68,68,0.12)', b: 'rgba(239,68,68,0.4)', t: 'Vacaciones' },
            evento: { bg: 'rgba(59,130,246,0.15)', b: 'rgba(59,130,246,0.5)', t: 'Evento' },
            feriado: { bg: 'rgba(197,160,89,0.15)', b: 'rgba(197,160,89,0.4)', t: 'Feriado' },
            residency: { bg: 'rgba(249,115,22,0.15)', b: 'rgba(249,115,22,0.45)', t: 'Residencia' },
            mixto: { bg: 'rgba(249,115,22,0.12)', b: 'rgba(249,115,22,0.35)', t: 'Mixto' },
            rest: { bg: 'rgba(100,116,139,0.12)', b: 'rgba(100,116,139,0.4)', t: 'Descanso' },
            holiday: { bg: 'rgba(197,160,89,0.15)', b: 'rgba(197,160,89,0.4)', t: 'Feriado' }
        };
        const b = tagToBadge[intel.primaryTag] || tagToBadge.rest;
        const wCond = (typeof document !== 'undefined' && document.getElementById('weather-condition-label'))
            ? document.getElementById('weather-condition-label').textContent.trim()
            : '—';
        const wTemp = (typeof document !== 'undefined' && document.getElementById('weather-main-temp'))
            ? document.getElementById('weather-main-temp').textContent.trim()
            : '—';
        const loc = (typeof document !== 'undefined' && document.getElementById('weather-location'))
            ? document.getElementById('weather-location').textContent.trim()
            : '';

        let eventBlocks = pl
            .map(function (e) {
                const t = (e && e.type) ? e.type : '';
                const v = (e && e.venue) ? e.venue : (e.fallbackTitle || '');
                const tm = (e && e.time) ? e.time : '';
                return (
                    '<div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:12px;">' +
                    '<div style="font-size:9px; color:var(--gold); font-weight:800; text-transform:uppercase;">' + escapeHtml(t) + (tm ? ' · ' + escapeHtml(tm) : '') + '</div>' +
                    '<div style="font-weight:800; color:#fff; margin-top:2px;">' + escapeHtml(String(v)) + '</div>' +
                    '</div>'
                );
            })
            .join('');

        if (!eventBlocks) {
            eventBlocks =
                '<div style="font-size:12px; color:rgba(255,255,255,0.5);">Sin capas extra de evento en la celda (misma lógica que arriba).</div>';
        }

        return (
            '<div style="margin-bottom:10px; border-radius:10px; padding:10px 12px; background:' + b.bg + '; border:1px solid ' + b.b + ';">' +
            '<div style="font-size:10px; font-weight:900; letter-spacing:0.1em; color:rgba(255,255,255,0.5);">TIPO DE DÍA</div>' +
            '<div style="font-size:15px; font-weight:900; color:#fff; margin-top:2px;">' + escapeHtml(intel.dayTypeLabel) + ' · ' + escapeHtml(b.t) + '</div>' +
            '<div style="font-size:11px; color:rgba(255,255,255,0.55); margin-top:2px;">' + escapeHtml(intel.formatted) + '</div>' +
            '</div>' +
            '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px;">' +
            '<span style="font-size:10px; font-weight:800; padding:3px 8px; border-radius:6px; background:' + b.bg + '; border:1px solid ' + b.b + ';">' + escapeHtml(intel.badgeLabel) + '</span>' +
            '</div>' +
            '<div style="font-size:10px; font-weight:800; text-transform:uppercase; color:rgba(255,255,255,0.45); margin:10px 0 4px;">Capas (perfil + agenda)</div>' +
            '<ul style="margin:0; padding-left:16px; font-size:12px; color:rgba(255,255,255,0.8); line-height:1.45;">' +
            intel.details
                .map(function (l) { return '<li style="margin-bottom:4px;">' + escapeHtml(l) + '</li>'; })
                .join('') +
            '</ul>' +
            (eventBlocks ? '<div style="margin-top:12px;"><div style="font-size:10px; font-weight:800; color:var(--gold); margin-bottom:4px; text-transform:uppercase;">Detalle celda (FullCalendar)</div>' + eventBlocks + '</div>' : '') +
            '<div style="margin-top:16px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08);">' +
            '<div style="font-size:10px; font-weight:800; color:var(--gold); text-transform:uppercase; margin-bottom:4px;">Clima (módulo hero · misma carga)</div>' +
            '<div style="font-size:14px; font-weight:800;">' + escapeHtml(wTemp) + ' · ' + escapeHtml(wCond) + (loc ? ' <span style="color:rgba(255,255,255,0.45); font-size:11px; font-weight:600;">' + escapeHtml(loc) + '</span>' : '') + '</div>' +
            '<div style="font-size:10px; color:rgba(255,255,255,0.35); margin-top:4px;">Pronóstico activo: hero + lista 10 días. Ingresos potenciales: próximamente.</div>' +
            '</div>'
        );
    };

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    window.mdjRenderAgendaCalendarLegend = function () {
        const el = document.getElementById('calendar-legend');
        if (!el) return;
        el.innerHTML =
            '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px 18px;align-items:center;font-size:9px;font-weight:800;letter-spacing:0.3px;text-transform:uppercase;color:rgba(255,255,255,0.6);">' +
            '<span><span style="color:#22c55e" aria-hidden="true">●</span> Disponible</span>' +
            '<span><span style="color:#ef4444" aria-hidden="true">●</span> Bloqueado</span>' +
            '<span><span style="color:#f97316" aria-hidden="true">●</span> Residencia</span>' +
            '<span><span style="color:#3b82f6" aria-hidden="true">●</span> Evento privado</span>' +
            '</div>';
    };
})();

async function initAgendaEngine() {
    const calendarEl =
        document.getElementById('agenda-calendar-master') || document.getElementById('calendar-master');
    if (!calendarEl) {
        console.error("❌ [AgendaEngine] Contenedor de calendario no encontrado.");
        return;
    }

    const sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : window.supabase;
    if (!sb) {
        console.warn('[AgendaEngine] Supabase no disponible; calendario en modo vacío.');
    }

    if (window.mdjCalendarInstance) {
        try {
            window.mdjCalendarInstance.destroy();
        } catch (_destroyErr) { /* noop */ }
        window.mdjCalendarInstance = null;
    }
    calendarEl.innerHTML = '';

    // Perfil remoto opcional: el grid se pinta siempre; los eventos leen este contexto en cada refetch.
    window.mdjAgendaEngineContext = { profile: {}, assignedLeads: [], eventFlowsByLeadId: {} };

        // 2) Estilos encapsulados (una sola hoja si se reinicia el motor)
        if (!document.getElementById('agenda-engine-calendar-styles')) {
            const style = document.createElement('style');
            style.id = 'agenda-engine-calendar-styles';
            style.innerHTML = `
            #calendar-master {
                font-family: 'Inter', system-ui, sans-serif;
            }
            
            /* EXTINCIÓN DE MARGEN Y PADDING */
            #calendar-master .fc-header-toolbar {
                margin: 0 !important;
                padding: 0 !important;
            }
            #calendar-master .fc-daygrid-day-frame {
                padding: 0 !important;
            }
            #calendar-master .fc-daygrid-body {
                padding: 0 !important;
            }
            #calendar-master .fc-daygrid-day-events {
                padding: 0 !important;
                margin: 0 !important;
                min-height: 0 !important;
            }
            
            /* COMPRESIÓN VERTICAL EXTREMA */
            #calendar-master .fc-theme-standard th,
            #calendar-master .fc-theme-standard td,
            #calendar-master .fc-theme-standard .fc-scrollgrid {
                border-color: rgba(255,255,255,0.08) !important;
            }
            
            /* El cuadro nativo de eventos está apagado */
            #calendar-master .fc-event {
                display: none !important;
            }
        `;
            document.head.appendChild(style);
        }

        // 3) FullCalendar: instancia y render antes del fetch remoto (Fase 1 — nunca bloquear el grid).
        const calendarInDashboardAgenda = !!(
            document.getElementById('tab-dashboard') &&
            document.getElementById('calendar-master') &&
            document.getElementById('tab-dashboard').contains(document.getElementById('calendar-master'))
        );

        function mdjAgendaEventsForDate(calendar, dateStr) {
            if (!calendar || !dateStr) return [];
            return calendar.getEvents().filter(function (ev) {
                const eStart = ev.startStr || (ev.start ? ev.start.toISOString().split('T')[0] : '');
                return eStart.startsWith(dateStr);
            });
        }

        function mdjAgendaNormalizeTime(t) {
            if (t == null) return '';
            const s = String(t).trim();
            if (!s || s === '--:--') return '';
            return s;
        }

        function mdjAgendaIsRealNotesUuid(id) {
            if (id == null || id === '') return false;
            const s = String(id).trim();
            if (/^res-/i.test(s)) return false;
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
        }

        window.mdjAgendaIsRealNotesUuid = mdjAgendaIsRealNotesUuid;

        function mdjAgendaPreferredTimes(profile) {
            let prefStart = '';
            let prefEnd = '';
            if (profile && profile.preferred_schedule) {
                const parts = String(profile.preferred_schedule).split('-');
                prefStart = mdjAgendaNormalizeTime(parts[0]);
                prefEnd = mdjAgendaNormalizeTime(parts[1]);
            }
            return { prefStart: prefStart, prefEnd: prefEnd };
        }

        function mdjAgendaShiftMeta(weekly, dayStrKey, profile) {
            const shifts = (weekly && weekly[dayStrKey]) || [];
            const active = shifts.filter(function (s) { return s && s.enabled; });
            const res = active.find(function (s) { return s.is_resident; }) || active[0] || null;
            const pref = mdjAgendaPreferredTimes(profile);
            if (res) {
                const start = mdjAgendaNormalizeTime(res.start_time) || pref.prefStart;
                const end = mdjAgendaNormalizeTime(res.end_time) || pref.prefEnd;
                const venue = (res.venue_name || '').trim();
                if (!venue && !start && !end) return null;
                const timeLabel = start && end ? start + ' - ' + end : (start || end || '');
                return {
                    title: venue || 'Turno',
                    venue: venue,
                    city: venue || (profile && profile.city) || '',
                    time: timeLabel,
                    start_time: start || null,
                    end_time: end || null,
                    source: 'weekly_schedule',
                    panel_status: 'scheduled_shift',
                    notes_event_id: null
                };
            }
            if (pref.prefStart && pref.prefEnd) {
                const timeLabel = pref.prefStart + ' - ' + pref.prefEnd;
                return {
                    title: 'Horario global (CONFIG)',
                    venue: '',
                    city: (profile && profile.city) || '',
                    time: timeLabel,
                    start_time: pref.prefStart,
                    end_time: pref.prefEnd,
                    source: 'preferred_schedule',
                    panel_status: 'scheduled_shift',
                    notes_event_id: null
                };
            }
            return null;
        }

        function mdjAgendaPickPrimaryEvent(events) {
            if (!events || !events.length) return null;
            const nonHoliday = events.filter(function (ev) {
                return !(ev.classNames && ev.classNames.includes('ag-evt-holiday'));
            });
            const pool = nonHoliday.length ? nonHoliday : events;
            const assignedLead = pool.find(function (ev) {
                return ev.extendedProps && ev.extendedProps.source === 'lead';
            });
            if (assignedLead) return assignedLead;
            const privateEv = pool.find(function (ev) {
                const ep = ev.extendedProps || {};
                return ep.source === 'availability_schedule' || (ep.venue && ep.start_time);
            });
            if (privateEv) return privateEv;
            const weeklyShift = pool.find(function (ev) {
                return ev.extendedProps && ev.extendedProps.source === 'weekly_schedule';
            });
            if (weeklyShift) return weeklyShift;
            const withVenue = pool.find(function (ev) {
                const ep = ev.extendedProps || {};
                if ((!startTime || !endTime) && window.mdjAgendaEngineContext && window.mdjAgendaEngineContext.profile) {
                const pref = mdjAgendaPreferredTimes(window.mdjAgendaEngineContext.profile);
                if (!startTime && pref.prefStart) startTime = pref.prefStart;
                if (!endTime && pref.prefEnd) endTime = pref.prefEnd;
            }
            const venue = (ep.venue || '').trim();
                return venue.length > 0;
            });
            if (withVenue) return withVenue;
            const resident = pool.find(function (ev) {
                return ev.classNames && ev.classNames.includes('ag-evt-resident');
            });
            if (resident) return resident;
            const gig = pool.find(function (ev) {
                return ev.classNames && (ev.classNames.includes('ag-evt-day') || ev.classNames.includes('ag-evt-night'));
            });
            if (gig) return gig;
            return pool[0];
        }

        function mdjAgendaAllowPreferredTimeFallback(ep) {
            if (!ep) return false;
            const src = ep.source;
            return (
                src === 'weekly_schedule' ||
                src === 'preferred_schedule' ||
                src === 'active_days' ||
                ep.isResident === true
            );
        }

        function mdjAgendaParseLeadTimes(lead) {
            if (!lead) return { start_time: null, end_time: null };
            let start = lead.start_time || lead.event_start_time || null;
            let end = lead.end_time || lead.event_end_time || null;
            const single = lead.event_time;
            if ((!start || !end) && single != null && String(single).trim() !== '') {
                const parts = String(single).split(/[-–—]/).map(function (s) { return s.trim(); });
                if (!start && parts[0]) start = parts[0];
                if (!end && parts[1]) end = parts[1];
            }
            if ((!start || !end) && lead.notes != null && lead.notes !== '') {
                try {
                    const n = typeof lead.notes === 'string' ? JSON.parse(lead.notes) : lead.notes;
                    if (n && typeof n === 'object') {
                        if (!start) start = n.start_time || n.event_start_time || n.from || null;
                        if (!end) end = n.end_time || n.event_end_time || n.to || null;
                    }
                } catch (_e) { /* notes no JSON */ }
            }
            return {
                start_time: mdjAgendaNormalizeTime(start),
                end_time: mdjAgendaNormalizeTime(end)
            };
        }

        function mdjAgendaFlowBlockTimes(flow) {
            if (!flow) return { start_time: null, end_time: null };
            const meta = flow.meta && typeof flow.meta === 'object' ? flow.meta : {};
            let start = meta.start_time || meta.event_start_time || null;
            let end = meta.end_time || meta.event_end_time || null;
            const blocks = Array.isArray(flow.blocks) ? flow.blocks : [];
            blocks.forEach(function (b) {
                if (!b || typeof b !== 'object') return;
                const bs = mdjAgendaNormalizeTime(b.start);
                const be = mdjAgendaNormalizeTime(b.end);
                if (bs && !start) start = bs;
                if (be && !end) end = be;
            });
            return {
                start_time: mdjAgendaNormalizeTime(start),
                end_time: mdjAgendaNormalizeTime(end)
            };
        }

        function mdjAgendaWeatherPayload(event, dateStr) {
            if (!event || !event.title) return dateStr;
            const ep = event.extendedProps || {};
            let startTime = mdjAgendaNormalizeTime(ep.start_time);
            let endTime = mdjAgendaNormalizeTime(ep.end_time);
            if ((!startTime || !endTime) && ep.time && typeof ep.time === 'string' && ep.time !== 'ALL DAY') {
                const parts = ep.time.split('-').map(function (s) { return s.trim(); });
                if (!startTime && parts[0]) startTime = mdjAgendaNormalizeTime(parts[0]);
                if (!endTime && parts[1]) endTime = mdjAgendaNormalizeTime(parts[1]);
            }
            if (
                (!startTime || !endTime) &&
                mdjAgendaAllowPreferredTimeFallback(ep) &&
                window.mdjAgendaEngineContext &&
                window.mdjAgendaEngineContext.profile
            ) {
                const pref = mdjAgendaPreferredTimes(window.mdjAgendaEngineContext.profile);
                if (!startTime && pref.prefStart) startTime = pref.prefStart;
                if (!endTime && pref.prefEnd) endTime = pref.prefEnd;
            }
            const venue = (ep.venue || '').trim();
            const eventName = (ep.event_name || event.title || '').trim();
            const notesEventId = mdjAgendaIsRealNotesUuid(ep.notes_event_id)
                ? ep.notes_event_id
                : (mdjAgendaIsRealNotesUuid(ep.flowId)
                    ? ep.flowId
                    : (mdjAgendaIsRealNotesUuid(ep.eventId) ? ep.eventId : null));
            return {
                title: eventName || 'Evento',
                startStr: event.startStr || dateStr,
                extendedProps: Object.assign({}, ep, {
                    eventId: notesEventId,
                    notes_event_id: notesEventId,
                    event_name: eventName || null,
                    venue: venue,
                    city: ep.city || (venue || undefined),
                    start_time: startTime || null,
                    end_time: endTime || null
                })
            };
        }

        async function mdjAgendaRefreshEventFlows(sb, leadRows) {
            if (!window.mdjAgendaEngineContext) return;
            window.mdjAgendaEngineContext.eventFlowsByLeadId = {};
            if (!sb || !leadRows || !leadRows.length) return;
            const leadIds = leadRows.map(function (l) { return l.id; }).filter(Boolean);
            if (!leadIds.length) return;
            try {
                const { data, error } = await sb
                    .from('mdj_event_flows')
                    .select('id, lead_id, status, venue, event_date, blocks, meta, title')
                    .in('lead_id', leadIds);
                if (error || !Array.isArray(data)) return;
                const map = {};
                data.forEach(function (row) {
                    if (!row || !row.lead_id) return;
                    if (!map[row.lead_id]) map[row.lead_id] = row;
                });
                window.mdjAgendaEngineContext.eventFlowsByLeadId = map;
            } catch (_flowErr) { /* RLS o tabla ausente */ }
        }

        async function mdjAgendaRefreshAssignedLeads(sb, profileRow) {
            if (!window.mdjAgendaEngineContext) return;
            window.mdjAgendaEngineContext.assignedLeads = [];
            window.mdjAgendaEngineContext.eventFlowsByLeadId = {};
            if (!sb || !profileRow || !profileRow.id) return;
            try {
                const { data, error } = await sb
                    .from('leads')
                    .select('id, event_type, event_date, location, status, budget, notes')
                    .eq('assigned_dj_id', profileRow.id)
                    .order('event_date', { ascending: true });
                if (!error && Array.isArray(data)) {
                    window.mdjAgendaEngineContext.assignedLeads = data;
                    await mdjAgendaRefreshEventFlows(sb, data);
                }
            } catch (_leadErr) { /* noop */ }
        }

        window.mdjAgendaRefreshAssignedLeads = mdjAgendaRefreshAssignedLeads;

        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
            locale: 'es',
            firstDay: 0,
            themeSystem: 'standard',
            height: 'auto',
            displayEventTime: false,
            events: function (info, successCallback) {
                const safeProfile = window.mdjAgendaEngineContext?.profile || {};
                const weekly = safeProfile.weekly_schedule || {};
                const isDbResident = safeProfile.is_resident === true;
                const vStart = safeProfile.vacation_start ? new Date(safeProfile.vacation_start + 'T00:00:00') : null;
                let vEnd = safeProfile.vacation_end ? new Date(safeProfile.vacation_end + 'T00:00:00') : null;
                if (vEnd) {
                    vEnd.setHours(23, 59, 59, 999);
                }
                const availSched =
                    safeProfile.availability_schedule && typeof safeProfile.availability_schedule === 'object'
                        ? safeProfile.availability_schedule
                        : null;
                const vStartJson = availSched?.vacation_start
                    ? new Date(availSched.vacation_start + 'T00:00:00')
                    : null;
                let vEndJson = availSched?.vacation_end
                    ? new Date(availSched.vacation_end + 'T00:00:00')
                    : null;
                if (vEndJson) {
                    vEndJson.setHours(23, 59, 59, 999);
                }
                const availabilityDatesSet = new Set(
                    Array.isArray(safeProfile.availability) ? safeProfile.availability.filter(Boolean) : []
                );
                const activeDaysStr = safeProfile.active_days || "";
                const activeDaysArr = activeDaysStr.split(',').filter(x => x.trim() !== "").map(Number);
                const customHolidaysStr = safeProfile.special_days || safeProfile.custom_holidays || "";
                const customHolidaysArr = customHolidaysStr.split(',').filter(x => x.trim() !== "");

                const events = [];
                let d = new Date(info.start.valueOf());

                const availability = safeProfile.availability_schedule?.schedule || {};
                const recurring = safeProfile.availability_schedule?.recurring_days || [];
                const mapR = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
                const recurringSet = new Set();
                if (Array.isArray(recurring)) {
                    recurring.forEach(function (r) {
                        let n;
                        if (typeof r === 'string') {
                            n = mapR[r.toLowerCase()] ?? Number(r);
                        } else {
                            n = Number(r);
                        }
                        if (Number.isInteger(n) && n >= 0 && n <= 6) recurringSet.add(n);
                    });
                }

                if (isDbResident) {
                    activeDaysArr.forEach(function (n) {
                        if (Number.isInteger(n) && n >= 0 && n <= 6) recurringSet.add(n);
                    });
                }

                while (d < info.end) {
                    const dateStr = d.toISOString().split('T')[0];
                    const day = d.getDay();
                    const dayOfWeek = day; // 0(Sun) - 6(Sat)
                    const dayStrKey = String(dayOfWeek);

                    // --- MOTOR NACIONAL DE FERIADOS USA (BILINGÜE) ---
                    if (MDJ_AGENDA_HOLIDAYS_US_2026[dateStr]) {
                        const currentLang = localStorage.getItem('mdjpro_lang') || 'en';
                        const holidayName = MDJ_AGENDA_HOLIDAYS_US_2026[dateStr][currentLang];
                        
                        events.push({
                            title: holidayName,
                            start: dateStr,
                            allDay: true,
                            className: 'ag-evt-holiday',
                            extendedProps: {
                                source: 'holiday',
                                isResident: false,
                                venue: holidayName,
                                event_name: holidayName,
                                time: "ALL DAY",
                                type: currentLang === 'es' ? "⭐ FERIADO USA" : "⭐ USA HOLIDAY"
                            }
                        });
                    } else if (customHolidaysArr.includes(dateStr)) {
                        // FESTIVO PERSONALIZADO DESDE EL PROFILE
                        events.push({
                            title: "P-DAY", // Personal Day o el custom
                            start: dateStr,
                            allDay: true,
                            className: 'ag-evt-holiday',
                            extendedProps: {
                                isResident: false,
                                venue: "⭐ PERSONAL HOLIDAY",
                                time: "ALL DAY",
                                type: "⭐ EXCLUSIVE"
                            }
                        });
                    }

                    // Check Vacation: columnas perfil + availability_schedule JSON
                    const isJsonVacation =
                        vStartJson &&
                        vEndJson &&
                        !isNaN(vStartJson.getTime()) &&
                        !isNaN(vEndJson.getTime()) &&
                        d >= vStartJson &&
                        d <= vEndJson;
                    const isVacation =
                        (vStart && vEnd && d >= vStart && d <= vEnd) || isJsonVacation;

                    if (isVacation) {
                        // BLOQUEO ABSOLUTO (Blackout)
                        events.push({
                            title: "VACACIONES / BLACKOUT",
                            start: dateStr,
                            allDay: true,
                            className: 'ag-evt-vacation',
                            extendedProps: {
                                source: 'vacation',
                                venue: '',
                                event_name: 'Vacaciones / Blackout',
                                panel_status: 'vacation'
                            }
                        });
                        d.setDate(d.getDate() + 1);
                        continue;
                    }

                    const assignedLeads = window.mdjAgendaEngineContext.assignedLeads || [];
                    const flowsByLead = window.mdjAgendaEngineContext.eventFlowsByLeadId || {};
                    assignedLeads.forEach(function (lead) {
                        if (lead.event_date !== dateStr) return;
                        const venue = (lead.location || '').trim();
                        const title = (lead.event_type || 'Evento asignado').trim();
                        const flow = flowsByLead[lead.id] || null;
                        const flowTimes = mdjAgendaFlowBlockTimes(flow);
                        const leadTimes = mdjAgendaParseLeadTimes(lead);
                        const flowVenue = flow && flow.venue ? String(flow.venue).trim() : '';
                        events.push({
                            title: title,
                            start: dateStr,
                            allDay: true,
                            className: 'ag-evt-night ag-evt-assigned',
                            extendedProps: {
                                source: 'lead',
                                eventId: lead.id,
                                flowId: flow ? flow.id : null,
                                notes_event_id: flow ? flow.id : lead.id,
                                event_name: title,
                                venue: flowVenue || venue,
                                city: flowVenue || venue || undefined,
                                status: lead.status,
                                flow_status: flow ? flow.status : null,
                                start_time: flowTimes.start_time || leadTimes.start_time || null,
                                end_time: flowTimes.end_time || leadTimes.end_time || null,
                                type: '🎧 EVENTO ASIGNADO'
                            }
                        });
                    });

                    // 1) availability_schedule: bloqueo, fiestas privadas por fecha, 2) residencia recurrente
                    const daySlot = availability[dateStr];
                    if (daySlot && daySlot.status === 'blocked') {
                        events.push({
                            title: 'Día bloqueado',
                            start: dateStr,
                            allDay: true,
                            className: 'ag-evt-vacation',
                            extendedProps: {
                                isResident: false,
                                source: 'blocked',
                                venue: '',
                                time: '',
                                type: '🔒 BLOQUEADO'
                            }
                        });
                    } else if (daySlot && Array.isArray(daySlot.events) && daySlot.events.length) {
                        daySlot.events.forEach(function (ev) {
                            const timeLabel =
                                ev.from && ev.to ? `${ev.from} - ${ev.to}` : ev.from || ev.to || '';
                            const venue = (ev.venue || '').trim();
                            const cancelled = (ev.status || '').toUpperCase() === 'CANCELLED';
                            events.push({
                                title: cancelled ? ('❌ ' + (venue || ev.title || 'Evento')) : (ev.title || venue || 'Evento'),
                                start: dateStr,
                                allDay: true,
                                backgroundColor: '#00c853',
                                borderColor: '#00c853',
                                className: cancelled ? 'ag-evt-vacation' : 'ag-evt-night',
                                extendedProps: {
                                    source: 'availability_schedule',
                                    isResident: false,
                                    eventId: mdjAgendaIsRealNotesUuid(ev.id) ? ev.id : null,
                                    notes_event_id: mdjAgendaIsRealNotesUuid(ev.id) ? ev.id : null,
                                    event_name: ev.title || null,
                                    venue: venue,
                                    city: ev.city || venue || undefined,
                                    time: timeLabel,
                                    start_time: mdjAgendaNormalizeTime(ev.from),
                                    end_time: mdjAgendaNormalizeTime(ev.to),
                                    type: cancelled ? '❌ CANCELADO' : '🎧 EVENTO',
                                    status: ev.status
                                }
                            });
                        });
                    } else if (recurringSet.has(day)) {
                        const dailyForRes = weekly[dayStrKey] || [];
                        const hasWeeklyShift = dailyForRes.some(function (s) { return s && s.enabled; });
                        if (!hasWeeklyShift) {
                            const meta = mdjAgendaShiftMeta(weekly, dayStrKey, safeProfile);
                            if (meta) {
                                events.push({
                                    title: meta.title,
                                    start: dateStr,
                                    allDay: true,
                                    backgroundColor: '#ff9800',
                                    borderColor: '#ff9800',
                                    className: 'ag-evt-night ag-evt-resident',
                                    extendedProps: {
                                        source: meta.source || 'weekly_schedule',
                                        isResident: true,
                                        eventId: null,
                                        notes_event_id: null,
                                        event_name: meta.title,
                                        venue: meta.venue,
                                        city: meta.city,
                                        time: meta.time,
                                        start_time: meta.start_time,
                                        end_time: meta.end_time,
                                        panel_status: 'scheduled_shift',
                                        type: '🏠 RESIDENCIA'
                                    }
                                });
                            }
                        }
                    }

                    if (availabilityDatesSet.has(dateStr)) {
                        events.push({
                            title: 'Disponibilidad',
                            start: dateStr,
                            allDay: true,
                            className: 'ag-evt-fallback ag-evt-resident',
                            extendedProps: {
                                source: 'legacy_availability',
                                isResident: true,
                                venue: '',
                                time: '',
                                type: '🔒 DISPONIBILIDAD'
                            }
                        });
                    }

                    // Check Weekly Schedule for this specific day
                    const dailyShifts = weekly[dayStrKey] || [];
                    const activeShifts = dailyShifts.filter(s => s.enabled);

                    if (activeShifts.length > 0) {
                        // MODO JSONB: Tenemos turnos!
                        // Ordenar: día primero, noche después
                        activeShifts.sort((a, b) => a.slot_type === 'day' ? -1 : 1);

                        activeShifts.forEach((shift) => {
                            let typeLabel = shift.slot_type === 'day' ? '☀️' : '🌙';
                            const pref = mdjAgendaPreferredTimes(safeProfile);
                            let startT = mdjAgendaNormalizeTime(shift.start_time) || pref.prefStart;
                            let endT = mdjAgendaNormalizeTime(shift.end_time) || pref.prefEnd;
                            let timeLabel = startT && endT ? startT + ' - ' + endT : (startT || endT || '');
                            let venue = (shift.venue_name || '').trim();

                            let cssClass = shift.slot_type === 'day' ? 'ag-evt-day' : 'ag-evt-night';
                            if (shift.is_resident) cssClass += ' ag-evt-resident';

                            events.push({
                                title: venue || (typeLabel + ' Turno'),
                                start: dateStr,
                                allDay: true,
                                className: cssClass,
                                extendedProps: {
                                    source: 'weekly_schedule',
                                    isResident: shift.is_resident,
                                    eventId: null,
                                    notes_event_id: null,
                                    event_name: venue || (typeLabel + ' Turno'),
                                    venue: venue,
                                    city: venue || undefined,
                                    time: timeLabel,
                                    start_time: startT || null,
                                    end_time: endT || null,
                                    panel_status: 'scheduled_shift',
                                    type: typeLabel
                                }
                            });
                        });
                    } else {
                        // FALLBACK GLOBAL
                        // Actuar según las reglas genéricas (Fase 1)
                        if (activeDaysArr.includes(dayOfWeek) && safeProfile.available !== false) {
                            // Está activo este día.
                            let fClass = 'ag-evt-fallback';
                            let lbl = "DISPONIBLE";

                            if (isDbResident) {
                                fClass += ' ag-evt-resident';
                                lbl = 'RESIDENTE GENÉRICO';
                            }

                            const meta = mdjAgendaShiftMeta(weekly, dayStrKey, safeProfile);
                            if (isDbResident && meta) {
                                events.push({
                                    title: meta.title,
                                    start: dateStr,
                                    allDay: true,
                                    className: fClass,
                                    extendedProps: {
                                        source: meta.source || 'weekly_schedule',
                                        isResident: true,
                                        eventId: null,
                                        notes_event_id: null,
                                        event_name: meta.title,
                                        venue: meta.venue,
                                        city: meta.city,
                                        time: meta.time,
                                        start_time: meta.start_time,
                                        end_time: meta.end_time,
                                        panel_status: 'scheduled_shift',
                                        type: '🏠 RESIDENCIA'
                                    }
                                });
                            } else if (!isDbResident) {
                                events.push({
                                    title: lbl,
                                    start: dateStr,
                                    allDay: true,
                                    className: fClass,
                                    extendedProps: {
                                        source: 'active_days',
                                        panel_status: 'available',
                                        type: 'DISPONIBLE'
                                    }
                                });
                            }
                        }
                    }

                    d.setDate(d.getDate() + 1);
                }

                successCallback(events);
            },
            eventContent: function (arg) {
                // CELDAS BIPARTITAS: 0 Texto, 0 Etiquetas. El evento es la celda misma.
                return { html: '' };
            },
            eventDidMount: function(arg) {
                // OCULTAR BLOQUES SÓLIDOS NATOS
                arg.el.style.display = 'none';

                const cell = arg.el.closest('.fc-daygrid-day-frame');
                if (!cell) return;

                // DIAGNÓSTICO DE TIPO DE EVENTO (COLOR)
                const isDay = arg.event.classNames.includes('ag-evt-day');
                const isNight = arg.event.classNames.includes('ag-evt-night');
                const isResident = arg.event.classNames.includes('ag-evt-resident');
                const isVacation = arg.event.classNames.includes('ag-evt-vacation');
                const isHoliday = arg.event.classNames.includes('ag-evt-holiday'); // Feriados USA

                // ASIGNACIÓN DE COLORES GLOBALES
                let colorRgb = '0, 255, 136'; // Default Verde (Gig)
                if (isVacation) colorRgb = '255, 107, 107'; 
                else if (isResident) colorRgb = '197, 160, 89'; 

                // Leer el estado actual de la celda
                let dayColor = cell.getAttribute('data-dayColor') || '255,255,255';
                let nightColor = cell.getAttribute('data-nightColor') || '255,255,255';
                let botAlpha = cell.getAttribute('data-botAlpha') || '0.02';
                let topAlpha = cell.getAttribute('data-topAlpha') || '0.02';

                // LÓGICA DE COLOR (Excluye a Holiday para permitir Ghosting / Transparencia Total)
                if (isVacation) {
                    dayColor = colorRgb; nightColor = colorRgb;
                    topAlpha = '0.2'; botAlpha = '0.2';
                } else {
                    if (isDay) { dayColor = colorRgb; topAlpha = '0.2'; }
                    if (isNight) { nightColor = colorRgb; botAlpha = '0.2'; }
                }

                // INYECCIÓN DEL ESTADO PARA PANEL DE EVENTOS (Regla de 10s)
                cell.setAttribute('data-dayColor', dayColor);
                cell.setAttribute('data-nightColor', nightColor);
                cell.setAttribute('data-topAlpha', topAlpha);
                cell.setAttribute('data-botAlpha', botAlpha);

                let eventsJson = cell.getAttribute('data-events');
                let eventsArr = eventsJson ? JSON.parse(eventsJson) : [];
                const payload = arg.event.extendedProps || {};
                payload.fallbackTitle = arg.event.title;
                eventsArr.push(payload);
                cell.setAttribute('data-events', JSON.stringify(eventsArr));

                // INYECCIÓN DE LA CELDA BIPARTITA O HOLOGRAMA PURO
                if (isDay || isNight || isVacation || isResident) {
                    cell.style.background = `linear-gradient(180deg, rgba(${dayColor}, ${topAlpha}) 50%, rgba(${nightColor}, ${botAlpha}) 50%)`;
                } else {
                    cell.style.background = 'transparent'; // Holograma puro sin fondo para días sin Gig
                }
                cell.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                cell.style.cursor = 'pointer';

                // --- LÓGICA DE FERIADOS FANTASMA (Superposición Absoluta) ---
                if (isHoliday) {
                    const holDiv = document.createElement('div');
                    holDiv.className = 'mdj-agenda-holiday-overlay';
                    if (!calendarInDashboardAgenda) {
                        holDiv.style.color = 'var(--gold)';
                        holDiv.style.textShadow = '0 0 8px var(--gold)';
                    }
                    holDiv.innerText = arg.event.title;
                    cell.appendChild(holDiv);
                }
            },
            dateClick: function (arg) {
                try {
                    window.mdjLastAgendaDateStr = arg.dateStr;
                } catch (_e) { /* noop */ }

                const frame = arg.dayEl.querySelector('.fc-daygrid-day-frame');
                const emptyUI = document.getElementById('dash-event-detail-empty');
                const dataUI = document.getElementById('dash-event-detail-data');
                const dayEvents = mdjAgendaEventsForDate(arg.view.calendar, arg.dateStr);
                const primaryEvent = mdjAgendaPickPrimaryEvent(dayEvents);
                const weatherTarget = mdjAgendaWeatherPayload(primaryEvent, arg.dateStr);

                if (typeof window.handleEventWeather === 'function') {
                    window.handleEventWeather(weatherTarget);
                }

                document.querySelectorAll('.fc-daygrid-day-frame.active-glow').forEach(function (el) {
                    el.classList.remove('active-glow');
                });

                if (!frame) return;

                const profile = (window.mdjAgendaEngineContext && window.mdjAgendaEngineContext.profile) || {};
                const intel =
                    typeof window.mdjIntelligenceForDate === 'function'
                        ? window.mdjIntelligenceForDate(arg.dateStr, profile)
                        : null;

                let glowRgb = intel && intel.glowRgb ? intel.glowRgb : '100, 116, 139';
                const isNightActive = frame.getAttribute('data-botAlpha') === '0.2';
                const fallback = isNightActive
                    ? frame.getAttribute('data-nightColor')
                    : frame.getAttribute('data-dayColor');
                if (fallback && fallback.length > 0) {
                    glowRgb = fallback;
                }
                frame.style.setProperty('--glow-color', 'rgba(' + glowRgb + ', 0.8)');
                frame.style.setProperty('--glow-solid', 'rgba(' + glowRgb + ', 1.0)');
                frame.classList.add('active-glow');

                if (emptyUI) emptyUI.style.display = 'none';
                if (dataUI) dataUI.style.display = 'block';

                if (window.activeGlowTimer) clearTimeout(window.activeGlowTimer);
                window.activeGlowTimer = setTimeout(function () {
                    frame.classList.remove('active-glow');
                    if (emptyUI) emptyUI.style.display = 'block';
                    if (dataUI) dataUI.style.display = 'none';
                    if (typeof window.handleEventWeather === 'function') {
                        const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                            .toISOString()
                            .split('T')[0];
                        const todayEv = mdjAgendaPickPrimaryEvent(
                            mdjAgendaEventsForDate(arg.view.calendar, localToday)
                        );
                        window.handleEventWeather(
                            todayEv ? mdjAgendaWeatherPayload(todayEv, localToday) : localToday
                        );
                    }
                }, 10000);
            },
            datesSet: function (info) {
                const el = document.getElementById('manual-calendar-title');
                if (!el || !info.view || !info.view.calendar) return;
                const d = info.view.calendar.getDate();
                const months = [
                    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
                ];
                el.textContent = `${months[d.getMonth()]} DE ${d.getFullYear()}`;
            }
        });

        calendar.render();
        window.mdjCalendarInstance = calendar;

        function mdjAgendaCalendarReflow() {
            try {
                calendar.updateSize();
            } catch (_reflowErr) { /* noop */ }
        }
        requestAnimationFrame(mdjAgendaCalendarReflow);
        setTimeout(mdjAgendaCalendarReflow, 200);
        if (!window.__mdjAgendaCalendarReflowBound) {
            window.__mdjAgendaCalendarReflowBound = true;
            window.addEventListener('resize', mdjAgendaCalendarReflow);
        }

        if (typeof window.mdjRenderAgendaCalendarLegend === 'function') {
            window.mdjRenderAgendaCalendarLegend();
        }

        document.dispatchEvent(new CustomEvent('djCalendarRendered', { detail: { view: null } }));

        if (sb) {
            try {
                const { data: { session } } = await sb.auth.getSession();
                if (!session) {
                    console.warn('[AgendaEngine] Sin sesión; agenda sin datos remotos.');
                } else {
                    const { data: profile, error: profErr } = await sb
                        .from('dj_profiles')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .maybeSingle();
                    if (profErr) {
                        console.warn('[AGENDA] profile error:', profErr);
                    } else {
                        window.mdjAgendaEngineContext.profile = profile || {};
                        await mdjAgendaRefreshAssignedLeads(sb, profile || {});
                    }
                }
            } catch (e) {
                console.warn('[AGENDA] profile error:', e);
            }
            calendar.refetchEvents();
        }

        setTimeout(() => {
            if (typeof window.handleEventWeather === 'function') {
                const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                    .toISOString()
                    .split('T')[0];
                const todayEv = mdjAgendaPickPrimaryEvent(mdjAgendaEventsForDate(calendar, localToday));
                window.handleEventWeather(
                    todayEv ? mdjAgendaWeatherPayload(todayEv, localToday) : localToday
                );
            }
        }, 400);
}

// Escuchar cambios de idioma globales para Forzar Refetch de los Feriados Traducidos
document.addEventListener('languageChanged', () => {
    if (window.mdjCalendarInstance) {
        window.mdjCalendarInstance.refetchEvents();
    }
    if (typeof window.mdjRenderAgendaCalendarLegend === 'function') {
        window.mdjRenderAgendaCalendarLegend();
    }
});

window.mdjStartAgendaEngine = function () {
    return initAgendaEngine();
};

if (window.MDJ_DASHBOARD_DEFER_AGENDA) {
    /* dj-dashboard: el hub llama mdjStartAgendaEngine tras cargar clima + flujo. */
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
        if (document.getElementById('calendar-master') || document.getElementById('agenda-calendar-master')) {
            void initAgendaEngine();
        }
    });
} else if (document.getElementById('calendar-master') || document.getElementById('agenda-calendar-master')) {
    void initAgendaEngine();
}

// 🔥 MÓDULO: FARO DEL TÍTULO DINÁMICO (Día Actual a 1Hz)
const setupDynamicIcon = () => {
    const dayIcon = document.getElementById('current-day-icon');
    if (!dayIcon) return;
    
    // Inyección inicial inmediata
    dayIcon.innerText = new Date().getDate();
    
    // Latido por segundo (Sincro absoluto sin reload)
    setInterval(() => {
        dayIcon.innerText = new Date().getDate();
    }, 1000);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDynamicIcon);
} else {
    setupDynamicIcon();
}
