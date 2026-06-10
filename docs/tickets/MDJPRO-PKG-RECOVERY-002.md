# MDJPRO-PKG-RECOVERY-002 — Install incident closure

**Status:** OPEN — awaiting Captain Terminal run  
**Date:** 2026-06-09  
**Root cause:** Multiple app copies (Xcode DerivedData vs `/Applications`) + agent could not complete `sudo installer` from chat.

---

## Incident summary

| Symptom | Cause |
|---------|--------|
| Xcode Run shows `V.2.0.0` | Fresh build from corrected source |
| Dock/Launchpad shows `V.2.00` | Stale binary in `/Applications` or wrong `.app` opened |
| Two Dock icons | Xcode instance + installed instance open simultaneously |
| `/Applications` empty after audits | Install never completed or app removed between attempts |

**Source code:** OK (`MARKETING_VERSION = 2.0.0`, `AppConfig` reads bundle, PNG clean).  
**Failure:** deployment chain, not Swift logic.

---

## Single recovery command (Captain Terminal)

```bash
cd ~/Desktop/MDJ
chmod +x scripts/mdj-recovery-install.sh
./scripts/mdj-recovery-install.sh
```

Script flow:
1. Quit all MDJ PRO processes
2. `mdj-release.sh` — Release build + `.pkg` (no version bump)
3. Print Release binary SHA256
4. `sudo installer` → `/Applications`
5. Compare Release SHA vs Installed SHA — **MATCH YES** required
6. Open only `/Applications/MDJ PRO.app`

Re-install existing pkg only (skip rebuild):

```bash
SKIP_BUILD=1 ./scripts/mdj-recovery-install.sh
```

---

## Closure criteria (PASS)

- [ ] `MATCH: YES` in recovery script output
- [ ] Welcome shows `V.2.0.0` (AppConfig)
- [ ] Settings / About show `V.2.0.0`
- [ ] Hub logo: clean PNG (no `V.2.00` raster)
- [ ] Only **one** MDJ PRO process when testing
- [ ] No `1.9.0` in installed binary strings

---

## Rules going forward

1. **Develop:** Xcode Run only  
2. **Test installer:** `/Applications` only — no Xcode Run at same time  
3. **Never** rename `.pkg` without `mdj-release.sh`  
4. **Version bump:** Captain defines `official` / `functional` / `cosmetic` first (AUTO-004)
