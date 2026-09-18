// supabase/functions/notify-yearly-recall/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Despachador que faltaba para la "Pieza 3" (docs/diseno-calendario-cliente-fase2.md):
// mdj-yearly-recall ya detecta cumpleaños/aniversarios/aniversarios de evento
// próximos y los encola en event_reminders_queue (reminder_type='yearly_recall',
// status='pending') -- pero esa función deja explícito en su propio comentario
// que "solo detecta la fecha y dispara SEÑAL", el aviso real se manda aparte.
// Esta función es ese aviso real: junta TODO lo pendiente en un solo correo
// resumen a STAFF (no le escribe nada al cliente directamente -- mismo criterio
// que mdj-yearly-recall: es para que Miami DJ Beat se acuerde, no para
// automatizar el mensaje al cliente).
//
// Por qué correo y no SMS: el número toll-free de Twilio todavía está en
// revisión (sometido 2026-09-17, 3-5 días hábiles) -- cualquier SMS que se
// mande ahora no se entregaría. notify-new-lead ya tiene un canal de correo
// real y funcionando (Resend) para avisar a staff -- se reusa el mismo patrón
// y las mismas env vars (RESEND_API_KEY, MANAGER_EMAIL, FROM_EMAIL) en vez de
// inventar un canal nuevo.
//
// Disparo: pg_cron, mismo secreto estático que ya usan send-reminder-sms /
// mdj-yearly-recall / calendar-channel-renew (Authorization: Bearer
// $CRON_EDGE_AUTH_SECRET) -- corre 30 min despues de dispatch_yearly_recall_cron
// (que llena la cola), para darle tiempo a terminar de insertar antes de barrer.
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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MANAGER_EMAIL = Deno.env.get("MANAGER_EMAIL") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@miamidjbeat.com>";
const CALENDAR_URL = Deno.env.get("SITE_URL")
  ? `${(Deno.env.get("SITE_URL") as string).replace(/\/$/, "")}/calendario-operacional-inteligente.html`
  : "https://miamidjbeat.com/calendario-operacional-inteligente.html";

const BATCH_LIMIT = 100;

function verifyCron(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cronSecret = Deno.env.get("CRON_EDGE_AUTH_SECRET") ?? "";
  return !!cronSecret && jwt === cronSecret;
}

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

type QueueRow = {
  id: string;
  client_user_id: string | null;
  event_id: string | null;
  dedup_key: string | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  birthday: "🎂 Cumpleaños",
  anniversary: "💍 Aniversario de boda",
  event_anniversary: "🎉 Aniversario de evento",
};

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), { status: 405 });
  }
  if (!verifyCron(req)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_credentials" }), { status: 401 });
  }
  if (!RESEND_API_KEY || !MANAGER_EMAIL) {
    console.error("[notify-yearly-recall] faltan RESEND_API_KEY / MANAGER_EMAIL");
    return new Response(JSON.stringify({ ok: false, error: "email_not_configured" }), { status: 500 });
  }

  const { data: rows, error } = await ADMIN
    .from("event_reminders_queue")
    .select("id, client_user_id, event_id, dedup_key, created_at")
    .eq("reminder_type", "yearly_recall")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[notify-yearly-recall] lectura de la cola falló:", error.message);
    return new Response(JSON.stringify({ ok: false, error: "queue_read_failed" }), { status: 500 });
  }
  const pending = (rows ?? []) as QueueRow[];
  if (!pending.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, detalle: "nada pendiente" }), { status: 200 });
  }

  // Enriquecer cada fila: nombre/telefono del cliente + (si viene de un evento
  // pasado) el venue/tipo, o el/los DJ(s) afiliados. Para cumpleaños/
  // aniversario, client_user_id guarda master_clients.id (mismo cambio que
  // mdj-yearly-recall 2026-09-18) -- master_clients es la fuente deduplicada
  // real, la misma que ya usa get_master_calendar_events() para el calendario.
  const items: { kind: string; nombre: string; detalle: string; djInfo: string; rowId: string }[] = [];

  for (const row of pending) {
    const kind = String(row.dedup_key ?? "").split(":")[0] || "yearly_recall";
    const kindLabel = KIND_LABEL[kind] || "📅 Fecha anual";

    let nombre = "Cliente";
    let djInfo = "";
    // "birthday"/"anniversary" (cliente propio): client_user_id = master_clients.id.
    // "event_anniversary" (evento pasado): client_user_id sigue siendo un
    // client_profiles.user_id real, tal cual lo guarda leads -- no se tocó esa
    // parte de mdj-yearly-recall, así que no se busca en master_clients aquí.
    if (row.client_user_id && kind !== "event_anniversary") {
      const { data: mc } = await ADMIN
        .from("master_clients")
        .select("name, normalized_phone")
        .eq("id", row.client_user_id)
        .maybeSingle();
      nombre = mc?.name || nombre;

      // DJ(s) afiliados a este cliente maestro -- mismo join que usa
      // get_master_calendar_events() (dj_client_affiliations -> dj_profiles).
      const { data: affs } = await ADMIN
        .from("dj_client_affiliations")
        .select("dj_id")
        .eq("master_client_id", row.client_user_id);
      const djIds = (affs ?? []).map((a: { dj_id: string }) => a.dj_id).filter(Boolean);
      if (djIds.length) {
        const { data: djs } = await ADMIN
          .from("dj_profiles")
          .select("stage_name, dj_name, full_name")
          .in("id", djIds);
        const nombres = (djs ?? [])
          .map((d: { stage_name?: string; dj_name?: string; full_name?: string }) => d.stage_name || d.dj_name || d.full_name)
          .filter(Boolean);
        if (nombres.length) djInfo = `DJ afiliado: ${nombres.join(", ")}`;
      }
    } else if (row.client_user_id) {
      const { data: cp } = await ADMIN
        .from("client_profiles")
        .select("full_name")
        .eq("user_id", row.client_user_id)
        .maybeSingle();
      nombre = cp?.full_name || nombre;
    }

    let detalle = kindLabel;
    if (row.event_id) {
      const { data: ev } = await ADMIN
        .from("leads")
        .select("event_type, venue, assigned_dj_name")
        .eq("id", row.event_id)
        .maybeSingle();
      if (ev) {
        detalle = `${kindLabel} · ${ev.event_type || "evento"}${ev.venue ? " en " + ev.venue : ""}`;
        if (ev.assigned_dj_name) djInfo = `DJ de ese evento: ${ev.assigned_dj_name}`;
      }
    }

    items.push({ kind: kindLabel, nombre, detalle, djInfo, rowId: row.id });
  }

  const rowsHtml = items.map((it) => `
    <div class="row">
      <span class="label">${escapeHtml(it.kind)}</span>
      <span class="value accent">${escapeHtml(it.nombre)}</span>
    </div>
    <div class="row" style="border-bottom:1px solid #1e1e1e;">
      <span class="label">Detalle</span>
      <span class="value">${escapeHtml(it.detalle)}${it.djInfo ? " · " + escapeHtml(it.djInfo) : ""}</span>
    </div>
  `).join("");

  const subject = `📅 Recordatorios de seguimiento anual (${items.length})`;
  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 32px 24px; }
  .header { background: linear-gradient(135deg, #1a1008, #2a1a00); border-bottom: 2px solid #c5a059;
    padding: 24px; border-radius: 12px 12px 0 0; text-align: center; }
  .logo { font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #c5a059; }
  .title { font-size: 22px; font-weight: 900; color: #fff; margin: 8px 0 0; }
  .body { background: #111; border: 1px solid #222; border-top: none; border-radius: 0 0 12px 12px; padding: 28px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 0; gap: 12px; }
  .label { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #777; text-transform: uppercase; min-width: 120px; padding-top: 2px; }
  .value { font-size: 14px; color: #f0f0f0; text-align: right; word-break: break-word; }
  .value.accent { color: #c5a059; font-weight: 700; }
  .cta { display: block; margin: 24px auto 0; padding: 14px 32px; background: #c5a059; color: #000;
    font-weight: 800; font-size: 15px; text-decoration: none; border-radius: 50px; text-align: center; letter-spacing: 1px; }
  .footer { margin-top: 20px; font-size: 11px; color: #444; text-align: center; }
</style></head>
<body><div class="wrap">
  <div class="header">
    <div class="logo">MIAMI DJ BEAT</div>
    <div class="title">📅 ${items.length} recordatorio${items.length === 1 ? "" : "s"} de seguimiento</div>
  </div>
  <div class="body">
    ${rowsHtml}
    <a class="cta" href="${CALENDAR_URL}">🗓️ Abrir Recordatorios</a>
  </div>
  <div class="footer">
    Miami DJ Beat LLC · Aviso interno, no se le escribió nada al cliente todavía.<br>
    Este mensaje fue generado automáticamente — no responder.
  </div>
</div></body></html>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [MANAGER_EMAIL], subject, html }),
  });
  const out = await r.json().catch(() => ({}));

  if (!r.ok) {
    console.error("[notify-yearly-recall] Resend error:", JSON.stringify(out).slice(0, 400));
    // No se marcan como enviadas -- el proximo cron reintenta el lote completo.
    return new Response(JSON.stringify({ ok: false, error: "resend_failed", detalle: out }), { status: 502 });
  }

  const ids = pending.map((r2) => r2.id);
  const { error: updErr } = await ADMIN
    .from("event_reminders_queue")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .in("id", ids);
  if (updErr) console.error("[notify-yearly-recall] no se pudo marcar 'sent':", updErr.message);

  return new Response(JSON.stringify({ ok: true, sent: items.length, resend_id: out?.id ?? null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
