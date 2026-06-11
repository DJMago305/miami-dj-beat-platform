# MDJPRO-INSTALL-OPEN-008 — Auto-open MDJ PRO after .pkg install

**Status:** **DONE** — PASS local + **PASS prod** (2026-06-11)  
**Priority:** Medium (install UX)  
**Type:** Installer postinstall script (Mac scripts only)

---

## Problem

After downloading from miamidjbeat.com and completing the Apple installer, the user had to manually open **MDJ PRO** from Applications. Expected Serato-like flow: app launches when install finishes.

---

## Solution

| File | Role |
|------|------|
| `~/Desktop/MDJ/scripts/pkg/postinstall` | `open -a "/Applications/MDJ PRO.app"` as console user |
| `~/Desktop/MDJ/scripts/lib/mdj-pkg-lib.sh` | Shared `mdj_build_installer_pkg` (payload + scripts) |
| `mdj-release.sh` / `mdj-pkg-only.sh` / `mdj-notarize-release.sh` | Use postinstall on every pkg build |

---

## Agreed behavior (canon)

- App opens when installation **completes** (postinstall runs before user clicks **Close** on installer dialog — **normal macOS**).
- Do **not** implement “only after Close” without a new ticket (fragile helper pattern).

---

## QA

| Phase | Result |
|-------|--------|
| Local pkg install | ✓ PASS (Captain) |
| Prod download from miamidjbeat.com | ✓ **PASS prod** |
| Notarized pkg in Supabase | ✓ SHA256 `5c8d37d3…` |

---

## Git

- Mac workshop commit: `974ea7b` (scripts + handoff)
- Web: no change required (same `MDJPRO_Installer.pkg` filename)

---

## Related

- `MDJPRO_PROJECT_STATE.md` §11  
- Copy web `dl-install-step4` still says “open from Applications” — optional cosmetic ticket
