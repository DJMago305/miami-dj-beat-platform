# Centro Legal (LC-12 / LC-13A / LC-13B) — diseño, NO aplicado

Estas 3 migraciones se movieron aquí desde `supabase/migrations/` el 2026-08-22,
tras una auditoría forense. Nunca se aplicaron a producción ni a ninguna base —
sus propias cabeceras lo dicen (`Status: NOT APPLIED`, `isolated Postgres
validation`), pero vivían en la carpeta que `supabase db push` ejecuta sin
preguntar.

## ⚠️ Peligro si se aplican tal cual

`20260722101300_legal_center_read_security_lc13a.sql` redefine
`auth.uid()` con un stub de laboratorio (`CREATE OR REPLACE FUNCTION
auth.uid()`) que solo lee `request.jwt.claim.sub`, sin el respaldo JSONB
(`request.jwt.claims`) que usa la función real de Supabase. Esa función la
usan 299 líneas en 76 archivos de migración — todo el RLS de la plataforma
(`artist_agenda`, dashboard del artista, memoria de ELIXIS, tablas
financieras). Aplicar esto sin reescribirlo primero arriesga tumbar la
autenticación de toda la plataforma.

Las 9 tablas `legal_*` que crean estas migraciones no tienen ningún
consumidor de código (verificado, cero referencias en `web/` ni
`supabase/functions/`) — el Centro Legal se diseñó contra
`MiamiDJBeat-MigracionV2`, un repo que nunca aterrizó.

## Antes de reescribir para producción

1. Sustituir el stub de `auth.uid()`/`legal_lc13_identity_profiles` por
   identidad real (`dj_profiles`/`auth.users`).
2. Eliminar por completo el `CREATE OR REPLACE FUNCTION auth.uid()`.
3. Borrar las dos tablas de laboratorio `legal_lc13_identity_profiles` y
   `legal_lc13b_secondary_identity_claims`.
4. Solo entonces promoverlas de vuelta a `supabase/migrations/`.
