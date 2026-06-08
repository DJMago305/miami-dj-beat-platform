// MDJPRO desktop activate — thin Edge wrapper → mdjpro_activate_device (service_role RPC).
// Deploy: supabase functions deploy mdj-activate --no-verify-jwt
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Never log license_key, hwid_hash, or full device_fingerprint.

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

type ActivateBody = {
  license_key?: string;
  device_fingerprint?: string;
  hwid_hash?: string;
  device_label?: string;
  app_version?: string;
  os_version?: string;
};

type RpcResult = Record<string, unknown> | null;

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

function newRequestId(): string {
  return crypto.randomUUID();
}

function auditLog(requestId: string, status: string, reason: string): void {
  console.log(
    `[MDJPRO] mdj-activate | request_id=${requestId} | status=${status} | reason=${reason}`,
  );
}

function auditError(requestId: string, status: string, reason: string): void {
  console.error(
    `[MDJPRO] mdj-activate | request_id=${requestId} | status=${status} | reason=${reason}`,
  );
}

function httpStatusForReason(reason: string): number {
  switch (reason) {
    case "forbidden":
      return 403;
    case "rate_limited":
      return 429;
    case "invalid_key":
    case "invalid_fingerprint":
      return 400;
    case "license_revoked":
    case "license_suspended":
    case "license_expired":
    case "lease_revoked":
    case "lease_fingerprint_mismatch":
    case "lease_expired":
      return 403;
    case "seats_exhausted":
      return 409;
    case "lease_not_found":
      return 404;
    case "lease_id_generation_failed":
      return 500;
    default:
      return 400;
  }
}

serve(async (req) => {
  const requestId = newRequestId();
  const { headers: corsHeaders, allowed: corsAllowed } = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    if (!corsAllowed) {
      auditLog(requestId, "rejected", "origin_not_allowed");
      return jsonResponse({ ok: false, reason: "origin_not_allowed" }, 403, corsHeaders);
    }
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    auditLog(requestId, "rejected", "method_not_allowed");
    return jsonResponse({ ok: false, reason: "method_not_allowed" }, 405, corsHeaders);
  }

  if (!corsAllowed) {
    auditLog(requestId, "rejected", "origin_not_allowed");
    return jsonResponse({ ok: false, reason: "origin_not_allowed" }, 403, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    auditError(requestId, "error", "server_misconfigured");
    return jsonResponse({ ok: false, reason: "server_misconfigured" }, 500, corsHeaders);
  }

  let body: ActivateBody;
  try {
    body = await req.json();
  } catch {
    auditLog(requestId, "rejected", "invalid_json");
    return jsonResponse({ ok: false, reason: "invalid_json" }, 400, corsHeaders);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    auditLog(requestId, "rejected", "invalid_body");
    return jsonResponse({ ok: false, reason: "invalid_body" }, 400, corsHeaders);
  }

  const licenseKey = optionalText(body.license_key);
  const deviceFingerprint = optionalText(body.device_fingerprint);

  if (!licenseKey) {
    auditLog(requestId, "rejected", "license_key_required");
    return jsonResponse({ ok: false, reason: "license_key_required" }, 400, corsHeaders);
  }

  if (!deviceFingerprint) {
    auditLog(requestId, "rejected", "device_fingerprint_required");
    return jsonResponse(
      { ok: false, reason: "device_fingerprint_required" },
      400,
      corsHeaders,
    );
  }

  const clientIp = extractClientIp(req);
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase.rpc("mdjpro_activate_device", {
    p_license_key: licenseKey,
    p_device_fingerprint: deviceFingerprint,
    p_hwid_hash: optionalText(body.hwid_hash),
    p_device_label: optionalText(body.device_label),
    p_app_version: optionalText(body.app_version),
    p_os_version: optionalText(body.os_version),
    p_client_ip: clientIp,
  });

  if (error) {
    auditError(requestId, "error", "rpc_error");
    return jsonResponse({ ok: false, reason: "internal_error" }, 500, corsHeaders);
  }

  const result = data as RpcResult;

  if (!result || typeof result !== "object") {
    auditError(requestId, "error", "rpc_empty");
    return jsonResponse({ ok: false, reason: "internal_error" }, 500, corsHeaders);
  }

  if (result.ok === true) {
    auditLog(requestId, "ok", "activate_ok");
    return jsonResponse(result, 200, corsHeaders);
  }

  const reason = typeof result.reason === "string" ? result.reason : "unknown";
  auditLog(requestId, "rejected", reason);
  return jsonResponse(result, httpStatusForReason(reason), corsHeaders);
});
