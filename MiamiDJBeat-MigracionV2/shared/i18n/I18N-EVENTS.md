# I18N-EVENTS.md

**TICKET-V2-SHARED-CORE-013 — Internationalization Specification**

**Módulo:** MOD-015 · Eventos  
**Versión:** 1.0

---

## Eventos emitidos

| Evento | Scope | Cuándo | Payload |
|--------|-------|--------|---------|
| `LANGUAGE_CHANGED` | public | Active locale changed post-READY | `{ locale: 'en' \| 'es' }` |

Registrado en EVENT-BUS-SPEC.md #17 · emisor MOD-015.

---

## Eventos escuchados

| Evento | Emisor | Acción i18n |
|--------|--------|-------------|
| `SESSION_READY` | Session | Sync locale if Session carries new value (external call) |
| `CONFIG_UPDATED` | Configuration | Reload default if i18n config keys changed ADR |

i18n **no** escucha Permissions, Auth, API events.

---

## Payload LANGUAGE_CHANGED

| Campo | Req | Tipo |
|-------|-----|------|
| `locale` | ✅ | `en` \| `es` |
| `previousLocale` | ○ | `en` \| `es` |
| `source` | ○ | `user` \| `session` \| `config` |

---

## Consumidores esperados

| Consumidor | Acción |
|------------|--------|
| Portal Shell | Re-render text nodes / data-i18n |
| Components | Invalidate cached labels ADR |
| Notifications | Re-display active toasts optional ADR |
| Theme | **No action** — separate concern |

---

## Orden emit

```
setActiveLocale success → READY → emit LANGUAGE_CHANGED
```

Never emit before bundle load complete.

---

*I18N-EVENTS v1.0 — TICKET-V2-SHARED-CORE-013*
