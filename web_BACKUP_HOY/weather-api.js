/**
 * Miami DJ Beat System - Weather API Integration Engine
 * Binds real weather data to the existing locked visual engine without altering HTML/CSS architecture.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Data Binding Targets (Existing HTML exactly as-is)
    const elements = {
        location: document.getElementById('weather-location'),
        temp: document.getElementById('weather-main-temp'),
        condition: document.getElementById('weather-condition-label'),
        highLow: document.getElementById('weather-high-low'),
        forecast: document.getElementById('weather-forecast-text'),
        wind: document.getElementById('weather-wind-speed')
    };

    // Fail safe: If we are not on a page with weather, abort.
    if (!elements.location) return;

    // TODO: Replace with real production API key and endpoint.
    // For this lab environment, we define a quick OpenWeatherMap config.
    const CONFIG = {
        apiKey:
            (typeof window !== 'undefined' && window.OPENWEATHER_API_KEY && String(window.OPENWEATHER_API_KEY).trim()) ||
            'dd8223bfcc6f68da9fc28ca245fe0201',
        lat: localStorage.getItem('mdj_weather_lat') || '25.8576', // Dynamic via UI or Hialeah Fallback
        lon: localStorage.getItem('mdj_weather_lon') || '-80.2781', // Dynamic via UI or Hialeah Fallback
        units: 'imperial', // Using Fahrenheit/Miles as per current UI
        lang: 'es' // Spanish descriptions
    };

    /**
     * Scene Mapping Matrix
     * Maps OpenWeatherMap Weather Conditions (ID) to existing locked scene classes.
     * https://openweathermap.org/weather-conditions
     */
    function mapApiToScene(weatherId, isDay) {
        // Group 2xx: Thunderstorm
        if (weatherId >= 200 && weatherId < 300) return isDay ? 'storm-day' : 'storm';

        // Group 3xx: Drizzle / Group 5xx: Rain
        if ((weatherId >= 300 && weatherId < 400) || (weatherId >= 500 && weatherId < 600)) {
            return isDay ? 'rain-day' : 'rain-night';
        }

        // Group 6xx: Snow
        if (weatherId >= 600 && weatherId < 700) return 'snow'; // Currently snow has only one scene

        // Group 7xx: Atmosphere (Fog, Mist, Dust, etc.) - Map to cloudy for now
        if (weatherId >= 700 && weatherId < 800) return isDay ? 'cloudy-day' : 'cloudy-night';

        // Group 800: Clear
        if (weatherId === 800) return isDay ? 'clear-day' : 'clear-night';

        // Group 80x: Clouds
        if (weatherId === 801 || weatherId === 802) { // Few to scattered clouds (Partly Cloudy)
            // Note: The system currently uses 'clear-day' and drops the carousel on top for day partly cloudy, 
            // per weather-lab.html CSS line 1296: `.scene-partly-cloudy` (which acts as sol + nubes).
            // So we use it. For night, we have a specific class.
            return isDay ? 'partly-cloudy' : 'partly-cloudy-night';
        }
        if (weatherId === 803 || weatherId === 804) { // Broken to overcast clouds (Cloudy)
            return isDay ? 'cloudy-day' : 'cloudy-night';
        }

        // Fallback
        return 'clear-day';
    }

    /**
     * Determines Day/Night status using API Unix timestamps against strictly local requested time.
     */
    function determineDayCycle(sunriseUnix, sunsetUnix) {
        // Convert Unix timestamp (seconds) to milliseconds
        const now = Date.now();
        const sunrise = sunriseUnix * 1000;
        const sunset = sunsetUnix * 1000;

        // Is it currently between sunrise and sunset at that specific location?
        return (now >= sunrise && now < sunset);
    }

    /**
     * Main Data Fetch Sequence
     */
    async function fetchWeatherData() {
        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${CONFIG.lat}&lon=${CONFIG.lon}&units=${CONFIG.units}&lang=${CONFIG.lang}&appid=${CONFIG.apiKey}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.error("API FALLIDA:", await response.text());
                return;
            }

            const data = await response.json();
            bindDataToUI(data);
        } catch (error) {
            console.error("API FETCH ERROR CRÍTICO:", error);
        }
    }

    function bindDataToUI(data) {
        // 1. Data Mapping to DOM elements
        if (elements.location) {
            // Premium Branding Rule: Strip redundant ', US' for domestic locations
            if (data.sys.country === "US") {
                elements.location.innerText = data.name;
            } else {
                elements.location.innerText = `${data.name}, ${data.sys.country}`;
            }
        }
        if (elements.temp) elements.temp.innerText = `${Math.round(data.main.temp)}°`;
        if (elements.highLow) elements.highLow.innerText = `Máx: ${Math.round(data.main.temp_max)}° Mín: ${Math.round(data.main.temp_min)}°`;

        // Capitalize first letter of description
        const desc = data.weather[0].description;
        const mainConditionTitle = desc.charAt(0).toUpperCase() + desc.slice(1);
        if (elements.condition) elements.condition.innerText = mainConditionTitle;
        if (elements.forecast) elements.forecast.innerText = `Actualmente se reporta ${desc}. `;
        if (elements.wind) elements.wind.innerText = `${Math.round(data.wind.speed)} mi/h`;

        // 2. Logic processing
        const isDay = determineDayCycle(data.sys.sunrise, data.sys.sunset);
        const conditionCode = data.weather[0].id;

        // Dispatch Decoupled Event for specialized External Listeners (DJ Logistics)
        const weatherBroadcast = new CustomEvent('mdj:weather-updated', {
            detail: data // Emit RAW OpenWeather payload. Zero assumptions.
        });
        document.dispatchEvent(weatherBroadcast);

        const targetScene = mapApiToScene(conditionCode, isDay);

        // 3. Execution (Triggers the locked visual engine via the standard hook)
        if (window.forceQAScene) {
            window.forceQAScene(targetScene);
        } else {
            console.error("Critical: QA Hook missing. Visual engine failed to trigger.");
        }
    }

    // Initialize
    fetchWeatherData();

    // Refresh weather every 15 minutes (900,000 ms) to keep data fresh without exceeding API rate limits
    setInterval(fetchWeatherData, 900000);
});
