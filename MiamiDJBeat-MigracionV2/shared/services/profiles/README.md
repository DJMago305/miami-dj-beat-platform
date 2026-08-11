# profiles/

Dominio **Profiles** (read model) · Shared Core · Paso 2.

## Responsabilidad

Tipos DTO y resolvers puros de taxonomía V1→V2 para Client / Artist / Staff.

## Qué contiene

- `profiles.types.ts` — `AccessSnapshotDTO`, `ClientProfileReadDTO`, `ArtistProfileReadDTO`, `PublicArtistCardDTO`, `StaffIdentityDTO`
- `profiles.mocks.ts` — fixtures frozen
- `profiles.map-snapshot.ts` — RPC→DTO read-only
- Resolvers de taxonomía (`profile-taxonomy-resolve.ts`)
- Spec Vitest: `tests/unit/profiles.spec.ts`

## Qué no contiene (aún)

- Writers / mutaciones
- SQL / migraciones
- Wiring a pantallas de portal (Paso 4+)

## Paso 3 — servicio de lectura

```ts
import { createProfilesServiceFromApiClient } from '@path/to/profiles';

const profiles = createProfilesServiceFromApiClient({ apiClient, sessionReader });
await profiles.fetchOwnAccessSnapshot();
await profiles.fetchOwnClientProfile();
await profiles.fetchOwnArtistProfile();
await profiles.fetchPublicArtistCard('djmago305');
```

## Referencias

- Spec: `PROFILES-SPEC.md`
- Matriz: `docs/V2/PROFILES-V1-V2-MAPPING-MATRIX.md`
- Taxonomía: `docs/V2/PROFILE-TAXONOMY.md`

## Localhost

Lab: `http://localhost:5173/client/` · `/artist/` · `/staff/`
