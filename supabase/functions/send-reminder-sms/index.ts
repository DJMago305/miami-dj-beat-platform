// supabase/functions/send-reminder-sms/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Despacha recordatorios de firma pendiente (reminder_queue) por SMS/WhatsApp
// vía Twilio. Reutiliza el mismo patrón de llamada + verificación de
// elixis-sms-dispatch (aceptado ≠ entregado, revisar error_code aunque el
// HTTP sea 200) — no se reinventa la integración con Twilio.
//
// A diferencia de elixis-sms-dispatch (que SOLO acepta un JWT de staff, un
// humano dispara un mensaje puntual), esta función tiene DOS disparadores:
//   · SISTEMA: pg_cron llama en lote, sin sesión de usuario, con el mismo
//     secreto estático que ya usa notify-dj-sms (Authorization: Bearer
//     $CRON_EDGE_AUTH_SECRET). Procesa todo lo vencido en reminder_queue.
//   · STAFF: un owner/admin/manager/seller autenticado puede forzar el envío
//     inmediato de UN recordatorio puntual pasando ?id=<uuid> con su propio
//     JWT — para reintentar algo fallido sin esperar al próximo ciclo.
//
// El teléfono y el mensaje NUNCA viajan en la petición: siempre se leen de
// la fila de reminder_queue, igual que elixis-sms-dispatch lee de
// elixis_sms_pending. Antes de mandar nada se revalida que el contrato
// asociado siga PENDING — si ya se firmó, se cancela el recordatorio en vez
// de mandarlo (evita el "ya firmé, por qué me siguen escribiendo").
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL_FALLBACK = "https://hkuvuqupbxwkiykxvqdr.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN = createClient(
  Deno.env.get("SUPABASE_URL") || SUPABASE_URL_FALLBACK,
  SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const ALLOWED_STAFF_ROLES = new Set(["owner", "admin", "manager", "seller"]);
const BATCH_LIMIT = 50;

type Gate =
  | { ok: true; mode: "cron" }
  | { ok: true; mode: "staff"; userId: string }
  | { ok: false; status: number; error: string };

// Acepta CUALQUIERA de los dos disparadores válidos — no se exige ambos.
async function verifyTrigger(req: Request): Promise<Gate> {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!jwt) return { ok: false, status: 401, error: "missing_authorization" };

  const cronSecret = Deno.env.get("CRON_EDGE_AUTH_SECRET") ?? "";
  if (cronSecret && jwt === cronSecret) return { ok: true, mode: "cron" };

  // No coincide con el secreto de cron: probar como JWT de staff real.
  const { data: { user }, error } = await ADMIN.auth.getUser(jwt);
  if (error || !user?.id) return { ok: false, status: 401, error: "invalid_credentials" };
  const { data: prof } = await ADMIN
    .from("dj_profiles").select("role").eq("user_id", user.id).maybeSingle();
  const role = String(prof?.role ?? "").toLowerCase().trim();
  if (!ALLOWED_STAFF_ROLES.has(role)) {
    return { ok: false, status: 403, error: "forbidden_not_staff" };
  }
  return { ok: true, mode: "staff", userId: user.id };
}

type ReminderRow = {
  id: string;
  contract_send_id: string;
  channel: "sms" | "whatsapp";
  recipient_phone: string;
  recipient_name: string | null;
  message_template: string;
  attempts: number;
  max_attempts: number;
};

// TODO: mensajes reales por template + idioma antes de ir a producción;
// el esqueleto solo cubre el template por defecto en español.
const TEMPLATES: Record<string, (name: string | null) => string> = {
  contract_pending_reminder: (name) =>
    `Hola${name ? " " + name : ""}, este es un recordatorio de Miami DJ Beat LLC: ` +
    `tienes un contrato pendiente de firma. Por favor revisa el enlace que te enviamos.`,
};

async function sendOne(row: ReminderRow): Promise<void> {
  // Revalidar contra contract_sends — nunca confiar en que sigue pendiente
  // solo porque estaba SCHEDULED cuando se encoló.
  const { data: send, error: e0 } = await ADMIN
    .from("contract_sends")
    .select("status")
    .eq("id", row.contract_send_id)
    .maybeSingle();
  if (e0 || !send) {
    await markRow(row.id, { status: "FAILED", last_error: "contract_send_not_found" });
    return;
  }
  if (send.status !== "PENDING") {
    await markRow(row.id, { status: "CANCELED" });
    return;
  }

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
  const token = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
  const from = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";
  if (!sid || !token || !from) {
    console.error("[send-reminder-sms] faltan secretos de Twilio");
    await markRow(row.id, { status: "FAILED", last_error: "sms_not_configured" });
    return;
  }

  const body = (TEMPLATES[row.message_template] ?? TEMPLATES.contract_pending_reminder)(row.recipient_name);
  // WhatsApp real (Fase 2): mismo endpoint de Twilio, "From"/"To" con el
  // prefijo whatsapp: y una plantilla aprobada por Meta. No implementado
  // todavía — de momento cualquier fila channel='whatsapp' cae aquí mismo
  // pero usando el número de SMS, lo cual Twilio rechazará limpiamente.
  const toAddr = row.channel === "whatsapp" ? `whatsapp:${row.recipient_phone}` : row.recipient_phone;
  const fromAddr = row.channel === "whatsapp" ? `whatsapp:${from}` : from;

  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${sid}:${token}`),
      },
      body: new URLSearchParams({ To: toAddr, From: fromAddr, Body: body }).toString(),
    });
    const cuerpo = await r.json().catch(() => ({}));
    const c = cuerpo as Record<string, unknown>;

    if (!r.ok) {
      await failOrRetry(row, String(c?.message ?? r.status));
      return;
    }

    // Aceptado ≠ entregado, y Twilio puede devolver error_code con HTTP 200
    // — mismo cuidado que elixis-sms-dispatch.
    const errCode = c?.error_code ?? null;
    if (errCode) {
      await failOrRetry(row, `twilio ${errCode}: ${String(c?.error_message ?? "")}`);
      return;
    }

    await markRow(row.id, { status: "SENT", twilio_sid: String(c?.sid ?? ""), sent_at: new Date().toISOString() });
  } catch (err) {
    await failOrRetry(row, `network: ${String(err)}`);
  }
}

async function failOrRetry(row: ReminderRow, errMsg: string): Promise<void> {
  const attempts = row.attempts + 1;
  if (attempts >= row.max_attempts) {
    await markRow(row.id, { status: "FAILED", attempts, last_error: errMsg.slice(0, 400) });
  } else {
    // Deja SCHEDULED para el próximo ciclo de cron — no se reprograma la
    // hora aquí a propósito, el esqueleto reintenta en el siguiente barrido.
    await markRow(row.id, { attempts, last_error: errMsg.slice(0, 400) });
  }
}

async function markRow(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await ADMIN.from("reminder_queue").update(patch).eq("id", id);
  if (error) console.error("[send-reminder-sms] no se pudo actualizar la fila", id, error);
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), { status: 405 });
  }

  const gate = await verifyTrigger(req);
  if (!gate.ok) {
    return new Response(JSON.stringify({ ok: false, error: gate.error }), { status: gate.status });
  }

  const forcedId = new URL(req.url).searchParams.get("id");

  let query = ADMIN
    .from("reminder_queue")
    .select("id, contract_send_id, channel, recipient_phone, recipient_name, message_template, attempts, max_attempts")
    .eq("status", "SCHEDULED");

  if (forcedId) {
    // Disparo manual de staff: una sola fila, sin exigir scheduled_at vencido.
    query = query.eq("id", forcedId);
  } else {
    // Disparo de cron: todo lo vencido, en lote.
    query = query.lte("scheduled_at", new Date().toISOString()).limit(BATCH_LIMIT);
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("[send-reminder-sms] error leyendo la cola", error);
    return new Response(JSON.stringify({ ok: false, error: "queue_read_failed" }), { status: 500 });
  }

  const pending = (rows ?? []).filter((r) => r.attempts < r.max_attempts) as ReminderRow[];
  for (const row of pending) {
    await sendOne(row);
  }

  return new Response(JSON.stringify({ ok: true, processed: pending.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
