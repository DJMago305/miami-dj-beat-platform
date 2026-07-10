# THEME-SPEC.md

**TICKET-V2-SHARED-CORE-014 — Theme Manager Specification**

**Módulo:** MOD-007 Theme Manager  
**Ticket:** TICKET-V2-SHARED-CORE-014  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Define, resuelve y distribuye **tokens visuales** — Dark · Gold · Premium · Glass.  
> **No** CSS final · **No** componentes · **No** UI render.

---

## 1. Propósito

Autoridad única de **design tokens** y resolución de tema para MiamiDJBeat-MigracionV2: dark/gold brand identity, preferencias usuario/sistema, accesibilidad documental — sin runtime CSS en este ticket.

---

## 2. Scope

| Incluye | Descripción |
|---------|-------------|
| Token registry | brand · semantic · surface · motion · etc. |
| Theme resolution | default → user → system → fallback |
| Lifecycle | 11 estados — THEME-LIFECYCLE.md |
| Events | THEME_* — THEME-EVENTS.md |
| Storage prefs | `mdj_v2_theme_*` — THEME-STORAGE-RULES.md |
| Accessibility rules | THEME-ACCESSIBILITY.md |
| Portal inheritance | Client · Artist · Staff overlays |
| `THEME_CHANGED` | Event Bus public |

---

## 3. Non-scope

| Excluye | Responsable |
|---------|-------------|
| CSS files / stylesheets | Design System MOD-008 · runtime ADR |
| Components / DOM | Components MOD-009 |
| Layout / nav geometry | Responsive MOD-016 · portal nav |
| i18n / copy | MOD-015 |
| Permissions | MOD-003 |
| Auth / session logic | MOD-001 · MOD-002 |
| Portal access | Permissions + shells |
| `web/styles.css` | V1 prohibido |

---

## 4. Responsabilidades

| Hace | No hace |
|------|---------|
| Define token contract | Render UI |
| Resuelve active theme | Decide layout |
| Emite THEME_CHANGED | Decide idioma |
| Valida contrast rules (spec) | `hasCapability()` |
| Persist theme pref via Storage facade | Lógica negocio |
| Portal token inheritance map | Modifica portales |

---

## 5. Límites

```
Configuration (defaults)
  → Theme Manager (resolve tokens)
  → Event Bus THEME_CHANGED
  → Design System / Components (consume tokens — future)
  → Portal shells (apply CSS vars — future)
```

Theme **no** importa portales. Portales **no** definen tokens Core sin ADR.

---

## 6. Dependencias permitidas

| Módulo | Uso |
|--------|-----|
| Configuration MOD-006 | default theme, token version |
| Storage MOD-012 | Preferences `theme` key |
| Event Bus MOD-004 | emit THEME_* |
| Logging MOD-010 | theme errors meta |
| Error Handling MOD-014 | ERR-THEME-* normalize |
| Session MOD-002 | read theme ref from snapshot (orchestrated) |

---

## 7. Dependencias prohibidas

| Prohibido | Motivo |
|-----------|--------|
| Permissions | No access decisions |
| i18n | No translatable strings |
| Auth | No identity |
| API Client | No HTTP |
| Portales direct import | Boundary |
| Components implementation | MOD-009 future consumer |
| V1 CSS copy | Lab isolation |

---

## 8. Modelo de temas

| Theme ID | Modo | Uso |
|----------|------|-----|
| `mdj-dark-gold` | dark | **Default brand** — premium glass luxury |
| `mdj-dark-gold-high-contrast` | dark | Accessibility fallback |
| `mdj-light` | light | ADR + PO only — not MVP default |

Base identity: **Dark · Gold · Premium · Glass · alto contraste · desktop/mobile**.

---

## 9. Tokens visuales

Categorías en **TOKEN-CONTRACT.md**:

color · space · radius · shadow · motion · z-index · typography refs

Naming: `--mdj-{category}-{name}` conceptual.

---

## 10. Tokens semánticos

| Token semantic | Maps to |
|----------------|---------|
| `--mdj-color-bg-primary` | surface.base |
| `--mdj-color-text-primary` | text.primary |
| `--mdj-color-accent` | brand.gold |
| `--mdj-color-border-subtle` | border.default |
| `--mdj-color-status-error` | status.error |

Semantic layer **indirection** — Components consume semantic, not raw hex.

---

## 11. Brand tokens

| Token | Valor conceptual | Identidad |
|-------|------------------|-----------|
| `brand.gold.primary` | #C9A227 family ADR | Miami DJ Beat gold |
| `brand.gold.muted` | lower saturation | secondary accent |
| `brand.bg.deep` | near-black | dark premium |
| `brand.glass.surface` | rgba overlay | glass luxury |
| `brand.glow.gold` | subtle shadow | premium highlight |

Exact hex → ADR design freeze; spec documents **roles**, not production values lock.

---

## 12. Portal inheritance

| Portal | Inheritance |
|--------|-------------|
| **Base** | Core token set `mdj-dark-gold` |
| **Client** | optional `portal.client.*` overlay ADR |
| **Artist** | optional `portal.artist.*` overlay |
| **Staff** | optional `portal.staff.*` overlay |

Rule: overlays **extend** base — never replace brand.gold without PO ADR.

---

## 13. Preferencias de usuario

| Pref | Values | Storage |
|------|--------|---------|
| `themeMode` | `dark` \| `light` \| `system` | Preferences `theme` |
| `themeId` | `mdj-dark-gold` … | optional ADR |

User explicit pref **wins** over system when not `system`.

Theme Manager **applies** pref — Session/portal **resolves** user choice external call.

---

## 14. Preferencias del sistema

| `prefers-color-scheme` | Maps |
|------------------------|------|
| `dark` | `mdj-dark-gold` |
| `light` | `mdj-light` if enabled ADR else dark |
| no match | Configuration default |

Only when user pref = `system`.

---

## 15. Relación con Design System

| Design System MOD-008 | Theme MOD-007 |
|-----------------------|---------------|
| Typography scale, spacing primitives | Token values source |
| Consumes semantic tokens | Defines token registry |
| Component patterns | No component defs |

Design System **downstream** — blocked on Theme spec PO approved.

---

## 16. Relación con Components

Components MOD-009 **consume** tokens via CSS variables / token object — **never** hardcoded hex.

Theme **never** imports Components.

---

## 17. Relación con i18n

**Strict separation:**

| Theme | i18n |
|-------|------|
| Color, motion, radius | Translation keys |
| No strings | No colors |

Prohibido: translatable text in Theme module.

---

## 18. Relación con Storage

Namespace `mdj_v2_theme_*` + Preferences `theme` — **THEME-STORAGE-RULES.md**.

Theme **no** writes Storage direct — facade only.

---

## 19. Relación con Event Bus

Public: `THEME_CHANGED` (catalog #16).

Extended internal/public — **THEME-EVENTS.md**.

---

## 20. Anti-patterns prohibidos

| Anti-pattern | Correcto |
|--------------|----------|
| Hex in component | semantic token |
| Theme checks permission | Permissions module |
| Copy in token value | i18n key |
| Import V1 styles.css | V2 token registry |
| Nav 12ch in Theme | Responsive/portal |
| Light default without ADR | dark-gold default |

---

## 21. Criterios de aceptación documental

| # | Criterio |
|---|----------|
| D-01 | 8 theme docs exist |
| D-02 | 11 lifecycle states + table |
| D-03 | Token contract types complete |
| D-04 | 12 theme events documented |
| D-05 | 10 ERR-THEME codes |
| D-06 | Accessibility rules WCAG-oriented |
| D-07 | Zero code/CSS/V1 |
| D-08 | Progress 12/16 = 75% |

---

## Facade conceptual (runtime futuro)

```
createThemeManager(config, storageReader) → ThemeFacade

ThemeFacade.resolveTheme(context)
ThemeFacade.getTokens(): TokenMap
ThemeFacade.setUserPreference(pref)
ThemeFacade.applyTheme()  // emits THEME_CHANGED
```

---

## Referencias

- `THEME-LIFECYCLE.md`
- `TOKEN-CONTRACT.md`
- `THEME-EVENTS.md`
- `THEME-ERRORS.md`
- `THEME-STORAGE-RULES.md`
- `THEME-ACCESSIBILITY.md`
- `../CONTRACTS.md` §9

---

*THEME-SPEC v1.0 — TICKET-V2-SHARED-CORE-014*
