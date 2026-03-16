/**
 * MDJPRO - Weather Astral Engine
 * Handles dynamic sun positioning and lunar phases via CSS manipulation and .scene-* classes.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements
    const sunEl = document.getElementById('sun-element');
    const sunBodyEl = document.getElementById('sun-body-element');
    const moonEl = document.getElementById('moon-element');
    const sunRaysEl = document.getElementById('sun-rays-element');
    const weatherContainer = document.querySelector('.weather-widget');
    const baseSky = document.getElementById('weather-layer-base');

    if (!sunEl || !moonEl) return;

    // 2. Base Florida Variables
    const sunriseHour = 7.1; // 7:06 AM
    const sunsetHour = 18.7; // 6:42 PM

    function updateAstralBodies() {
        // If QA mode is forcing a scene, we skip dynamic updates.
        if (weatherContainer && weatherContainer.hasAttribute('data-qa-forced')) return;

        const now = new Date();
        const currentHour = now.getHours() + (now.getMinutes() / 60);

        const isDay = currentHour >= sunriseHour && currentHour <= sunsetHour;

        // Progreso solar
        const sunProgress = (currentHour - sunriseHour) / (sunsetHour - sunriseHour);
        const clampedSun = Math.max(0, Math.min(1, sunProgress));

        // Let's determine the background scene based on time
        let targetScene = 'clear-night';
        if (isDay) {
            if (clampedSun < 0.15 || clampedSun > 0.85) {
                targetScene = 'sunset'; // Sunrise and Sunset share the same warm gradient logic
            } else {
                targetScene = 'clear-day'; // Peak day
            }
        } else if (currentHour >= 4 && currentHour < sunriseHour) {
            targetScene = 'sunset'; // Dawn pre-glow
        }

        // Apply background scene quietly without destroying potential weather overrides (like cloudy/rain)
        // For Astral, we only manage the clear sky states. If it's cloudy/raining, the event-weather.js will override this.
        // To be safe, we only swap if it's currently a clear/sunset/night scene.
        if (weatherContainer) {
            const isOverridden = weatherContainer.classList.contains('scene-cloudy') || 
                                 weatherContainer.classList.contains('scene-rain') || 
                                 weatherContainer.classList.contains('scene-storm');
            
            if (!isOverridden) {
                weatherContainer.classList.remove('scene-clear-day', 'scene-sunset', 'scene-clear-night');
                weatherContainer.classList.add(`scene-${targetScene}`);
            }
        }

        if (baseSky) {
            const isOverriddenSky = baseSky.classList.contains('cloudy') || 
                                    baseSky.classList.contains('rain') || 
                                    baseSky.classList.contains('storm');
            if(!isOverriddenSky) {
                baseSky.className = 'sky-base';
                baseSky.classList.add(targetScene);
            }
        }

        // --- SUN LOGIC ---
        if (isDay) {
            sunEl.style.opacity = '1';
            moonEl.style.opacity = '0';

            // Arco del sol
            const x = clampedSun * 100;
            const y = 40 - Math.sin(clampedSun * Math.PI) * 25;
            
            // Tamaño y brillo
            const scale = 1.0 + Math.sin(clampedSun * Math.PI) * 0.1;
            const brightness = 0.9 + Math.sin(clampedSun * Math.PI) * 0.25;
            
            // Aplicación Sol
            sunEl.style.left = `${x}%`;
            sunEl.style.top = `${y}%`;
            sunEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
            sunEl.style.filter = `brightness(${brightness})`; // Pure image only
            sunEl.style.opacity = isDay ? "1" : "0";

            if (sunBodyEl) {
                sunBodyEl.style.left = `${x}%`;
                sunBodyEl.style.top = `${y}%`;
                sunBodyEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
                sunBodyEl.style.opacity = isDay ? "1" : "0";
            }

            // Movimiento de rayos de sol
            if (sunRaysEl) {
                sunRaysEl.style.left = `${x}%`;
                sunRaysEl.style.top = `${y}%`;
                sunRaysEl.style.transform = `translate(-50%, -50%) scale(${scale * 1.35})`; 
                sunRaysEl.style.opacity = isDay ? "0.72" : "0";

                // Reglas visuales rayos
                if (clampedSun < 0.25) sunRaysEl.style.filter = "brightness(0.95)";
                else if (clampedSun < 0.75) sunRaysEl.style.filter = "brightness(1.15)";
                else sunRaysEl.style.filter = "brightness(0.9)";
            }

        } 
        // --- MOON LOGIC ---
        else {
            sunEl.style.opacity = '0';
            if (sunBodyEl) sunBodyEl.style.opacity = '0';
            if (sunRaysEl) sunRaysEl.style.opacity = '0';

            // Calculate lunar progress (No NASA astronomy needed)
            const moonStart = sunsetHour;
            const moonEnd = sunriseHour + 24;

            // Si la hora actual es despues de medianoche:
            const adjustedHour = currentHour < sunriseHour ? currentHour + 24 : currentHour;
            const moonProgress = (adjustedHour - moonStart) / (moonEnd - moonStart);
            const clampedMoon = Math.max(0, Math.min(1, moonProgress));
            
            // Lunar Arc (Slightly different trajectory)
            const moonX = 100 - clampedMoon * 100;
            const moonY = 35 - Math.sin(clampedMoon * Math.PI) * 20; 
            
            moonEl.style.left = `${moonX}%`;
            moonEl.style.top = `${moonY}%`;
            moonEl.style.transform = `translate(-50%, -50%) scale(0.9)`;
            moonEl.style.opacity = !isDay ? "1" : "0";
            moonEl.style.filter = `drop-shadow(0 0 40px rgba(200, 220, 255, 0.4))`;

            // Stars Logic based on scene overrides
            const starsEl = document.getElementById('weather-stars');
            if (starsEl) {
                const isOverriddenCloudy = weatherContainer && (
                    weatherContainer.classList.contains('scene-cloudy') || 
                    weatherContainer.classList.contains('scene-storm') ||
                    weatherContainer.classList.contains('scene-rain')
                );
                
                if (isOverriddenCloudy) {
                    starsEl.style.opacity = "0.18";
                } else {
                    starsEl.style.opacity = "0.8";
                }
            }
        }
    }

    // Initial call
    updateAstralBodies();

    // Update every minute
    window.astralInterval = setInterval(updateAstralBodies, 60000);

    // --- DEMO MODE EXPOSE ---
    window.testTime = (hours) => {
        const _Date = Date;
        globalThis.Date = class extends _Date {
            getHours() { return Math.floor(hours); }
            getMinutes() { return (hours % 1) * 60; }
        };
        updateAstralBodies();
        globalThis.Date = _Date;
    };
});
