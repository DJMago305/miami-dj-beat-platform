# Reporte de análisis — Reemplazo de la agenda vieja por el Calendario Operacional Inteligente
**Fecha:** 2026-08-14 · **Regla aplicada:** no-removal-without-report (feedback permanente del PO)

## 1. Qué es la agenda VIEJA (lo que se reemplazaría)

| Pieza | Dónde | Qué hace |
|---|---|---|
| `web/js/agenda-engine.js` (1394 líneas) | `dj-dashboard.html`, `account-settings.html` | "Motor Avanzado JSONB / Inteligencia de día": calcula disponibilidad, tipos de día, feriados y badges **desde el perfil** (weekly_schedule, availability_schedule, vacaciones). **Solo lectura**, sin agenda real de eventos. |
| FullCalendar (`#calendar-master`) | pestaña "Agenda" de `dj-dashboard.html` (`#tab-dashboard`) | Calendario visual (CSS/JS de FullCalendar) al lado del Clima (Clima ~40% / Calendario ~60%). |
| Panel disponibilidad (`#panel-agenda`) | `account-settings.html` | Toggle simple Disponible/Ocupado (config), NO es el calendario. |

## 2. Qué es la agenda NUEVA (reemplazo)

`web/calendario-operacional-inteligente.html` — Calendario Operacional Inteligente, ya cableado a **datos reales**: residencias (`residency_schedule`, 313), bookings (`leads`), fechas de clientes (`client_profiles`). Vistas Día/Semana/Mes/Año, switch **Artista ↔ Owner·Matrix**, consentimiento, continuidad, notarización. Cableado a ELIXIS (pendiente el enlace directo).

## 3. Diferencias clave
- La vieja es **disponibilidad calculada del perfil**; la nueva es una **agenda operacional real** (eventos, residencias, clientes, finanzas, intelligence layers).
- La vieja no tiene la separación Artista-aislado / Owner-Matrix; la nueva sí (con consentimiento, RLS).

## 4. Riesgos
- **`dj-dashboard.html` es ENORME y frágil** (historial de regresiones de nav — ver [[project_nav_agentic_regressions]]). Editar su interior = alto riesgo.
- La pestaña Agenda está **entrelazada con el Clima** (hero WebGL, re-arquitectura del clima diferida — [[project_weather_platform_rearchitecture]]). No expandir esa re-arq desde aquí.
- Regla: nav independiente por portal (no compartir) — [[feedback_no_shared_nav_across_portals]].

## 5. Recomendación de integración (menor riesgo)
**Embeber por `<iframe>`**, NO fusionar código en dj-dashboard:
- El Calendario Inteligente carga en un iframe dentro de la sección Agenda, **aislado** del código frágil de dj-dashboard. Recibe el rol por query (`?role=owner` en staff / `?role=artista` en perfil de artista).
- El bloque viejo (FullCalendar `#calendar-master`) se **oculta** (no se borra el archivo aún) hasta validar visualmente; `agenda-engine.js` se conserva mientras algo lo use.
- La plantilla de artista (perfil) monta el mismo iframe con `?role=artista` (aislado por RLS).

## 6. Pendiente de confirmar con el PO (Capitán)
1. **Ubicación exacta "pestaña Agenda de Staff":** ¿la pestaña Agenda de `dj-dashboard.html`? ¿un panel en `account-settings.html`/`admin-dashboard.html`? ¿o una página staff dedicada?
2. ¿El Clima se queda arriba y el calendario nuevo va **debajo** (como decía el plan), o el calendario nuevo reemplaza toda la columna de calendario?
3. ¿Aprueba el enfoque **iframe** (aislado, menor riesgo)?

## 7. Plan de ejecución (tras aprobación)
1. Embeber iframe del calendario en la ubicación confirmada (staff → `?role=owner`).
2. Ocultar el FullCalendar viejo (no borrar aún) + verificar visual.
3. Repetir en la plantilla de artista (`?role=artista`).
4. Reporte visual before/after + luego retirar el código muerto (segundo reporte de removal).
