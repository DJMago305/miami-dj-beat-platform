// supabase/functions/mdj-avisos-despachar/index.ts
// Vacia el buzon de avisos: coge lo pendiente, redacta el texto y lo manda.
//
// Por que el texto se redacta AQUI y no en el trigger: cambiar como se le habla
// al cliente no deberia exigir una migracion de base de datos. El trigger solo
// guarda QUE paso; las palabras viven aqui.
//
// Se puede llamar de dos formas:
//   · con la clave de cron (cabecera x-mdj-cron)  -> automatico, cada pocos minutos
//   · con el JWT de un owner/staff                -> a mano, para probar o forzar
//
//   supabase functions deploy mdj-avisos-despachar --project-ref hkuvuqupbxwkiykxvqdr --no-verify-jwt
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarPush, type Suscripcion } from "../_shared/web-push.ts";

const ADMIN = createClient(
    Deno.env.get("SUPABASE_URL") || "https://hkuvuqupbxwkiykxvqdr.supabase.co",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
);

const ROLES_STAFF = new Set(["owner", "admin", "manager", "seller"]);

// CORS. Se me habia olvidado y el preflight moria con 405: la llamada desde el
// navegador ni llegaba a salir. Es la TERCERA vez que este mismo fallo se
// disfraza de "la logica no funciona".
// El localhost va por PATRON, nunca por puerto fijo: parchear un puerto suelto
// ya ha fallado antes cada vez que cambia el servidor de desarrollo.
const ORIGENES = [
    "https://miamidjbeat.com", "https://www.miamidjbeat.com", "https://miamidjbeat.vercel.app",
];
const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function cors(req: Request): Record<string, string> {
    const o = req.headers.get("origin") ?? "";
    return {
        "Access-Control-Allow-Origin": ORIGENES.includes(o) || LOCALHOST.test(o) ? o : ORIGENES[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mdj-cron",
        "Vary": "Origin",
    };
}

// ── LAS PALABRAS ──────────────────────────────────────────────────────────────
// Se le habla al cliente como a una persona, no como a un sistema: nada de
// "order_status = confirmed". Y no se promete lo que no se sabe.
function redactar(tipo: string, d: Record<string, unknown>) {
    const orden = String(d?.orden ?? "");
    const evento = String(d?.evento ?? "").trim();
    const fecha = String(d?.fecha ?? "");
    // La fecha llega como 2026-09-14. Se parte a mano: new Date() sobre una
    // fecha suelta la interpreta en UTC y en Miami sale el dia ANTERIOR.
    const p = fecha.split("-");
    const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio",
                   "agosto","septiembre","octubre","noviembre","diciembre"];
    const dia = p.length === 3 ? `${Number(p[2])} de ${MESES[Number(p[1]) - 1] ?? ""}` : "";
    const cual = evento || (orden ? `tu orden ${orden}` : "tu evento");

    switch (tipo) {
        case "orden_confirmada":
            return {
                titulo: "Evento confirmado",
                mensaje: dia ? `${cual} queda confirmado para el ${dia}.` : `${cual} queda confirmado.`,
                url: "/client-portal.html",
            };
        case "orden_cancelada":
            return {
                titulo: "Evento cancelado",
                mensaje: `Se cancelo ${cual}. Si no lo pediste tu, escribenos.`,
                url: "/client-portal.html",
            };
        case "deposito_recibido":
            return {
                titulo: "Deposito recibido",
                mensaje: `Recibimos tu deposito de ${cual}. Ya esta reservada la fecha.`,
                url: "/client-billing.html",
            };
        case "pago_completo":
            return {
                titulo: "Pago completo",
                mensaje: `${cual} queda pagado por completo. Gracias.`,
                url: "/client-billing.html",
            };
        default:
            return null;
    }
}

serve(async (req: Request) => {
    const h = cors(req);
    const json = (b: unknown, s: number) =>
        new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...h, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response("ok", { headers: h });
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

    // ── Quien puede vaciar el buzon ───────────────────────────────────────────
    const claveCron = Deno.env.get("MDJ_CRON_KEY") ?? "";
    const traeCron = req.headers.get("x-mdj-cron") ?? "";
    let autorizado = false;

    // Comparacion normal: la clave no se compara en tiempo constante porque el
    // atacante no puede medir nada util a traves de la red de Supabase, pero se
    // exige que exista y tenga largo suficiente para no aceptar "" == "".
    if (claveCron.length >= 20 && traeCron === claveCron) {
        autorizado = true;
    } else {
        const auth = req.headers.get("Authorization") ?? "";
        const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (jwt) {
            const { data: { user } } = await ADMIN.auth.getUser(jwt);
            if (user?.id) {
                const { data: prof } = await ADMIN
                    .from("dj_profiles").select("role").eq("user_id", user.id).maybeSingle();
                autorizado = ROLES_STAFF.has(String(prof?.role ?? "").toLowerCase().trim());
            }
        }
    }
    if (!autorizado) return json({ ok: false, error: "no_autorizado" }, 401);

    const publica = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const privada = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const sujeto = Deno.env.get("VAPID_SUBJECT") ?? "mailto:miamidjbeat@gmail.com";
    if (!publica || !privada) return json({ ok: false, error: "faltan_claves_vapid" }, 503);

    // Lote acotado: si se acumulan miles, se vacian en varias pasadas en vez de
    // agotar el tiempo de la funcion y no saber cuales quedaron a medias.
    const { data: cola } = await ADMIN
        .from("avisos_pendientes")
        .select("id, destinatario, tipo, datos, intentos")
        .eq("estado", "pendiente")
        .order("creado_en", { ascending: true })
        .limit(100);

    if (!cola?.length) return json({ ok: true, vaciados: 0, nota: "no habia nada pendiente" }, 200);

    let enviados = 0, sinDispositivo = 0, fallidos = 0;

    for (const aviso of cola) {
        const texto = redactar(aviso.tipo, (aviso.datos ?? {}) as Record<string, unknown>);
        if (!texto) {
            // Un tipo que no sabemos redactar no se queda dando vueltas en la
            // cola para siempre: se marca y se deja rastro del motivo.
            await ADMIN.from("avisos_pendientes").update({
                estado: "fallido", error: `tipo desconocido: ${aviso.tipo}`, enviado_en: new Date().toISOString(),
            }).eq("id", aviso.id);
            fallidos++;
            continue;
        }

        const { data: subs } = await ADMIN
            .from("push_suscripciones")
            .select("id, endpoint, p256dh, auth")
            .eq("user_id", aviso.destinatario);

        if (!subs?.length) {
            // No es un fallo: es un cliente que no activo los avisos. Se
            // distingue a proposito, para poder medir cuantos faltan por activar.
            await ADMIN.from("avisos_pendientes").update({
                estado: "sin_dispositivo", enviado_en: new Date().toISOString(),
            }).eq("id", aviso.id);
            sinDispositivo++;
            continue;
        }

        const carga = { ...texto, tag: `mdj-${aviso.tipo}`, ts: Date.now() };
        const tandas = await Promise.allSettled(subs.map((s) =>
            enviarPush(s as unknown as Suscripcion, carga, { publica, privada, sujeto })
                .then((r) => ({ ...r, id: s.id }))
        ));

        let alguno = false;
        const muertos: string[] = [];
        for (const t of tandas) {
            if (t.status !== "fulfilled") continue;
            if (t.value.ok) alguno = true;
            else if (t.value.muerto) muertos.push(t.value.id);
        }
        if (muertos.length) await ADMIN.from("push_suscripciones").delete().in("id", muertos);

        if (alguno) {
            await ADMIN.from("avisos_pendientes").update({
                estado: "enviado", enviado_en: new Date().toISOString(),
            }).eq("id", aviso.id);
            enviados++;
        } else {
            // Se deja PENDIENTE para reintentar, salvo que ya se haya insistido
            // mucho: un buzon roto no debe consumir cada pasada para siempre.
            const n = Number(aviso.intentos ?? 0) + 1;
            await ADMIN.from("avisos_pendientes").update({
                intentos: n,
                estado: n >= 5 ? "fallido" : "pendiente",
                error: "ningun dispositivo acepto el aviso",
            }).eq("id", aviso.id);
            fallidos++;
        }
    }

    return json({
        ok: true,
        revisados: cola.length,
        enviados,
        sin_dispositivo: sinDispositivo,
        fallidos,
        // Si quedan 100 revisados, es que hay mas cola esperando otra pasada.
        quedan_mas: cola.length === 100,
    }, 200);
});
