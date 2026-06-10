// MDJPRO Caso A — mint install handoff for logged-in Pro MDJB user.
// Deploy: supabase functions deploy mdjpro-install-handoff
// Auth: user JWT (Authorization bearer). Returns handoff_token once — never log it.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const ALLOWED_ORIGINS = [
  "https://miamidjbeat.com",
  "https://www.miamidjbeat.com",
  "https://miamidjbeat.vercel.app",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://127.0.0.1:8080",
];

function buildCorsHeaders(req: Request): { headers: Record<string, string>; allowed: boolean } {
  const origin = req.headers.get("origin") ?? "";
  if (!origin) {
    return { headers: { Vary: "Origin" }, allowed: true };
  }
  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        Vary: "Origin",
      },
      allowed: true,
    };
  }
  return { headers: { Vary: "Origin" }, allowed: false };
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const { headers: corsHeaders, allowed: corsAllowed } = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    if (!corsAllowed) {
      return jsonResponse({ ok: false, reason: "origin_not_allowed" }, 403, corsHeaders);
    }
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405, corsHeaders);
  }

  if (!corsAllowed) {
    return jsonResponse({ ok: false, reason: "origin_not_allowed" }, 403, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authHeader = req.headers.get("authorization") ?? "";

  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500, corsHeaders);
  }

  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ ok: false, reason: "auth_required" }, 401, corsHeaders);
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return jsonResponse({ ok: false, reason: "auth_invalid" }, 401, corsHeaders);
  }

  const { data, error } = await supabase.rpc("mdjpro_create_install_handoff", {
    p_uid: userData.user.id,
  });

  if (error) {
    console.error("[MDJPRO] mdjpro-install-handoff rpc_error");
    return jsonResponse({ ok: false, reason: "internal_error" }, 500, corsHeaders);
  }

  const result = data as Record<string, unknown> | null;
  if (!result || result.ok !== true) {
    const reason = typeof result?.reason === "string" ? result.reason : "unknown";
    const status = reason === "not_premium" ? 403 : reason === "forbidden" ? 403 : 400;
    console.log(`[MDJPRO] mdjpro-install-handoff rejected | reason=${reason}`);
    return jsonResponse(result ?? { ok: false, reason }, status, corsHeaders);
  }

  console.log(
    `[MDJPRO] mdjpro-install-handoff ok | user=${userData.user.id.slice(0, 8)} | has_display=${Boolean(result.license_display)}`,
  );

  return jsonResponse(
    {
      ok: true,
      version: 1,
      handoff_token: result.handoff_token,
      email: result.email,
      stage_name: result.stage_name,
      license_display: result.license_display,
      expires_at: result.expires_at,
    },
    200,
    corsHeaders,
  );
});
