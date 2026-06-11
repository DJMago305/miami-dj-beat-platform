# MDJPRO-PKG-RECOVERY-002 — Install incident (ARCHIVED)

**Status:** **ARCHIVED — NO ACTION**  
**Closed:** 2026-06-11  
**Superseded by:** ship line **V.2.6.0** (pkg notarized, Storage, **INSTALL-OPEN-008** PASS prod)

---

## Why this ticket exists

Forensic note for the **2026-06-09/10** install confusion (DerivedData vs `/Applications`, stale binaries).  
**Do not run recovery scripts below** for current work.

---

## Closure (current prod)

| Check | Result |
|-------|--------|
| `/Applications/MDJ PRO.app` | **2.6.0** ✓ |
| Pkg name = pkg content | ✓ |
| Notarized prod + Desktop backup | ✓ |
| Install from miamidjbeat.com | ✓ PASS |

---

<details>
<summary>Historical record — 2026-06-09 incident — do not execute</summary>

### Symptoms (historical)

| Symptom | Cause |
|---------|--------|
| Xcode Run vs Dock version mismatch | DerivedData vs `/Applications` |
| Two Dock icons | Xcode + installed instance |
| Empty `/Applications` | Install never completed |

### Recovery script (obsolete)

```bash
# DO NOT RUN — reference only
cd ~/Desktop/MDJ
./scripts/mdj-recovery-install.sh
```

### Rules (still useful)

1. **Develop:** Xcode Run  
2. **Test installer:** `/Applications` only — Cmd+Q before `.pkg`  
3. **Never** rename `.pkg` without `mdj-release.sh`  
4. Version bumps: see AUTO-004

</details>
