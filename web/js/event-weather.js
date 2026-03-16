/**
 * DJ EVENT WEATHER ORCHESTRATOR
 * Fetches real weather data and synchronizes it with the 6-layer CSS/PNG visual architecture
 * and logistical alerts for MDJPRO.
 */

window.OPENWEATHER_API_KEY = 'YOUR_API_KEY'; // Reemplazar en producción

async function getWeatherForecast(city, eventDateStr) {
    if (window.OPENWEATHER_API_KEY === 'YOUR_API_KEY') {
        console.warn("Using mock weather data because API key is missing. Set window.OPENWEATHER_API_KEY");
        return getMockWeatherData(city);
    }

    try {
        // Obtenemos el clima actual como fallback base
        const urlCurrent = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${window.OPENWEATHER_API_KEY}&units=imperial`;
        const resCurrent = await fetch(urlCurrent);
        
        if (!resCurrent.ok) {
            console.error(`Weather API Error: ${resCurrent.status}`);
            return getMockWeatherData(city);
        }
        const currentData = await resCurrent.json();

        if (!eventDateStr) return currentData;

        // Intentamos el pronóstico a 5 días (/forecast)
        const urlForecast = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${window.OPENWEATHER_API_KEY}&units=imperial`;
        const resForecast = await fetch(urlForecast);
        
        if (!resForecast.ok) return currentData;
        const forecastData = await resForecast.json();
        
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
        
        return closestBlock;
        
    } catch (e) {
        console.error("Weather fetch failed:", e);
        return getMockWeatherData(city);
    }
}

function mapWeatherToScene(data) {
    const main = data.weather?.[0]?.main || "Clear";
    // Check if it's night based on icon (e.g., '01n' ends with 'n')
    const isNight = data.weather?.[0]?.icon?.endsWith("n") || false;

    // Detect sunset transition window
    // Window: 45 minutes before sunset until 15 minutes after sunset
    const now = Math.floor(Date.now() / 1000);
    const sunset = data.sys?.sunset || 0;
    const isSunset = sunset > 0 && (now >= sunset - 2700 && now <= sunset + 900);

    // If it's sunset time and weather is generally visible (not severe storm/rain)
    if (isSunset && (main === "Clear" || main === "Clouds")) return "sunset";

    if (main === "Thunderstorm") return "storm";
    if (main === "Rain" || main === "Drizzle") return isNight ? "rain-night" : "rain";
    if (main === "Clouds" || main === "Mist" || main === "Fog" || main === "Haze" || main === "Smoke") return isNight ? "cloudy-night" : "cloudy-day";
    
    return isNight ? "clear-night" : "clear-day";
}

function renderWeatherWidget(data, eventOrDate) {
    // 1. Update Top Hero Widget 🍏
    const heroCity = document.getElementById('hero-city');
    const heroTemp = document.getElementById('hero-temp');
    const heroCond = document.getElementById('hero-condition');
    const heroHL = document.getElementById('hero-high-low');
    const locationLbl = document.getElementById('weather-location');

    const temp = Math.round(data.main?.temp || 78);
    const tempMax = Math.round(data.main?.temp_max || temp + 5);
    const tempMin = Math.round(data.main?.temp_min || temp - 5);
    const description = data.weather?.[0]?.description || data.weather?.[0]?.main || "Despejado";
    const conditionMain = data.weather?.[0]?.main || "Clear";

    if (heroCity) heroCity.textContent = data.name || "Miami";
    if (locationLbl) locationLbl.textContent = `${data.name || "Miami"} — USA`;
    if (heroTemp) heroTemp.textContent = `${temp}°`;
    
    // Capitalize first letter of description for UI
    const capitalizedDesc = description.charAt(0).toUpperCase() + description.slice(1);
    if (heroCond) heroCond.textContent = capitalizedDesc;
    
    if (heroHL) heroHL.textContent = `Máxima: ${tempMax}° | Mínima: ${tempMin}°`;

    // 2. Build the right sidebar details
    const dataDiv = document.getElementById('dash-event-detail-data');
    if (!dataDiv) return;

    dataDiv.style.display = 'block';

    const isEvent = !!eventOrDate.title;
    const dateStr = isEvent ? eventOrDate.startStr : eventOrDate;
    const eventTitle = isEvent ? eventOrDate.title : 'Día sin eventos';

    let themeColor = 'rgba(255,255,255,0.2)';
    let statusLabel = 'Agenda Disponible';
    let cardIcon = '☀️';
    
    // Extract Extended Props
    const startTime = (isEvent && eventOrDate.extendedProps?.start_time) ? eventOrDate.extendedProps.start_time : '--:--';
    const endTime = (isEvent && eventOrDate.extendedProps?.end_time) ? eventOrDate.extendedProps.end_time : '--:--';
    const bufferTime = (isEvent && eventOrDate.extendedProps?.buffer_time) ? `+${eventOrDate.extendedProps.buffer_time}m` : '--';
    const evCity = (isEvent && eventOrDate.extendedProps?.city) ? eventOrDate.extendedProps.city : data.name;

    if (isEvent) {
        if (conditionMain === 'Thunderstorm' || conditionMain === 'Rain') {
            themeColor = '#ff5555'; // Red alert for bad weather
            cardIcon = conditionMain === 'Thunderstorm' ? '⚡' : '🌧';
        } else if (eventOrDate.extendedProps?.status === 'CANCELLED') {
             themeColor = '#ff5555';
             statusLabel = 'Evento Cancelado';
        } else {
            themeColor = '#00ff88'; // Green for good weather
            cardIcon = conditionMain === 'Clouds' ? '🌤' : '☀️';
            statusLabel = 'Evento Confirmado';
        }
    }

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

                <!-- Logic Alert Block -->
                ${renderLogisticsAlerts(logistics)}
            </div>
        </div>
    `;

    // (Optional) Populate Hourly Timeline - Keep mock for now since OpenWeatherMap Free only has current data unless using OneCall API
    generateHourlyTimelineOptions(temp, conditionMain);
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
    const tempC = (tempF - 32) * 5/9;
    
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

function applyWeatherScene(scene, weatherMain) {
    // 5-Layer Cinematic CSS architecture handles opacity transitions
    const weatherContainer = document.querySelector('.weather-widget');
    const baseSky = document.getElementById('weather-layer-base');

    if (weatherContainer) {
        // Remove all scene-* classes
        weatherContainer.classList.remove('scene-clear-day', 'scene-partly-cloudy', 'scene-sunset', 'scene-clear-night', 'scene-cloudy-day', 'scene-cloudy-night', 'scene-rain', 'scene-rain-night', 'scene-rain-day', 'scene-storm', 'scene-storm-day', 'scene-snow');
        
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

window.startDynamicLightning = function() {
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

window.stopDynamicLightning = function() {
    if (window.dynamicLightningTimer) {
        clearTimeout(window.dynamicLightningTimer);
        window.dynamicLightningTimer = null;
    }
    const container = document.getElementById('weather-layer-lightning');
    if (container) {
        container.querySelectorAll('.dynamic-lightning-svg').forEach(el => el.remove());
    }
};

window.handleEventWeather = async function(eventOrDate) {
    const isEvent = !!eventOrDate.title;
    const city = isEvent ? (eventOrDate.extendedProps?.city || 'Miami') : 'Miami';
    const dateStr = isEvent ? (eventOrDate.startStr || eventOrDate.start) : eventOrDate;

    // UI Loading State (Optional)
    const heroCond = document.getElementById('hero-condition');
    if(heroCond) heroCond.textContent = "Obteniendo datos...";

    // 1. Fetch Forecast
    const data = await getWeatherForecast(city, dateStr);
    
    // 2. Map
    const scene = mapWeatherToScene(data);

    // 3. Render Dashboard Widgets (Hero + Details)
    renderWeatherWidget(data, eventOrDate);

    // 4. Update the 6-Layer Atmosphere
    applyWeatherScene(scene, data.weather?.[0]?.main || "Clear");
};


// ─── Helpers ──────────────────────────────────────────────

function getMockWeatherData(city) {
    // Simulates an API response if key is missing/invalid
    const hours = new Date().getHours();
    const isNight = hours < 6 || hours > 19;
    
    return {
        name: city,
        weather: [{ 
            main: "Clouds", 
            description: "nubes dispersas",
            icon: isNight ? "02n" : "02d" 
        }],
        main: {
            temp: 74,
            temp_max: 78,
            temp_min: 68
        },
        wind: { speed: 8.5 }, // mph
        sys: {
             sunset: Math.floor(Date.now() / 1000) + 7200 // Sunset in 2 hours
        }
    };
}

function generateHourlyTimelineOptions(baseTemp, condition) {
    const hourlyScroller = document.getElementById('hourly-scroller-main');
    if (!hourlyScroller) return;

    let conditionLower = condition.toLowerCase();
    
    const hours = [
        { h: 'Now', t: baseTemp + '°', c: conditionLower }, 
        { h: '+1h', t: (baseTemp - 1) + '°', c: conditionLower },
        { h: '+2h', t: (baseTemp - 2) + '°', c: conditionLower }, 
        { h: '+3h', t: (baseTemp - 2) + '°', c: conditionLower },
        { h: '+4h', t: (baseTemp - 3) + '°', c: conditionLower }
    ];

    hourlyScroller.innerHTML = hours.map(h => `
        <div style="text-align: center; min-width: 55px; animation: fadeIn 0.5s ease-out;">
            <div style="font-size: 11px; font-weight: 700; opacity: 0.5; margin-bottom: 12px;">${h.h}</div>
            <div style="margin-bottom: 12px; transform: scale(1.1);">${window.getWeatherSVG(h.c, 28)}</div>
            <div style="font-size: 17px; font-weight: 600; letter-spacing: -0.5px;">${h.t}</div>
        </div>
    `).join('');
}
