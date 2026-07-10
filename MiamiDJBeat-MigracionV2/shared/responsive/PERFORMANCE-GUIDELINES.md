# PERFORMANCE-GUIDELINES.md

**TICKET-V2-SHARED-CORE-018 — Responsive Engine Specification**

**Módulo:** MOD-016 · Performance  
**Versión:** 1.0

> Reglas documentales — **no** profiling runtime.

---

## Objetivos

| Objetivo | Target ADR |
|----------|------------|
| Breakpoint handler lightweight | Debounce resize 150ms |
| No resize storm | Coalesce VIEWPORT_RESIZED |
| Mobile first paint | Critical path portal — not Responsive module weight |
| Image lazy | Below fold — LAYOUT-ADAPTATION |

---

## Reglas

| # | Regla |
|---|-------|
| PF-01 | Breakpoint listener count minimized — single Responsive authority |
| PF-02 | **No** synchronous layout read/write loops on resize |
| PF-03 | `matchMedia` listeners preferred over resize where stepped ADR runtime |
| PF-04 | Disable heavy glass blur low-end mobile — Feature Flag ADR |
| PF-05 | Reduce motion — skip transition on BREAKPOINT_CHANGED |
| PF-06 | Table virtual scroll large datasets — Components portal ADR |
| PF-07 | Font subset WOFF2 — runtime ticket · document requirement |

---

## Breakpoint change cost

| Action | Allowed |
|--------|---------|
| Toggle CSS class on root | ✅ runtime ADR |
| Re-mount entire portal | ❌ |
| Refetch Permissions | ❌ |
| Full i18n reload | ❌ |

---

## Network

Responsive rules **do not** trigger API calls on orientation change.

---

*PERFORMANCE-GUIDELINES v1.0 — TICKET-V2-SHARED-CORE-018*
