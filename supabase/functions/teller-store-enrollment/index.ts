// supabase/functions/teller-store-enrollment/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// "Pista de aterrizaje" para el banco real de la empresa (Chase, vía Teller).
// Teller Connect (widget del lado cliente) entrega el accessToken directo en
// el navegador al terminar el enrollment -- ese token NUNCA debe quedarse en
// el cliente ni usarse desde ahí. Este endpoint lo recibe UNA vez, confirma
// las cuentas reales contra la API de Teller (mTLS), y lo guarda en
// public.bank_accounts -- de ahí en adelante solo Edge Functions lo tocan.
//
// Requiere, como Secrets del proyecto (Supabase → Settings → Edge Functions):
//   TELLER_CERT_PEM      -- certificado del Teller Dashboard (contenido del .pem)
//   TELLER_CERT_KEY_PEM  -- llave privada del mismo certificado
// Sin esos dos, la función responde TELLER_NOT_CONFIGURED en vez de fallar
// oscuro -- así se sabe exactamente qué falta cuando llegue el acceso.
//
// Solo gestión (owner/admin/manager) puede invocar esto -- es dinero real de
// la empresa, nunca un artista individual. Mismo candado de rol que
// financial-engine.

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
const TELLER_ENV = Deno.env.get("TELLER_ENV") || "development"; // "development" real, gratis hasta 100 enrollments
const TELLER_API = "https://api.teller.io";

function tellerHttpClient(): Deno.HttpClient | null {
  const cert = Deno.env.get("TELLER_CERT_PEM");
  const key = Deno.env.get("TELLER_CERT_KEY_PEM");
  if (!cert || !key) return null;
  // Teller exige mTLS para cualquier llamado que toque datos reales de un
  // usuario (development o production) -- sandbox es el único caso sin esto.
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

    // 1) Candado de rol -- mismo criterio que financial-engine.
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

    const body = await req.json().catch(() => ({}));
    const accessToken = String(body.accessToken || "");
    const enrollmentId = String(body.enrollmentId || "");
    if (!accessToken || !enrollmentId) {
      return json({ ok: false, error: "MISSING_FIELDS", detail: "accessToken y enrollmentId son requeridos." }, 400);
    }

    // 2) Confirmar las cuentas reales contra la API de Teller antes de guardar
    //    nada -- nunca confiar ciegamente en lo que llega del navegador.
    const accounts = await tellerFetch("/accounts", accessToken, client);
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return json({ ok: false, error: "NO_ACCOUNTS", detail: "Teller no devolvió cuentas para este enrollment." }, 502);
    }

    const saved: unknown[] = [];
    for (const acc of accounts) {
      const { data: row, error } = await svc
        .from("bank_accounts")
        .upsert(
          {
            provider: "teller",
            enrollment_id: enrollmentId,
            teller_account_id: acc.id,
            institution_name: acc.institution?.name ?? null,
            account_name: acc.name ?? null,
            account_type: acc.type ?? null,
            last4: acc.last_four ?? null,
            access_token: accessToken,
            active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "teller_account_id" },
        )
        .select("id, institution_name, account_name, last4")
        .single();
      if (error) throw error;
      saved.push(row);
    }

    return json({ ok: true, env: TELLER_ENV, accounts: saved });
  } catch (err) {
    return json({ ok: false, error: "UNEXPECTED", detail: String((err as Error)?.message || err) }, 500);
  }
});
