# AI Booth — tracking contract (Crystal / Ads / “Sombra”)

Canonical language for product strings: **English** (`en`). Spanish may appear in UI when locale is ES.

**Related:** Historical notes in [`booth-tracking-contract.md`](./booth-tracking-contract.md) (same semantics; this file is the captain’s checklist for ad links).

## Goal

External capture systems send users to **`web/booth.html`** with **query parameters**. The Booth parses them (see `URLSearchParams` logic in `booth.html`), exposes **`window.MDJBoothCapture`** / **`window.MDJBoothRadar`**, and persists **sanitized** attribution into `public.leads` on form submit (`notes.booth_attribution`).

## Required & optional parameters

| Parameter | Example | Purpose |
|-----------|---------|---------|
| `intent` | `dj_booking`, `booking`, `wedding` | High-level funnel intent; may map to event type. |
| `source` | `crystal`, `meta`, `google` | Capture system id. |
| `campaign` | `miami-wedding-q2` | Short campaign name (distinct from `utm_campaign` if you use both). |
| `customer_interest` | `wedding`, `corporate gala`, `latin night` | **What to talk about first** — shown in the personalized greeting. |
| `ref` | `ig-reel-042` | Short token → `referred_by` when length allows. |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` | Standard UTMs | Reporting / attribution blob in `notes`. |

## Example links

```text
https://miamidjbeat.com/booth.html?intent=dj_booking&customer_interest=wedding&source=crystal&campaign=miami_brides_2026

https://miamidjbeat.com/booth.html?intent=booking&source=crystal&ref=ad-991&utm_source=facebook&utm_medium=paid&utm_campaign=dj-miami
```

## Client globals (Booth page)

- `window.MDJBoothCapture` — full API (`getAgentContext`, `getAgentSystemHint`, `raw`).
- `window.MDJBoothRadar` — **alias** to the same object (“radar” name for integrations).

## Server / AI

- Edge chat function must inject **`getAgentSystemHint()`** (or equivalent) into the system prompt; never echo raw URL in full to the user if it contains tokens.
- **Sanitization** happens in the browser before insert; the server should still validate on tools.

## Learning telemetry (v2 foundation)

- Booth now tracks session telemetry via RPC:
  - `public.booth_track_event(p_session_key, p_event_type, p_payload)`
  - `public.booth_set_outcome(p_session_key, p_outcome, p_reason, p_lead_id)` (authenticated only)
- Backing tables:
  - `public.ai_booth_sessions`
  - `public.ai_booth_events`
  - `public.ai_booth_session_training` (view: session + events for internal training rows)
  - `public.ai_booth_learning_examples` (table: **anonymous** win/loss lessons; filled by trigger on `leads.lead_outcome`)
- Current event baseline from `web/booth.html`:
  - `booth_open`
  - `lead_submit_attempt`
  - `lead_submit_success`
  - `lead_submit_error` / `lead_submit_exception`

## Widget Booth (`mdj-assistant.js`) — carrito + fechas conmemorativas (borrador local)

Además de la página dedicada `booth.html`, el widget **Booth** en el sitio puede dejar datos en `sessionStorage` para ventas asistidas y remarketing **cuando exista integración** con CRM / proveedor SMS-email-WhatsApp.

| Key | Contenido | Uso |
|-----|-----------|-----|
| `mdj_booth_cart_recommendations` | Array JSON (picks de talento, rol, fecha, tier) | Lista previa “tipo carrito” hasta checkout real. |
| `mdj_booth_life_events` | Array JSON: `kind` (`birthday` \| `anniversary` \| `other`), `honoree_name`, `client_first_name`, `milestone_date`, `preferred_channel`, `notes_raw`, `ts` | **Borrador** para recordatorio anual (cumple / aniversario); el envío automático exige **opt-in**, enlace a **lead/cuenta** y cumplimiento (p. ej. TCPA / política de privacidad). |

**Plantilla de mensaje (ES)** — tono comercial; personalizar `X` / nombres:

- *«Hola **[Cliente]** — soy Miami DJ Beat. El año pasado te ayudamos con tu fiesta **(X)**… se acerca otra vez esa fecha; ¿te gustaría revivir ese momento icónico con nosotros?»*
- Variante con homenajeado: *«Hola, por parte de **[Homenajeado]**, Miami DJ Beat…»*

**English (canonical product string):**

- *“Hi **[Client]** — Miami DJ Beat here. Last year we helped with your **[event]**… that date is coming up again. Want to plan another iconic night with us?”*

## Version

- **v1** — 2026-04-13 — Adds `campaign` and `customer_interest`; aligns with `web/booth.html`.
- **v1.1** — 2026-04-14 — Documents `mdj_booth_cart_recommendations` + `mdj_booth_life_events` and annual outreach templates.
