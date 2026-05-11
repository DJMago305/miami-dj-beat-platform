// web/js/agenda-engine.js
// NÚCLEO FASE 3: Motor Avanzado JSONB
// FASE 2: Inteligencia de día (misma lógica que el motor de eventos) + panel inferior.

(function () {
    const HOLIDAYS_US_2026 = {
        '2026-02-14': { es: 'San Valentín', en: "Valentine's Day" },
        '2026-03-17': { es: 'San Patricio', en: "St. Patrick's Day" },
        '2026-04-03': { es: 'Viernes Santo', en: 'Good Friday' },
        '2026-04-05': { es: 'Pascua', en: 'Easter' },
        '2026-05-25': { es: 'Memorial Day', en: 'Memorial Day' },
        '2026-07-04': { es: 'Independencia', en: 'Independence Day' },
        '2026-09-07': { es: 'Labor Day', en: 'Labor Day' },
        '2026-10-31': { es: 'Halloween', en: 'Halloween' },
        '2026-11-26': { es: 'Acción de Gracias', en: 'Thanksgiving' },
        '2026-12-25': { es: 'Navidad', en: 'Christmas' },
        '2026-12-31': { es: 'Fin de Año', en: "New Year's Eve" }
    };

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
        const h = HOLIDAYS_US_2026[dateStr];
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
    window.mdjAgendaEngineContext = { profile: {} };

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

                while (d < info.end) {
                    const dateStr = d.toISOString().split('T')[0];
                    const day = d.getDay();
                    const dayOfWeek = day; // 0(Sun) - 6(Sat)
                    const dayStrKey = String(dayOfWeek);

                    // --- MOTOR NACIONAL DE FERIADOS USA (BILINGÜE) ---
                    const holidaysUS2026 = {
                        "2026-02-14": { es: "San Valentín", en: "Valentine's Day" },
                        "2026-03-17": { es: "San Patricio", en: "St. Patrick's Day" },
                        "2026-04-03": { es: "Viernes Santo", en: "Good Friday" },
                        "2026-04-05": { es: "Pascua", en: "Easter" },
                        "2026-05-25": { es: "Memorial Day", en: "Memorial Day" },
                        "2026-07-04": { es: "Independencia", en: "Independence Day" },
                        "2026-09-07": { es: "Labor Day", en: "Labor Day" },
                        "2026-10-31": { es: "Halloween", en: "Halloween" },
                        "2026-11-26": { es: "Acción de Gracias", en: "Thanksgiving" },
                        "2026-12-25": { es: "Navidad", en: "Christmas" },
                        "2026-12-31": { es: "Fin de Año", en: "New Year's Eve" }
                    };

                    if (holidaysUS2026[dateStr]) {
                        const currentLang = localStorage.getItem('mdjpro_lang') || 'en';
                        const holidayName = holidaysUS2026[dateStr][currentLang];
                        
                        events.push({
                            title: holidayName,
                            start: dateStr,
                            allDay: true,
                            className: 'ag-evt-holiday',
                            extendedProps: {
                                isResident: false,
                                venue: holidayName,
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
                            className: 'ag-evt-vacation'
                        });
                        d.setDate(d.getDate() + 1);
                        continue;
                    }

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
                                venue: 'Día bloqueado',
                                time: '',
                                type: '🔒 BLOQUEADO'
                            }
                        });
                    } else if (daySlot && Array.isArray(daySlot.events) && daySlot.events.length) {
                        daySlot.events.forEach(function (ev) {
                            const timeLabel =
                                ev.from && ev.to ? `${ev.from} - ${ev.to}` : ev.from || ev.to || '';
                            const venue = ev.venue || 'Fiesta privada';
                            const cancelled = (ev.status || '').toUpperCase() === 'CANCELLED';
                            events.push({
                                title: cancelled ? `❌ ${venue}` : (ev.title || venue),
                                start: dateStr,
                                allDay: true,
                                backgroundColor: '#00c853',
                                borderColor: '#00c853',
                                className: cancelled ? 'ag-evt-vacation' : 'ag-evt-night',
                                extendedProps: {
                                    isResident: false,
                                    venue,
                                    city: ev.city || 'Miami, FL',
                                    time: timeLabel,
                                    type: cancelled ? '❌ CANCELADO' : '🎧 EVENTO',
                                    status: ev.status
                                }
                            });
                        });
                    } else if (recurringSet.has(day)) {
                        events.push({
                            title: 'Residencia',
                            start: dateStr,
                            allDay: true,
                            backgroundColor: '#ff9800',
                            borderColor: '#ff9800',
                            className: 'ag-evt-night ag-evt-resident',
                            extendedProps: {
                                isResident: true,
                                venue: 'Key Largo / Miami Venue',
                                time: '22:00 - 03:00',
                                type: '🏠 RESIDENCIA'
                            }
                        });
                    }

                    if (availabilityDatesSet.has(dateStr)) {
                        events.push({
                            title: 'Residencia/Bloqueado',
                            start: dateStr,
                            allDay: true,
                            className: 'ag-evt-fallback ag-evt-resident',
                            extendedProps: {
                                isResident: true,
                                venue: 'Residencia/Bloqueado',
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
                            let timeLabel = (shift.start_time || '') + (shift.end_time ? ' - ' + shift.end_time : '');
                            let venue = shift.venue_name || 'MDJ Event';
                            
                            let cssClass = shift.slot_type === 'day' ? 'ag-evt-day' : 'ag-evt-night';
                            if (shift.is_resident) cssClass += ' ag-evt-resident';

                            events.push({
                                title: `${typeLabel} | ${timeLabel} | ${venue}`,
                                start: dateStr,
                                allDay: true, // rendered as blocks
                                className: cssClass,
                                extendedProps: {
                                    isResident: shift.is_resident,
                                    venue: venue,
                                    time: timeLabel,
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
                                lbl = "RESIDENTE GENÉRICO";
                            }

                            events.push({
                                title: lbl,
                                start: dateStr,
                                allDay: true,
                                className: fClass
                            });
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
                    holDiv.style.cssText = "position:absolute; top:0; bottom:0; left:0; right:0; display:flex; justify-content:center; align-items:center; text-align:center; padding: 0 5px; font-size:10px; font-weight:800; color:var(--gold); text-shadow: 0 0 8px var(--gold); text-transform:uppercase; z-index:30; pointer-events:none;";
                    holDiv.innerText = arg.event.title;
                    cell.style.position = 'relative';
                    cell.appendChild(holDiv);
                }
            },
            dateClick: function (arg) {
                if (typeof window.handleEventWeather === 'function') {
                    window.handleEventWeather(arg.dateStr);
                }
                try {
                    window.mdjLastAgendaDateStr = arg.dateStr;
                } catch (_e) { /* noop */ }

                document.querySelectorAll('.fc-daygrid-day-frame.active-glow').forEach(function (el) {
                    el.classList.remove('active-glow');
                });

                const frame = arg.dayEl.querySelector('.fc-daygrid-day-frame');
                if (!frame) return;

                const profile = (window.mdjAgendaEngineContext && window.mdjAgendaEngineContext.profile) || {};
                const intel =
                    typeof window.mdjIntelligenceForDate === 'function'
                        ? window.mdjIntelligenceForDate(arg.dateStr, profile)
                        : null;

                let cellPayloads = [];
                const eventsJson = frame.getAttribute('data-events');
                if (eventsJson) {
                    try {
                        cellPayloads = JSON.parse(eventsJson);
                    } catch (_parseErr) {
                        cellPayloads = [];
                    }
                }

                let glowRgb = intel && intel.glowRgb ? intel.glowRgb : '100, 116, 139';
                if (eventsJson) {
                    const isNightActive = frame.getAttribute('data-botAlpha') === '0.2';
                    const fallback = isNightActive
                        ? frame.getAttribute('data-nightColor')
                        : frame.getAttribute('data-dayColor');
                    if (fallback && fallback.length > 0) {
                        glowRgb = fallback;
                    }
                }
                frame.style.setProperty('--glow-color', 'rgba(' + glowRgb + ', 0.8)');
                frame.style.setProperty('--glow-solid', 'rgba(' + glowRgb + ', 1.0)');
                frame.classList.add('active-glow');

                const emptyUI = document.getElementById('dash-event-detail-empty');
                const dataUI = document.getElementById('dash-event-detail-data');
                if (emptyUI) emptyUI.style.display = 'none';
                if (dataUI) {
                    dataUI.style.display = 'block';
                    if (typeof window.mdjRenderAgendaDetailPanel === 'function' && intel) {
                        dataUI.innerHTML = window.mdjRenderAgendaDetailPanel(intel, cellPayloads);
                    } else if (intel) {
                        dataUI.innerHTML =
                            '<div style="color:#fff;font-weight:800;">' + (intel.formatted || arg.dateStr) + '</div>';
                    }
                }

                if (window.activeGlowTimer) clearTimeout(window.activeGlowTimer);
                window.activeGlowTimer = setTimeout(function () {
                    frame.classList.remove('active-glow');
                    if (emptyUI) emptyUI.style.display = 'block';
                    if (dataUI) dataUI.style.display = 'none';
                }, 120000);
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
                window.handleEventWeather(localToday);
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

// 🌐 ROBUST MODULE TRIGGER: DOMContentLoaded o ejecución inmediata si el DOM ya está listo.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void initAgendaEngine();
    });
} else {
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
