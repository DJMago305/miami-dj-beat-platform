# Legal Template Assets — Legal Center V2

**Scope:** shared binary catalog for Staff · Artist · Client portals (lab only).

## Layer placement

```
contracts/     DC-1 — entities + ports (no binaries)
in-memory/     DC-2 — fixtures + read service
assets/        shared template binaries + catalog   ← THIS FOLDER
provider/      DC-3 — factory + portal adapters + asset resolver re-export
ui/            LC-4 — shell (no direct PDF imports)
```

UI must **not** import PDFs directly. Portals resolve URLs through `resolveLegalTemplateAssetUrl()` in the provider/assets layer.

## Directory layout

```
assets/
  legal-template-asset-catalog.ts
  legal-template-asset-urls.ts      # Vite ?url imports (ready binaries only)
  legal-template-asset-resolver.ts
  templates/
    tax/SPC-001/TV-SPC-001-1/fw9-corporate.pdf
    contracts/client/CTR-001/...    (planned)
    contracts/artist/CTR-002/...    (planned)
    contracts/corporate/...         (planned)
    policies/LGL-002/...            (planned)
    nda/NDA-001/...                 (planned)
    releases/REL-001/...            (planned)
    vendor/VND-001/...              (planned)
```

## Dual storage — W-9 corporate

| Role | Path |
|------|------|
| Counsel / PO reference | `MiamiDJBeat-MigracionV2/docs/legal/fw9.pdf` |
| Runtime consumable copy | `assets/templates/tax/SPC-001/TV-SPC-001-1/fw9-corporate.pdf` |

The runtime copy is a **duplicate** (not a move). Legal review stays in `docs/legal/`; the lab serves the catalog copy via Vite.

## Registering a new template

1. Add catalog row in `legal-template-asset-catalog.ts` (`availability: planned` until binary exists).
2. Place file under `templates/<category>/<templateCode>/<versionId>/`.
3. Import URL in `legal-template-asset-urls.ts`.
4. Set `availability: ready`.
5. Add unit tests in `tests/unit/legal-template-assets.test.ts`.

## Access rules (aligned with LGC discovery)

| Template | Portals | Public library |
|----------|---------|----------------|
| SPC-001 W-9 | staff, artist | **No** (LGC-005 isolated) |
| CTR / LGL / NDA / releases | per catalog row | Yes (except W-9) |
| Vendor agreements | staff | Yes |

## Future LC-4 PDF engine

Download buttons in LC-4 UI will call `resolveLegalTemplateAssetUrl()` — not implemented in this ticket (UI shell unchanged).
