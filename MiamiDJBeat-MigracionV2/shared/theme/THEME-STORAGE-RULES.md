# THEME-STORAGE-RULES.md

**TICKET-V2-SHARED-CORE-014 — Theme Manager Specification**

**Módulo:** MOD-007 · Storage  
**Versión:** 1.0

---

## Namespace

Prefix: `mdj_v2_theme_*`  
Preferences namespace (Storage MOD-012): key `theme`

---

## Qué puede guardarse

| Key | Contenido | Backend |
|-----|-----------|---------|
| `mdj_v2_preferences_theme` | `dark` \| `light` \| `system` | localStorage |
| `mdj_v2_theme_id` | `mdj-dark-gold` optional ADR | localStorage |
| `mdj_v2_theme_version` | int schema version | localStorage |

Session mirror: `mdj_v2_session_theme` per SESSION-STORAGE — Session orchestrates write.

---

## Qué NO puede guardarse

| Prohibido |
|-----------|
| Full token map / CSS dump |
| Private token registry secrets |
| Permissions / capabilities |
| Role matrix |
| Payment data |
| PII unnecessary |
| JWT / auth refs |
| Portal access flags |

---

## User preference

| Field | Values |
|-------|--------|
| `themeMode` | `dark` \| `light` \| `system` |

Invalid → ERR-THEME-004 · do not persist.

---

## Portal preference

Optional ADR `portalThemeOverlay` id — **not** separate storage key MVP; inherits base + portal enum in memory.

---

## Fallback preference

If read corrupt → delete key · use Configuration default · log ERR-THEME-005.

---

## TTL

Preferences `theme`: **no TTL** (persistent user choice).

Cache token map memory: session lifetime only.

---

## Invalidación

| Trigger | Action |
|---------|--------|
| CONFIG theme version bump | Clear `mdj_v2_theme_version` · re-resolve |
| Invalid pref detected | Remove pref key |
| Logout | **Keep** theme pref (default) — same as locale |
| THEME_SECURITY_VIOLATION | Clear theme keys · fallback |

---

## Limpieza

`clearNamespace` theme keys — Theme module authority via Storage facade only on SECURITY or corrupt.

---

*THEME-STORAGE-RULES v1.0 — TICKET-V2-SHARED-CORE-014*
