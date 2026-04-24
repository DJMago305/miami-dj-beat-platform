// web/js/agenda-engine.js
// NÚCLEO FASE 3: Motor Avanzado JSONB

async function initAgendaEngine() {
    const calendarEl =
        document.getElementById('agenda-calendar-master') || document.getElementById('calendar-master');
    if (!calendarEl) {
        console.error("❌ [AgendaEngine] Contenedor de calendario no encontrado.");
        return;
    }

    // 1. Supabase Connection
    const sb = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : window.supabase;
    if (!sb) {
        console.error("❌ AgendaEngine: Supabase no encontrado.");
        return;
    }

    try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session) {
            return;
        }

        // Fetch DJ Profile Data
        const { data: profile, error } = await sb
            .from('dj_profiles')
            .select('weekly_schedule, is_resident, vacation_start, vacation_end, active_days, available')
            .eq('user_id', session.user.id)
            .single();

        if (error) throw error;

        // Parse global vars
        const weekly = profile.weekly_schedule || {};
        const isDbResident = profile.is_resident === true;
        const vStart = profile.vacation_start ? new Date(profile.vacation_start + 'T00:00:00') : null;
        let vEnd = profile.vacation_end ? new Date(profile.vacation_end + 'T00:00:00') : null;
        // Extend vEnd to cover the whole day
        if (vEnd) {
            vEnd.setHours(23, 59, 59, 999);
        }

        const activeDaysStr = profile.active_days || "";
        const activeDaysArr = activeDaysStr.split(',').filter(x => x.trim() !== "").map(Number); // [0,1,2...]

        // DÍAS FESTIVOS EDITABLES (Perfil de Artista)
        const customHolidaysStr = profile.special_days || profile.custom_holidays || "";
        const customHolidaysArr = customHolidaysStr.split(',').filter(x => x.trim() !== "");

        // 2. Initialize FullCalendar
        const calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
            locale: 'es',
            firstDay: 0,
            themeSystem: 'standard',
            aspectRatio: 0.9, /* VERTICALIDAD MÁXIMA 0.9 (El chin final) */
            displayEventTime: false,
            events: function (info, successCallback) {
                // Generar array de eventos para el rango visible
                const events = [];
                let d = new Date(info.start.valueOf());

                while (d < info.end) {
                    const dateStr = d.toISOString().split('T')[0];
                    const dayOfWeek = d.getDay(); // 0(Sun) - 6(Sat)
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

                    // Check Vacation Fallback FIRST for the day
                    const isVacation = (vStart && vEnd && d >= vStart && d <= vEnd);

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
                        if (activeDaysArr.includes(dayOfWeek) && profile.available !== false) {
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
            dateClick: function(arg) {
                if (typeof window.handleEventWeather === 'function') {
                    window.handleEventWeather(arg.dateStr);
                }
                // RESET TOTAL DE RESPLANDORES PREVIOS
                document.querySelectorAll('.fc-daygrid-day-frame.active-glow').forEach(el => {
                    el.classList.remove('active-glow');
                    // Restaurar gradiente nativo (los props dataset se mantienen intactos o forzamos CSS resuelto)
                });
                
                const frame = arg.dayEl.querySelector('.fc-daygrid-day-frame');
                if (!frame) return;

                const eventsJson = frame.getAttribute('data-events');
                if (!eventsJson) return; // Día vacío

                const eventsArr = JSON.parse(eventsJson);
                
                // Color primario para el Glow
                const isNightActive = frame.getAttribute('data-botAlpha') === '0.2';
                let glowColor = isNightActive ? frame.getAttribute('data-nightColor') : frame.getAttribute('data-dayColor');
                
                frame.style.setProperty('--glow-color', `rgba(${glowColor}, 0.8)`);
                frame.style.setProperty('--glow-solid', `rgba(${glowColor}, 1.0)`);
                
                // ACTIVAR GLOW (Controlado por CSS class .active-glow en el html)
                frame.classList.add('active-glow');

                // RENDERIZAR DETALLES INFOS
                const emptyUI = document.getElementById('dash-event-detail-empty');
                const dataUI = document.getElementById('dash-event-detail-data');
                
                if (emptyUI) emptyUI.style.display = 'none';
                if (dataUI) {
                    dataUI.style.display = 'block';
                    dataUI.innerHTML = eventsArr.map(e => `
                        <div style="margin-bottom: 12px; padding-bottom:12px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <span style="font-size:11px; color:var(--gold); font-weight: 800; letter-spacing: 1px; text-transform:uppercase;">
                                ${e.type || ''} ${e.time ? ` // ${e.time}` : ''}
                            </span>
                            <div style="font-weight:900; font-size:18px; color:${e.type && e.type.includes('FERIADO') ? 'var(--gold)' : '#fff'}; line-height: 1.2; margin-top:2px;">${e.venue || e.fallbackTitle || ''}</div>
                            ${e.isResident ? '<span style="font-size: 8px; border: 1px solid var(--gold); border-radius: 4px; padding: 2px 6px; color: var(--gold); margin-top: 4px; display:inline-block; font-weight: 800;">RESIDENT</span>' : ''}
                        </div>
                    `).join('');
                }

                // TIMER LOGIC -> EXACTAMENTE 10 SEGUNDOS (Fade-Out suave)
                if (window.activeGlowTimer) clearTimeout(window.activeGlowTimer);
                window.activeGlowTimer = setTimeout(() => {
                    frame.classList.remove('active-glow');
                    if(emptyUI) emptyUI.style.display = 'block';
                    if(dataUI) dataUI.style.display = 'none';
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

        // 3. Inject CSS dynamically for encapsulation
        const style = document.createElement('style');
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

        // 4. Render
        calendar.render();
        window.mdjCalendarInstance = calendar; // Permite controles custom

        document.dispatchEvent(new CustomEvent('djCalendarRendered', { detail: { view: null } }));
        setTimeout(() => {
            if (typeof window.handleEventWeather === 'function') {
                const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                    .toISOString()
                    .split('T')[0];
                window.handleEventWeather(localToday);
            }
        }, 400);

    } catch (e) {
        console.error("❌ AGENDA ENGINE CRASH:", e);
    }
}

// Escuchar cambios de idioma globales para Forzar Refetch de los Feriados Traducidos
document.addEventListener('languageChanged', () => {
    if (window.mdjCalendarInstance) {
        window.mdjCalendarInstance.refetchEvents();
    }
});

// 🌐 ROBUST MODULE TRIGGER: Garantiza ejecución incluso si DOMContentLoaded ya disparó (Fix Chrome/Safari)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAgendaEngine);
} else {
    initAgendaEngine();
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
