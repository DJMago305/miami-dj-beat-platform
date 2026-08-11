# WEATHER ENGINE V1 → V2 — Mapping Matrix (DTO Read Model)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/WEATHER-V1-V2-MAPPING-MATRIX.md` |
| **Fase** | Dominio Weather Engine V2 — **ciclo lectura cerrado** (Pasos 1–6) |
| **Estado ciclo** | ✅ **CERRADO EN LABORATORIO** — ver [WEATHER-CYCLE-CLOSURE.md](./WEATHER-CYCLE-CLOSURE.md) |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Types lab** | `MiamiDJBeat-MigracionV2/shared/types/weather.types.ts` |
| **Servicio lab** | `MiamiDJBeat-MigracionV2/shared/services/weather/` |
| **Suite ciclo Weather** | **46/46 PASS** · `tsc --noEmit` OK · portales **200** |
| **Tipo** | Matriz discovery + contrato de lectura — **sin writers** · **sin SQL** · **sin commit** · **sin deploy** |
| **Prerrequisitos** | [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) · [BOOKINGS-CYCLE-CLOSURE.md](./BOOKINGS-CYCLE-CLOSURE.md) · [FINANCIAL-CYCLE-CLOSURE.md](./FINANCIAL-CYCLE-CLOSURE.md) |
| **Jerarquía** | Constitución + Protocolo PO · Candidate C (canónico V1, worktree offline-payment) · Design Bible V1 (experiencia) |
| **Aislamiento** | **No** modificar V1 `web/` · `supabase/` · Perfiles/Agenda/Finanzas sellados · **no** reescribir Candidate C |

---

## 0. Lectura canónica aplicada

| Documento / evidencia | Uso |
|----------------------|-----|
| **Candidate C** (FROZEN) — worktree `MiamiDJBeat-V1-offline-payment` · `docs/architecture/weather-intelligence/MIAMI-DJ-BEAT-WEATHER-INTELLIGENCE-ENGINE-CANDIDATE-C.md` | Arquitectura canónica Weather V1 (event-first, provider proxy, Risk/Signals) |
| **Design Bible V1** (FROZEN) — mismo worktree | Experiencia visual REALITY FIRST (no runtime en este paso) |
| `docs/MASTER-DOCUMENTATION-INDEX.md` §3.13 | Artefactos Weather en checkout `miami-dj-beat-platform` = **NO canónicos** |
| Legacy productivo (solo inventario) | `web/js/event-weather.js` · `weather-engine.js` · `weather-logistics.js` · `dj-logistics-engine.js` · `weather-api.js` · `weather-astral.js` |
| Agenda / Venue | Bookings V2 DTOs (`leadId` / venue label) — puente; **sin** mutar Agenda |
| MASTER-WIRING-AUDIT | Agenda consume `event-weather.js` |

**Root de implementación futura:** `MiamiDJBeat-MigracionV2/` — **no** tocar `web/` V1 ni Candidate C freeze.

---

## 1. Principios de mapeo

1. **Event-first (Candidate C §9):** el núcleo MDJB es `Occurrence + Venue + Location + Timezone + Event Window + Weather` — no un widget genérico.
2. **Read model lab ≠ Visual Engine.** Este ciclo define DTOs de lectura para portales; canvas/sky/REALITY FIRST queda en Design Bible / futuro Visual Prototype.
3. **Provider-independent:** DTOs no exponen OpenWeather raw; normalizan a señales MDJB. Secrets **nunca** en cliente (Candidate C §6).
4. **Cobro/Agenda ortogonales:** Weather **no** cancela ni reprograma eventos; **no** escribe leads/dj_ledger.
5. **Venue geo gap (C §9):** V1 a menudo cae a Miami/geocode; `VenueOutdoorRiskDTO` puede usar `locationLabel` + coords opcionales / `Unknown` freshness.
6. **Risk canónico V2 (producto Paso 1):** `Low` · `Moderate` · `Severe` · `Critical` — proyectado desde señales + legacy advice (`success`/`warning`/`danger`).
7. **Consejos operativos** (from `getDJLogisticsAdvice` merit KEEP/REFACTOR en C): carpas, cubiertas, reubicación booth, electrónicos, etc. — solo **recomendación read-only**.

---

## 2. Inventario de fuentes V1

### 2.1 Runtime legacy (productivo / lab)

| Artefacto | Rol | Notas discovery |
|-----------|-----|-----------------|
| `event-weather.js` | Orquestador OWM current+forecast, capas visuales, alertas extremas (lluvia+viento) | Key en cliente = deuda (C §6) |
| `weather-engine.js` | Geo Nominatim + OWM current → dispara `handleEventWeather` | Provider-coupled |
| `weather-api.js` | Fetch capa API | Legacy |
| `weather-astral.js` | Fase lunar / astral | Fallback sinódico KEEP parcial (C §7) |
| `dj-logistics-engine.js` | `getDJLogisticsAdvice()` rule-based | **REFACTOR → Risk/Signals** (C) |
| `weather-logistics.js` | Listener `mdj:weather-updated` → UI consejo | Glue REPLACE |
| `weather-lab.html` | Prototipo FullCalendar + weather | No prod; C: REMOVE del core |
| `weather-experience/*` | Prototype visual (offline-payment) | Experiencia; fuera Paso 1 DTO |

### 2.2 Arquitectura canónica (documental — no tablas)

Candidate C modelo conceptual (§10):

`WeatherLocation` · `WeatherCurrent` · `WeatherHourlyPoint` · `WeatherDailyPoint` · `WeatherCondition` · `WeatherAstronomy` · `WeatherAlert` · `WeatherPrecipitationWindow` · `WeatherEventWindow` · `WeatherRisk` · `WeatherProviderMetadata` (freshness `LIVE|CACHED|STALE|OFFLINE`).

**No existe** tabla `weather_*` / `event_weather_alerts` en migraciones V1 inventariadas para este paso — proyecciones son **virtuales** (provider + event context).

### 2.3 Señales legacy útiles para riesgo

| Señal | Origen típico | Uso DTO |
|-------|---------------|---------|
| `weather[0].main` / id | OWM | condición / precip |
| `wind.speed` (mph) | OWM | umbral Severe/Critical (~30 mph legacy extremo) |
| `main.temp` / humidity | OWM | calor / humedad operativa |
| Advice `type` | `dj-logistics-engine` | `success→Low` · `warning→Moderate/Severe` · `danger→Critical` |
| Event date + city | Agenda / geocode | ventana evento |

---

## 3. DTOs V2 de lectura (Paso 1)

### 3.1 `WeatherForecastReadDTO` — forecast normalizado

Proyección de current + bloques horarios/diarios para un lugar/ventana (sin secreto provider).

| Campo DTO | Fuente / proyección | Notas |
|-----------|---------------------|-------|
| `forecastId` | Sintético `wx:{lat}:{lon}:{asOf}` o `wx:event:{leadId}` | Virtual |
| `locationLabel` | Ciudad / venue | |
| `latitude` / `longitude` | Venue geo o geocode (nullable) | Privacy: redondeo futuro |
| `timezone` | Derivada venue geo (gap V1) | Nullable |
| `asOf` | `retrievedAt` | |
| `freshness` | `LIVE\|CACHED\|STALE\|OFFLINE\|UNKNOWN` | C metadata |
| `conditionCode` | Normalizado MDJB | No raw OWM-only |
| `conditionLabel` | Display | |
| `tempF` / `feelsLikeF` | Current | Imperial MDJB FL |
| `humidityPct` / `windMph` / `precipProbability` | Current / hour | |
| `hourlyPreview` | Hasta N puntos resumidos | Read list |
| `providerAttribution` | Texto atribución | Sin key |
| `visibility` | `WeatherVisibilityAudience` | |

### 3.2 `EventWeatherAlertDTO` — alerta ligada a evento

| Campo DTO | Fuente / proyección | Notas |
|-----------|---------------------|-------|
| `alertId` | Sintético `alert:{leadId}:{kind}:{asOf}` | |
| `leadId` / `bookingId` | Agenda bridge | |
| `eventDate` / `eventTitle` | Lead / booking | |
| `venueLabel` | `location` lead | |
| `riskLevel` | `WeatherRiskLevel` | |
| `headline` | Mensaje corto | |
| `detail` | Explicación | |
| `recommendations` | `WeatherOperationalAdvice[]` | Carpa, booth, etc. |
| `windowPhase` | `PRE\|SHOW\|POST\|UNKNOWN` | C Event Window |
| `issuedAt` | | |
| `sourceKind` | `provider_alert` · `derived_risk` · `lab_mock` | |
| `visibility` | audience | |

### 3.3 `VenueOutdoorRiskDTO` — riesgo outdoor del venue/gig

| Campo DTO | Fuente / proyección | Notas |
|-----------|---------------------|-------|
| `riskId` | Sintético `risk:{venueKey}:{date}` | |
| `venueLabel` | | |
| `leadId` | Nullable | |
| `eventDate` | | |
| `isOutdoorLikely` | Heurística / flag futuro | Gap: venue no tipifica indoor/outdoor en V1 |
| `riskLevel` | Agregado | |
| `drivers` | `WeatherRiskDriver[]` | rain, wind, heat, storm… |
| `advice` | `WeatherOperationalAdvice[]` | |
| `forecastSummary` | One-liner | |
| `visibility` | audience | |

---

## 4. Niveles de riesgo y recomendaciones

### 4.1 `WeatherRiskLevel` (canónico V2)

| Nivel | Significado operativo |
|-------|----------------------|
| **Low** | Condiciones favorables / consejo afirmativo |
| **Moderate** | Precaución; preparar coberturas ligeras |
| **Severe** | Riesgo material para equipo/show; contingencia requerida |
| **Critical** | Protocolo extremo (tormenta/viento fuerte); priorizar seguridad |

### 4.2 Mapa legacy advice → riesgo

| Legacy `advice.type` | → V2 |
|----------------------|------|
| `success` | `Low` |
| `warning` | `Moderate` (o `Severe` si wind/rain umbral alto) |
| `danger` | `Critical` |
| Señal viento > ~30 mph + rain heavy (event-weather extremo) | `Critical` / `Severe` |

### 4.3 `WeatherOperationalAdviceCode` (catálogo inicial)

| Code | Recomendación (display EN) |
|------|----------------------------|
| `bring_tent_cover` | Bring tent / weather cover for outdoor setup |
| `protect_electronics` | Protect electronics from rain and moisture |
| `relocate_dj_booth` | Relocate DJ booth to covered / indoor area |
| `secure_light_structures` | Secure light structures and stands against wind |
| `extra_load_in_time` | Allow extra load-in time for weather delays |
| `monitor_lightning` | Monitor lightning; pause outdoor set if active |
| `hydrate_heat` | Heat/humidity: hydrate crew; shade rest area |
| `all_clear` | Conditions favorable for outdoor performance |

---

## 5. Visibilidad por rol

| Audience | Ve | No ve |
|----------|----|-------|
| **Client** (`client_event`) | Alertas / riesgo del **evento contratado** propio; forecast resumido del venue del booking | Consola multi-evento; coords precisas de otros venues; raw provider dumps |
| **Artist** (`artist_gig`) | Condiciones / riesgo del **gig asignado** (venue del show); consejos operativos booth/equipo | Cancelación automática; datos financieros; alertas de gigs ajenos |
| **Staff seller** | Vista agregada limitada de riesgos próximos | Writers; secretos provider; PII cliente no necesaria para clima |
| **Staff full** (`staff_master`) | Consola maestro de riesgos meteorológicos (multi-event) | Keys provider; device GPS de usuarios |
| **Público** | Nada operativo (o marketing genérico futuro — fuera scope) | — |

Alineación: Perfiles V2 + Bookings `leadId` / assigned artist — **Postgres manda** en prod para ownership de evento; lab usa mocks.

---

## 6. Módulos / superficies consumidoras (lab — ciclo cerrado)

| Superficie | DTO primario | Slot / MOD |
|------------|--------------|------------|
| Staff Weather Risk Console | All three DTOs | `master-weather` · MOD-301-WX · `staff/weather/` |
| Artist Gig Weather Radar | `VenueOutdoorRiskDTO` + forecast | `artist-weather` · MOD-204-WX · `artist/weather/` |
| Client Event Weather Banner | `EventWeatherAlertDTO` + forecast/risk | `client-weather` · MOD-103-WX · `client/weather/` |
| Visual sky (post-ciclo) | Design Bible — **not** these DTOs alone | REALITY FIRST — ticket futuro |

Cierre de auditoría: [WEATHER-CYCLE-CLOSURE.md](./WEATHER-CYCLE-CLOSURE.md).

---

## 7. Gaps bloqueantes / abiertos

| # | Gap | Impacto | Resolución futura (ticket) |
|---|-----|---------|------------------------------|
| G1 | Venue sin lat/lon/timezone canónico | Forecast cae a Miami/geocode | Geo venue + gobernanza Accounting/EKG (C §9) |
| G2 | Indoor/outdoor no tipificado | `isOutdoorLikely` heurístico | Campo venue o meta evento |
| G3 | API key en cliente V1 | Seguridad | Proxy Edge only (C §6) — **no** en lab Paso 1 |
| G4 | Sin tabla alerts persistida | IDs sintéticos; sin historial durable | Persistencia opcional post read-map |
| G5 | Provider no congelado | Mappers deben ser provider-agnostic | Open-Meteo+NWS dirección preliminar |
| G6 | Visual Engine ≠ DTO | UI sky no en Paso 1 | Prototype + Design Bible |
| G7 | Cancel/reschedule writers | Fuera alcance | Nunca en este ciclo read-only |
| G8 | Checkout Weather NO canónico en platform | No promover A/B | Seguir Candidate C worktree |

---

## 8. Fuera de alcance (Paso 1)

- Writers (cancel event, reschedule, persist alerts, auto-notify)
- SQL / RLS / Edge Weather Proxy deploy
- Mutar `web/` V1 weather JS/HTML/CSS
- Alterar Candidate C / Design Bible freeze
- Reabrir Perfiles / Agenda / Finanzas
- Commit / push / deploy

---

## 9. Pasos 2–5 (implementados en lab — 2026-08-11) — ciclo lectura cerrado

| Paso | Entregable | Estado |
|------|------------|--------|
| 2 | `shared/services/weather/` read-only + Vitest | ✅ 15 tests |
| 3 | Staff Risk Console `staff/weather/` | ✅ MOD-301-WX · 11 tests |
| 4 | Artist Gig Radar `artist/weather/` | ✅ MOD-204-WX · 10 tests |
| 5 | Client Event Banner `client/weather/` | ✅ MOD-103-WX · 10 tests |
| 6 | [WEATHER-CYCLE-CLOSURE.md](./WEATHER-CYCLE-CLOSURE.md) | ✅ |

**Métodos servicio:** `fetchClientEventWeather` · `fetchArtistGigWeather` · `fetchMasterWeatherConsole`  
**Suite ciclo:** **46/46 PASS** · **sin writers** · **sin proxy productivo**.

**Post-ciclo (requiere OK PO):** Edge proxy, geo venue, Visual Engine, writers — ver cierre §7.

---

## 10. Referencias

| Recurso | Ruta |
|---------|------|
| Types | `MiamiDJBeat-MigracionV2/shared/types/weather.types.ts` |
| Candidate C (canónico) | Worktree offline-payment · `…/MIAMI-DJ-BEAT-WEATHER-INTELLIGENCE-ENGINE-CANDIDATE-C.md` |
| Design Bible | Worktree offline-payment · `…/MIAMI-DJ-BEAT-WEATHER-DESIGN-BIBLE-V1.md` |
| Índice gobernanza | `docs/MASTER-DOCUMENTATION-INDEX.md` §3.13 |
| Agenda cierre | `docs/V2/BOOKINGS-CYCLE-CLOSURE.md` |
| Finanzas cierre | `docs/V2/FINANCIAL-CYCLE-CLOSURE.md` |
| Weather cierre | `docs/V2/WEATHER-CYCLE-CLOSURE.md` |

---

*Weather Engine V2 — matriz V1→V2 — ciclo lectura cerrado (Pasos 1–6) — 2026-08-11 — documentation only — no commit*
