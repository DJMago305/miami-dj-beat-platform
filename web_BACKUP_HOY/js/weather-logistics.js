import { getDJLogisticsAdvice } from './dj-logistics-engine.js';

/**
 * MDJPRO - DJ Logistics Event Listener (Phase 4)
 * Completely isolated from the Data Fetcher. Listens passively for weather updates,
 * calculates actionable DJ recommendations, and renders them in the UI.
 */
document.addEventListener('DOMContentLoaded', () => {
    
    // Listen for the decoupled broadcast from the API layer
    document.addEventListener('mdj:weather-updated', (e) => {
        // e.detail contains the RAW OpenWeather payload. Feed it directly to the engine.
        const adviceList = getDJLogisticsAdvice(e.detail);
        renderAdvice(adviceList);
    });

});

function renderAdvice(adviceList) {
    const container = document.getElementById("dj-advice");
    if (!container) return;
    
    container.innerHTML = "";
    
    // Define modern RGB colors mapping to the CEO's 'danger', 'warning', 'success' types
    const styles = {
        'danger': 'background: rgba(255, 85, 85, 0.1); border: 1px solid rgba(255, 85, 85, 0.3); color: #ff5555;',
        'warning': 'background: rgba(255, 187, 0, 0.1); border: 1px solid rgba(255, 187, 0, 0.3); color: #ffbb00;',
        'success': 'background: rgba(0, 255, 136, 0.1); border: 1px solid rgba(0, 255, 136, 0.3); color: #00ff88;'
    };

    adviceList.forEach(a => {
        const div = document.createElement("div");
        div.className = `alert ${a.type}`;
        div.style.cssText = `padding: 12px 18px; border-radius: 12px; margin-bottom: 8px; ${styles[a.type]}`;
        div.innerText = a.message;
        container.appendChild(div);
    });
}
