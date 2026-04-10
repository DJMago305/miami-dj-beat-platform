export function getDJLogisticsAdvice(weatherData) {
  const advice = [];

  const weatherMain = weatherData.weather[0].main;
  const windSpeed = weatherData.wind.speed;
  const temp = weatherData.main.temp;
  const humidity = weatherData.main.humidity;

  // 🌧 LLUVIA
  if (["Rain", "Drizzle", "Thunderstorm"].includes(weatherMain)) {
    advice.push({
      type: "danger",
      message: "CRÍTICO: Lluvia inminente\n→ Activar protección (carpa + energía)"
    });
  }

  // 💨 VIENTO
  if (windSpeed > 15) {
    advice.push({
      type: "warning",
      message: "ALERTA: Viento fuerte\n→ Asegurar estructuras y luces"
    });
  }

  // 🔥 CALOR
  if (temp > 90) {
    advice.push({
      type: "warning",
      message: "ALERTA TÉRMICA: Alta temperatura\n→ Hidratación + ventilación de equipos"
    });
  }

  // 💧 HUMEDAD
  if (humidity > 80) {
    advice.push({
      type: "warning",
      message: "RIESGO: Alta humedad\n→ Protección anti-condensación"
    });
  }

  // ✅ CONDICIÓN IDEAL
  if (advice.length === 0) {
    advice.push({
      type: "success",
      message: "OK: Condiciones óptimas\n→ Evento seguro para exterior"
    });
  }

  return advice;
}
