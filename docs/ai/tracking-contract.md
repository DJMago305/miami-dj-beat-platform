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

## Version

- **v1** — 2026-04-13 — Adds `campaign` and `customer_interest`; aligns with `web/booth.html`.
