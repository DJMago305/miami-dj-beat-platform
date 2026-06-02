/**
 * create-platform-account
 * ─────────────────────────────────────────────────────────────────────────────
 * Crea una cuenta en Supabase Auth via admin.generateLink (tipo 'invite') e
 * inserta el perfil inicial en la tabla correspondiente usando service role.
 *
 * generateLink → crea el usuario + devuelve action_link (sin depender de SMTP).
 * Localhost: el Owner copia el link y lo envía por WhatsApp/chat.
 * Producción con SMTP: el correo se entrega automáticamente.
 *
 * GATE: solo users con role = 'owner' en dj_profiles pueden invocarla.
 * Usa --no-verify-jwt en local (la función valida el JWT manualmente).
 *
 * ── Matriz de ruteo ──────────────────────────────────────────────────────────
 *  manager           → dj_profiles    { role:'manager', is_premium:true, subscription_status:'active' }
 *  seller            → dj_profiles    { role:'seller',  is_premium:true, subscription_status:'active' }
 *  artist            → dj_profiles    { role:'talent',  mdj_artist_commercial_tier:0, plan:'lite' }
 *  client            → client_profiles
 *  commercial_client → client_profiles { is_commercial:true, company_name, venue_type }
 *
 * ── Respuesta ────────────────────────────────────────────────────────────────
 *  { success:true, user_id, email, action_link }
 *  { error: string }
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ── Env ── */
const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")            ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")        ?? "";
const SITE_URL         = (Deno.env.get("SITE_URL") ?? "https://miamidjbeat.com").replace(/\/$/, "");

/* ── CORS — permite localhost y el dominio de producción ── */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ── Admin client (service role — nunca viaja al cliente) ── */
const adminSb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const VALID_TYPES = new Set(["manager", "seller", "client", "commercial_client", "artist"]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    /* ─── GATE: verificar que el caller es owner ─────────────────────────── */
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "No autenticado." }, 401);

    /* Validar JWT manualmente con el cliente anon (aplica RLS correctamente) */
    const callerSb = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth:   { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: callerErr } = await callerSb.auth.getUser();
    if (callerErr || !caller?.id) return json({ error: "Token inválido o sesión expirada." }, 401);

    const { data: callerProfile, error: profileErr } = await adminSb
      .from("dj_profiles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (profileErr || !callerProfile || callerProfile.role !== "owner") {
      return json({ error: "Acceso denegado. Solo el Owner puede crear cuentas." }, 403);
    }

    /* ─── Validar body ───────────────────────────────────────────────────── */
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const email        = String(body.email       ?? "").trim();
    const full_name    = String(body.full_name   ?? "").trim();
    const account_type = String(body.account_type ?? "").trim();
    const phone        = body.phone      ? String(body.phone).trim()      : null;
    const dj_name      = body.dj_name    ? String(body.dj_name).trim()    : null;
    const city         = body.city       ? String(body.city).trim()       : null;
    const notes        = body.notes      ? String(body.notes).trim()      : null;
    const plan_tier    = Number(body.plan_tier ?? 0) || 0;
    const biz_name     = body.biz_name   ? String(body.biz_name).trim()   : null;
    const venue_type   = body.venue_type ? String(body.venue_type).trim() : null;

    if (!email || !full_name || !account_type) {
      return json({ error: "email, full_name y account_type son obligatorios." }, 400);
    }
    if (!VALID_TYPES.has(account_type)) {
      return json({ error: "account_type inválido. Valores: manager|seller|client|commercial_client|artist." }, 400);
    }
    if (account_type === "artist" && !dj_name) {
      return json({ error: "dj_name es obligatorio para cuentas de artista." }, 400);
    }
    if (account_type === "commercial_client" && !biz_name) {
      return json({ error: "biz_name (nombre del negocio) es obligatorio para clientes comerciales." }, 400);
    }

    /* ─── Generar link de invitación ─────────────────────────────────────── */
    const redirectTo = `${SITE_URL}/auth.html?invited=1&type=${account_type}`;

    const { data: linkData, error: linkError } = await adminSb.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: {
          full_name,
          account_type,
          created_by_id:   caller.id,
          created_by_name: "Miami DJ Beat · Owner",
        },
      },
    });

    let newUserId: string | null    = linkData?.user?.id        ?? null;
    let actionLink: string | null   = linkData?.properties?.action_link ?? null;

    /* ── Fallback: email ya existía → buscar el user_id y continuar ── */
    if (linkError && !newUserId) {
      const isDuplicate =
        linkError.message?.toLowerCase().includes("already") ||
        linkError.message?.toLowerCase().includes("duplicate") ||
        linkError.message?.toLowerCase().includes("registered") ||
        linkError.code === "email_exists";

      if (isDuplicate) {
        /* Buscar por email en auth.users via admin listUsers con filtro */
        const { data: usersPage } = await adminSb.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existing = usersPage?.users?.find((u) => u.email === email);
        if (existing) {
          newUserId  = existing.id;
          actionLink = null; // usuario ya existe, no hay nuevo link
        } else {
          return json({ error: "Email ya registrado pero no encontrado. Contacta soporte." }, 409);
        }
      } else {
        return json({ error: linkError.message }, 400);
      }
    }

    /* ─── Insertar perfil inicial (inmediato, sin esperar activación) ────── */
    if (newUserId) {
      const now = new Date().toISOString();

      if (account_type === "client" || account_type === "commercial_client") {
        /* ── Cliente / Cliente Comercial → client_profiles ── */
        await adminSb.from("client_profiles").upsert(
          {
            user_id:             newUserId,
            email,
            full_name,
            phone,
            notes,
            /* Campos exclusivos de cliente comercial (B2B) */
            ...(account_type === "commercial_client" && {
              company_name:      biz_name,
              venue_type:        venue_type,
              is_commercial:     true,
            }),
            created_at: now,
          },
          { onConflict: "user_id" }
        );

      } else {
        /* ── Staff / Artista → dj_profiles ── */
        const isStaff = account_type === "manager" || account_type === "seller";
        const djRole  = account_type === "artist" ? "talent" : account_type;
        const tier    = account_type === "artist"  ? plan_tier : 0;
        const plan    = account_type === "artist"
          ? (tier === 0 ? "lite" : tier === 1 ? "pro" : "elite")
          : null;

        await adminSb.from("dj_profiles").upsert(
          {
            user_id:    newUserId,
            email,
            full_name,
            dj_name:    account_type === "artist" ? (dj_name ?? full_name) : full_name,
            stage_name: account_type === "artist" ? dj_name : null,
            phone,
            city,
            notes,
            role: djRole,

            /* Staff operativo: acceso completo sin pasarela de pago */
            is_premium:                  isStaff ? true : false,
            subscription_status:         isStaff ? "active" : "inactive",

            /* Artista: tier LITE por defecto */
            mdj_artist_commercial_tier:  tier,
            plan,

            available:  false,
            created_at: now,
          },
          { onConflict: "user_id" }
        );
      }
    }

    /* ─── Respuesta — incluye action_link para bypass en localhost ───────── */
    return json({ success: true, user_id: newUserId, email, action_link: actionLink });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[create-platform-account]", msg);
    return json({ error: msg }, 500);
  }
});
