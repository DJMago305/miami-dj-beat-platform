// supabase/functions/mdj-push-suscribir/index.ts
// Guarda el buzon de UN dispositivo que acaba de decir que si.
//
// A diferencia del SMS, aqui SI puede entrar cualquier usuario con sesion:
// un cliente se suscribe a sus propios avisos. Lo que no puede hacer es
// suscribir a otro -- el user_id sale del JWT verificado, nunca del cuerpo.
//
//   supabase functions deploy mdj-push-suscribir --project-ref hkuvuqupbxwkiykxvqdr --no-verify-jwt
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || "https://hkuvuqupbxwkiykxvqdr.supabase.co",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
);

const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com", "https://www.miamidjbeat.com", "https://miamidjbeat.vercel.app",
];
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function cors(req: Request) {
    const o = req.headers.get("origin") ?? "";
    return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(o) || LOCALHOST.test(o) ? o : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

// Solo se aceptan buzones de los tres servicios reales. Sin esto, cualquiera
// registra una URL suya y convierte la funcion en un emisor de peticiones.
const BUZONES = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)\//;

serve(async (req) => {
    const h = cors(req);
    const json = (b: unknown, s: number) =>
        new Response(JSON.stringify(b), { status: s, headers: { ...h, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response("ok", { headers: h });
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    const auth = req.headers.get("Authorization") ?? "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!jwt) return json({ ok: false, error: "missing_authorization" }, 401);
    const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
    if (error || !user?.id) return json({ ok: false, error: "invalid_session" }, 401);

    let c: Record<string, unknown>;
    try { c = await req.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }

    const endpoint = String(c?.endpoint ?? "");
    const p256dh = String(c?.p256dh ?? "");
    const llave = String(c?.auth ?? "");
    if (!BUZONES.test(endpoint)) return json({ ok: false, error: "endpoint_no_reconocido" }, 400);
    if (!p256dh || !llave) return json({ ok: false, error: "faltan_claves" }, 400);

    // Si el mismo dispositivo vuelve a suscribirse, se actualiza la fila en vez
    // de duplicarla: si no, el cliente recibiria el mismo aviso dos veces.
    const { error: err } = await ADMIN.from("push_suscripciones").upsert({
        user_id: user.id,
        endpoint,
        p256dh,
        auth: llave,
        agente: String(c?.agente ?? "").slice(0, 200) || null,
        fallos: 0,
    }, { onConflict: "endpoint" });

    if (err) {
        console.error("[mdj-push-suscribir]", err.message);
        return json({ ok: false, error: "no_se_pudo_guardar" }, 500);
    }
    return json({ ok: true }, 200);
});
