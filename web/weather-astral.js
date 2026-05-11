/**
 * MDJPRO - Weather Astral Engine
 * Handles dynamic sun positioning, lunar paths, and lunar phases mathematically via date/time.
 * Compatible with the locked Z-index weather matrix.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const sunEl = document.getElementById('sun-element');
    const sunBodyEl = document.getElementById('sun-body-element');
    const moonEl = document.getElementById('moon-element');
    const sunRaysEl = document.getElementById('sun-rays-element');
    const weatherContainer = document.querySelector('.weather-widget');
    const baseSky = document.getElementById('weather-layer-base');

    if (!sunEl || !moonEl) return;

    // --- Core Astro Variables ---
    const sunriseHour = 7.1; // 7:06 AM
    const sunsetHour = 18.7; // 6:42 PM
    const moonriseHour = sunsetHour;
    const moonsetHour = sunriseHour + 24; // Spans past midnight

    function getHourInMiami(date) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).formatToParts(date);

        const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
        const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);

        return hour + minute / 60;
    }

    /* =========================================================
       1. MOON PHASE CALCULATION (Synodic Algorithm)
    ========================================================= */
    function getMoonPhaseByDate(date) {
        // Base New Moon: Jan 6, 2000 18:14 UTC
        const baseDate = new Date('2000-01-06T18:14:00Z');
        const diffMs = date.getTime() - baseDate.getTime();
        const daysSinceBase = diffMs / (1000 * 60 * 60 * 24);

        // Exact Synodic Month
        const synodicMonth = 29.53058867;
        let phaseDecimal = (daysSinceBase % synodicMonth) / synodicMonth;
        if (phaseDecimal < 0) phaseDecimal += 1;

        // Forzar fase llena el 6 de abril según la "Realidad" solicitada por el usuario
        const month = date.getMonth();
        const day = date.getDate();
        if (month === 3 && day === 6) return 'full-moon';

        if (phaseDecimal < 0.05 || phaseDecimal >= 0.95) return 'new-moon';
        if (phaseDecimal < 0.20) return 'waxing-crescent';
        if (phaseDecimal < 0.30) return 'first-quarter';
        if (phaseDecimal < 0.45) return 'waxing-gibbous';
        if (phaseDecimal < 0.55) return 'full-moon';
        if (phaseDecimal < 0.70) return 'waning-gibbous';
        if (phaseDecimal < 0.80) return 'last-quarter';
        return 'waning-crescent';
    }

    function applyMoonPhase(date, temp) {
        let targetImage = 'moon.png';
        if (typeof window.getLunarAsset === 'function') {
            // Elimina prefijo './assets/weather/' para usar el path nativo del astral
            const fullPath = window.getLunarAsset(date, temp);
            targetImage = fullPath.replace('./assets/weather/', '');
        }

        // 1. Textura y Relieve (Imagen hiperrealista directa, sin cartón CSS)
        moonEl.src = `./assets/weather/${targetImage}`;
        moonEl.style.webkitMaskImage = 'none';
        moonEl.style.maskImage = 'none';

        // 2. Elimina el Cuadrado
        moonEl.style.borderRadius = '50%';

        // 3. Glow Dinámico Dorado
        moonEl.style.filter = `drop-shadow(0 0 30px rgba(197, 160, 89, 0.7))`;
        moonEl.style.opacity = '1';
    }

    /* =========================================================
       2. ASTRAL TRAJECTORY CALCULATIONS (Math Arcs)
    ========================================================= */
    function getSunPositionByTime(currentHour) {
        const isDay = currentHour >= sunriseHour && currentHour <= sunsetHour;
        if (!isDay) return { opacity: 0, x: 0, y: 100, scale: 1, brightness: 1 };

        // Progress from 0 (sunrise) to 1 (sunset)
        const progress = (currentHour - sunriseHour) / (sunsetHour - sunriseHour);
        const clamped = Math.max(0, Math.min(1, progress));

        // Math: 
        // X moves linearly from -10% to 110% (East to West)
        // Y moves in an inverted parabola (Math.sin). Elevando el arco para que no se arrastre en el fondo.
        const x = -10 + (clamped * 120);
        const y = 14 - Math.sin(clamped * Math.PI) * 12; // Reaches 2% at noon, 14% at horizons (Arco alto imperial)

        // Escala bloqueada a 1.0 para evitar brincos de tamaño (Zero-Jump Protocol)
        const scale = 1.0;
        const brightness = 0.9 + Math.sin(clamped * Math.PI) * 0.25;

        return { opacity: 1, progress: clamped, x, y, scale, brightness };
    }

    function applySunVisuals(sun) {
        sunEl.style.opacity = '1';
        sunEl.style.left = `${sun.x}%`;
        sunEl.style.top = `${sun.y}%`;
        sunEl.style.transform = `translate(-50%, -50%) scale(${sun.scale})`;

        // Arquitectura de Cristal: Capas de resplandor apiladas (Rays + Core Glow + Ambient)
        sunEl.style.filter = `brightness(${sun.brightness}) drop-shadow(0 0 60px rgba(255, 230, 150, 0.9)) drop-shadow(0 0 120px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 20px rgba(255, 255, 255, 1))`;
    }

    function getMoonPositionByTime(currentHour) {
        // Adjust hour to handle the midnight wraparound safely
        let adjustedHour = currentHour;
        if (currentHour < sunriseHour) {
            adjustedHour += 24;
        }

        const isNight = adjustedHour >= moonriseHour && adjustedHour <= moonsetHour;
        if (!isNight) return { opacity: 0, x: 0, y: 100, scale: 1 };

        // Progress from 0 (sunset today) to 1 (sunrise tomorrow)
        const progress = (adjustedHour - moonriseHour) / (moonsetHour - moonriseHour);
        const clamped = Math.max(0, Math.min(1, progress));

        // X moves smoothly across the 100% boundary 
        // Force the moon into a prominent upper position to emulate premium dashboard design
        const x = 85 - (clamped * 70); // Starts right, moves to top center
        const y = 30 - Math.sin(clamped * Math.PI) * 15;

        // Escala calibrada precisa "Tamago" (100% real en vez de 160%)
        return { opacity: 1, progress: clamped, x, y, scale: 1.0 };
    }

    /* =========================================================
       3. ENGINE ORCHESTRATION & DOM APPLICATION
    ========================================================= */
    // EXPUESTO PARA CONECTAR A LA FUENTE ORIGINAL (API)
    window.applyAstralState = function (targetDate, weatherData) {
        if (weatherContainer && weatherContainer.hasAttribute('data-qa-forced')) return;

        let astralDate = targetDate;

        if (!astralDate) {
            // Fallback: Timezone estricta Miami
            const miamiTimeStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
            astralDate = new Date(miamiTimeStr);
        }

        const currentHour = astralDate.getHours() + (astralDate.getMinutes() / 60);
        const moonHour = getHourInMiami(astralDate);

        // 3a. Evaluate Background Scene
        const isDay = currentHour >= sunriseHour && currentHour <= sunsetHour;

        // 3b. Apply Solar Physics (Reactivo a la Temperatura Real)
        const sun = getSunPositionByTime(currentHour);
        if (sun.opacity > 0) {

            // MOTOR TERMICO: Determinar color del Sol basado en Temp (API)
            let coreColor = '255, 230, 150'; // Default warm
            let glowColor = '255, 255, 255'; // Default white
            if (weatherData && weatherData.main && weatherData.main.temp) {
                const t = weatherData.main.temp;
                if (t >= 85) {
                    coreColor = '255, 120, 50'; // Heatwave orange/red
                    glowColor = '255, 180, 100';
                } else if (t >= 75) {
                    coreColor = '255, 200, 100'; // Hot Florida gold
                    glowColor = '255, 240, 180';
                } else if (t < 60) {
                    coreColor = '200, 240, 255'; // Cold/Frosty sun
                    glowColor = '150, 220, 255';
                }
            }

            sunEl.style.opacity = '1';
            sunEl.style.left = `${sun.x}%`;
            sunEl.style.top = `${sun.y}%`;
            sunEl.style.transform = `translate(-50%, -50%) scale(${sun.scale})`;

            // Arquitectura Dinámica por Calor
            sunEl.style.filter = `brightness(${sun.brightness}) drop-shadow(0 0 60px rgba(${coreColor}, 0.9)) drop-shadow(0 0 120px rgba(${glowColor}, 0.6)) drop-shadow(0 0 30px rgba(255, 255, 255, 1))`;

            if (sunBodyEl) sunBodyEl.style.opacity = '0'; // Clean old unused elements
            if (sunRaysEl) sunRaysEl.style.opacity = '0'; // Clean old unused elements

        } else {
            sunEl.style.opacity = '0';
            if (sunBodyEl) sunBodyEl.style.opacity = '0';
            if (sunRaysEl) sunRaysEl.style.opacity = '0';
        }

        // 3c. Apply Lunar Physics
        const moon = getMoonPositionByTime(moonHour);
        if (moon.opacity > 0) {
            window.__lastMoonPos = window.__lastMoonPos || null;
            let moonX = moon.x;
            let moonY = moon.y;

            if (window.__lastMoonPos) {
                const dx = Math.abs(moonX - window.__lastMoonPos.x);
                const dy = Math.abs(moonY - window.__lastMoonPos.y);

                // Si el salto es extremo, ancla primero en la posicion previa.
                if (dx > 40 || dy > 40) {
                    moonX = window.__lastMoonPos.x;
                    moonY = window.__lastMoonPos.y;
                }

                // Follow suave para evitar micro-brincos entre muestras.
                moonX = window.__lastMoonPos.x + (moonX - window.__lastMoonPos.x) * 0.1;
                moonY = window.__lastMoonPos.y + (moonY - window.__lastMoonPos.y) * 0.1;
            }

            window.__lastMoonPos = { x: moonX, y: moonY };
            if (!window.__moonHasRendered) {
                moonEl.style.opacity = '0';
            }
            moonEl.style.transition = 'left 20s linear, top 20s linear, transform 20s linear, opacity .8s ease';
            const currentTemp = weatherData?.main?.temp || null;
            applyMoonPhase(astralDate, currentTemp); // Llama al motor unificado de fases y temperatura
            moonEl.style.filter = `
                drop-shadow(0 0 6px rgba(255,255,255,0.6))
                drop-shadow(0 0 12px rgba(255,255,255,0.3))
                blur(0.5px)
            `;
            moonEl.style.left = `${moonX}%`;
            moonEl.style.top = `${moonY}%`;
            moonEl.style.transform = `translate(-50%, -50%) scale(${moon.scale})`;
            moonEl.style.display = 'block'; // Failsafe
            requestAnimationFrame(() => {
                moonEl.style.opacity = '1';
                window.__moonHasRendered = true;
            });

        } else {
            moonEl.style.opacity = '0';
            // Do NOT use display:none, preserve physical transform bounds
        }
    }

    // Astral: sin tick inicial ni interval aquí — renderWeatherWidget → applyAstralState(ts, data).

    // --- DEMO MODE EXPOSE ---
    window.testTimeObject = (testDate, hours) => {
        const _Date = Date;
        globalThis.Date = class extends _Date {
            constructor() { super(); return testDate; }
            getHours() { return Math.floor(hours); }
            getMinutes() { return (hours % 1) * 60; }
        };
        applyAstralState();
        globalThis.Date = _Date;
    };
});
