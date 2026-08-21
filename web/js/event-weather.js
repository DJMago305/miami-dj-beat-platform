/**
 * DJ EVENT WEATHER ORCHESTRATOR
 * Fetches real weather data and synchronizes it with the 6-layer CSS/PNG visual architecture
 * and logistical alerts for Miami DJ Beat System.
 */

window.__mdjWeatherBootTime = Date.now();
window.__mdjWeatherLocked = true;
window.__mdjWeatherInitialDone = false;
setTimeout(function () {
    window.__mdjWeatherLocked = false;
    if (typeof window.handleEventWeather === 'function' && !window.__mdjWeatherInitialDone) {
        window.handleEventWeather();
    }
}, 1200);

/* La clave ya no vive en el navegador: la lleva mdj-weather. */

let currentDuration = 220;
let _carouselLerpRaf = null;

function smoothDuration(target) {
    const diff = target - currentDuration;
    const step = diff * 0.08;
    currentDuration += step;
    return currentDuration;
}

/**
 * Ronda framerate hasta converger a target (smoothDuration 8% por frame).
 * No re-entra a applyWeatherScene: eso limpiaría capas/keyframes/sol a cada frame.
 */
function startCarouselDurationLerp(weatherContainer, targetSec) {
    if (!weatherContainer) return;
    if (_carouselLerpRaf) {
        cancelAnimationFrame(_carouselLerpRaf);
        _carouselLerpRaf = null;
    }
    const TOL = 0.5;
    function tick() {
        const el = weatherContainer.querySelector('.nubes-largas-fast-container');
        if (!el || !el.isConnected) {
            _carouselLerpRaf = null;
            return;
        }
        const smooth = smoothDuration(targetSec);
        el.style.setProperty('animation-duration', `${smooth.toFixed(1)}s`, 'important');
        if (Math.abs(targetSec - currentDuration) <= TOL) {
            currentDuration = targetSec;
            el.style.setProperty('animation-duration', `${currentDuration.toFixed(1)}s`, 'important');
            _carouselLerpRaf = null;
            return;
        }
        _carouselLerpRaf = requestAnimationFrame(tick);
    }
    _carouselLerpRaf = requestAnimationFrame(tick);
}

const __mdjGeocodeCache = {};

/** Resuelve ciudad (sin GPS) → lat/lon vía OpenWeather Geocoding API 1.0 */
async function mdjGeocodeCityForWeather(cityLabel) {
    const key = String(cityLabel).toLowerCase();
    if (__mdjGeocodeCache[key]) return __mdjGeocodeCache[key];
    const q = encodeURIComponent(`${cityLabel},FL,US`);
    const url = mdjPuenteClima({ recurso: 'geo', q: cityLabel + ',FL,US' });
    if (!url) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arr = await res.json();
        if (!Array.isArray(arr) || !arr[0]) return null;
        const out = { lat: arr[0].lat, lon: arr[0].lon };
        __mdjGeocodeCache[key] = out;
        return out;
    } catch (e) {
        console.warn('[MDJ] Geocoding falló para', cityLabel, e);
        return null;
    }
}

/** Primer cambio de `main` en /forecast respecto al actual (para UI/CSS progresivo) */
function computeForecastTransitionHint(data) {
    const list = data.fullForecast;
    if (!Array.isArray(list) || list.length < 1) return null;
    const curMain = (data.weather && data.weather[0] && data.weather[0].main) || '';
    const nowDt = data.dt || Math.floor(Date.now() / 1000);
    for (let i = 0; i < Math.min(12, list.length); i++) {
        const blk = list[i];
        const nextMain = blk.weather?.[0]?.main;
        if (!nextMain || nextMain === curMain) continue;
        const hours = Math.max(0, (blk.dt - nowDt) / 3600);
        return { nextMain, hoursApprox: Math.round(hours * 10) / 10 };
    }
    return null;
}

async function getWeatherForecast(city, eventDateStr, lat = null, lon = null) {
    // 25.7617, -80.1918 — Miami centro (sin GPS; ciudad "Miami" reutiliza esto, otras se geocodifican)
    const miamiLat = 25.7617;
    const miamiLon = -80.1918;
    let useLat = miamiLat;
    let useLon = miamiLon;
    if (lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
        useLat = Number(lat);
        useLon = Number(lon);
    } else if (city && typeof city === 'string' && city.trim()) {
        const c = city.trim();
        if (c.toLowerCase() !== 'miami') {
            const g = await mdjGeocodeCityForWeather(c);
            if (g) {
                useLat = g.lat;
                useLon = g.lon;
            }
        }
    }
    const urlCurrent = mdjPuenteClima({ recurso: 'weather', lat: useLat, lon: useLon, units: 'imperial', lang: 'es' });
    if (!urlCurrent) return null;

    // TEMP diagnóstico: confirmar Hialeah vs Miami vs geocoding (quitar al cerrar)
    const _owmHasGpsOrEventCoords = lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon));
    console.log('[OWM] city:', city);
    console.log('[OWM] lat/lon final:', useLat, useLon);
    console.log('[OWM] source:', _owmHasGpsOrEventCoords ? 'gps/event-coords' : 'city-geocode-or-fallback');

    const resCurrent = await fetch(urlCurrent);

    if (!resCurrent.ok) {
        console.error(`Weather API Error: ${resCurrent.status}`);
        throw new Error(`API Error ${resCurrent.status}`);
    }
    const currentData = await resCurrent.json();
    currentData.fullForecast = [];

    // La Manguera API está abierta al 100%. No hay filtros ni overrides alterando el clima real.

    // Forecast misma grilla (Miami)
    const urlForecast = mdjPuenteClima({ recurso: 'forecast', lat: useLat, lon: useLon, units: 'imperial', lang: 'es' });

    const resForecast = await fetch(urlForecast);
    let forecastData = null;

    if (resForecast.ok) {
        forecastData = await resForecast.json();
        currentData.sys = currentData.sys || {};
        if (forecastData.city && forecastData.city.sunset) {
            currentData.sys.sunset = forecastData.city.sunset;
        }
        currentData.fullForecast = Array.isArray(forecastData.list) ? forecastData.list : [];
    }

    if (!eventDateStr) return currentData;

    // Si la fecha solicitada es HOY, devolver CLIMA EN VIVO EXACTO (No el forecast de las 8PM)
    const todayStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const todayIsoDate = new Date(todayStr).toISOString().substring(0, 10);
    if (typeof eventDateStr === 'string' && eventDateStr.startsWith(todayIsoDate)) {
        return currentData; 
    }

    if (!forecastData) return currentData;

    // Determinamos la hora objetivo del evento
    let eventDate = new Date(eventDateStr);
    // Si no tiene hora (ej: "2026-03-24"), asumimos las 8:00 PM (Hora pico DJ)
    if (typeof eventDateStr === 'string' && eventDateStr.length <= 10) {
        eventDate.setHours(20, 0, 0, 0);
    }

    const eventTime = eventDate.getTime();

    // Buscar el bloque de 3 horas más cercano a la hora del evento
    let closestBlock = forecastData.list[0];
    let minDiff = Math.abs(closestBlock.dt * 1000 - eventTime);

    for (const block of forecastData.list) {
        const diff = Math.abs(block.dt * 1000 - eventTime);
        if (diff < minDiff) {
            minDiff = diff;
            closestBlock = block;
        }
    }

    // Si el evento está a más de 3 días fuera del rango de la API de forecast (fallback al actual)
    if (minDiff > 3 * 24 * 60 * 60 * 1000) return currentData;

    // Adaptamos la estructura del bloque para que el UI renderer no se rompa (mismo shape que /weather)
    closestBlock.name = forecastData.city.name || currentData.name;
    closestBlock.sys = closestBlock.sys || {};
    closestBlock.sys.sunset = forecastData.city.sunset || currentData.sys.sunset;
    closestBlock.fullForecast = Array.isArray(forecastData.list) ? forecastData.list : [];

    return closestBlock;
}

/* ======================================================================
 * REGLAS DE JERARQUÍA OFICIAL DEL MOTOR CLIMÁTICO (No alterar)
 * ----------------------------------------------------------------------
 * Para evitar escenas equivocadas, la resolución visual debe seguir
 * estrictamente el siguiente orden de validación basado en el 'main' y 'id':
 *
 *   1. Thunderstorm (Tormenta severa con relámpagos)
 *   2. Rain / Drizzle (Lluvia constante o llovizna)
 *   3. Mist / Fog / Haze / Smoke (Condensación / humo opaco)
 *   4. Clear (Cielo limpio / Luna y estrellas limpias)
 *   5. Clouds (Nubes. Se valida el 'description' o 'id' para
 *      separar Nubes Ligeras (801/802) de Nubes Pesadas (803/804))
 *   6. Sunset (Override controlado por astronomía local)
 *
 * REGLA SUNSET:
 * El atardecer es un override que SÓLO puede ganar y pisar a la escena
 * si el clima de ese bloque pertenece EXCLUSIVAMENTE a Clear o Clouds.
 * Si hay lluvia o tormenta a la hora del atardecer, el agua gana y 
 * el sunset se ignora. 
 * ====================================================================== */
function mapWeatherToScene(data) {
    const main = data.weather?.[0]?.main || "Clear";
    const blockTime = data.dt || Math.floor(Date.now() / 1000);
    const sunrise = data.sys?.sunrise || 0;
    const sunset = data.sys?.sunset || 0;

    const isNight = (sunrise > 0 && sunset > 0)
        ? (blockTime < sunrise || blockTime > sunset)
        : (data.weather?.[0]?.icon?.endsWith("n") || false);

    // Detect sunset transition window
    const isSunset = sunset > 0 && (blockTime >= sunset - 2700 && blockTime <= sunset + 900);

    // If it's sunset time and weather is generally visible (not severe storm/rain)
    if (isSunset && (main === "Clear" || main === "Clouds")) return "sunset";

    if (main === "Thunderstorm") return isNight ? "storm" : "storm-day";
    
    // EXTREME WEATHER PROTOCOL: Inundación o vientos fuertes (> 30mph) activan alerta roja
    const weatherId = data.weather?.[0]?.id || 500;
    const windSpeed = data.wind?.speed || 0;
    
    if (main === "Rain" && (weatherId >= 502 || windSpeed > 30)) {
        return isNight ? "storm" : "storm-day";
    }

    // IGNORAR PRE-ALERTAS: Si es Drizzle (3xx) o Lluvia Ligera (500), no renderizar la animación física de lluvia.
    if (main === "Drizzle" || (main === "Rain" && weatherId === 500)) {
        return isNight ? "cloudy-night" : "cloudy-day";
    }

    if (main === "Rain") return isNight ? "rain-night" : "rain";

    if (main === "Clouds") {
        const cloudId = data.weather?.[0]?.id;
        const desc = (data.weather?.[0]?.description || "").toLowerCase();
        // OWM: 801 few, 802 scattered, 803 broken → más cielo; 804 overcast → muy nublado
        const partly =
            cloudId === 801 ||
            cloudId === 802 ||
            cloudId === 803 ||
            desc.includes("few") ||
            desc.includes("scattered") ||
            desc.includes("broken") ||
            desc.includes("dispersas") ||
            desc.includes("pocas nubes") ||
            desc.includes("poco");
        if (partly) return isNight ? "partly-cloudy-night" : "partly-cloudy";
        return isNight ? "cloudy-night" : "cloudy-day";
    }
    if (main === "Mist" || main === "Fog" || main === "Haze" || main === "Smoke") return isNight ? "cloudy-night" : "cloudy-day";

    return isNight ? "clear-night" : "clear-day";
}

/**
 * Etiqueta de condición solo para el hero/telemetría (no altera escena ni fetch).
 * OWM: 801/802 → Parcialmente nublado; 803 → Mayormente nublado; 804 → Nublado.
 * Sin id en 801–804: misma lógica que antes (descripción con mayúscula inicial).
 */
/** Día calendario local (YYYY-MM-DD) para alinear bloques 3h con "hoy" o el día de `data.dt`. */
function mdjLocalDayKeyFromUnix(unixSec) {
    const d = new Date((unixSec || 0) * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Máx/mín diarios desde slots 3h de /forecast (fullForecast). Misma idea que OWM/Apple para el rango del día.
 * Si no hay slots coincidentes: fallback a main.temp_min / temp_max del snapshot de /weather.
 */
function getDailyMinMaxFromForecast(data) {
    const list = Array.isArray(data?.fullForecast) ? data.fullForecast : [];
    const refSec = data?.dt != null ? data.dt : Math.floor(Date.now() / 1000);
    const dayKey = mdjLocalDayKeyFromUnix(refSec);

    const temps = list
        .filter((item) => item && item.dt != null && mdjLocalDayKeyFromUnix(item.dt) === dayKey)
        .map((item) => item?.main?.temp)
        .filter((t) => typeof t === 'number' && !Number.isNaN(t));

    if (!temps.length) {
        return {
            min: data?.main?.temp_min,
            max: data?.main?.temp_max
        };
    }

    return {
        min: Math.min(...temps),
        max: Math.max(...temps)
    };
}

function getDisplayConditionLabel(data) {
    const w0 = data.weather?.[0];
    if (!w0) return "Despejado";
    const id = w0.id;
    if (id === 801 || id === 802) return "Parcialmente nublado";
    if (id === 803) return "Mayormente nublado";
    if (id === 804) return "Nublado";
    const raw = w0.description || w0.main || "Despejado";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function renderWeatherWidget(data, eventOrDate) {
    // 1. Update Top Hero Widget 🍏
    const heroCity = document.getElementById('hero-city');
    const heroTemp = document.getElementById('weather-main-temp');
    const heroCond = document.getElementById('weather-condition-label');
    const heroHL = document.getElementById('weather-high-low');
    const locationLbl = document.getElementById('weather-location');

    const temp = Math.round(data.main?.temp || 78);
    const dailyRange = getDailyMinMaxFromForecast(data);
    const tempMax = Math.round(dailyRange.max ?? (data.main?.temp_max) ?? (temp + 5));
    const tempMin = Math.round(dailyRange.min ?? (data.main?.temp_min) ?? (temp - 5));
    const conditionMain = data.weather?.[0]?.main || "Clear";

    const iconImg = document.getElementById('weather-icon-img');
    const predictBox = document.getElementById('weather-predict');

    const displayCity = window.userBaseLocation?.city || data.name || "Miami";
    const displayLoc = `${displayCity}, FL`.toUpperCase();
    if (heroCity) heroCity.textContent = displayLoc;
    if (locationLbl) locationLbl.textContent = displayLoc;
    if (heroTemp) heroTemp.textContent = `${temp}°`;

    // 1a. Inyectar Icono Real de la API
    const iconCode = data.weather?.[0]?.icon;
    if (iconImg && iconCode) {
        iconImg.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
        iconImg.style.display = 'block';
    }

    const capitalizedDesc = getDisplayConditionLabel(data);
    if (heroCond) heroCond.textContent = capitalizedDesc;
    if (predictBox) predictBox.innerHTML = `TELEMETRÍA: <strong>${capitalizedDesc}</strong> | Viento: <strong>${Math.round(data.wind?.speed || 0)} mph</strong> | Humedad: <strong>${data.main?.humidity || '--'}%</strong>`;

    if (heroHL) heroHL.textContent = `Máx: ${tempMax}° Mín: ${tempMin}°`;

    // 1b. Update Data Grid (Glass Modules)
    const elHumi = document.getElementById('w-val-humidity');
    const elFeels = document.getElementById('w-val-feels-like');
    const elVis = document.getElementById('w-val-visibility');
    const elWind = document.getElementById('w-val-wind');

    if (elHumi) elHumi.textContent = `${data.main?.humidity || 50}%`;
    if (elFeels) elFeels.textContent = `${Math.round(data.main?.feels_like || temp)}°`;
    if (elWind) elWind.textContent = `${Math.round(data.wind?.speed || 0)} mph`;

    if (elVis) {
        // Convertir visibilidad de Metros a Millas (y redondear a 1 decimal máximo o número entero)
        const visibilityMiles = (data.visibility || 10000) / 1609.34;
        elVis.textContent = `${Math.round(visibilityMiles)} mi`;
    }

    // 2. Build the right sidebar details
    const dataDiv = document.getElementById('dash-event-detail-data');
    if (!dataDiv) return;

    dataDiv.style.display = 'block';

    const isEvent = !!eventOrDate.title;
    const dateStr = isEvent ? (eventOrDate.startStr || (eventOrDate.start ? eventOrDate.start.toISOString().split('T')[0] : '')) : eventOrDate;
    const eventTitle = isEvent
        ? ((eventOrDate.extendedProps?.event_name || eventOrDate.title || '').trim() || 'Sin título')
        : 'Día sin evento en agenda';

    let cardIcon = '☀️';
    if (conditionMain === 'Thunderstorm') cardIcon = '⚡';
    else if (conditionMain === 'Rain' || conditionMain === 'Drizzle') cardIcon = '🌧';
    else if (conditionMain === 'Clouds') cardIcon = '🌤';

    // Horario operativo (solo datos reales del evento / CONFIG)
    function mdjFormatOpTime(val, emptyLabel) {
        if (val == null || val === '' || val === '--:--') return emptyLabel || 'Sin horario';
        return String(val).trim();
    }
    let startTime = mdjFormatOpTime(null);
    let endTime = mdjFormatOpTime(null);
    const epPanel = isEvent ? (eventOrDate.extendedProps || {}) : null;
    if (isEvent && epPanel) {
        startTime = mdjFormatOpTime(epPanel.start_time);
        endTime = mdjFormatOpTime(epPanel.end_time);
        if ((startTime === 'Sin horario' || endTime === 'Sin horario') && epPanel.time && typeof epPanel.time === 'string' && epPanel.time !== 'ALL DAY') {
            const parts = epPanel.time.split('-').map(function (s) { return s.trim(); });
            if (startTime === 'Sin horario' && parts[0]) startTime = mdjFormatOpTime(parts[0]);
            if (endTime === 'Sin horario' && parts[1]) endTime = mdjFormatOpTime(parts[1]);
        }
        if (
            (startTime === 'Sin horario' || endTime === 'Sin horario') &&
            mdjAgendaAllowPreferredTimeFallback(epPanel) &&
            window.mdjAgendaEngineContext &&
            window.mdjAgendaEngineContext.profile
        ) {
            const sched = window.mdjAgendaEngineContext.profile.preferred_schedule;
            if (sched) {
                const prefParts = String(sched).split('-').map(function (s) { return s.trim(); });
                if (startTime === 'Sin horario' && prefParts[0]) startTime = mdjFormatOpTime(prefParts[0]);
                if (endTime === 'Sin horario' && prefParts[1]) endTime = mdjFormatOpTime(prefParts[1]);
            }
        }
    }
    const bufferTime = (isEvent && eventOrDate.extendedProps?.buffer_time) ? `+${eventOrDate.extendedProps.buffer_time}m` : '—';
    const evCity = isEvent
        ? ((eventOrDate.extendedProps?.venue || '').trim() || 'Sin venue')
        : (data.name || '—');
    const dashPage = ((window.location.pathname || '').split('/').pop() || '').toLowerCase();
    const showStaffDjAlertBtn = isEvent && dashPage !== 'dj-dashboard.html';

    const panelStatus = mdjAgendaResolvePanelStatus(epPanel, isEvent);
    const themeColor = panelStatus.color;
    const statusLabel = panelStatus.label;

    const eventDayName = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' });
    const capitalizedDay = eventDayName.charAt(0).toUpperCase() + eventDayName.slice(1);

    // Call logistics rules
    const logistics = calculateLogisticsAlerts(data, data.name || "Miami");

    dataDiv.innerHTML = `
        <div style="animation: fadeIn 0.4s ease-out; color: #fff; font-family: 'Inter', sans-serif;">
            <!-- Status Pill Superior -->
            <div style="color: ${themeColor}; font-size: 10px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 10px currentColor;"></span>
                ${statusLabel}
            </div>

            <!-- GRID DE INFORMACIÓN CRÍTICA (FORMATO CEO) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: rgba(0,0,0,0.2); backdrop-filter: blur(20px); padding: 25px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.05);">
                
                <!-- Fila 1: Evento y Lugar -->
                <div style="grid-column: 1 / -1;">
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Evento</div>
                    <div style="font-size: 20px; font-weight: 800; color: #fff; line-height: 1.2;">${eventTitle}</div>
                </div>

                <!-- Fila 2: Tiempos Exactos -->
                <div style="display: flex; gap: 15px; grid-column: 1 / -1; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="flex: 1;">
                        <div style="font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Start Time</div>
                        <div style="font-size: 16px; font-weight: 700; color: #fff;">${startTime}</div>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">End Time</div>
                        <div style="font-size: 16px; font-weight: 700; color: #fff;">${endTime}</div>
                    </div>
                    <div style="flex: 1;">
                        <div style="font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Buffer</div>
                        <div style="font-size: 16px; font-weight: 700; color: var(--gold);">${bufferTime}</div>
                    </div>
                </div>

                <!-- Fila 3: Lugar y Fecha -->
                <div>
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Locación</div>
                    <div style="font-size: 15px; font-weight: 700; color: #fff;">${evCity}</div>
                </div>
                <div>
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Fecha</div>
                    <div style="font-size: 15px; font-weight: 700; color: #fff;">${capitalizedDay}</div>
                </div>

                <!-- Fila 4: Clima Previsto y Atardecer -->
                <div>
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Clima Previsto</div>
                    <div style="font-size: 15px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 18px;">${cardIcon}</span>
                        <span>${capitalizedDesc} ${temp}°F</span>
                    </div>
                </div>
                <div>
                    <div style="font-size: 10px; color: var(--gold); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Atardecer</div>
                    <div style="font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
                        <span>🌇</span> ${formatTimestamp(data.sys?.sunset)}
                    </div>
                </div>

                <!-- ALERTA MOVIL SMS (solo staff / manager — no en dashboard del artista) -->
                ${showStaffDjAlertBtn ? `
                <div style="grid-column: 1 / -1; margin-top: 15px;">
                    <button onclick="window.triggerDJMobileAlert('${eventOrDate.extendedProps?.eventId || ''}')" class="btn primary full" style="padding: 14px; font-size: 13px; font-weight: 800; background: rgba(197, 160, 89, 0.15); border: 1px solid var(--gold); color: var(--gold); border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        ENVIAR RECORDATORIO AL DJ
                    </button>
                </div>
                ` : ''}

                <!-- Logic Alert Block -->
                ${renderLogisticsAlerts(logistics)}
            </div>
        </div>
    `;

    // 4. ACTUALIZAR CARRUSEL HORARIO ⏱️ (Datos Reales API)
    generateHourlyTimelineOptions(data);

    // 5. ACTUALIZAR PRONÓSTICO EXTENDIDO 📅 (Datos Reales API)
    const dailyScroller = document.getElementById('daily-forecast-list');
    if (dailyScroller && data.fullForecast) {
        const dailyMap = new Map();
        const todayStr = new Date().toLocaleDateString('es-ES', { weekday: 'short' });

        data.fullForecast.forEach(block => {
            const dateObj = new Date(block.dt * 1000);

            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const localKey = `${yyyy}-${mm}-${dd}`;

            const dayStr = dateObj.toLocaleDateString('es-ES', { weekday: 'short' });

            if (!dailyMap.has(localKey)) {
                dailyMap.set(localKey, {
                    dayName: dayStr === todayStr ? 'Hoy' : (dayStr.charAt(0).toUpperCase() + dayStr.slice(1).replace('.', '')),
                    min: block.main.temp_min,
                    max: block.main.temp_max,
                    icons: {}
                });
            }

            const dayData = dailyMap.get(localKey);
            if (block.main.temp_min < dayData.min) dayData.min = block.main.temp_min;
            if (block.main.temp_max > dayData.max) dayData.max = block.main.temp_max;

            const icon = block.weather[0].icon;
            dayData.icons[icon] = (dayData.icons[icon] || 0) + 1;
        });

        const emojiMap = {
            '01d': '☀️', '02d': '⛅', '03d': '☁️', '04d': '☁️',
            '09d': '🌧️', '10d': '🌦️', '11d': '⛈️', '13d': '❄️', '50d': '🌫️'
        };

        const sortedKeys = Array.from(dailyMap.keys()).sort();
        const daysArray = sortedKeys.map(key => {
            const day = dailyMap.get(key);
            let dominantIcon = Object.keys(day.icons).reduce((a, b) => day.icons[a] > day.icons[b] ? a : b);

            return {
                d: day.dayName,
                i: emojiMap[dominantIcon] || '☀️',
                min: Math.round(day.min),
                max: Math.round(day.max)
            };
        }).slice(0, 6);

        dailyScroller.innerHTML = daysArray.map(day => `
            <div style="display: grid; grid-template-columns: 50px 30px 40px 1fr 40px; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; color: #fff;">
                <div style="opacity: 1;">${day.d}</div>
                <div style="font-size: 18px; text-align: center;">${day.i}</div>
                <div style="opacity: 0.8; font-size: 14px; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">${day.min}°</div>
                <div style="position: relative; height: 5px; background: rgba(0,0,0,0.2); border-radius: 4px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);">
                    <div style="position: absolute; left: 20%; right: 10%; height: 100%; background: linear-gradient(90deg, #c5a059, #fff); border-radius: 4px; box-shadow: 0 0 5px rgba(197, 160, 89, 0.5);"></div>
                </div>
                <div style="text-align: right; font-weight: 800; font-size: 15px; text-shadow: 0 1px 3px rgba(0,0,0,0.4);">${day.max}°</div>
            </div>
        `).join('');
    }

    // CONDUCCIÓN DIRECTA: Conectar a la matriz original (API) - Petición Expresa del Arquitecto
    if (window.applyAstralState && data.dt) {
        // Enlaza el motor astral exactamente con el timestamp del bloque de OpenWeather 
        // y forza la luna y el sol exactos para esa franja horaria.
        const blockTimestamp = new Date(data.dt * 1000);
        window.applyAstralState(blockTimestamp, data);
    }
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

/**
 * Estado operativo del panel Agenda — nunca derivado del clima.
 * @returns {{ label: string, color: string }}
 */
function mdjAgendaResolvePanelStatus(ep, isEvent) {
    if (!isEvent || !ep) {
        return { label: 'Agenda disponible', color: 'rgba(255,255,255,0.45)' };
    }

    const flowSt = ep.flow_status != null ? String(ep.flow_status).toLowerCase() : '';
    if (flowSt) {
        const flowMap = {
            draft: { label: 'Producción · borrador', color: '#94a3b8' },
            ready: { label: 'Producción · listo', color: '#c5a059' },
            sent: { label: 'Producción · enviado', color: '#22c55e' },
            archived: { label: 'Producción · archivado', color: '#64748b' }
        };
        if (flowMap[flowSt]) return flowMap[flowSt];
    }

    if (ep.source === 'lead' && ep.status != null && String(ep.status).trim() !== '') {
        const st = String(ep.status).trim().toUpperCase();
        const leadMap = {
            CONFIRMED: { label: 'Confirmado (lead)', color: '#22c55e' },
            MATCHED: { label: 'Asignado (lead)', color: '#c5a059' },
            COMPLETED: { label: 'Completado (lead)', color: '#64748b' },
            CANCELLED: { label: 'Cancelado (lead)', color: '#ff5555' },
            DENIED: { label: 'Denegado (lead)', color: '#ff5555' },
            CLOSED: { label: 'Cerrado (lead)', color: '#64748b' },
            PENDING: { label: 'Pendiente (lead)', color: '#f59e0b' }
        };
        if (leadMap[st]) return leadMap[st];
        return { label: 'Lead · ' + st, color: '#c5a059' };
    }

    if (ep.source === 'availability_schedule') {
        const evSt = (ep.status || '').toUpperCase();
        if (evSt === 'CANCELLED') {
            return { label: 'Evento cancelado', color: '#ff5555' };
        }
        return { label: 'Evento privado (agenda)', color: '#4ade80' };
    }

    if (ep.source === 'blocked') {
        return { label: 'Día bloqueado', color: '#ff5555' };
    }

    if (ep.source === 'legacy_availability') {
        return { label: 'Disponible', color: 'rgba(255,255,255,0.45)' };
    }

    if (
        ep.panel_status === 'scheduled_shift' ||
        ep.source === 'weekly_schedule' ||
        ep.source === 'preferred_schedule' ||
        ep.isResident === true
    ) {
        return { label: 'Turno programado', color: '#c5a059' };
    }

    if (ep.source === 'active_days' || ep.panel_status === 'available') {
        return { label: 'Disponible', color: 'rgba(255,255,255,0.45)' };
    }

    if (ep.source === 'vacation' || ep.panel_status === 'vacation') {
        return { label: 'Vacaciones / blackout', color: '#64748b' };
    }

    if (ep.source === 'holiday' || (ep.type && String(ep.type).indexOf('FERIADO') !== -1)) {
        return { label: 'Feriado', color: 'rgba(255,255,255,0.55)' };
    }

    return { label: 'Agenda', color: 'rgba(255,255,255,0.45)' };
}

function formatTimestamp(unixTimestamp) {
    if (!unixTimestamp) return '--:-- PM';
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function calculateLogisticsAlerts(data, city) {
    const windSpeedMph = data.wind?.speed || 0;
    const windSpeedMs = windSpeedMph * 0.44704; // Convert mph to m/s for rules
    const condition = data.weather?.[0]?.main || "Clear";
    const tempF = data.main?.temp || 78;
    const tempC = (tempF - 32) * 5 / 9;

    const cityStr = city.toLowerCase();
    const isOutdoor = cityStr.includes('beach') || cityStr.includes('key largo') || cityStr.includes('outdoor') || cityStr.includes('park');

    let alerts = [];

    // Wind Rule (>= 10 m/s (~22 mph))
    const windThreshold = isOutdoor ? 8 : 10;
    if (windSpeedMs >= windThreshold) {
        alerts.push({
            title: "Viento Fuerte",
            icon: "💨",
            message: "Revisar estructuras, pesos de carpas y anclaje de telas."
        });
    }

    // Rain Rule
    if (condition === "Rain" || condition === "Drizzle" || condition === "Thunderstorm") {
        alerts.push({
            title: "Precipitación",
            icon: "🌧️",
            message: "Preparar coberturas impermeables y protección eléctrica total."
        });
    }

    // Cold Rule (<= 16°C (~60°F))
    if (tempC <= 16) {
        alerts.push({
            title: "Noche Fría",
            icon: "❄️",
            message: "Considerar abrigo para staff o solicitar heaters al cliente."
        });
    }

    if (alerts.length === 0) {
        alerts.push({
            title: "Condiciones Óptimas",
            icon: "✅",
            message: isOutdoor ? "Clima exterior excelente. Sin riesgos logísticos detectados." : "Sin alertas operativas reportadas."
        });
    }

    // Add general outdoor context note if applicable and weather is bad
    if (isOutdoor && alerts.length > 0 && alerts[0].title !== "Condiciones Óptimas") {
        alerts[0].message += " ALERTA OUTDOOR PRIORITARIA.";
    }

    return alerts;
}

function renderLogisticsAlerts(alerts) {
    const primaryAlert = alerts[0];
    const isWarning = primaryAlert.title !== "Condiciones Óptimas";

    const bg = isWarning ? 'rgba(197,160,89,0.1)' : 'rgba(0,255,136,0.05)';
    const border = isWarning ? 'rgba(197,160,89,0.2)' : 'rgba(0,255,136,0.1)';
    const color = isWarning ? 'var(--gold)' : '#00ff88';

    return `
    <div style="grid-column: span 2; margin-top: 10px; padding: 15px; background: ${bg}; border-radius: 16px; border: 1px solid ${border};">
        <div style="font-size: 10px; color: ${color}; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                ${isWarning ? '⚠️ ALERTA LOGÍSTICA' : primaryAlert.icon + ' ESTADO LOGÍSTICO'} — ${primaryAlert.title}
        </div>
        <div style="font-size: 13px; font-weight: 500; line-height: 1.5; color: rgba(255,255,255,0.9);">
            ${alerts.map(a => a.message).join(' ')}
        </div>
    </div>
    `;
}

function applyWeatherScene(scene, weatherMain, data) {
    // 5-Layer Cinematic CSS architecture handles opacity transitions
    const weatherContainer = document.querySelector('.weather-widget');
    const baseSky = document.getElementById('weather-layer-base');

    if (weatherContainer) {
        // Remove all scene-* classes
        weatherContainer.classList.remove('scene-clear-day', 'scene-partly-cloudy', 'scene-sunset', 'scene-clear-night', 'scene-cloudy-day', 'scene-cloudy-night', 'scene-partly-cloudy-night', 'scene-rain', 'scene-rain-night', 'scene-rain-day', 'scene-storm', 'scene-storm-day', 'scene-snow');

        // --- STRICT HARD JS RESET ---
        // Rule: "Before activating any scene, first disable ALL weather layers and reset all scene-specific opacity/top/display values."
        const allWeatherLayers = weatherContainer.querySelectorAll(
            '.sun-asset, .sun-rays-asset, .sun-rays-intense-asset, ' +
            '.moon-asset, .stars-img, .milky-way-img, ' +
            '.cloud-layer-back, .cloud-layer-front, ' +
            '.sky-rain-layer, .sky-snow-layer, .rayo-storm-asset'
        );
        allWeatherLayers.forEach(layer => {
            layer.style.cssText = '';
        });

        // Add the mapped class
        weatherContainer.classList.add(`scene-${scene}`);

        // ALERTA ROJA: Glow Extremadamente visible en caso de peligro inminente (INUNDACIÓN/HURACÁN)
        if (scene === 'storm' || scene === 'storm-day') {
            weatherContainer.classList.add('active-extreme-alert');
        } else {
            weatherContainer.classList.remove('active-extreme-alert');
        }

        // ── ARQUITECTURA REAL: REACTIVIDAD A DATOS (Humedad y Viento) ──
        if (data) {
            // 1. Nitidez Asegurada: Removido el filtro de blur general (Humedad).
            // Se usa máscara lineal leve a los costados para difuminar "el empate" de las nubes estáticas/móviles sin afectar Nitidez.
            const skyScene = weatherContainer.querySelector('.weather-scene');
            if (skyScene) {
                skyScene.style.filter = "none";
                skyScene.style.transition = "filter 0.5s ease";
                // Aplicación de degradado leve en los bordes para disimular el empate de las Nubes
                skyScene.style.webkitMaskImage = "linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)";
                skyScene.style.maskImage = "linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)";
            }

            // 2. Flujo de Viento (Velocidad de Animación de Capas)
            const windSpeed = data.wind?.speed || 0;
            let cloudSpeed = 60 - (windSpeed * 8);
            if (cloudSpeed < 3) cloudSpeed = 3;

            const dynamicClouds = weatherContainer.querySelectorAll('.cloud-layer-front, .cloud-layer-back');
            dynamicClouds.forEach(cloud => {
                cloud.style.animationDuration = `${cloudSpeed}s`;
                // Elimina cualquier opacidad forzada sobre las nubes, los PNGs ya tienen su alfa correcto.
                cloud.style.opacity = '1';
                cloud.style.filter = "drop-shadow(0 0 10px rgba(0,0,0,0.1))"; // Para que el borde sea limpio
            });

            // Carrusel panorámico: viento mph → duración; wind.deg → animation-direction (horizontal, sin rotar el strip)
            const wind = data.wind?.speed || 0;
            let duration;
            if (wind <= 5) {
                duration = 360;
            } else if (wind <= 12) {
                duration = 300;
            } else if (wind <= 20) {
                duration = 230;
            } else {
                duration = 170;
            }

            const clouds = weatherContainer.querySelector('.nubes-largas-fast-container');
            if (clouds) {
                const windDeg = data.wind?.deg;
                if (windDeg != null && !Number.isNaN(Number(windDeg))) {
                    const deg = Number(windDeg);
                    const blowToward = (deg + 180) % 360;
                    const east = Math.sin((blowToward * Math.PI) / 180);
                    const animDir = Math.abs(east) < 0.12 ? 'normal' : east > 0 ? 'reverse' : 'normal';
                    clouds.style.setProperty('animation-direction', animDir, 'important');
                } else {
                    clouds.style.removeProperty('animation-direction');
                }
                startCarouselDurationLerp(weatherContainer, duration);
            }
        } else {
            if (_carouselLerpRaf) {
                cancelAnimationFrame(_carouselLerpRaf);
                _carouselLerpRaf = null;
            }
            const cloudsClr = weatherContainer.querySelector('.nubes-largas-fast-container');
            if (cloudsClr) cloudsClr.style.removeProperty('animation-direction');
        }

        if (data?.weather?.[0] && String(scene).includes("rain")) {
            const wid = data.weather[0].id || 500;
            let intensity = "light";
            if (wid >= 502) intensity = "heavy";
            else if (wid === 501) intensity = "moderate";
            weatherContainer.setAttribute("data-rain-intensity", intensity);
        } else {
            weatherContainer.removeAttribute("data-rain-intensity");
        }
    }

    if (baseSky) {
        baseSky.className = 'sky-base';
        baseSky.classList.add(scene);
    }

    // Dynamic Lightning Orchestration (DISABLED - returning to native custom Rayo Storm.png asset)
    /*
    if (scene === 'storm' || scene === 'storm-day') {
        if (window.startDynamicLightning) window.startDynamicLightning();
    } else {
        if (window.stopDynamicLightning) window.stopDynamicLightning();
    }
    */

    // Map OpenWeather `main` to our internal old format to trigger HTML5 Canvas Rain/Lightning effects directly
    if (window.updateWeatherAnimation) {
        window.updateWeatherAnimation(weatherMain);
    }
}

// ─── DYNAMIC LIGHTNING MANAGER ────────────────────────────

window.startDynamicLightning = function () {
    if (window.dynamicLightningTimer) return; // Prevent duplicates

    // Lightning must render above clouds (z-index 35)
    const container = document.getElementById('weather-layer-lightning');
    if (!container) return;

    // Purge old nodes just in case
    container.querySelectorAll('.dynamic-lightning-svg').forEach(el => el.remove());

    function createLightningPath(startX, startY, endX, branches, isMain, vBias = 0) {
        let path = `M ${startX} ${startY}`;
        let currX = startX;
        let currY = startY;
        const segmentCount = isMain ? 12 + Math.floor(Math.random() * 8) : 5 + Math.floor(Math.random() * 4);
        const xStep = (endX - startX) / segmentCount;

        for (let i = 0; i < segmentCount; i++) {
            currX += xStep + (Math.random() * 20 - 10);

            // Jitter to enforce horizontal strike
            let yJitter = (Math.random() * 40 - 20);
            if (!isMain) {
                // Secondary branches push up or down
                yJitter = vBias + (Math.random() * 40 - 20);
            }

            currY += yJitter;
            path += ` L ${currX} ${currY}`;

            // Randomly spawn a sub-branch
            if (branches > 0 && Math.random() > (isMain ? 0.7 : 0.9)) {
                const branchBias = (Math.random() > 0.5 ? 40 : -40); // push up or down
                const subBranchEndX = currX + (Math.random() * 100 * (Math.sign(xStep) || 1) + 30 * (Math.sign(xStep) || 1));
                path += createLightningPath(currX, currY, subBranchEndX, branches - 1, false, branchBias);
                path += ` M ${currX} ${currY}`; // Return to main trunk
            }
        }
        return path;
    }

    function strike() {
        if (!window.dynamicLightningTimer) return;

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("class", "dynamic-lightning-svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.style.pointerEvents = "none";

        // Add random slight rotation and scale for variety
        const scaleX = Math.random() > 0.5 ? 1 : -1;
        svg.style.transform = `scaleX(${scaleX})`;

        // Lightning originates from the side and crawls horizontally across the sky
        const rect = container.getBoundingClientRect();
        const startY = rect.height * (0.1 + Math.random() * 0.2); // Upper sky
        const startX = Math.random() > 0.5 ? rect.width * -0.1 : rect.width * 1.1; // Start slightly offscreen left or right
        const endX = startX < 0 ? rect.width * (0.6 + Math.random() * 0.5) : rect.width * (0.4 - Math.random() * 0.5); // Strike across to the other side

        const pathData = createLightningPath(startX, startY, endX, 4, true);

        // Glow Layer (Massive, blurred, intense blue/purple to replace the asset)
        const glowPath = document.createElementNS(svgNS, "path");
        glowPath.setAttribute("d", pathData);
        glowPath.setAttribute("stroke", "rgba(160, 190, 255, 0.8)");
        glowPath.setAttribute("stroke-width", "18");
        glowPath.setAttribute("fill", "none");
        glowPath.style.filter = "blur(10px) brightness(1.5)";

        // Core Layer (Thick, sharp, piercing white)
        const corePath = document.createElementNS(svgNS, "path");
        corePath.setAttribute("d", pathData);
        corePath.setAttribute("stroke", "#ffffff");
        corePath.setAttribute("stroke-width", "5");
        corePath.setAttribute("fill", "none");
        corePath.style.filter = "blur(1px) contrast(2)";

        svg.appendChild(glowPath);
        svg.appendChild(corePath);
        container.appendChild(svg);

        // Random brief duration: 100ms to 250ms
        const duration = Math.floor(Math.random() * 150) + 100;

        // Rapid multi-strobe effect
        svg.animate([
            { opacity: 0 },
            { opacity: 1, offset: 0.1 },
            { opacity: 0.2, offset: 0.3 },
            { opacity: 0.9, offset: 0.5 },
            { opacity: 0, offset: 1 }
        ], {
            duration: duration,
            easing: 'cubic-bezier(0.1, 0.8, 0.1, 1)'
        });

        // Clean up DOM node
        setTimeout(() => {
            if (svg.parentNode) svg.remove();
        }, duration + 50);

        // Schedule next burst between 5s to 12s (reduced frequency so it's not too crowded)
        const nextInterval = Math.floor(Math.random() * 7000) + 5000;
        window.dynamicLightningTimer = setTimeout(strike, nextInterval);
    }

    // Ignite First timer randomly
    window.dynamicLightningTimer = setTimeout(strike, Math.random() * 1500);
};

window.stopDynamicLightning = function () {
    if (window.dynamicLightningTimer) {
        clearTimeout(window.dynamicLightningTimer);
        window.dynamicLightningTimer = null;
    }
    const container = document.getElementById('weather-layer-lightning');
    if (container) {
        container.querySelectorAll('.dynamic-lightning-svg').forEach(el => el.remove());
    }
};

window.userBaseLocation = {
    city: 'Miami',
    lat: null,
    lon: null,
    isGPS: false,
    cityCached: false
};
window.locationInitialized = false;

window.initializeUserLocation = function () {
    return new Promise((resolve) => {
        if (window.locationInitialized) return resolve();

        // 1. Verificar LocalStorage (MEMORIA IPHONE)
        const savedLat = localStorage.getItem('mdj_weather_lat');
        const savedLon = localStorage.getItem('mdj_weather_lon');

        if (savedLat && savedLon) {
            console.log("📍 Ubicación restaurada de la memoria:", savedLat, savedLon);
            window.userBaseLocation.lat = parseFloat(savedLat);
            window.userBaseLocation.lon = parseFloat(savedLon);
            window.userBaseLocation.isGPS = true;
            window.locationInitialized = true;
            resolve();
            return;
        }

        // 2. Si no hay memoria, solicitar permiso
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    // Guardar para nunca volver a preguntar
                    localStorage.setItem('mdj_weather_lat', lat);
                    localStorage.setItem('mdj_weather_lon', lon);

                    window.userBaseLocation.lat = lat;
                    window.userBaseLocation.lon = lon;
                    window.userBaseLocation.isGPS = true;
                    window.locationInitialized = true;
                    console.log("📍 Permiso concedido y guardado en memoria.");
                    resolve();
                },
                (error) => {
                    console.warn("⚠️ Permiso denegado o error GPS. Usando Hialeah por defecto.");
                    window.userBaseLocation.city = 'Hialeah';
                    window.userBaseLocation.isGPS = false;
                    window.locationInitialized = true;
                    resolve();
                },
                { timeout: 5000 }
            );
        } else {
            console.warn("Navegador no soporta Geolocalización. Usando Hialeah.");
            window.userBaseLocation.city = 'Hialeah';
            window.userBaseLocation.isGPS = false;
            window.locationInitialized = true;
            resolve();
        }
    });
};

function showWeatherLoadingState() {
    const hourly = document.querySelector('#hourly-scroller-main');
    const daily = document.querySelector('#daily-forecast-list');

    if (hourly && !hourly.dataset.loading) {
        hourly.dataset.loading = 'true';
        hourly.innerHTML = '<div style="opacity:.65; font-weight:700;">Cargando pronóstico...</div>';
    }

    if (daily && !daily.dataset.loading) {
        daily.dataset.loading = 'true';
        daily.innerHTML = '<div style="opacity:.65; font-weight:700;">Preparando 10 días...</div>';
    }
}

window.handleEventWeather = async function (eventOrDate) {
    if (window.__mdjWeatherLocked) {
        console.log('[MDJ] Weather blocked during boot phase');
        return;
    }
    if (!window.locationInitialized) await window.initializeUserLocation();

    eventOrDate = eventOrDate || new Date().toISOString().split('T')[0];

    const isEvent = !!eventOrDate.title;
    const dateStr = isEvent ? (eventOrDate.startStr || (eventOrDate.start ? eventOrDate.start.toISOString().split('T')[0] : '')) : eventOrDate;

    // Notas manager: solo UUID real (lead / flow); turnos CONFIG sin consulta a event_notes
    const epNotes = isEvent ? (eventOrDate.extendedProps || null) : null;
    window.currentActiveNotesEventId = mdjAgendaResolveNotesEventId(epNotes);
    window.currentActiveNotesContext = epNotes;
    window.currentActiveEventId = window.currentActiveNotesEventId;
    if (typeof window.fetchAndRenderEventNotes === 'function') {
        window.fetchAndRenderEventNotes(window.currentActiveNotesEventId, epNotes);
    }

    let targetCity = 'Miami';
    let targetLat = null;
    let targetLon = null;

    if (isEvent) {
        if (eventOrDate.extendedProps && eventOrDate.extendedProps.lat != null && eventOrDate.extendedProps.lon != null) {
            targetLat = eventOrDate.extendedProps.lat;
            targetLon = eventOrDate.extendedProps.lon;
        } else if (eventOrDate.extendedProps && eventOrDate.extendedProps.city) {
            targetCity = eventOrDate.extendedProps.city;
        } else if (window.userBaseLocation.isGPS) {
            targetLat = window.userBaseLocation.lat;
            targetLon = window.userBaseLocation.lon;
        } else {
            targetCity = window.userBaseLocation.city;
        }
    } else {
        if (window.userBaseLocation.isGPS) {
            targetLat = window.userBaseLocation.lat;
            targetLon = window.userBaseLocation.lon;
        } else {
            targetCity = window.userBaseLocation.city;
        }
    }

    // UI Loading State (Optional)
    const heroCond = document.getElementById('weather-condition-label');
    if (heroCond) heroCond.textContent = "Rastreando...";

    // 1. Fetch Forecast with Geolocation/City
    // CRÍTICO: Solo usar dateStr si es un Evento real. Si es Dashboard base, usar NOW (null) para no heredar lluvias futuras de la noche.
    const dateToFetch = isEvent ? dateStr : null;
    let data;
    try {
        data = await getWeatherForecast(targetCity, dateToFetch, targetLat, targetLon);
    } catch (err) {
        console.error("Error sincronizando nubes reales:", err);
        const heroTemp = document.getElementById('weather-main-temp');
        const locLbl = document.getElementById('weather-location');
        if (heroCond) heroCond.textContent = "Servicio meteorológico no disponible";
        if (heroTemp) heroTemp.textContent = "—";
        if (locLbl) {
            const errCity = window.userBaseLocation?.city || "Miami";
            locLbl.textContent = `${errCity}, FL`.toUpperCase();
        }
        return;
    }

    if (!data.fullForecast || data.fullForecast.length === 0) {
        window.__mdjWeatherForecastRetries = (window.__mdjWeatherForecastRetries || 0) + 1;
        if (window.__mdjWeatherForecastRetries <= 8) {
            showWeatherLoadingState();
            var evRetry = eventOrDate;
            setTimeout(function () {
                window.handleEventWeather(evRetry);
            }, 1500);
            return;
        }
        window.__mdjWeatherForecastRetries = 0;
    } else {
        window.__mdjWeatherForecastRetries = 0;
    }

    // Cache nombre de ciudad: no pisan Nominatim/GPS si ya hay área real guardada
    if (!isEvent && targetLat != null && !window.userBaseLocation.cityCached) {
        if (!window.userBaseLocation.isGPS || !window.userBaseLocation?.city) {
            window.userBaseLocation.city = data.name || "Miami";
        }
        window.userBaseLocation.cityCached = true;
    }

    // 2. Map
    const scene = mapWeatherToScene(data);

    // 3–4) BUILD + COMMIT: un solo requestAnimationFrame (menos layout thrash; mismo DOM/IDs)
    requestAnimationFrame(function () {
        const hourlyEl = document.querySelector('#hourly-scroller-main');
        const dailyEl = document.querySelector('#daily-forecast-list');
        if (hourlyEl) delete hourlyEl.dataset.loading;
        if (dailyEl) delete dailyEl.dataset.loading;

        renderWeatherWidget(data, eventOrDate);
        applyWeatherScene(scene, data.weather?.[0]?.main || "Clear", data);

        const ww = document.querySelector('.weather-widget');
        if (ww) {
            ww.classList.add('ready');
            const hint = computeForecastTransitionHint(data);
            if (hint) {
                ww.setAttribute('data-forecast-next-main', hint.nextMain);
                ww.setAttribute('data-forecast-next-hours', String(hint.hoursApprox));
            } else {
                ww.removeAttribute('data-forecast-next-main');
                ww.removeAttribute('data-forecast-next-hours');
            }
        }

        const booth = document.getElementById('booth-hero-container');
        if (booth) {
            booth.classList.remove('mdj-weather-refresh-pulse');
            void booth.offsetWidth;
            booth.classList.add('mdj-weather-refresh-pulse');
            booth.addEventListener(
                'animationend',
                function onPulseEnd() {
                    booth.classList.remove('mdj-weather-refresh-pulse');
                    booth.removeEventListener('animationend', onPulseEnd);
                },
                { once: true }
            );
        }
        window.__mdjWeatherInitialDone = true;
    });
};


// ─── Helpers ──────────────────────────────────────────────



// ─── MOTOR LUNAR ASTRONÓMICO ──────────────────────────────
window.getLunarAsset = function (dateObj, currentTemp) {
    // 1. Eclipse Override (Máxima prioridad CEO)
    const dateStr = dateObj.toISOString().split('T')[0];
    const eclipseDates = ['2024-03-25', '2024-09-18', '2025-03-14', '2025-09-07', '2026-03-03', '2026-08-28'];
    if (eclipseDates.includes(dateStr)) {
        return './assets/weather/Moon_Eclipce.png';
    }

    // 2. Astronomía en Tiempo Real (Ciclo Sinódico)
    // Nodo Base: Luna Nueva (11 de Enero de 2024, 11:57 UTC)
    const knownNewMoon = new Date(Date.UTC(2024, 0, 11, 11, 57, 0));
    const lunarCycle = 29.53058867;
    const diffMs = dateObj - knownNewMoon;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    let phaseAge = diffDays % lunarCycle;
    if (phaseAge < 0) phaseAge += lunarCycle;

    let phaseStr = '';
    if (phaseAge < 1 || phaseAge > 28.5) phaseStr = 'new';
    else if (phaseAge >= 1 && phaseAge < 6.5) phaseStr = 'crescent';
    else if (phaseAge >= 6.5 && phaseAge < 8.5) phaseStr = 'quarter';
    else if (phaseAge >= 8.5 && phaseAge < 13.5) phaseStr = 'gibbous';
    else if (phaseAge >= 13.5 && phaseAge < 16.5) phaseStr = 'full';
    else if (phaseAge >= 16.5 && phaseAge < 21.5) phaseStr = 'gibbous';
    else if (phaseAge >= 21.5 && phaseAge < 23.5) phaseStr = 'quarter';
    else phaseStr = 'crescent';

    // 3. Override de Fuego (Luna Roja por sobre-tensión térmica nocturna)
    if (phaseStr === 'full' && currentTemp && currentTemp >= 88) {
        return './assets/weather/moon_Red.png';
    }

    // 4. Salida Asset Exacto Visual HQ
    switch (phaseStr) {
        case 'new': return './assets/weather/moon_new.png';
        case 'crescent': return './assets/weather/moon_crescent.png';
        case 'quarter': return './assets/weather/moon_quarter.png';
        case 'gibbous': return './assets/weather/moon_gibbous.png';
        case 'full': return './assets/weather/moon_full.png';
        default: return './assets/weather/moon_full.png';
    }
};

function mdjFormatHourlyLabel(dateObj, isNow) {
    if (isNow) return 'Ahora';
    const h = dateObj.getHours();
    const hour12 = h % 12 || 12;
    const suffix = h < 12 ? 'am' : 'pm';
    return hour12 + suffix;
}

function mdjResolveHourlyIconSrc(iconCode, dateObj, temp) {
    const icon = String(iconCode || '01d');
    if (icon.endsWith('n')) return window.getLunarAsset(dateObj, temp);
    /* Iconos locales hero son panorámicos; en franja horaria usar OWM (cuadrado). */
    return 'https://openweathermap.org/img/wn/' + icon + '@2x.png';
}

function mdjHourlyIconHtml(iconCode, dateObj, temp) {
    const icon = String(iconCode || '01d');
    const isNight = icon.endsWith('n');
    const imgSrc = mdjResolveHourlyIconSrc(icon, dateObj, temp);
    const glowColor = isNight ? 'rgba(200,220,255,0.6)' : 'rgba(255,200,100,0.85)';
    const size = isNight ? '28px' : '36px';
    const owmFallback = 'https://openweathermap.org/img/wn/' + icon + '@2x.png';
    return (
        '<div style="position:relative;width:' + size + ';height:' + size + ';display:flex;justify-content:center;align-items:center;">' +
        '<div style="position:absolute;width:60%;height:60%;border-radius:50%;box-shadow:0 0 16px ' + glowColor + ';background-color:' + glowColor + ';filter:blur(4px);z-index:1;"></div>' +
        '<img src="' + imgSrc + '" alt="" onerror="this.onerror=null;this.src=\'' + owmFallback + '\';" ' +
        'style="position:relative;z-index:2;width:100%;height:100%;object-fit:contain;display:block;">' +
        '</div>'
    );
}

function generateHourlyTimelineOptions(data) {
    const hourlyScroller = document.getElementById('hourly-scroller-main');
    if (!hourlyScroller) return;

    if (!data.fullForecast || data.fullForecast.length === 0) {
        const temp = Math.round(data.main?.temp || 78);
        const iconCode = data.weather?.[0]?.icon || '01d';
        const defaultVisual = mdjHourlyIconHtml(iconCode, new Date(), temp);

        hourlyScroller.innerHTML = `
            <div style="text-align: center; min-width: 55px; animation: fadeIn 0.5s ease-out; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
                <div style="font-size: 14px; font-weight: 700; opacity: 1; margin-bottom: 6px; width: 100%; text-align: center; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">Ahora</div>
                <div style="line-height: 1; margin-bottom: 8px; width: 100%; display: flex; justify-content: center; align-items: center; min-height: 40px;">${defaultVisual}</div>
                <div style="font-size: 19px; font-weight: 600; letter-spacing: -0.5px; width: 100%; text-align: center;">${temp}°</div>
            </div>
        `;
        return;
    }

    const nextBlocks = data.fullForecast.slice(0, 7);

    const hoursData = nextBlocks.map((block, index) => {
        const dateObj = new Date(block.dt * 1000);
        const label = mdjFormatHourlyLabel(dateObj, index === 0);
        const icon = (index === 0 && data.weather?.[0]?.icon) ? data.weather[0].icon : block.weather[0].icon;
        const visualHtml = mdjHourlyIconHtml(icon, dateObj, block.main.temp);

        return {
            h: label,
            t: Math.round(block.main.temp) + '°',
            visual: visualHtml
        };
    });

    hourlyScroller.innerHTML = hoursData.map(h => `
        <div style="text-align: center; min-width: 60px; animation: fadeIn 0.5s ease-out; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform 0.2s;">
            <div style="font-size: 13px; font-weight: 700; opacity: 1; margin-bottom: 6px; width: 100%; text-align: center; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">${h.h}</div>
            <div style="line-height: 1; margin-bottom: 8px; width: 100%; display: flex; justify-content: center; align-items: center; min-height: 40px;">${h.visual}</div>
            <div style="font-size: 19px; font-weight: 700; letter-spacing: -0.5px; width: 100%; text-align: center; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">${h.t}</div>
        </div>
    `).join('');
}

// ── INBOX OPERATIVO (notas manager — solo UUID reales) ──
var MDJ_NOTES_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mdjIsRealNotesEventUuid(id) {
    if (id == null || id === '') return false;
    var s = String(id).trim();
    if (/^res-/i.test(s)) return false;
    return MDJ_NOTES_UUID_RE.test(s);
}

function mdjAgendaResolveNotesEventId(ep) {
    if (!ep) return null;
    if (ep.notes_event_id && mdjIsRealNotesEventUuid(ep.notes_event_id)) {
        return String(ep.notes_event_id).trim();
    }
    if (ep.flowId && mdjIsRealNotesEventUuid(ep.flowId)) {
        return String(ep.flowId).trim();
    }
    if (ep.source === 'lead' && mdjIsRealNotesEventUuid(ep.eventId)) {
        return String(ep.eventId).trim();
    }
    if (mdjIsRealNotesEventUuid(ep.eventId)) {
        return String(ep.eventId).trim();
    }
    return null;
}

function mdjAgendaNotesNoUuidMessage(ep) {
    if (!ep) {
        return '<p class="fineprint" style="opacity:0.4; text-align:center; padding: 20px 0;">Sin evento operativo seleccionado.</p>';
    }
    var src = ep.source;
    if (
        src === 'weekly_schedule' ||
        src === 'preferred_schedule' ||
        src === 'active_days' ||
        ep.panel_status === 'scheduled_shift' ||
        ep.panel_status === 'available'
    ) {
        return '<p class="fineprint" style="opacity:0.45; text-align:center; padding: 20px 0;">Sin notas operativas para este turno.</p>';
    }
    if (src === 'holiday' || src === 'vacation' || src === 'blocked' || src === 'legacy_availability') {
        return '<p class="fineprint" style="opacity:0.45; text-align:center; padding: 20px 0;">Sin notas operativas para este día.</p>';
    }
    return '<p class="fineprint" style="opacity:0.4; text-align:center; padding: 20px 0;">Sin notas operativas para este evento.</p>';
}

window.fetchAndRenderEventNotes = async function (eventId, contextEp) {
    const container = document.getElementById('manager-notes-container');
    if (!container) return;

    const ep = contextEp || null;
    const resolvedId = eventId && mdjIsRealNotesEventUuid(eventId)
        ? String(eventId).trim()
        : mdjAgendaResolveNotesEventId(ep);

    if (!resolvedId) {
        container.innerHTML = mdjAgendaNotesNoUuidMessage(ep);
        return;
    }

    container.innerHTML = '<p class="fineprint" style="opacity:0.5; text-align:center;">Cargando notas operativas…</p>';

    const { data, error } = await window.getSupabaseClient()
        .from('event_notes')
        .select('id, type, title, body, priority, created_at, is_read')
        .eq('event_id', resolvedId)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = '<p class="fineprint" style="opacity:0.45; text-align:center; padding: 20px 0;">No se pudieron cargar las notas operativas.</p>';
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="fineprint" style="opacity:0.4; text-align:center; padding: 20px 0;">Sin notas del manager para este evento.</p>';
        return;
    }

    const goldColor = window.CALENDAR_THEMES?.resident?.color || '#c5a059';
    const redColor = window.CALENDAR_THEMES?.locked?.color || '#ff5555';

    container.innerHTML = data.map(note => `
        <div style="background: ${goldColor}0D; border-left: 3px solid ${note.priority === 'high' ? redColor : goldColor}; padding: 12px 15px; border-radius: 6px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: #fff; font-size: 11px; font-weight: 800; text-transform: uppercase;">
                    ${note.priority === 'high' ? '⚠️ ' : ''}${note.title}
                </span>
                <span style="color: rgba(255,255,255,0.4); font-size: 10px;">${new Date(note.created_at).toLocaleDateString()}</span>
            </div>
            <p style="color: rgba(255,255,255,0.8); font-size: 13px; line-height: 1.4; margin: 0;">${note.body}</p>
        </div>
    `).join('');
};

window.setupEventNotesRealtime = function (djUuid) {
    if (!djUuid || typeof window.getSupabaseClient !== 'function') return;
    const supabase = window.getSupabaseClient();

    if (window.eventNotesChannel) {
        supabase.removeChannel(window.eventNotesChannel);
        window.eventNotesChannel = null;
        console.log('🧹 [Event Notes] Canal previo limpiado.');
    }

    window.pendingEventNotes = window.pendingEventNotes || {};

    window.eventNotesChannel = supabase
        .channel(`realtime:event_notes:${djUuid}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'event_notes',
            filter: `dj_uuid=eq.${djUuid}`
        }, payload => {
            const newNote = payload.new;

            if (window.currentActiveNotesEventId === newNote.event_id) {
                if (typeof window.fetchAndRenderEventNotes === 'function') {
                    window.fetchAndRenderEventNotes(window.currentActiveNotesEventId, window.currentActiveNotesContext || null);
                }
            } else {
                if (!window.pendingEventNotes[newNote.event_id]) {
                    window.pendingEventNotes[newNote.event_id] = 0;
                }
                window.pendingEventNotes[newNote.event_id]++;
                document.dispatchEvent(new CustomEvent('djNewNoteReceived', { detail: newNote }));
            }
        })
        .subscribe((status) => {
            switch (status) {
                case 'SUBSCRIBED':
                    console.log(`✅ [Event Notes] Realtime Activo para DJ: ${djUuid}`);
                    break;
                case 'CHANNEL_ERROR':
                    console.error(`❌ [Event Notes] Error al conectar Realtime (DJ: ${djUuid}).`);
                    break;
                case 'TIMED_OUT':
                    console.warn(`⏳ [Event Notes] Timeout al conectar Realtime. Reintentando...`);
                    break;
                default:
                    console.log(`📡 [Event Notes] Estado de conexión: ${status}`);
            }
        });
};

// ── SMS / MOBILE ALERT MOCK (Fase 1) ──
window.triggerDJMobileAlert = function (eventId) {
    if (!eventId) {
        alert("⚠️ Error: ID del evento no encontrado. Sincronización fallida.");
        return;
    }

    // Feedback visual asumiendo el target en event.currentTarget
    const btn = event.currentTarget || document.activeElement;
    if (!btn || btn.tagName !== 'BUTTON') return;

    const originalText = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-block; animation: spin 1s linear infinite;">⏳</span> ENVIANDO A CENTRAL...`;
    btn.style.opacity = '0.8';
    btn.style.pointerEvents = 'none';

    // Simula latencia de Edge Function (Webhook a Twilio/Supabase)
    setTimeout(() => {
        btn.innerHTML = `✅ ALERTA ENVIADA EXITOSAMENTE`;
        btn.style.background = `rgba(0, 255, 136, 0.15)`;
        btn.style.color = `#00ff88`;
        btn.style.borderColor = `#00ff88`;

        // Retornar a neutral luego de 3s
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = `rgba(197, 160, 89, 0.15)`;
            btn.style.color = `var(--gold)`;
            btn.style.borderColor = `var(--gold)`;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        }, 3000);
    }, 1200);
};

// AUTO-REFRESH GLOBAL CADA 30 SEGUNDOS (EXTREME WEATHER BYPASS)
if (!window.weatherAutoRefreshStarted) {
    setInterval(() => {
        if (typeof window.handleEventWeather === 'function') {
            window.handleEventWeather();
            console.log("🔥 ALERTA: Refresco Global Táctico Ejecutado (Bypass Caché 30s)");
        }
    }, 30000);
    window.weatherAutoRefreshStarted = true;
}
