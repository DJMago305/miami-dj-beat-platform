# Financial / Payments Domain Service — SPEC (Paso 2)

| Campo | Valor |
|-------|--------|
| **Módulo** | `shared/services/financial` |
| **Matriz** | `docs/V2/FINANCIAL-V1-V2-MAPPING-MATRIX.md` |
| **Types** | `shared/types/financial.types.ts` |
| **Estado** | Read-only mappers + service + mocks — **sin writers** · **sin SQL** · **sin commit** |
| **Aislamiento** | **≠** OFTL `shared/services/finance/` (no modificar) |

## Métodos públicos

| Método | Rol |
|--------|-----|
| `fetchOwnPaymentReceipts({ clientUserId })` | Cliente — recibos + txs cobro + balance due/paid |
| `fetchArtistWalletBalance({ artistUserId })` | Artista — wallet + pending release + ledger txs |
| `fetchMasterFinancialLedger({ audience })` | Staff — libro maestro receipts + txs + totales |

**Prohibido:** charge · record payment · approve · refund · release payout · insert/update/delete.
