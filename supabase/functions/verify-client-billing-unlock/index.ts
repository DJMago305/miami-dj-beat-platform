// verify-client-billing-unlock — manager/admin proves they know the *client* account password to unlock billing UI in client-portal (manager mode).
// Uses password grant against GoTrue (tokens discarded). Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function isStaffFromJwt(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null): boolean {
  if (!user) return false;
  const a = String(user.app_metadata?.role ?? "").toLowerCase();
  const t = String(user.user_metadata?.user_type ?? "").toLowerCase();
  return a === "admin" || a === "manager" || t === "admin" || t === "manager";
}

async function isStaffFromDjProfiles(userId: string): Promise<boolean> {
  const { data } = await sb.from("dj_profiles").select("role").eq("user_id", userId).maybeSingle();
  const r = String(data?.role ?? "").toUpperCase();
  return r === "MANAGER" || r === "ADMIN";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "server_misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const managerJwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!managerJwt) {
      return new Response(JSON.stringify({ ok: false, error: "missing_authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user: manager }, error: mErr } = await sb.auth.getUser(managerJwt);
    if (mErr || !manager?.id) {
      return new Response(JSON.stringify({ ok: false, error: "invalid_manager_session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const staffOk = isStaffFromJwt(manager) || await isStaffFromDjProfiles(manager.id);
    if (!staffOk) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden_not_staff" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as { lead_id?: string; client_password?: string };
    const leadId = String(body.lead_id ?? "").trim();
    const clientPassword = String(body.client_password ?? "");
    if (!leadId || !clientPassword) {
      return new Response(JSON.stringify({ ok: false, error: "lead_id_and_client_password_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error: leadErr } = await sb
      .from("leads")
      .select("id, email")
      .eq("id", leadId)
      .maybeSingle();

    if (leadErr || !lead?.email) {
      return new Response(JSON.stringify({ ok: false, error: "lead_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String(lead.email).trim();
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "lead_missing_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenUrl = `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`;
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ email, password: clientPassword }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.warn("[verify-client-billing-unlock] password check failed", tokenRes.status, errText.slice(0, 200));
      return new Response(JSON.stringify({ ok: false, error: "invalid_client_password" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
