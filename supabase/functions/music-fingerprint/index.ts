// supabase/functions/music-fingerprint/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// MUSIC HUNTER · item 3 de la especificacion (2026-08-30, autorizado por el PO)
//
// QUÉ HACE: recibe una muestra de audio crudo (PCM float32 + sample rate --
// exactamente lo que devuelve music-hunter-ring-buffer.js en el navegador),
// la empaqueta como WAV de 16 bits y la manda a ACRCloud para identificar el
// track que suena. Se llama SERVIDOR A SERVIDOR desde elixis-realtime-session
// (action=identificar_track), mismo patrón que "consultar" -> elixis-
// orchestrator: el navegador nunca ve las credenciales de ACRCloud, y el JWT
// del usuario ya quedó verificado ahí antes de llegar acá.
//
// LIMITACIÓN REAL, NO UN DESCUIDO: la identificación básica de ACRCloud
// (Music Recognition) devuelve artista/título/álbum/género -- NO devuelve BPM
// ni tonalidad (key) de forma confiable. Esos dos campos quedan en null salvo
// que la cuenta de ACRCloud del PO tenga contratada su capa de "Audio
// Analysis" aparte (producto distinto). Inventar un número ahí sería
// mentirle a DjMago en su propio prompt ("nunca inventes datos").
//
// MODO MOCK: si ACRCLOUD_HOST/ACRCLOUD_ACCESS_KEY/ACRCLOUD_SECRET_KEY faltan,
// vienen vacíos, o ACRCloud devuelve un error de credenciales (401/403),
// responde un resultado de prueba CLARAMENTE marcado (mock:true, confidence:0)
// en vez de fallar en seco -- para poder probar el resto de la tubería (UI,
// tool calling) sin credenciales reales todavía, sin que nadie confunda el
// mock con un dato real. Pedido explícito del PO: "modo mock/fallback...
// hasta que se ingresen las credenciales finales".
//
// SECRETOS (Supabase → Edge Functions → Secrets):
//   ACRCLOUD_HOST         ← host del proyecto en la consola de ACRCloud
//                            (ej. identify-us-west-2.acrcloud.com)
//   ACRCLOUD_ACCESS_KEY
//   ACRCLOUD_SECRET_KEY
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ─── RATE LIMIT ──────────────────────────────────────────────────────────────
// Esta función se despliega SIN verificación de JWT (mismo criterio que
// mdj-music/mdj-weather: un puente a una API de terceros con credencial
// propia, sin datos por-usuario que proteger con RBAC) -- pero eso significa
// que cualquiera que sepa la URL puede invocarla directo, sin pasar por
// elixis-realtime-session. Sin este tope, eso es gastar la cuota de ACRCloud
// del PO en cualquier cantidad. Mismo patrón que mdj-music.
const _ventana = new Map<string, number[]>();
const TOPE = 20;
const VENTANA_MS = 60_000;
function pasadoDeVueltas(req: Request): boolean {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
        ?? req.headers.get("x-real-ip") ?? "desconocida";
    const ahora = Date.now();
    const golpes = (_ventana.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
    golpes.push(ahora);
    _ventana.set(ip, golpes);
    return golpes.length > TOPE;
}

const ACRCLOUD_URI = "/v1/identify";
const ACRCLOUD_DATA_TYPE = "audio";
const ACRCLOUD_SIGNATURE_VERSION = "1";
// ACRCloud recomienda entre 3 y 15s de muestra -- nuestro ring buffer manda
// hasta 6s (ver music-hunter-ring-buffer.js), ya dentro del rango.
const MAX_PCM_SAMPLES = 48_000 * 15; // tope defensivo: 15s a 48kHz

type ResultadoTrack = {
    ok: boolean;
    mock: boolean;
    artist: string | null;
    title: string | null;
    bpm: number | null;
    musical_key: string | null;
    genre: string | null;
    confidence: number;
    motivo?: string;
};

function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function respuestaMock(motivo: string): ResultadoTrack {
    return {
        ok: true, mock: true,
        artist: "(modo prueba — ACRCloud sin configurar)", title: null,
        bpm: null, musical_key: null, genre: null, confidence: 0,
        motivo,
    };
}

// ─── Credenciales ────────────────────────────────────────────────────────────
function credencialesAcrcloud(): { host: string; accessKey: string; secretKey: string } | null {
    const host = (Deno.env.get("ACRCLOUD_HOST") ?? "").trim();
    const accessKey = (Deno.env.get("ACRCLOUD_ACCESS_KEY") ?? "").trim();
    const secretKey = (Deno.env.get("ACRCLOUD_SECRET_KEY") ?? "").trim();
    if (!host || !accessKey || !secretKey) return null;
    return { host, accessKey, secretKey };
}

// ─── Firma HMAC-SHA1, contrato oficial de ACRCloud ──────────────────────────
// string_to_sign = "POST\n/v1/identify\n{access_key}\n{data_type}\n{signature_version}\n{timestamp}"
// firma = base64(HMAC-SHA1(string_to_sign, access_secret))
async function firmarAcrcloud(secretKey: string, stringToSign: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw", encoder.encode(secretKey), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
    );
    const firma = await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign));
    const bytes = new Uint8Array(firma);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

// ─── PCM float32 -> WAV 16-bit mono ──────────────────────────────────────────
// El ring buffer del navegador (music-hunter-ring-buffer.js) manda floats
// crudos [-1,1], no un archivo -- el empaquetado a WAV vive aca, un solo
// lugar, para no duplicar esta logica si algun dia otro cliente manda audio.
function construirWav(pcmFloat32: Float32Array, sampleRate: number): Uint8Array {
    const dataSize = pcmFloat32.length * 2; // 16 bits = 2 bytes por muestra
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function escribirTexto(offset: number, texto: string){
        for (let i = 0; i < texto.length; i++) view.setUint8(offset + i, texto.charCodeAt(i));
    }

    escribirTexto(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    escribirTexto(8, "WAVE");
    escribirTexto(12, "fmt ");
    view.setUint32(16, 16, true);          // tamaño del sub-chunk fmt
    view.setUint16(20, 1, true);           // PCM = 1
    view.setUint16(22, 1, true);           // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);           // block align
    view.setUint16(34, 16, true);          // bits por muestra
    escribirTexto(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < pcmFloat32.length; i++) {
        const s = Math.max(-1, Math.min(1, pcmFloat32[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }
    return new Uint8Array(buffer);
}

function base64ADecoded(b64: string): Uint8Array {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

// ─── Llamada real a ACRCloud ─────────────────────────────────────────────────
async function identificarConAcrcloud(
    creds: { host: string; accessKey: string; secretKey: string },
    wav: Uint8Array,
): Promise<ResultadoTrack> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const stringToSign = [
        "POST", ACRCLOUD_URI, creds.accessKey, ACRCLOUD_DATA_TYPE, ACRCLOUD_SIGNATURE_VERSION, timestamp,
    ].join("\n");
    const signature = await firmarAcrcloud(creds.secretKey, stringToSign);

    const form = new FormData();
    form.set("access_key", creds.accessKey);
    form.set("sample_bytes", String(wav.byteLength));
    form.set("timestamp", timestamp);
    form.set("signature", signature);
    form.set("signature_version", ACRCLOUD_SIGNATURE_VERSION);
    form.set("data_type", ACRCLOUD_DATA_TYPE);
    form.set("sample", new Blob([wav], { type: "audio/wav" }), "muestra.wav");

    const respuesta = await fetch(`https://${creds.host}${ACRCLOUD_URI}`, { method: "POST", body: form });
    const payload = await respuesta.json().catch(() => ({}));

    // Credenciales mal cargadas (host/keys con typo, cuenta suspendida) --
    // ACRCloud contesta 200 con un status.code de error, no un HTTP 401/403,
    // asi que hay que mirar status.code, no solo respuesta.ok.
    const codigo = payload?.status?.code;
    if (codigo === 3001 || codigo === 3003) {
        // 3001 = access_key invalida, 3003 = firma invalida.
        console.error("[music-fingerprint] credenciales ACRCloud rechazadas:", JSON.stringify(payload.status));
        return respuestaMock("acrcloud_credenciales_invalidas");
    }
    if (codigo === 1001) {
        // "No result" -- llamada correcta, no hubo coincidencia. No es un mock,
        // es un resultado real: no se reconocio la pista.
        return { ok: true, mock: false, artist: null, title: null, bpm: null,
            musical_key: null, genre: null, confidence: 0, motivo: "sin_coincidencia" };
    }
    if (codigo !== 0) {
        console.error("[music-fingerprint] ACRCloud codigo inesperado:", JSON.stringify(payload.status).slice(0, 300));
        return { ok: false, mock: false, artist: null, title: null, bpm: null,
            musical_key: null, genre: null, confidence: 0, motivo: "acrcloud_fallo" };
    }

    const track = payload?.metadata?.music?.[0];
    if (!track) {
        return { ok: true, mock: false, artist: null, title: null, bpm: null,
            musical_key: null, genre: null, confidence: 0, motivo: "sin_coincidencia" };
    }
    const artista = Array.isArray(track.artists) && track.artists[0]?.name ? String(track.artists[0].name) : null;
    const genero = Array.isArray(track.genres) && track.genres[0]?.name ? String(track.genres[0].name) : null;
    // "score" de ACRCloud viene 0-100 -- se normaliza a 0-1 para que
    // confidence sea consistente sin importar el proveedor de fingerprint.
    const confianza = typeof track.score === "number" ? Math.max(0, Math.min(1, track.score / 100)) : 0;

    return {
        ok: true, mock: false,
        artist: artista, title: track.title ? String(track.title) : null,
        // ACRCloud Music Recognition no trae BPM/key -- ver nota de cabecera.
        // Null explicito, no un valor inventado.
        bpm: null, musical_key: null,
        genre: genero, confidence: confianza,
    };
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok");
    if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    if (pasadoDeVueltas(req)) return json({ ok: false, error: "too_many_requests" }, 429);

    let body: { pcm_base64?: string; sample_rate?: number } = {};
    try { body = await req.json(); } catch { /* cuerpo vacio */ }

    const pcmBase64 = String(body.pcm_base64 ?? "");
    const sampleRate = Number(body.sample_rate) || 0;
    if (!pcmBase64 || !sampleRate) {
        return json({ ok: false, error: "missing_pcm_or_sample_rate" }, 400);
    }

    let pcmFloat32: Float32Array;
    try {
        const bytes = base64ADecoded(pcmBase64);
        if (bytes.byteLength % 4 !== 0) throw new Error("longitud_invalida");
        pcmFloat32 = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
    } catch (err) {
        console.error("[music-fingerprint] pcm_base64 invalido:", err);
        return json({ ok: false, error: "invalid_pcm" }, 400);
    }
    if (pcmFloat32.length === 0) return json({ ok: false, error: "empty_pcm" }, 400);
    if (pcmFloat32.length > MAX_PCM_SAMPLES) {
        return json({ ok: false, error: "pcm_too_large" }, 413);
    }

    const creds = credencialesAcrcloud();
    if (!creds) {
        console.warn("[music-fingerprint] ACRCloud sin configurar -- respondiendo modo mock");
        return json(respuestaMock("acrcloud_no_configurado"), 200);
    }

    try {
        const wav = construirWav(pcmFloat32, sampleRate);
        const resultado = await identificarConAcrcloud(creds, wav);
        return json(resultado, 200);
    } catch (err) {
        console.error("[music-fingerprint] fallo de red hacia ACRCloud:", err);
        return json({ ok: false, mock: false, artist: null, title: null, bpm: null,
            musical_key: null, genre: null, confidence: 0, motivo: "acrcloud_inalcanzable" }, 200);
    }
});
