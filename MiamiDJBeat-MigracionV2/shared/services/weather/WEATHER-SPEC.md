# Weather Engine Domain Service — SPEC (Paso 2)

| Campo | Valor |
|-------|--------|
| **Módulo** | `shared/services/weather` |
| **Matriz** | `docs/V2/WEATHER-V1-V2-MAPPING-MATRIX.md` |
| **Types** | `shared/types/weather.types.ts` |
| **Estado** | Read-only mappers + service + mocks — **sin writers** · **sin SQL** · **sin provider keys** · **sin commit** |
| **Lab** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Prerrequisitos** | Weather Paso 1 sellado · Perfiles + Agenda + Finanzas sellados |

## Métodos públicos

| Método | Rol |
|--------|-----|
| `fetchClientEventWeather({ clientUserId })` | Cliente — alertas / forecast / riesgo del **evento contratado** propio |
| `fetchArtistGigWeather({ artistUserId, artistProfileId? })` | Artista — riesgo outdoor + condiciones del **gig asignado** |
| `fetchMasterWeatherConsole({ audience })` | Staff — consola maestro multi-evento + `riskCounts` |

**Prohibido:** cancel event · reschedule · persist alerts · call production weather API with secrets · insert/update/delete.

## Mappers

| Función | Salida |
|---------|--------|
| `mapObservationRowToForecast` | `WeatherForecastReadDTO` |
| `mapEventWeatherRowToAlert` | `EventWeatherAlertDTO` |
| `mapVenueWeatherRowToOutdoorRisk` | `VenueOutdoorRiskDTO` |
| `resolveOutdoorRiskLevel` | `Low` · `Moderate` · `Severe` · `Critical` (+ wind/rain elevate) |
| `buildOperationalAdvice` | Carpa, booth, lightning, etc. |

## Data port (inyectable)

`selectEventWeatherForClient` · `selectEventWeatherForArtist` · `selectEventWeatherForStaff` — filas virtuales / fixtures; **sin** red productiva en tests.

## Tests

`tests/unit/weather.service.spec.ts` — riesgo, aislamiento por rol, recomendaciones, superficie read-only.

## Siguiente paso (requiere OK PO)

Paso 3+ — vistas portal / wiring UI (sin writers).
