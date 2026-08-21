// supabase/functions/mdj-push-enviar/index.ts
// Manda un aviso a TODOS los dispositivos de un usuario.
//
// Este es el reemplazo del SMS para el cliente que YA reservo. No cuesta nada
// por mensaje y no pasa por operadoras -- que es lo que tenia bloqueado el SMS
// con el error 30032 desde marzo.
//
// Misma constitucion que el SMS: solo owner/staff dispara avisos en nombre de
// la empresa. Un artista no habla por Miami DJ Beat.
//
//   supabase functions deploy mdj-push-enviar --project-ref hkuvuqupbxwkiykxvqdr --no-verify-jwt
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarPush, type Suscripcion } from "../_shared/web-push.ts";

const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || "https://hkuvuqupbxwkiykxvqdr.supabase.co",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
);

const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "seller"]);
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

    const { data: prof } = await ADMIN
        .from("dj_profiles").select("role").eq("user_id", user.id).maybeSingle();
    const rol = String(prof?.role ?? "").toLowerCase().trim();
    if (!ALLOWED_ROLES.has(rol)) return json({ ok: false, error: "forbidden_not_staff", detail: rol || "sin_rol" }, 403);

    const publica = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const privada = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const sujeto = Deno.env.get("VAPID_SUBJECT") ?? "mailto:miamidjbeat@gmail.com";
    if (!publica || !privada) return json({ ok: false, error: "faltan_claves_vapid" }, 503);

    let c: Record<string, unknown>;
    try { c = await req.json(); } catch { return json({ ok: false, error: "json_invalido" }, 400); }

    // Acepta uno o muchos: {user_id} o {user_ids:[...]}. La difusion en masa
    // es el caso normal -- avisar a los DJs de un venue, o a los clientes de
    // los eventos de manana -- no la excepcion.
    const brutos: string[] = Array.isArray(c?.user_ids)
        ? (c.user_ids as unknown[]).map(String)
        : [String(c?.user_id ?? "")];
    const destinos = [...new Set(brutos)].filter((u) => /^[0-9a-f-]{36}$/i.test(u));

    if (!destinos.length) return json({ ok: false, error: "sin_destinatarios_validos" }, 400);
    // Tope de cordura: un lote mas grande que esto agota el tiempo de la
    // funcion a medias y deja a unos avisados y a otros no, sin saber quienes.
    if (destinos.length > 500) return json({ ok: false, error: "lote_demasiado_grande", maximo: 500 }, 400);

    const titulo = String(c?.titulo ?? "").trim();
    const mensaje = String(c?.mensaje ?? "").trim();
    if (!titulo || titulo.length > 100) return json({ ok: false, error: "titulo_invalido" }, 400);
    if (!mensaje || mensaje.length > 500) return json({ ok: false, error: "mensaje_invalido" }, 400);

    const { data: subs } = await ADMIN
        .from("push_suscripciones")
        .select("id, user_id, endpoint, p256dh, auth")
        .in("user_id", destinos);

    if (!subs?.length) {
        // Se dice claro, no se finge exito. Es la leccion del 30032: un
        // "enviado" sin destinatario es una mentira con buena cara.
        return json({
            ok: false, error: "sin_dispositivos",
            detalle: "Ninguno de esos usuarios ha aceptado avisos en ningun equipo.",
        }, 404);
    }

    const carga = {
        titulo, mensaje,
        url: String(c?.url ?? "/").slice(0, 300),
        tag: String(c?.tag ?? "").slice(0, 60) || undefined,
        ts: Date.now(),
    };

    // En PARALELO. En serie, 200 dispositivos a ~300ms cada uno son 60 segundos
    // y la funcion se corta por tiempo; a la vez son menos de dos.
    const tandas = await Promise.allSettled(subs.map((s) =>
        enviarPush(s as unknown as Suscripcion, carga, { publica, privada, sujeto })
            .then((r) => ({ ...r, id: s.id, user: s.user_id }))
    ));

    let entregados = 0;
    const muertos: string[] = [];
    const alcanzados = new Set<string>();
    for (const t of tandas) {
        if (t.status !== "fulfilled") { console.error("[mdj-push-enviar]", t.reason); continue; }
        if (t.value.ok) { entregados++; alcanzados.add(String(t.value.user)); }
        else if (t.value.muerto) muertos.push(t.value.id);
    }

    // Buzon que ya no existe se borra. Un dispositivo desinstalado no vuelve.
    if (muertos.length) await ADMIN.from("push_suscripciones").delete().in("id", muertos);

    // Se informa de QUIENES quedaron fuera. Un resumen que solo diga "180 de
    // 200" obliga a adivinar a quien hay que llamar por telefono.
    const sinAvisar = destinos.filter((d) => !alcanzados.has(d));

    return json({
        ok: entregados > 0,
        personas_avisadas: alcanzados.size,
        personas_pedidas: destinos.length,
        dispositivos_alcanzados: entregados,
        dispositivos_intentados: subs.length,
        limpiados: muertos.length,
        sin_avisar: sinAvisar,
    }, entregados > 0 ? 200 : 502);
});
