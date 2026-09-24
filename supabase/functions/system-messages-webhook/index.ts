// supabase/functions/system-messages-webhook/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mensajes del Sistema — Fase 1, receptor de SMS ENTRANTES.
//
// Este es el hueco real que no existia en el sistema hasta 2026-09-23: si un
// cliente o artista respondia un SMS, Twilio lo recibia pero nadie en Miami DJ
// Beat lo veia. Esta funcion es el webhook que Twilio llama de verdad cuando
// "A MESSAGE COMES IN" -- configurado a mano en Twilio Console sobre el numero
// +18334322941 (Messaging -> A MESSAGE COMES IN -> esta URL).
//
// SEGURIDAD: este endpoint es PUBLICO por necesidad (Twilio no manda un JWT de
// Supabase). Sin verificar la firma, cualquiera podria POSTear mensajes falsos
// a la bandeja de Staff. Se valida X-Twilio-Signature contra el algoritmo real
// de Twilio (HMAC-SHA1 sobre URL + parametros ordenados, con el Auth Token como
// llave) -- https://www.twilio.com/docs/usage/security#validating-requests.
//
// No se auto-responde nada: se devuelve un TwiML <Response/> vacio. Cualquier
// respuesta al cliente la decide y manda una persona desde "Mensajes del
// Sistema", nunca este webhook.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/system-messages-webhook`;

const ADMIN = createClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const EMPTY_TWIML = new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
  status: 200,
  headers: { "Content-Type": "text/xml" },
});

function base64FromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function computeTwilioSignature(authToken: string, url: string, params: Record<string, string>): Promise<string> {
  // Algoritmo real de Twilio: URL + (clave+valor de cada parametro, ordenados
  // alfabeticamente por clave, sin separadores) -> HMAC-SHA1 -> base64.
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64FromBytes(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// MMS entrante (2026-09-23, pedido del PO: "es un chat, poder mandar fotos y
// video"): la URL que manda Twilio en MediaUrl0 exige Basic Auth de Twilio
// para verse -- un <img src> del navegador nunca la va a poder cargar. Se baja
// el archivo aca (con las credenciales que este servidor SI tiene) y se
// resube al MISMO bucket publico que ya usa la foto de contacto de Network
// (avatars/staff-uploads/..., ver uploadNetworkPhoto en staff-admin.html) --
// esa carpeta ya es publica de lectura, no hace falta RLS nueva.
const MEDIA_EXT_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};
async function reHospedarMedia(sid: string, authToken: string, mediaUrl: string, contentType: string, telefono: string): Promise<string | null> {
  try {
    const res = await fetch(mediaUrl, { headers: { Authorization: "Basic " + btoa(`${sid}:${authToken}`) } });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ext = MEDIA_EXT_POR_TIPO[contentType] || "bin";
    const digitos = telefono.replace(/\D/g, "").slice(-10) || "sin-numero";
    const path = `staff-uploads/system-messages/${digitos}/recibido-${Date.now()}.${ext}`;
    const up = await ADMIN.storage.from("avatars").upload(path, bytes, { contentType, upsert: true, cacheControl: "3600" });
    if (up.error) { console.error("system-messages-webhook: fallo al resubir media", up.error.message); return null; }
    const pub = ADMIN.storage.from("avatars").getPublicUrl(path);
    return pub.data?.publicUrl ?? null;
  } catch (e) {
    console.error("system-messages-webhook: excepcion al resubir media", (e as Error).message);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  if (!authToken) {
    console.error("system-messages-webhook: TWILIO_AUTH_TOKEN no configurado");
    return new Response("server_configuration_incomplete", { status: 500 });
  }

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const signatureHeader = req.headers.get("X-Twilio-Signature") ?? "";
  const expectedSignature = await computeTwilioSignature(authToken, WEBHOOK_URL, params);
  if (!signatureHeader || !timingSafeEqual(signatureHeader, expectedSignature)) {
    console.error("system-messages-webhook: firma de Twilio invalida, mensaje rechazado");
    return new Response("invalid_signature", { status: 403 });
  }

  const from = params["From"];
  const body = params["Body"];
  const messageSid = params["MessageSid"];

  if (!from || !messageSid) {
    // Twilio a veces manda callbacks de status (sin From) a la misma URL si
    // se configura mal en consola -- se ignora en silencio, sin romper el 200.
    return EMPTY_TWIML;
  }

  let mediaUrl: string | null = null;
  const numMedia = parseInt(params["NumMedia"] || "0", 10);
  if (numMedia > 0 && params["MediaUrl0"]) {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
    if (sid) mediaUrl = await reHospedarMedia(sid, authToken, params["MediaUrl0"], params["MediaContentType0"] || "", from);
  }

  const { error } = await ADMIN.from("system_messages").insert({
    direccion: "entrante",
    telefono: from,
    cuerpo: (body ?? "").slice(0, 1600) || (mediaUrl ? "" : "(mensaje vacio o multimedia)"),
    media_url: mediaUrl,
    twilio_sid: messageSid,
    estado: "recibido",
  });

  // Codigo 23505 = unique_violation: Twilio reintento el mismo webhook (mismo
  // MessageSid) -- no es un error real, ya lo tenemos guardado.
  if (error && (error as { code?: string }).code !== "23505") {
    console.error("system-messages-webhook: fallo al guardar mensaje entrante", error.message);
  }

  return EMPTY_TWIML;
});
