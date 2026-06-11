# MDJPRO-VERSION-SYNC-003 — Hub logo version (ARCHIVED)

**Status:** **ARCHIVED — NO ACTION**  
**Closed:** 2026-06-11  
**Prod:** **V.2.6.0** — hub/splash/About use `AppConfig.version`

---

## Captain confirmation (2026-06-11)

- **`V.2.00` on hub:** **not visible** in current prod / installed app — **do not reopen this ticket for PNG work**.
- **No asset edit required** for SYNC-003 in the 2.6.0 line.
- This file is **historical record only** (incident era **V.2.0.0** audit).

---

## Version policy (still valid)

Official MDJPRO releases use **`V.MAJOR.MINOR.PATCH`** (three segments).  
**Single source:** `AppConfig.version` from bundle — see [MDJPRO-VERSION-AUTO-004](./MDJPRO-VERSION-AUTO-004-xcode-single-source.md).

---

<details>
<summary>Historical record — V.2.0.0 era (2026-06-09) — do not implement</summary>

### Problem (resolved / obsolete)

Hub audit reported raster **`V.2.00`** in `mdj_logo 2.png` while `AppConfig` showed **`V.2.0.0`**.  
That gap belonged to the **2.0.0 ship window**, not the current **2.6.0** line.

### Original scope (never execute now)

- Edit PNG or overlay `AppConfig.version` on hub logo  
- Rebuild `MDJPRO V.2.0.0.pkg` for logo-only patch  

### Audit snapshot (SYNC-002 era)

| Check | Result |
|-------|--------|
| `AppConfig.version` | `V.2.0.0` ✓ |
| Hub logo PNG | reported `V.2.00` ✗ (historical) |

**Approval on file:** Captain `APROBADO — MDJPRO-VERSION-SYNC-003` (2026-06-09) — **superseded by 2.6.0 ship**.

</details>
