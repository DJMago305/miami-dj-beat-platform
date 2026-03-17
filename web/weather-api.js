/**
 * MDJPRO - Weather API Integration Engine
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
        apiKey: 'REPLACE_WITH_YOUR_OPENWEATHERMAP_API_KEY', // MDJPRO: Insert your API key here
        lat: '25.7617', // Miami Latitude
        lon: '-80.1918', // Miami Longitude
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
        return isDay ? 'clear-day' : 'clear-night';
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
            // Using the current API structure; adjust if using Apple WeatherKit or another source.
            // Using OWM API v2.5
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${CONFIG.lat}&lon=${CONFIG.lon}&units=${CONFIG.units}&lang=${CONFIG.lang}&appid=${CONFIG.apiKey}`;
            
            // In a real isolated lab without an API key, we simulate the payload for active testing.
            // If the API key is not replaced, it throws 401, so we catch and use mock data.
            const response = await fetch(url);
            
            if (!response.ok) {
                console.warn("⚠️ API fetch failed (Likely missing API Key). using Mock API Data to test scene bindings.");
                simulateApiPayload();
                return;
            }

            const data = await response.json();
            bindDataToUI(data);

        } catch (error) {
            console.error("Weather Engine Error:", error);
            console.warn("Falling back to local simulation for lab testing.");
            simulateApiPayload();
        }
    }

    function bindDataToUI(data) {
        console.log("🌦 Weather Data Received:", data);

        // 1. Data Mapping to DOM elements
        if (elements.location) elements.location.innerText = `${data.name}, ${data.sys.country}`;
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
        const targetScene = mapApiToScene(conditionCode, isDay);

        // 3. Execution (Triggers the locked visual engine via the standard hook)
        if (window.forceQAScene) {
            window.forceQAScene(targetScene);
            console.log(`🎯 Real Weather Triggered Scene: ${targetScene} (${isDay ? 'Day' : 'Night'})`);
        } else {
            console.error("Critical: QA Hook missing. Visual engine failed to trigger.");
        }
    }

    // --- Developer Testing Tool (Lab Only) ---
    function simulateApiPayload() {
        // Allows testing the data binding immediately without an API key
        const mockData = {
            weather: [{ id: 802, main: "Clouds", description: "nubes dispersas" }], // 802 = Partly Cloudy
            main: { temp: 82.5, temp_min: 75.0, temp_max: 88.0 },
            wind: { speed: 12.4 },
            sys: { country: "USA", sunrise: (Date.now()/1000) - 3600, sunset: (Date.now()/1000) + 36000 }, // Forces Day mode
            name: "Miami Test Lab"
        };
        bindDataToUI(mockData);
    }

    // Initialize
    fetchWeatherData();
    
    // Refresh weather every 15 minutes (900,000 ms) to keep data fresh without exceeding API rate limits
    setInterval(fetchWeatherData, 900000); 
});
