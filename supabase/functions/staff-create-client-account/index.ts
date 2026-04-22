// staff-create-client-account — solo equipo con fila dj_profiles: owner | admin (dueño) | manager | seller (comisión / ventas).
// No basta JWT/metadata: debe existir rol operativo en dj_profiles. verify_jwt = true.
// verify_jwt = true. Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COMMISSION_STAFF_ROLES = new Set(["admin", "owner", "manager", "seller"]);

/** Solo quien tiene dj_profiles con rol de dueño, gestión o ventas/comisión (no talento ni cliente). */
async function isCommissionStaffDj(userId: string): Promise<boolean> {
  const { data, error } = await sb.from("dj_profiles").select("role").eq("user_id", userId).maybeSingle();
  if (error || !data) return false;
  const r = String(data.role ?? "").toLowerCase().trim();
  return COMMISSION_STAFF_ROLES.has(r);
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** GoTrue-friendly length; includes upper, lower, digit, symbol. */
function randomTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digit = "23456789";
  const sym = "!@#$%&*";
  const all = upper + lower + digit + sym;
  const buf = new Uint8Array(18);
  crypto.getRandomValues(buf);
  let out = "";
  out += upper[buf[0] % upper.length];
  out += lower[buf[1] % lower.length];
  out += digit[buf[2] % digit.length];
  out += sym[buf[3] % sym.length];
  for (let i = 4; i < 18; i++) {
    out += all[buf[i] % all.length];
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) {
      return new Response(JSON.stringify({ ok: false, error: "missing_authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: caller }, error: cErr } = await sb.auth.getUser(jwt);
    if (cErr || !caller?.id) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const staffOk = await isCommissionStaffDj(caller.id);
    if (!staffOk) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden_not_staff" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      email?: string;
      full_name?: string | null;
      phone?: string | null;
      client_authorized?: boolean;
    };

    if (body.client_authorized !== true) {
      return new Response(JSON.stringify({ ok: false, error: "client_authorized_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "email_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const full_name = body.full_name == null ? null : String(body.full_name).trim() || null;
    const phone = body.phone == null ? null : String(body.phone).trim().slice(0, 40) || null;

    const tempPassword = randomTempPassword();

    const { data: created, error: uErr } = await sb.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        user_type: "client",
        ...(full_name ? { full_name } : {}),
        ...(phone ? { phone } : {}),
      },
      app_metadata: { role: "client" },
    });

    if (uErr || !created?.user?.id) {
      const msg = String(uErr?.message ?? "");
      console.warn("[staff-create-client-account] createUser", uErr);
      if (/already|registered|exists|duplicate/i.test(msg)) {
        return new Response(JSON.stringify({ ok: false, error: "email_already_registered" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: false, error: "create_user_failed", detail: msg.slice(0, 200) }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uid = created.user.id;

    const { error: pErr } = await sb.from("client_profiles").insert([
      {
        user_id: uid,
        email,
        full_name,
        phone,
      },
    ]);

    if (pErr) {
      console.error("[staff-create-client-account] profile insert", pErr);
      try {
        await sb.auth.admin.deleteUser(uid);
      } catch (_) {
        /* best effort */
      }
      return new Response(JSON.stringify({ ok: false, error: "profile_insert_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: uid, temp_password: tempPassword }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[staff-create-client-account]", e);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
