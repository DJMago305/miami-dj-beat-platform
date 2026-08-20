// supabase/functions/mdj-music/index.ts
// Puente a Apple Music — la clave privada se queda SOLO en el servidor.
//
// Por que este y no una busqueda web: para armar un set no sirve un titular,
// sirve el catalogo de la industria. Apple Music da listas por pais, generos y
// busqueda de artistas y temas, y ya esta pagado con la membresia de
// desarrollador del PO. No cobra por consulta.
//
// Molde: mdj-weather / booth-tts. Mismo criterio: lista blanca de recursos,
// validacion de entrada, tope por IP y la credencial fuera del navegador.
//
// Desplegar:
//   supabase secrets set APPLE_MUSIC_TEAM_ID=...
//   supabase secrets set APPLE_MUSIC_KEY_ID=...
//   supabase secrets set APPLE_MUSIC_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
//   supabase functions deploy mdj-music --no-verify-jwt
//
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
    "https://miamidjbeat.com",
    "https://www.miamidjbeat.com",
    "https://miamidjbeat.vercel.app",
];
const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function cors(req: Request): Record<string, string> {
    const origin = req.headers.get("origin") ?? "";
    const ok = ALLOWED_ORIGINS.includes(origin) || LOCALHOST_ORIGIN.test(origin);
    return {
        "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Vary": "Origin",
    };
}

const _ventana = new Map<string, number[]>();
const TOPE = 30;
const VENTANA_MS = 60_000;

function pasado_de_vueltas(req: Request): boolean {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
        ?? req.headers.get("x-real-ip") ?? "desconocida";
    const ahora = Date.now();
    const golpes = (_ventana.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
    golpes.push(ahora);
    _ventana.set(ip, golpes);
    return golpes.length > TOPE;
}

function json(cuerpo: unknown, estado: number, req: Request): Response {
    return new Response(JSON.stringify(cuerpo), {
        status: estado,
        headers: { ...cors(req), "Content-Type": "application/json" },
    });
}

// ── EL TOKEN DE DESARROLLADOR ─────────────────────────────────────────────────
// Apple no acepta la clave privada directamente: hay que firmar con ella un JWT
// (ES256) y mandar ESE. El token vale meses, asi que se firma una vez y se
// guarda en memoria -- firmar en cada peticion seria tirar CPU sin motivo.
let _token: string | null = null;
let _tokenExpira = 0;

function b64url(datos: Uint8Array | string): string {
    const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : datos;
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemADer(pem: string): Uint8Array {
    // El .p8 viene con cabeceras y saltos de linea; el importador quiere bytes.
    const limpio = pem
        .replace(/-----BEGIN [^-]+-----/g, "")
        .replace(/-----END [^-]+-----/g, "")
        .replace(/\s+/g, "");
    const bin = atob(limpio);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

async function tokenDesarrollador(): Promise<string> {
    const ahora = Math.floor(Date.now() / 1000);
    if (_token && ahora < _tokenExpira - 3600) return _token;

    const teamId = Deno.env.get("APPLE_MUSIC_TEAM_ID") ?? "";
    const keyId = Deno.env.get("APPLE_MUSIC_KEY_ID") ?? "";
    const pem = Deno.env.get("APPLE_MUSIC_PRIVATE_KEY") ?? "";
    if (!teamId || !keyId || !pem) throw new Error("faltan_credenciales");

    const cabecera = { alg: "ES256", kid: keyId };
    // Apple admite hasta 6 meses; se piden 90 dias para que una fuga tenga
    // fecha de caducidad corta sin obligar a renovar cada semana.
    const exp = ahora + 90 * 24 * 3600;
    const cuerpo = { iss: teamId, iat: ahora, exp };

    const porFirmar = `${b64url(JSON.stringify(cabecera))}.${b64url(JSON.stringify(cuerpo))}`;

    const clave = await crypto.subtle.importKey(
        "pkcs8",
        pemADer(pem),
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"],
    );
    const firma = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        clave,
        new TextEncoder().encode(porFirmar),
    );

    _token = `${porFirmar}.${b64url(new Uint8Array(firma))}`;
    _tokenExpira = exp;
    return _token;
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "GET" && req.method !== "POST") {
        return json({ error: "metodo_no_permitido" }, 405, req);
    }
    if (pasado_de_vueltas(req)) return json({ error: "demasiadas_peticiones" }, 429, req);

    let token: string;
    try {
        token = await tokenDesarrollador();
    } catch (err) {
        console.error("[mdj-music] token:", err);
        return json({ error: "sin_credenciales" }, 503, req);
    }

    const u = new URL(req.url);
    // Lista blanca: no se acepta una ruta arbitraria. Sin esto el puente
    // reenvia lo que le manden y se convierte en un proxy abierto con la
    // credencial del PO.
    const recurso = u.searchParams.get("recurso") ?? "charts";
    // Tienda: "us" por defecto (Miami). Dos letras, nada mas.
    const tienda = /^[a-z]{2}$/.test(u.searchParams.get("tienda") ?? "") ? u.searchParams.get("tienda")! : "us";
    const limite = Math.min(25, Math.max(1, Number(u.searchParams.get("limite")) || 20));

    let destino: URL;
    if (recurso === "charts") {
        // Lo que suena AHORA en esa tienda. Opcionalmente por genero.
        destino = new URL(`https://api.music.apple.com/v1/catalog/${tienda}/charts`);
        destino.searchParams.set("types", "songs");
        destino.searchParams.set("limit", String(limite));
        const genero = (u.searchParams.get("genero") ?? "").trim();
        if (/^\d{1,6}$/.test(genero)) destino.searchParams.set("genre", genero);
    } else if (recurso === "buscar") {
        const q = (u.searchParams.get("q") ?? "").trim();
        if (!q || q.length > 120) return json({ error: "consulta_invalida" }, 400, req);
        destino = new URL(`https://api.music.apple.com/v1/catalog/${tienda}/search`);
        destino.searchParams.set("term", q);
        destino.searchParams.set("types", "songs,artists,albums");
        destino.searchParams.set("limit", String(limite));
    } else if (recurso === "generos") {
        destino = new URL(`https://api.music.apple.com/v1/catalog/${tienda}/genres`);
        destino.searchParams.set("limit", String(limite));
    } else {
        return json({ error: "recurso_desconocido" }, 400, req);
    }

    try {
        const res = await fetch(destino.toString(), {
            headers: { Authorization: `Bearer ${token}` },
        });
        const texto = await res.text();
        if (!res.ok) {
            // El cuerpo de error puede llevar rastros de la credencial: solo
            // viaja el codigo, nunca el cuerpo.
            console.error("[mdj-music] Apple", res.status, texto.slice(0, 200));
            return json({ error: "proveedor_fallo", estado: res.status }, 502, req);
        }
        return new Response(texto, {
            status: 200,
            headers: {
                ...cors(req),
                "Content-Type": "application/json",
                // Las listas no cambian por minutos: 30 min de cache ahorra
                // llamadas y responde al instante al volver.
                "Cache-Control": "public, max-age=1800",
            },
        });
    } catch (err) {
        console.error("[mdj-music] red:", err);
        return json({ error: "proveedor_inalcanzable" }, 502, req);
    }
});
