// ══════════════════════════════════════════════════════════════════════
// financial-engine — Edge Function (Supabase / Deno)
// Corre el motor financiero canónico T009 del lado SERVIDOR y persiste en
// las 13 tablas financial_. Autoridad del lado servidor (RLS-safe): usa
// service_role para escribir, pero SOLO tras verificar que el llamador es
// staff (mismo candado que el RLS). Es también el punto donde ELIXIS se
// conectará (Fase 5): expone commands + queries del motor.
//
// Contrato HTTP (POST, JSON):
//   { "action":"command", "name":"recordPayment", "input":{...} }
//   { "action":"query",   "name":"getNetCash",   "args":[...] }
//   { "action":"health" }
// Respuesta: { ok, data | result | error }
// ══════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "./mdj-financial-local-services.js"; // side-effect: attach a globalThis
import { loadStore, persistStore } from "./mapping.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Motor (una sola instancia; el store se pasa por request = stateless)
const G = globalThis as any;
if (!G.MDJFinancialLocalServices) throw new Error("motor T009 no cargó en globalThis");
const engine = G.MDJFinancialLocalServices.createLocalFinancialServices();

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "health") return json({ ok: true, engine: "T009", tables: 13 });

    // 1) Candado: el llamador debe ser staff (fail-closed). service_role bypassa
    //    RLS, así que la función es la que debe autorizar. ⚠️ SOLO PRUEBA: la
    //    variable FINANCIAL_ENGINE_TEST_BYPASS_STAFF="1" salta el candado para
    //    poder probar en mdjb-ensayo sin montar auth. NUNCA setearla en producción.
    const svc = createClient(SUPABASE_URL, SERVICE_KEY); // service_role (bypass RLS)
    const TEST_BYPASS = Deno.env.get("FINANCIAL_ENGINE_TEST_BYPASS_STAFF") === "1";
    if (!TEST_BYPASS) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userRes } = await userClient.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) return json({ ok: false, error: "NO_SESSION" }, 401);
      // Rol directo (INCLUYE owner — is_staff de V1 lo excluye). Mismo criterio que elixis-chat.
      const { data: prof, error: profErr } = await svc.from("dj_profiles").select("role").eq("user_id", uid).maybeSingle();
      if (profErr) return json({ ok: false, error: "ROLE_CHECK_FAILED", detail: profErr.message }, 500);
      const role = String(prof?.role ?? "").toLowerCase().trim();
      if (!new Set(["owner", "admin", "manager", "seller"]).has(role)) {
        return json({ ok: false, error: "NOT_STAFF", detail: role || "sin_rol" }, 403);
      }
    }

    // 1.5) IMPORT (Fase 3): residency_schedule real -> venues + agreements canónicos.
    //      Idempotente: dedup por nombre de venue y por (venue+título) de agreement.
    if (body.action === "import_residencies") {
      const { data: rows, error } = await svc.from("residency_schedule").select("*").eq("active", true);
      if (error) return json({ ok: false, error: "read_residency_failed", detail: error.message }, 500);
      let store = await loadStore(svc);
      const now = () => new Date().toISOString();
      const idg = () => crypto.randomUUID();
      let venuesCreated = 0, agreementsCreated = 0;
      for (const r of (rows ?? [])) {
        let venue = store.venues.find((v: any) => v.name === r.venue);
        if (!venue) {
          const out = engine.commands.createVenue(store, { name: r.venue, now: now(), idGenerator: idg, idempotencyKey: crypto.randomUUID() });
          if (!(out.result && out.result.ok)) continue;
          store = out.store; venue = out.result.data; venuesCreated++;
        }
        const title = `Residencia ${r.shift} · ${r.venue}`;
        if (!store.venueAgreements.find((a: any) => a.venueId === venue.id && a.title === title)) {
          const rateCents = Math.round(Number(r.venue_pay_usd || 0) * 100);
          const out = engine.commands.createVenueAgreement(store, {
            venueId: venue.id, title, frequency: "WEEKLY",
            scheduledDays: [r.shift === "noche" ? "friday" : "saturday"],
            rateByDay: rateCents > 0 ? { [r.shift]: rateCents } : {},
            effectiveFrom: String(r.created_at || now()).slice(0, 10),
            now: now(), idGenerator: idg, idempotencyKey: crypto.randomUUID(),
          });
          if (out.result && out.result.ok) { store = out.store; agreementsCreated++; }
        }
      }
      await persistStore(svc, store);
      return json({ ok: true, imported: { residencies: (rows ?? []).length, venuesCreated, agreementsCreated } });
    }

    // 2) Hidratar el store desde las 13 tablas
    const store = await loadStore(svc);

    // 3) COMMAND: correr + (si ok) persistir
    if (body.action === "command") {
      const name = String(body.name || "");
      if (!engine.commands[name]) return json({ ok: false, error: "UNKNOWN_COMMAND", name }, 400);
      const input = {
        ...(body.input || {}),
        now: new Date().toISOString(),
        idGenerator: () => crypto.randomUUID(),
        idempotencyKey: (body.input && body.input.idempotencyKey) || crypto.randomUUID(),
      };
      const out = engine.commands[name](store, input);
      if (out.result && out.result.ok) await persistStore(svc, out.store);
      return json({ ok: !!(out.result && out.result.ok), result: out.result });
    }

    // 4) QUERY: leer del store hidratado
    if (body.action === "query") {
      const name = String(body.name || "");
      if (!engine.queries[name]) return json({ ok: false, error: "UNKNOWN_QUERY", name }, 400);
      const args = Array.isArray(body.args) ? body.args : [];
      const data = engine.queries[name](store, ...args);
      return json({ ok: true, data });
    }

    return json({ ok: false, error: "UNKNOWN_ACTION", action: body.action }, 400);
  } catch (e) {
    return json({ ok: false, error: "ENGINE_ERROR", detail: String(e && (e as Error).message || e) }, 500);
  }
});
