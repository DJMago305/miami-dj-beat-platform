# Bookings / Agenda Domain Service — SPEC (Paso 2)

| Campo | Valor |
|-------|--------|
| **Módulo** | `shared/services/bookings` |
| **Matriz** | `docs/V2/BOOKINGS-V1-V2-MAPPING-MATRIX.md` |
| **Types** | `shared/types/bookings.types.ts` |
| **Estado** | Read-only mappers + service + mocks — **sin writers** · **sin SQL** · **sin commit** |

## Métodos públicos

| Método | Rol |
|--------|-----|
| `fetchOwnBookings({ clientUserId })` | Cliente — propios leads |
| `fetchArtistSchedule({ artistUserId })` | Artista — slots JSON + assigned |
| `fetchMasterSchedule({ audience })` | Staff — master leads |
| `fetchEventDetail(id, { audience })` | Detalle + redact PII |

**Prohibido:** insert · update · delete · cancel.
