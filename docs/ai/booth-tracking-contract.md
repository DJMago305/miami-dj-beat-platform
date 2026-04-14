# AI Booth — tracking contract (external capture → “Sombra” / ads / CRM)

> **Canonical checklist (params + examples):** [`tracking-contract.md`](./tracking-contract.md) — includes `campaign` and `customer_interest`.

Canonical language for product strings: **English** (`en`). Spanish copy may appear in the Booth UI when the active locale is Spanish.

## Purpose

External systems (working name **“Sombra”**, ads, social listening, CRM) send prospects to the Booth with **URL query parameters**. The Booth:

1. Parses and stores them in **`sessionStorage`** and **`window.MDJBoothCapture`** (agent context for the future chat Edge Function).
2. Adjusts the **VIP welcome** (copy + optional TTS) when capture params are present.
3. **Persists attribution on lead submit** into `public.leads`:
   - **`source`**: always `ai_booth` (top-level funnel label).
   - **`referred_by`**: optional short `ref` token when provided (same pattern as `web/form-handler.js`).
   - **`notes`**: JSON string with **`booth_attribution`** + **`agent_context_hint`** (English, one line for Prompt Maestro / ops). Requires a `notes` (text/json) column on `leads` — already used elsewhere (e.g. party planner / admin blueprint).

No insert is performed **on page load** (avoids duplicate rows on refresh). Attribution is saved when the user submits the prospect form.

## Supported query parameters

| Param | Required | Description |
|--------|----------|-------------|
| `intent` | No | Intent label, e.g. `booking`, `wedding`, `corporate`, `private_party`. Drives VIP greeting and may pre-select **event type** when mappable. |
| `source` | No | External capture source id (e.g. `sombra`, `crystal`, `meta`, `google`). Stored in `notes.booth_attribution.source`. |
| `ref` | No | Campaign or contact reference (short token). Mapped to **`referred_by`** when short enough; also stored in attribution JSON. |
| `campaign` | No | Short campaign id (e.g. ad set name). Distinct from `utm_campaign`. |
| `customer_interest` | No | Human-readable interest (e.g. `wedding`) — drives personalized greeting. |
| `utm_source` | No | Standard UTM. |
| `utm_medium` | No | Standard UTM. |
| `utm_campaign` | No | Standard UTM. |
| `utm_content` | No | Standard UTM. |

Example:

```text
https://miamidjbeat.com/booth.html?intent=booking&source=sombra&ref=ig-story-0426&utm_source=instagram&utm_medium=paid&utm_campaign=dj-miami-wedding
```

## Client API (Booth page only)

After load, scripts expose:

```js
window.MDJBoothCapture.getAgentContext()   // object for UI / future agent
window.MDJBoothCapture.getAgentSystemHint() // one-line hint for Prompt Maestro injection (English)
window.MDJBoothRadar // alias → same object (“radar” for ad integrations)
```

Canonical param list + examples: [`tracking-contract.md`](./tracking-contract.md).

## Server-side follow-ups (not in this doc)

- Chat Edge Function should read the same context from the client session or a signed server-side session.
- Optional: webhook from “Sombra” → Edge Function → insert/update lead (separate design; do not duplicate anonymous inserts from the browser without rate limits).

## Version

- **v1** — 2026-04-13 — Initial contract aligned with `web/booth.html` capture implementation.
