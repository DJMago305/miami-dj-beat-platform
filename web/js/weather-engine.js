/* ── PUENTE AL TIEMPO ────────────────────────────────────────────────
   La clave YA NO viaja al navegador: vive solo en la funcion mdj-weather.
   Antes estaba incrustada aqui y este archivo se sirve publico, asi que
   cualquiera la leia. Una variable de navegador la habria sacado de git
   pero no de la vista. */
function mdjPuenteClima(params) {
    var base = (typeof window !== 'undefined' && typeof window.mdbSupabaseFunctionUrl === 'function')
        ? window.mdbSupabaseFunctionUrl('mdj-weather') : '';
    if (!base) return '';
    var u = new URL(base);
    Object.keys(params).forEach(function (k) { u.searchParams.set(k, params[k]); });
    return u.toString();
}

// 🛰️ WEATHER GEO-ENGINE: Satélite Nominatim + API OpenWeatherMap
// Conecta el Dashboard directamente a las coordenadas del operador y devuelve Clima Profesional VIP.

function mdjIsNearHialeahFL(lat, lon) {
    const la = Number(lat);
    const lo = Number(lon);
    if (Number.isNaN(la) || Number.isNaN(lo)) return false;
    const hLat = 25.8576;
    const hLon = -80.2781;
    return Math.abs(la - hLat) < 0.15 && Math.abs(lo - hLon) < 0.15;
}

const WeatherGeoEngine = {
    init: function() {
        console.log("🛰️ Iniciando Sonda de Geolocalización...");
        this.startGeolocationEngine();
        
        // Refresco de posición y clima cada 15 minutos exactos (900,000ms)
        setInterval(() => this.startGeolocationEngine(), 900000);
    },

    fetchProfessionalWeather: async function(lat, lon, realCityName) {
        // La clave se inyecta desde fuera; NUNCA se escribe aqui: este archivo
        // se sirve publico. Sin clave no se llama a la API.
        const url = mdjPuenteClima({ recurso: 'weather', lat: lat, lon: lon, units: 'imperial', lang: 'es' });
        if (!url) { console.warn('[weather-engine] Puente no disponible.'); return null; }
        
        try {
            const res = await fetch(url);
            const data = await res.json();

            let cityName = realCityName && String(realCityName).trim();
            if (!cityName) {
                if (mdjIsNearHialeahFL(lat, lon)) {
                    cityName = "Hialeah";
                } else {
                    cityName = data.name || "Miami";
                }
            }
            
            // --> INYECCIÓN DIRECTA AL ID DEMANDADO <--
            const locNode = document.getElementById('weather-location');
            if (locNode) {
                const label = `${cityName}, FL`.toUpperCase();
                locNode.innerHTML = `<i class="la la-map-marker" style="margin-right: 5px;"></i> ${label}`;
            }

            // Procesado del Clima usando el motor original de "Apple Dark" Si existe
            if (typeof window.handleEventWeather === 'function') {
                // Almacenamos el GPS central global
                window.userBaseLocation = window.userBaseLocation || {};
                window.userBaseLocation.lat = lat;
                window.userBaseLocation.lon = lon;
                window.userBaseLocation.isGPS = true;
                window.userBaseLocation.city = cityName;
                window.locationInitialized = true;
                
                // Le pasamos el control a event-weather.js para que dibuje el sol, nubes o relámpagos.
                window.__mdjWeatherLocked = false;
                window.handleEventWeather(new Date().toISOString().split('T')[0]);
            }
            
        } catch (error) {
            console.error("❌ Fallo en Suscripción Meteorológica:", error);
        }
    },

    updateLocationName: async function(lat, lon) {
        try {
            // Geocodificación Inversa hiper-precisa (Satélite a Nivel Calle/Barrio)
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
            const data = await res.json();
            
            // Si el satélite detecta "Hialeah", esto lo extrae crudo.
            let city = data.address.city || data.address.town || data.address.village || data.address.county || "MIAMI";
            return city;
        } catch (e) {
            console.error("Error Nominatim (Fallback to OpenWeather City):", e);
            return null;
        }
    },

    startGeolocationEngine: function() {
        // PERMANENT MEMORY: Check localStorage first to NEVER ask again
        const savedLat = localStorage.getItem('mdj_weather_lat');
        const savedLon = localStorage.getItem('mdj_weather_lon');

        if (savedLat && savedLon) {
            console.log("🛰️ GPS Permanente Restaurado desde LocalStorage");
            this.updateLocationName(savedLat, savedLon).then(realCity => {
                this.fetchProfessionalWeather(savedLat, savedLon, realCity);
            }).catch(() => {
                this.fetchProfessionalWeather(savedLat, savedLon, null);
            });
            return; // Exit immediately
        }

        if (!navigator.geolocation) {
            console.error("Geolocalización bloqueada por el navegador.");
            
            const locNode = document.getElementById('weather-location');
            if (locNode) {
                locNode.innerHTML = `<i class="la la-map-marker" style="margin-right: 5px;"></i> ERROR GPS`;
            }
            return;
        }

        // Temporizador paralelo de 2.0s para evitar bloqueo visual si el usuario ignora el prompt
        const timeoutFallback = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout: Usuario ignoró o retrasó el popup de ubicación")), 12000)
        );

        const geoPromise = new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        // Carrera: Gana la lectura satelital, o gana el Fallback de Seguridad a Miami
        Promise.race([geoPromise, timeoutFallback])
            .then(async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // SAVE EXPLICITLY TO LOCALSTORAGE FOREVER
                localStorage.setItem('mdj_weather_lat', lat);
                localStorage.setItem('mdj_weather_lon', lon);
                
                let realCity = null;
                try {
                    realCity = await this.updateLocationName(lat, lon);
                } catch (e) {
                    console.warn("Retraso en Satélite Local, usando fallback geográfico.");
                }
                
                await this.fetchProfessionalWeather(lat, lon, realCity);
            })
            .catch(async (err) => {
                console.warn("📍 Fallback Silencioso Activo a Miami:", err.message);
                // 25.7617, -80.1918 — Miami centro
                const lat = 25.7617;
                const lon = -80.1918;
                // Disparo forzado e instantáneo a Miami para no bloquear el UI
                await this.fetchProfessionalWeather(lat, lon, "MIAMI");
            });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    WeatherGeoEngine.init();
});
