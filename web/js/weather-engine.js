// 🛰️ WEATHER GEO-ENGINE: Satélite Nominatim + API OpenWeatherMap
// Conecta el Dashboard directamente a las coordenadas del operador y devuelve Clima Profesional VIP.

const WeatherGeoEngine = {
    init: function() {
        console.log("🛰️ Iniciando Sonda de Geolocalización...");
        this.startGeolocationEngine();
        
        // Refresco de posición y clima cada 15 minutos exactos (900,000ms)
        setInterval(() => this.startGeolocationEngine(), 900000);
    },

    fetchProfessionalWeather: async function(lat, lon, realCityName) {
        // La API KEY Profesional rescatada de la arquitectura original
        const API_KEY = window.OPENWEATHER_API_KEY || 'dd8223bfcc6f68da9fc28ca245fe0201';
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=imperial&lang=es`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            // Si el satélite entregó el barrio ("Hialeah"), lo forzamos. 
            // Si Nominatim falla, OpenWeather devolverá "Hialeah" de todas formas por las coordenadas lat/lon.
            const cityName = realCityName || data.name;
            
            // --> INYECCIÓN DIRECTA AL ID DEMANDADO <--
            const locNode = document.getElementById('weather-location');
            if (locNode) {
                locNode.innerHTML = `<i class="la la-map-marker" style="margin-right: 5px;"></i> ${cityName.toUpperCase()}, FL — USA`;
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
            setTimeout(() => reject(new Error("Timeout: Usuario ignoró o retrasó el popup de ubicación")), 2000)
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
                // Miami VIP Coordinates (Central)
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
