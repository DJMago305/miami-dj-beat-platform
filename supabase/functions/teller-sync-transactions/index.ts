// supabase/functions/teller-sync-transactions/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Trae los movimientos reales de cada cuenta ya conectada (public.bank_accounts)
// y los guarda en public.bank_transactions. Pensado para llamarse a demanda
// desde Cash Flow Master (botón "Actualizar") y, más adelante, por cron.
//
// Mismos Secrets requeridos que teller-store-enrollment (TELLER_CERT_PEM /
// TELLER_CERT_KEY_PEM) -- si faltan, responde TELLER_NOT_CONFIGURED en vez de
// fallar oscuro. Mismo candado de rol (owner/admin/manager) -- dinero real de
// la empresa, nunca de un artista individual.
//
// Idempotente: upsert por teller_transaction_id, así que llamarlo varias
// veces seguidas nunca duplica movimientos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELLER_API = "https://api.teller.io";

function tellerHttpClient(): Deno.HttpClient | null {
  const cert = Deno.env.get("TELLER_CERT_PEM");
  const key = Deno.env.get("TELLER_CERT_KEY_PEM");
  if (!cert || !key) return null;
  return Deno.createHttpClient({ cert, key });
}

async function tellerFetch(path: string, accessToken: string, client: Deno.HttpClient) {
  const res = await fetch(`${TELLER_API}${path}`, {
    headers: { Authorization: "Basic " + btoa(`${accessToken}:`) },
    client,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Teller ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const svc = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) return json({ ok: false, error: "NO_SESSION" }, 401);
    const { data: prof, error: profErr } = await svc.from("dj_profiles").select("role").eq("user_id", uid).maybeSingle();
    if (profErr) return json({ ok: false, error: "ROLE_CHECK_FAILED", detail: profErr.message }, 500);
    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (!new Set(["owner", "admin", "manager"]).has(role)) {
      return json({ ok: false, error: "NOT_MANAGEMENT", detail: role || "sin_rol" }, 403);
    }

    const client = tellerHttpClient();
    if (!client) {
      return json({ ok: false, error: "TELLER_NOT_CONFIGURED", detail: "Faltan TELLER_CERT_PEM / TELLER_CERT_KEY_PEM como Secrets." }, 501);
    }

    const { data: accounts, error: accErr } = await svc
      .from("bank_accounts")
      .select("id, teller_account_id, access_token")
      .eq("active", true);
    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return json({ ok: false, error: "NO_ACCOUNTS_CONNECTED", detail: "Todavía no hay ninguna cuenta conectada en bank_accounts." }, 404);
    }

    let totalSynced = 0;
    const perAccount: Record<string, number> = {};

    for (const acc of accounts) {
      const txns = await tellerFetch(`/accounts/${acc.teller_account_id}/transactions`, acc.access_token, client);
      if (!Array.isArray(txns)) continue;

      const rows = txns.map((t: any) => {
        const amount = Number(t.amount);
        return {
          bank_account_id: acc.id,
          teller_transaction_id: t.id,
          posted_date: t.date,
          description: t.description ?? null,
          amount_cents: Math.round(Math.abs(amount) * 100),
          direction: amount < 0 ? "debit" : "credit",
          category: t.details?.category ?? null,
          raw: t,
        };
      });

      if (rows.length) {
        const { error: upErr } = await svc.from("bank_transactions").upsert(rows, { onConflict: "teller_transaction_id" });
        if (upErr) throw upErr;
      }
      perAccount[acc.teller_account_id] = rows.length;
      totalSynced += rows.length;
    }

    return json({ ok: true, accounts_synced: accounts.length, transactions_seen: totalSynced, per_account: perAccount });
  } catch (err) {
    return json({ ok: false, error: "UNEXPECTED", detail: String((err as Error)?.message || err) }, 500);
  }
});
