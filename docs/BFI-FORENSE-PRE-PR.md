# Forense pre-PR — Motor BFI (rama plan/v2-artist-agenda-matrix)

> Análisis de solo-lectura, 2026-08-14. Mapa para el PR CONTROLADO del trabajo
> financiero a la web real (main), por terminal Mac. No se ejecutó ningún merge.

## Veredicto
- Suite financiera: **9/9 verdes**.
- Secretos hardcodeados: **0** (solo comentarios / `Deno.env.get` / `GRANT ... TO service_role`).
- La rama está **199 commits sobre main**; de ellos **~35 son financieros (bfi)**; ~164 son WIP ajeno (nav/clima/identidad/agenda).
- WIP no commiteado (NO va en el PR financiero): admin-dashboard.html (VIP), weather-lab.html + supabase/functions/atmosphere (clima), migraciones/scripts identity_* (SSOT), .claude/.

## Estrategia de PR limpio (aislar lo financiero)
1. Rama fresca desde main: `git checkout -b feat/motor-bfi main`
2. Cherry-pick SOLO los commits financieros (lista abajo), en orden.
3. Vigilar 3 archivos COMPARTIDOS (pueden traer cambios de otro WIP): `vercel.json`, `web/dj-dashboard.html`, `supabase/functions/elixis-chat/index.ts` — revisar el diff final.
4. Correr los 9 self-tests + `node -c` de las functions; revisar diff completo; abrir PR con `gh`.
5. OK del PO antes de mergear.

## Commits financieros a cherry-pick (viejo → nuevo)
```
f9f006d docs(v2-finance): add OFTL architecture discovery
d500de6 docs(v2-finance): add OFTL data contracts specification
02949a8 feat(v2-finance): add OFTL core financial contracts
ad49ec9 docs(v2-finance): add payment allocation discovery
314d6f8 docs(v1-finance): add continuity audit
90f5c89 feat(v2-financial): Centro de Pagos & Cobros artista (verlo-ya, UI-only mock)
a7b66ce fix(v2-ssot): align Client VIP & Finance KPIs + connect Artist DJ Advice to real weather advice
12f1db4 refactor(v2-client): implement tab navigation system + distribute profile, bookings & finance modules
10bd18e refactor(v2-staff): implement hash router for sidebar + fix broken #djs & #staff links + add #finance panel
9462385 fix(v2-client): derive VIP tag dynamically + format finance receipt dates + optimize #bookings grid layout
5ef0e25 feat(financial): Business Financial Intelligence (maqueta) dentro de CASH FLOW — owner-only
6333266 fix(financial): BFI card DEBAJO del cash flow personal (no arriba)
51e05d1 feat(financial): switch OWNER en CASH FLOW — PFS (personal) ⇄ Owner Financial IA (Matrix)
aedb587 feat(financial): toggle día/noche al lado del switch OWNER (tematiza el Matrix)
7ca1b7e feat(bfi): emblema mercado alcista + pantalla completa del Matrix
215a637 chore(prod): vercel.json listo para el Matrix inline + URLs limpias
b2be29d fix(bfi): día/noche = ícono sol/luna que alterna al tocarlo (no switch)
e5f7ad0 docs(bfi): plan tecnico del motor BFI (contrato de datos + reuso V2 + orden BU)
68624a5 docs(bfi): plan motor Rev.2 — motor T009 ya existe (offline) + arquitectura agente ELIXIS
190b9e3 docs(bfi): Fase 0 — inventario preciso de modulos financieros a traer + orden
e07e6cb feat(bfi): traer Grupo A — motor financiero canonico (T009) + self-tests VERDES
7aeb570 feat(bfi): traer Grupo B — evidencia de equivalencia nuevo==legacy VERDE
df7ecb5 feat(bfi): cerrar Fase 0 — Grupo C (ar-visual-validation) + Grupo D (DDL diseno, sin aplicar)
d43797a fix(bfi): banner demo discreto + responsividad del Matrix (breakpoint 1024)
cf00590 fix(bfi): Matrix embebido sin bordes, llena ancho completo
60a04d3 feat(bfi): pantalla completa NATIVA del Matrix (todo el monitor) para analisis
30f301c feat(bfi): barra negra consolidada (branding arriba) + menos espacio muerto
771e6d0 feat(bfi): panel lateral del Matrix recogible (desktop) para mejor vision
d9a222b feat(bfi): Fase 1 — RLS staff-only para las 13 tablas financial_ (diseno)
3169531 feat(bfi): Fase 2 — financial-engine Edge Function (motor server-side + persistencia)
2d37fcf feat(bfi): Fase 5 — ELIXIS delega al motor financiero (tool-use)
1bdfa36 feat(bfi): Fase 3 — import residency_schedule -> modelo canonico (venues+agreements)
52815dc fix(bfi): motor auth por ROL directo (incluye owner) — is_staff de prod excluye owner
333ddfc docs(bfi): Fase 6 — runbook de produccion (con gate del PO por paso)
664899e fix(bfi): RLS financial usa can_read_financial (INCLUYE owner), no is_staff
```

## Archivos del PR financiero (autocontenidos)
```
docs/BFI-FASE0-INVENTARIO-TRAIDA.md
docs/BFI-FASE6-RUNBOOK-PRODUCCION.md
docs/BFI-MOTOR-PLAN-TECNICO.md
docs/architecture/MIAMI-DJ-BEAT-V1-CANONICAL-FINANCIAL-ARCHITECTURE.md
supabase/canonical-financial-design/20260724143000_staff_record_lead_offline_payment.sql
supabase/canonical-financial-design/20260802154200_canonical_talent_taxonomy_v1.sql
supabase/canonical-financial-design/20260804230000_canonical_financial_architecture_v1_ddl.sql
supabase/canonical-financial-design/README.md
supabase/canonical-financial-design/rls_financial_staff_only.sql
supabase/functions/elixis-chat/index.ts
supabase/functions/financial-engine/README.md
supabase/functions/financial-engine/index.ts
supabase/functions/financial-engine/mapping.ts
supabase/functions/financial-engine/mdj-financial-local-services.js
vercel.json
web/business-financial-intelligence.html
web/dj-dashboard.html
web/js/fixtures/mdj-financial-legacy-adapter.synthetic.json
web/js/mdj-accounting-ar-visual-validation.js
web/js/mdj-accounting-financial-runtime.js
web/js/mdj-accounting-financial-runtime.local-selftest.mjs
web/js/mdj-ar-by-venue-projection.js
web/js/mdj-financial-adapter-cross-validation-fixture-007D.mjs
web/js/mdj-financial-adapter-cross-validation-harness-007D.mjs
web/js/mdj-financial-canonical-equivalence-fixture-007C.mjs
web/js/mdj-financial-canonical-equivalence-harness-007C.mjs
web/js/mdj-financial-canonical-shadow-writer.js
web/js/mdj-financial-canonical-shadow-writer.local-selftest.mjs
web/js/mdj-financial-domain-events.js
web/js/mdj-financial-domain-events.local-selftest.mjs
web/js/mdj-financial-equivalence-fixture.js
web/js/mdj-financial-equivalence-harness.mjs
web/js/mdj-financial-legacy-adapter.js
web/js/mdj-financial-legacy-import-bridge.js
web/js/mdj-financial-legacy-readonly-adapter.js
web/js/mdj-financial-legacy-readonly-adapter.local-selftest.mjs
web/js/mdj-financial-local-services.js
web/js/mdj-financial-local-services.local-selftest.mjs
web/js/mdj-financial-projection-sync.js
web/js/mdj-financial-projection-sync.local-selftest.mjs
web/js/mdj-local-projection-engine.js
web/serve.json
```
