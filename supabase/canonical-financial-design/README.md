# Canonical Financial Architecture — SQL de DISEÑO (NO aplicar)

Estos 3 SQL son **diseño versionado, NO migraciones activas.** Están **a propósito
FUERA de `supabase/migrations/`** para que **no se apliquen** con un `db push`.

| Archivo | Qué es | Estado |
|---|---|---|
| `20260804230000_canonical_financial_architecture_v1_ddl.sql` | Esquema canónico (13 tablas `financial_*`). El header dice **"DESIGN ONLY. NOT AUTHORIZED for remote apply".** | ⛔ Gate PO |
| `20260802154200_canonical_talent_taxonomy_v1.sql` | Taxonomía de talento (DJ/Banda/MC/Músico/Bailarín/Talento) del Artist Matrix. | ⛔ Gate PO |
| `20260724143000_staff_record_lead_offline_payment.sql` | Registro de pago offline (staff). | ⛔ Gate PO |

## Fuente de verdad del diseño
`docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md` — §5 modelo
E-R, §6 contrato de entidades, §20 orden de implementación, §21 los 10 gates.

## Cómo promover a migración (cuando el PO autorice el gate)
```
git mv supabase/canonical-financial-design/<archivo>.sql supabase/migrations/
```
y recién ahí aplicar en el Supabase local de prueba primero (nunca remoto sin
autorización expresa, per §20 pasos 14–15).

## Regla
Traído del worktree `MiamiDJBeat-V1-offline-payment` en una sola dirección
(hacia este proyecto, nunca al revés). Este material es diseño; **aplicar espera
autorización explícita del Product Owner.**
