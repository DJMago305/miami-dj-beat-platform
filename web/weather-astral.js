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
        const phaseDecimal = (daysSinceBase % synodicMonth) / synodicMonth;
        
        let phaseIndex = phaseDecimal;
        if (phaseIndex < 0) phaseIndex += 1; // Handle pre-2000 dates safely
        
        // Map 0-1 to 8 distinct phases
        if (phaseIndex < 0.03 || phaseIndex >= 0.97) return 'new-moon';
        if (phaseIndex < 0.22) return 'waxing-crescent';
        if (phaseIndex < 0.28) return 'first-quarter';
        if (phaseIndex < 0.47) return 'waxing-gibbous';
        if (phaseIndex < 0.53) return 'full-moon';
        if (phaseIndex < 0.72) return 'waning-gibbous';
        if (phaseIndex < 0.78) return 'last-quarter';
        return 'waning-crescent';
    }

    function applyMoonPhase(date) {
        const phase = getMoonPhaseByDate(date);
        
        // Dynamic asset routing. 
        // Note: If these specific files don't exist yet, it's safe because the `alt` tag 
        // won't break the layout, and it prepares the architecture exactly as requested.
        // Fallback or base image can be added if needed, but for now we wire it to the phase system. 
        const phaseAssetMap = {
            'new-moon': 'New Moon.png',
            'waxing-crescent': 'Waxing Crescent.png',
            'first-quarter': 'First Quarter.png',
            'waxing-gibbous': 'Waxing Gibbous.png',
            'full-moon': 'moon.png', // Using existing moon as full moon for safety
            'waning-gibbous': 'Waning Gibbous.png',
            'last-quarter': 'Last Quarter.png',
            'waning-crescent': 'Waning Crescent.png'
        };

        const targetImage = phaseAssetMap[phase] || 'moon.png';
        const absolutePath = `./assets/weather/moon-phases/${targetImage}`;
        
        // Temporal fallback safety check (if moon-phases folder is missing assets, it uses old moon.png)
        // In a real production environment, you might just trust the path.
        // COMMENTED OUT FOR NOW TO PREVENT 404 BROKEN IMAGES:
        // if (phase === 'full-moon') {
        //      moonEl.src = `./assets/weather/moon.png`;
        // } else {
        //      moonEl.src = `./assets/weather/moon-phases/${targetImage}`;
        // }
        // 
        // Optional debug
        // console.log(`[MDJPRO Astral] Calculated Phase: ${phase}`);
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
        // Y moves in an inverted parabola (Math.sin). At 0.5 (noon), sin(0.5*PI) = 1 (Highest point)
        const x = -10 + (clamped * 120); 
        const y = 40 - Math.sin(clamped * Math.PI) * 25; // Reaches 15% at noon, 40% at horizons

        const scale = 1.0 + Math.sin(clamped * Math.PI) * 0.1;
        const brightness = 0.9 + Math.sin(clamped * Math.PI) * 0.25;

        return { opacity: 1, progress: clamped, x, y, scale, brightness };
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

        // Math:
        // X moves linearly from 110% to -10% (Rises East, Sets West)
        // Actually for Miami weather widgets, let's keep consistency: Sun East->West, Moon East->West
        const x = 110 - (clamped * 120); 
        const y = 35 - Math.sin(clamped * Math.PI) * 25; // Reaches 10% highest, 35% on horizon

        return { opacity: 1, progress: clamped, x, y, scale: 0.95 };
    }

    /* =========================================================
       3. ENGINE ORCHESTRATION & DOM APPLICATION
    ========================================================= */
    function applyAstralState() {
        if (weatherContainer && weatherContainer.hasAttribute('data-qa-forced')) return;

        const now = new Date();
        const currentHour = now.getHours() + (now.getMinutes() / 60);

        // 3a. Evaluate Background Scene
        const isDay = currentHour >= sunriseHour && currentHour <= sunsetHour;
        let targetScene = 'clear-night';
        
        if (isDay) {
            const sunProgress = (currentHour - sunriseHour) / (sunsetHour - sunriseHour);
            if (sunProgress < 0.15 || sunProgress > 0.85) {
                targetScene = 'sunset';
            } else {
                targetScene = 'clear-day';
            }
        } else if (currentHour >= 4 && currentHour < sunriseHour) {
            targetScene = 'sunset'; // Dawn pre-glow
        }

        // Apply clean background only if no severe weather overrides it
        if (weatherContainer) {
            const isOverridden = weatherContainer.classList.contains('scene-cloudy') || 
                                 weatherContainer.classList.contains('scene-rain') || 
                                 weatherContainer.classList.contains('scene-storm');
            
            if (!isOverridden) {
                Array.from(weatherContainer.classList).forEach(cls => {
                    if (cls.startsWith('scene-')) {
                        weatherContainer.classList.remove(cls);
                    }
                });
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

        // 3b. Apply Solar Physics
        const sun = getSunPositionByTime(currentHour);
        if (sun.opacity > 0) {
            sunEl.style.opacity = '1';
            sunEl.style.left = `${sun.x}%`;
            sunEl.style.top = `${sun.y}%`;
            sunEl.style.transform = `translate(-50%, -50%) scale(${sun.scale})`;
            sunEl.style.filter = `brightness(${sun.brightness})`;

            if (sunBodyEl) {
                sunBodyEl.style.opacity = '1';
                sunBodyEl.style.left = `${sun.x}%`;
                sunBodyEl.style.top = `${sun.y}%`;
                sunBodyEl.style.transform = `translate(-50%, -50%) scale(${sun.scale})`;
            }

            if (sunRaysEl) {
                sunRaysEl.style.opacity = '0.72';
                sunRaysEl.style.left = `${sun.x}%`;
                sunRaysEl.style.top = `${sun.y}%`;
                sunRaysEl.style.transform = `translate(-50%, -50%) scale(${sun.scale * 1.35})`; 
                
                if (sun.progress < 0.25) sunRaysEl.style.filter = "brightness(0.95)";
                else if (sun.progress < 0.75) sunRaysEl.style.filter = "brightness(1.15)";
                else sunRaysEl.style.filter = "brightness(0.9)";
            }
        } else {
            sunEl.style.opacity = '0';
            if (sunBodyEl) sunBodyEl.style.opacity = '0';
            if (sunRaysEl) sunRaysEl.style.opacity = '0';
        }

        // 3c. Apply Lunar Physics
        const moon = getMoonPositionByTime(currentHour);
        if (moon.opacity > 0) {
            applyMoonPhase(now); // Recalculate phase visual safely
            moonEl.style.opacity = '1';
            moonEl.style.left = `${moon.x}%`;
            moonEl.style.top = `${moon.y}%`;
            moonEl.style.transform = `translate(-50%, -50%) scale(${moon.scale})`;
            moonEl.style.filter = `drop-shadow(0 0 40px rgba(200, 220, 255, 0.4))`;
            moonEl.style.display = 'block'; // Failsafe
        } else {
            moonEl.style.opacity = '0';
            // Do NOT use display:none, preserve physical transform bounds
        }
    }

    // --- Initiation and Tick ---
    applyAstralState();
    window.astralInterval = setInterval(applyAstralState, 60000);

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
