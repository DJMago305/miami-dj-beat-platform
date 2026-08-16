// supabase/functions/elixis-orchestrator/index.ts
// R11 / IA rule 1 — intent router. Does not call tools or mutate records.
// Classifies the staff message, then forwards the original request to elixis-chat.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
);
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "seller"]);

async function verifyStaff(
    req: Request,
): Promise<{ ok: true; userId: string; name: string; role: string } | { ok: false; status: number; error: string; detail?: string }> {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!jwt) return { ok: false, status: 401, error: "missing_authorization" };
    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return { ok: false, status: 401, error: "invalid_session" };
    const { data: prof } = await ADMIN
        .from("dj_profiles").select("role,stage_name,dj_name,full_name").eq("user_id", user.id).maybeSingle();
    const role = String(prof?.role ?? "").toLowerCase().trim();
    if (!ALLOWED_ROLES.has(role)) {
        return { ok: false, status: 403, error: "forbidden_not_staff", detail: role || "sin_rol" };
    }
    const name = String(prof?.stage_name || prof?.dj_name || prof?.full_name || "").trim();
    return { ok: true, userId: user.id, name, role };
}

const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com",
    "https://www.miamidjbeat.com",
    "https://miamidjbeat.vercel.app",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://127.0.0.1:8080",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
];

function buildCorsHeaders(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

const _ipWindow = new Map<string, number[]>();
const RATE_LIMIT = 20;
const WINDOW_MS = 60_000;

function isRateLimited(req: Request): boolean {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const now = Date.now();
    const hits = (_ipWindow.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    hits.push(now);
    _ipWindow.set(ip, hits);
    return hits.length > RATE_LIMIT;
}

type Intent = "finance" | "lead_note" | "general";

function classifyIntent(message: string): Intent {
    const t = message.toLowerCase();
    if (
        /crear_nota_lead/.test(t) ||
        (/\b(nota|note)\b/.test(t) && /\b(lead|solicitud)\b/.test(t))
    ) {
        return "lead_note";
    }
    if (
        /finanza|caja neta|por cobrar|por pagar|getnetcash|cash ?inflow|cash ?outflow|ingresos cobrados|egresos pagados|cuentas por/.test(t)
    ) {
        return "finance";
    }
    return "general";
}

const SPECIALIST: Record<Intent, string> = {
    finance: "elixis",
    lead_note: "elixis",
    general: "elixis",
};

function specialistUrl(): string {
    const explicit = (Deno.env.get("ELIXIS_CHAT_URL") ?? "").trim();
    if (explicit) return explicit.replace(/\/$/, "");
    const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
    return base ? `${base}/functions/v1/elixis-chat` : "";
}

serve(async (req: Request) => {
    const cors = buildCorsHeaders(req);

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: cors });
    }
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (isRateLimited(req)) {
        return new Response(JSON.stringify({ error: "Too many requests. Try again in a moment." }),
            { status: 429, headers: { ...cors, "Content-Type": "application/json", "Retry-After": "60" } });
    }

    const gate = await verifyStaff(req);
    if (!gate.ok) {
        return new Response(
            JSON.stringify({ error: gate.error, detail: gate.detail }),
            { status: gate.status, headers: { ...cors, "Content-Type": "application/json" } },
        );
    }

    let body: { message?: unknown };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const userMessage = typeof body.message === "string" ? body.message.trim() : "";
    if (!userMessage || userMessage.length > 2000) {
        return new Response(JSON.stringify({ error: "Message missing or too long" }),
            { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const intent = classifyIntent(userMessage);
    const agent = SPECIALIST[intent];
    const dest = specialistUrl();
    if (!dest) {
        return new Response(JSON.stringify({ error: "specialist_unconfigured", agent, intent }),
            { status: 503, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

    let downstream: Response;
    try {
        downstream = await fetch(dest, {
            method: "POST",
            headers: {
                Authorization: authHeader,
                apikey: anon,
                "Content-Type": "application/json",
                "X-MDJ-Orchestrator": "elixis-orchestrator",
                "X-MDJ-Intent": intent,
            },
            body: JSON.stringify(body),
        });
    } catch (e) {
        console.error("[elixis-orchestrator] specialist fetch error:", e);
        return new Response(
            JSON.stringify({ error: "specialist_unreachable", agent, intent }),
            { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
        );
    }

    const text = await downstream.text();
    let payload: unknown;
    try {
        payload = text ? JSON.parse(text) : { error: "specialist_empty_response" };
    } catch {
        return new Response(
            JSON.stringify({ error: "specialist_invalid_response", agent, intent }),
            { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
        );
    }

    if (!downstream.ok) {
        const err = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
        return new Response(
            JSON.stringify({
                error: err.error ?? "specialist_error",
                detail: err.detail,
                agent,
                intent,
            }),
            { status: downstream.status, headers: { ...cors, "Content-Type": "application/json" } },
        );
    }

    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
            ...cors,
            "Content-Type": "application/json",
            "X-MDJ-Intent": intent,
            "X-MDJ-Agent": agent,
        },
    });
});
