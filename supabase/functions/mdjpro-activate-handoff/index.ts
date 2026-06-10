// MDJPRO Caso A — consume install handoff + activate device (no license key in client).
// Deploy: supabase functions deploy mdjpro-activate-handoff --no-verify-jwt
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

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

type HandoffBody = {
  handoff_token?: string;
  device_fingerprint?: string;
  hwid_hash?: string;
  device_label?: string;
  app_version?: string;
  os_version?: string;
};

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

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function extractClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return null;
}

function httpStatusForReason(reason: string): number {
  switch (reason) {
    case "forbidden":
      return 403;
    case "rate_limited":
      return 429;
    case "handoff_expired":
    case "handoff_already_used":
    case "handoff_invalid":
      return 410;
    case "license_suspended":
    case "license_revoked":
    case "license_expired":
      return 403;
    case "seats_exhausted":
      return 409;
    default:
      return 400;
  }
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
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500, corsHeaders);
  }

  let body: HandoffBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, reason: "invalid_json" }, 400, corsHeaders);
  }

  const handoffToken = optionalText(body.handoff_token);
  const deviceFingerprint = optionalText(body.device_fingerprint);

  if (!handoffToken) {
    return jsonResponse({ ok: false, reason: "handoff_token_required" }, 400, corsHeaders);
  }

  if (!deviceFingerprint) {
    return jsonResponse({ ok: false, reason: "device_fingerprint_required" }, 400, corsHeaders);
  }

  const clientIp = extractClientIp(req);
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase.rpc("mdjpro_consume_install_handoff", {
    p_handoff_token: handoffToken,
    p_device_fingerprint: deviceFingerprint,
    p_hwid_hash: optionalText(body.hwid_hash),
    p_device_label: optionalText(body.device_label),
    p_app_version: optionalText(body.app_version),
    p_os_version: optionalText(body.os_version),
    p_client_ip: clientIp,
  });

  if (error) {
    console.error("[MDJPRO] mdjpro-activate-handoff rpc_error");
    return jsonResponse({ ok: false, reason: "internal_error" }, 500, corsHeaders);
  }

  const result = data as Record<string, unknown> | null;
  if (!result || result.ok !== true) {
    const reason = typeof result?.reason === "string" ? result.reason : "unknown";
    console.log(`[MDJPRO] mdjpro-activate-handoff rejected | reason=${reason}`);
    return jsonResponse(result ?? { ok: false, reason }, httpStatusForReason(reason), corsHeaders);
  }

  console.log("[MDJPRO] mdjpro-activate-handoff ok");
  return jsonResponse(result, 200, corsHeaders);
});
