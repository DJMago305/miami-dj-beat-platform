# DELIVERY-CHANNELS.md

**TICKET-V2-SHARED-CORE-009 — Notifications Specification**

**Módulo:** MOD-011 · Canales de entrega  
**Versión:** 1.0  
**Total canales documentados:** **8**

---

## In-App (MVP)

| Canal | Descripción | Interrumpe UX |
|-------|-------------|---------------|
| **In-App** | Inbox / centro notificaciones portal | no |
| **Toast** | Mensaje efímero corner | mínimo |
| **Banner** | Barra superior persistente temporal | medio |
| **Modal** | Diálogo blocking | alto |

Render: portal `components/` consume payload — Notifications **no** DOM.

---

## Futuro (documentado, no MVP)

| Canal | Descripción | Implementación |
|-------|-------------|----------------|
| **Email** | Correo transaccional | Edge + template ADR |
| **Push** | Web push / mobile | Edge + subscription ADR |
| **SMS** | Texto | Edge (SoundForTips pattern separate) |
| **Webhook** | Integraciones B2B | Edge staff-only |

V2 spec reserva channel enum; MVP runtime **solo** In-App family.

---

## Selección de canal

| Input | Regla |
|-------|-------|
| type + priority | default channel matrix |
| explicit override | create() param |
| user preference | future ADR |
| capability deny | downgrade to In-App or suppress |

### Matrix tipo → canal default

| Type | Primary | Fallback |
|------|---------|----------|
| Information | Toast | In-App |
| Success | Toast | — |
| Warning | Banner | Toast |
| Error | Toast | Modal |
| Critical | Modal | Banner |
| Confirmation | Modal | — |
| Progress | Banner | In-App |
| System | Banner | Modal |
| Background | In-App | — |

---

## Cola por canal

| Canal | Max concurrent | Queue |
|-------|----------------|-------|
| Toast | 3 visible | FIFO drop Low |
| Banner | 1 | replace same dedupeKey |
| Modal | 1 | queue High+ |
| In-App | unlimited list | paginate UI |

---

## Entorno

| Entorno | External channels |
|---------|-------------------|
| local | In-App only |
| staging | In-App + Email test ADR |
| production | per PO cutover |

---

*DELIVERY-CHANNELS v1.0 — 8 channels — TICKET-V2-SHARED-CORE-009*
