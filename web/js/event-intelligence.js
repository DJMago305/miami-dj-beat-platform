/**
 * MDJPRO - Event Intelligence System (Phase 5 SaaS Module)
 * --------------------------------------------------------
 * This module is completely decoupled from the Live Weather Visual Engine.
 * It is responsible for checking future events (from Supabase) against the 
 * OpenWeather 5-Day Forecast API, and triggering early logistics alerts.
 */

import { getDJLogisticsAdvice } from '../dj-logistics-engine.js';

/* Se inyecta desde fuera; nunca literal: este archivo se sirve publico. */
const FORECAST_API_KEY = (typeof window !== 'undefined' && window.OPENWEATHER_API_KEY)
    ? String(window.OPENWEATHER_API_KEY).trim() : '';

export async function runEventIntelligenceSweep() {
    console.log("🔍 [Intelligence] Executing Future Event Sweep via Supabase...");

    // 1. Initialize Supabase
    if (typeof window.getSupabaseClient !== 'function') {
        console.error("❌ [Intelligence] window.getSupabaseClient is not defined. Ensure supabase-config.js loaded.");
        return;
    }
    const supabase = window.getSupabaseClient();

    try {
        // 2. Query upcoming events from the existing CEO 'leads' table (Sales Pipeline)
        const nowIso = new Date().toISOString();
        const { data: upcomingLeads, error } = await supabase
            .from('leads')
            .select('*')
            .gte('event_date', nowIso) // Assuming event_date exists
            .order('event_date', { ascending: true });

        if (error) throw error;

        if (!upcomingLeads || upcomingLeads.length === 0) {
            console.log("ℹ️ [Intelligence] No upcoming leads/events found in the pipeline.");
            return;
        }

        // 3. Process each lead against the Forecast API
        for (const lead of upcomingLeads) {

            // Critical SaaS Business Rule: We MUST have exact coordinates to provide Intelligence.
            if (!lead.lat || !lead.lon || !lead.event_date) {
                console.warn(`⚠️ [Intelligence] Lead ${lead.id} is missing lat/lon or date. Cannot run predictive weather.`);
                continue; // Skip calculating intelligence for incomplete leads
            }

            const pipelineEvent = {
                name: lead.name || 'MDJPRO Private Event',
                location: lead.location || 'Unknown Venue',
                event_date: lead.event_date,
                latitude: lead.lat,
                longitude: lead.lon
            };

            await analyzeEventWeather(pipelineEvent);
        }

    } catch (error) {
        console.error("❌ [Intelligence Sweep Error]:", error);
    }
}

async function analyzeEventWeather(event) {
    try {
        // Fetch 5-Day Forecast (Not Current)
        const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${event.latitude}&lon=${event.longitude}&appid=${FORECAST_API_KEY}&units=imperial&lang=es`);

        if (!response.ok) throw new Error("Forecast API failed");
        const forecastData = await response.json();

        // 1. Find the forecast block that matches the Event Date
        const targetTime = new Date(event.event_date).getTime();

        // OpenWeather returns 3-hour intervals in 'list'
        // We find the closest match to the gig time
        let closestForecast = forecastData.list[0];
        let minDiff = Math.abs(targetTime - (closestForecast.dt * 1000));

        for (const block of forecastData.list) {
            const blockTime = block.dt * 1000;
            const diff = Math.abs(targetTime - blockTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestForecast = block;
            }
        }

        console.log(`[Intelligence] Found predicted weather for ${event.name} at ${new Date(closestForecast.dt * 1000).toLocaleString()}`);
        console.log(closestForecast);

        // 2. Format it into the structure our Engine expects
        const mockEnginePayload = {
            weather: closestForecast.weather,
            wind: closestForecast.wind,
            main: closestForecast.main
        };

        // 3. Pipe into the pure DJ Logistics Engine
        const advanceAdvice = getDJLogisticsAdvice(mockEnginePayload);

        // 4. Render Pre-Flight SaaS Alert
        renderPreFlightAlerts(event.name, event.location, event.event_date, advanceAdvice);

    } catch (error) {
        console.error("❌ [Intelligence Event Analysis Error]:", error.message);
    }
}

function renderPreFlightAlerts(eventName, locationName, eventDate, adviceList) {
    const container = document.getElementById("saas-event-alerts"); // A new UI zone
    if (!container) return;

    // Only render if there are dangers or warnings. We don't bother the DJ if it's "success".
    const criticalAlerts = adviceList.filter(a => a.type === 'danger' || a.type === 'warning');
    if (criticalAlerts.length === 0) return;

    // Format date beautifully
    const formattedDate = new Date(eventDate).toLocaleDateString('es-ES', { weekday: 'long', hour: 'numeric', minute: '2-digit' });

    // Append alert (don't overwrite, as there may be multiple events)
    const alertHTML = `
        <div style="background: rgba(255, 85, 85, 0.1); border: 1px solid rgba(255, 85, 85, 0.4); border-radius: 12px; padding: 15px; margin-bottom: 20px; animation: pulseRed 2s infinite;">
            <div style="font-size: 10px; color: #ff5555; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
                🛑 PRE-FLIGHT BRIEFING (FUTURE ALERT)
            </div>
            <div style="font-size: 16px; color: #fff; font-weight: 700; margin-bottom: 4px;">
                ${eventName} @ ${locationName}
            </div>
            <div style="font-size: 11px; color: var(--gold); font-weight: 700; text-transform: uppercase; margin-bottom: 10px;">
                🗓 ${formattedDate}
            </div>
            ${criticalAlerts.map(a => `<div style="font-size: 12px; color: #ddd; margin-bottom: 5px;">• ${a.message}</div>`).join('')}
        </div>
    `;

    // Use insertAdjacentHTML so multiple failing events stack vertically
    container.insertAdjacentHTML('beforeend', alertHTML);
}

function initEventIntelligence() {
    // Only run if the UI element exists
    if (document.getElementById("saas-event-alerts")) {
        runEventIntelligenceSweep();
    }

    // Phase 7 DOM Overlay: Apply Calendar Resolution Matrix
    // We now listen to the native FullCalendar hook dispatched from profile-loader.js
    document.addEventListener('djCalendarRendered', (e) => {
        console.log("✅ [Calendar Matrix] Caught 'djCalendarRendered' event! FullCalendar is ready.");
        
        // 1. Dibujar Leyenda Homologada
        if (typeof renderCalendarLegend === 'function') renderCalendarLegend();

        const days = document.querySelectorAll('.fc-daygrid-day[data-date]');
        if (days.length > 0) {
            if (typeof window.getSupabaseClient === 'function') {
                applyCalendarMatrix(window.getSupabaseClient(), days);
            } else {
                console.error("❌ [Calendar Matrix] Supabase client is missing.");
            }
        } else {
            console.warn("⚠️ [Calendar Matrix] Event caught, but `.fc-daygrid-day` elements not found.");
        }
    });
}

// 🌐 ROBUST MODULE TRIGGER: Ensures execution even if DOMContentLoaded fired during network module imports (Chrome Fix)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEventIntelligence);
} else {
    initEventIntelligence();
}

/**
 * PHASE 7: 3-Layer Calendar Resolution Matrix (DOM Overlay)
 * Resolves L3 (Manager) > L2 (Events) > L1 (DJ Profile)
 */
async function applyCalendarMatrix(supabase, dayCells) {
    console.log("🗓️ [Calendar Matrix] Executing L3>L2>L1 DOM Overlay...");
    if (!dayCells || dayCells.length === 0) return;

    // We will build a single map of date => { priority, stateClass }
    // Priority: 3 = Manager, 2 = Event, 1 = Availability, 0 = Clear
    const matrixState = {};

    function registerState(dateStr, priority, stateClass) {
        if (!matrixState[dateStr] || priority > matrixState[dateStr].priority) {
            matrixState[dateStr] = { priority, stateClass };
        }
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // --- L1: DJ Profile Availability ---
        const { data: profile } = await supabase
            .from('dj_profiles')
            .select('availability, availability_schedule')
            .eq('user_id', session.user.id)
            .single();

        if (profile) {
            // Arrays of blocked dates (e.g., ["2026-03-20"])
            if (profile.availability && Array.isArray(profile.availability)) {
                profile.availability.forEach(date => registerState(date, 1, 'state-vacation'));
            }

            // Availability Schedule JSON (Residencies, etc.)
            if (profile.availability_schedule && profile.availability_schedule.schedule) {
                Object.entries(profile.availability_schedule.schedule).forEach(([dateStr, data]) => {
                    if (data.status === 'blocked') {
                        registerState(dateStr, 1, 'state-vacation');
                    } else if (data.events && data.events.length > 0) {
                        registerState(dateStr, 1, 'state-resident'); // Or base event
                    }
                });
            }

            // Handle Vacation Range
            if (profile.availability_schedule && profile.availability_schedule.vacation_start && profile.availability_schedule.vacation_end) {
                const dates = getDatesInRange(profile.availability_schedule.vacation_start, profile.availability_schedule.vacation_end);
                dates.forEach(d => registerState(d, 1, 'state-vacation'));
            }

            // Handle Recurring Residencies (0 = Sun, 1 = Mon...)
            if (profile.availability_schedule && Array.isArray(profile.availability_schedule.recurring_days)) {
                // Normalize DB values to strings to prevent ANY strict-typing failure (e.g. 5 !== "5")
                const dbDays = profile.availability_schedule.recurring_days.map(String);
                console.log("🔥 [AUDIT] 3. normalized dbDays array:", dbDays);

                let appliedCount = 0;

                Array.from(dayCells).forEach(cell => {
                    const dateVal = cell.getAttribute('data-date'); // e.g., "2026-03-20"
                    if (dateVal) {
                        const parts = dateVal.split('-');
                        if (parts.length === 3) {
                            const [y, m, d] = parts.map(Number);
                            const dateObj = new Date(y, m - 1, d);
                            const computedWeekday = dateObj.getDay(); // 0-6 (0 = Sunday)

                            // ── MAPPING FIX: Normalize formats to compare safely ──
                            // We check both the pure 0-6 format, AND the 1-7 format to ensure we catch the DB data
                            const dow_0_6 = String(computedWeekday);
                            const dow_1_7 = String(computedWeekday === 0 ? 7 : computedWeekday);

                            const match = dbDays.includes(dow_0_6) || dbDays.includes(dow_1_7);

                            // 4. log each calendar cell (only for first 7 days to avoid flooding)
                            if (d <= 7) {
                                console.log(`🔥 [AUDIT] 4. Cell Eval | dateVal=${dateVal} | computedWeekday=${computedWeekday} | dow_0_6=${dow_0_6} | dow_1_7=${dow_1_7} | MATCH=${match}`);
                            }

                            if (match) {
                                // 5. log every registerState
                                if (appliedCount === 0) console.log(`🔥 [AUDIT] 5. First registerState trigger on: ${dateVal}`);
                                registerState(dateVal, 1, 'state-resident');
                                appliedCount++;
                            }
                        }
                    }
                });
                console.log(`🔥 [AUDIT] Total registerState calls for state-resident: ${appliedCount}`);
            }
        }

        // --- L2: System Events (Leads) ---
        const nowIso = new Date().toISOString().split('T')[0];
        const { data: leads } = await supabase
            .from('leads')
            .select('event_date, status')
            .gte('event_date', nowIso); // Only care about future/current

        if (leads) {
            leads.forEach(lead => {
                if (lead.event_date) {
                    const dateStr = lead.event_date.split('T')[0];
                    registerState(dateStr, 2, 'state-gig');
                }
            });
        }

        // --- L3: Manager Overrides (To be implemented later) ---

        // --- OVERLAY INJECTION ---
        let injectedCount = 0;

        // 6. log final matrixState
        console.log("🔥 [AUDIT] 6. Final matrixState BEFORE DOM injection:", matrixState);

        Array.from(dayCells).forEach(cell => {
            const dateVal = cell.getAttribute('data-date');

            // Clean up old classes
            ['state-vacation', 'state-resident', 'state-gig', 'state-blocked', 'state-free', 'event-intelligence-active'].forEach(c => cell.classList.remove(c));

            if (matrixState[dateVal]) {
                const finalClass = matrixState[dateVal].stateClass;

                if (finalClass !== 'state-free') {
                    cell.classList.add(finalClass);
                    cell.classList.add('event-intelligence-active');
                    if (finalClass === 'state-resident') injectedCount++;
                }
            }
        });

        // 7. log how many DOM cells actually receive state-resident
        console.log(`🔥 [AUDIT] 7. Total DOM specific state-resident cells injected: ${injectedCount}`);

        console.log(`📌 [Calendar Matrix] Successfully applied ${injectedCount} overlay states to the UI.`);

    } catch (e) {
        console.error("Calendar Matrix Overlay Error:", e);
    }
}

function getDatesInRange(startStr, endStr) {
    if (!startStr || !endStr) return [];
    const dates = [];
    let curr = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    if (curr > end) return [];
    while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

// ── LEYENDA VISUAL DINÁMICA ──
function renderCalendarLegend() {
    const legendBox = document.getElementById('calendar-legend');
    if (!legendBox || typeof window.CALENDAR_THEMES === 'undefined') return;

    legendBox.innerHTML = Object.values(window.CALENDAR_THEMES).map(theme => {
        const bg = theme.ring ? 'transparent' : theme.color;
        const border = theme.ring ? '1px solid rgba(255,255,255,0.4)' : 'none';
        const shadow = theme.ring ? 'none' : `0 0 10px ${theme.color}60`;
        
        return `
        <div style="display: flex; align-items: center; gap: 6px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${bg}; border: ${border}; box-shadow: ${shadow};"></div>
            <span style="font-size: 11px; font-weight: 700; color: #fff; opacity: 0.8; letter-spacing: 0.5px; text-transform: uppercase;">${theme.label}</span>
        </div>
        `;
    }).join('');
}
