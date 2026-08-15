# financial-engine — Edge Function (Fase 2)

El **motor financiero canónico T009 corriendo del lado servidor**, persistiendo en
las 13 tablas `financial_`. Autoridad server-side, RLS-safe. Es también el punto
donde **ELIXIS se conecta en la Fase 5**.

## Arquitectura
Stateless por request: **hidrata** el store desde las 13 tablas → **corre** el
comando/consulta del motor → **persiste** (upsert idempotente por PK) → responde.
- `index.ts` — handler HTTP + candado staff.
- `mapping.ts` — mapeo camelCase↔snake_case + load/persist (columnas verificadas vs DDL).
- `mdj-financial-local-services.js` — el motor T009 (copia de `web/js/`, mantener en sync).

## Contrato HTTP (POST JSON)
```
{ "action":"command", "name":"recordPayment", "input": { "direction":"INFLOW","amountCents":35000,"currency":"USD","method":"ZELLE","paymentDate":"2026-08-08" } }
{ "action":"query",   "name":"getNetCash",     "args": [] }
{ "action":"health" }
```
Comandos: createVenue, createVenueAgreement, createOccurrenceWithPfr, createVenueReceivable,
createPayable, recordPayment, confirmPayment, allocatePayment, recordOwnerPayout, recordRefund,
reverseAllocation, rescheduleOccurrence, cancelOccurrence, voidReceivable, voidPayable, reconcilePayment.
Consultas: getNetCash, getCashInflow, getCashOutflow, getReceivableBalance(id), getPayableBalance(id),
getAccountsReceivable, getAccountsPayable, getUnallocatedPaymentAmount(id), getPaymentEffectiveStatus(id)…

## Seguridad
- **Candado staff (fail-closed):** solo `public.is_staff(auth.uid())=true` ejecuta. `service_role`
  bypassa RLS para escribir, por eso la función autoriza ella misma.
- ⚠️ **`FINANCIAL_ENGINE_TEST_BYPASS_STAFF="1"`** salta el candado — **SOLO para probar en
  mdjb-ensayo. NUNCA setearla en producción.**
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente.

## Desplegar (en mdjb-ensayo / PRUEBA)
```bash
# 1) enlazar el proyecto de prueba
supabase link --project-ref <ref-de-mdjb-ensayo>
# 2) bypass de prueba (SOLO prueba)
supabase secrets set FINANCIAL_ENGINE_TEST_BYPASS_STAFF=1
# 3) desplegar (sin verify_jwt para poder probar con curl)
supabase functions deploy financial-engine --no-verify-jwt
```

## Probar (curl)
Sustituye `<REF>` y `<ANON_KEY>` (Project Settings → API):
```bash
URL="https://<REF>.supabase.co/functions/v1/financial-engine"
H="-H apikey:<ANON_KEY> -H Content-Type:application/json"

# salud
curl -s $H "$URL" -d '{"action":"health"}'

# comando: registrar un cobro de $350 y confirmarlo
curl -s $H "$URL" -d '{"action":"command","name":"recordPayment","input":{"direction":"INFLOW","amountCents":35000,"currency":"USD","method":"ZELLE","paymentDate":"2026-08-08"}}'
# (toma el id del resultado y confírmalo)
curl -s $H "$URL" -d '{"action":"command","name":"confirmPayment","input":{"paymentId":"<ID>"}}'

# consulta: caja
curl -s $H "$URL" -d '{"action":"query","name":"getNetCash","args":[]}'
```
Cada comando escribe de verdad en las 13 tablas de mdjb-ensayo. La consulta lee lo
persistido → la BD y el motor cuadran **en vivo** (no solo seed).

## Producción (Fase 6, gate del PO)
- NO setear el bypass. La función exige staff real (`is_staff`).
- Confirmar el nombre del argumento de `is_staff` en prod (aquí el stub usa `uid`);
  si difiere, ajustar la línea `svc.rpc("is_staff", { uid })`.
- Desplegar con verify_jwt activo.
