// supabase/functions/notify-yearly-recall/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Despachador que faltaba para la "Pieza 3" (docs/diseno-calendario-cliente-fase2.md):
// mdj-yearly-recall ya detecta cumpleaños/aniversarios/aniversarios de evento
// próximos y los encola en event_reminders_queue (reminder_type='yearly_recall',
// status='pending') -- pero esa función deja explícito en su propio comentario
// que "solo detecta la fecha y dispara SEÑAL", el aviso real se manda aparte.
// Esta función es ese aviso real: junta TODO lo pendiente en un solo correo
// resumen a STAFF (MANAGER_EMAIL, no le escribe nada al cliente directamente --
// mismo criterio que mdj-yearly-recall: es para que Miami DJ Beat se acuerde,
// no para automatizar el mensaje al cliente).
//
// Ruteo adicional (2026-09-23, pedido del PO): cuando un cumpleaños/aniversario
// es de un cliente afiliado a un DJ/vendedor específico (dj_client_affiliations,
// ver find_or_create_master_client), ese mismo aviso se le manda TAMBIÉN al DJ
// dueño de ese cliente, en su propio correo -- así el sistema deja constancia
// de quién está trabajando/cerrando a ese cliente, de cara a la comisión de
// esa venta, sin depender de que el owner se lo reenvíe manualmente.
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

// Íconos de los botones de acción -- mismos trazos SVG feather-style que ya
// usa la ficha real de Network (staff-admin.html, ICO_MAIL/ICO_MESSAGE),
// pre-rasterizados a PNG porque el SVG inline no se ve bien en la mayoría de
// los programas de correo (Outlook lo rompe). Corrección del PO (2026-09-19,
// aplicada también aquí): nada de emoji dibujado -- mismo ícono plano,
// mismo criterio de color (WhatsApp = verde) que ya está en producción.
const ICO_MSG_PNG = "data:image/png;base64,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";
const ICO_PHONE_PNG = "data:image/png;base64,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";
const ICO_VIDEO_PNG = "data:image/png;base64,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";
const ICO_MAIL_PNG = "data:image/png;base64,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";
const ICO_WA_PNG = "data:image/png;base64,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";
const AVATAR_FALLBACK_PNG = "data:image/png;base64,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";


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

const KIND_LABEL_ES: Record<string, string> = {
  birthday: "Cumpleaños",
  anniversary: "Aniversario de boda",
  event_anniversary: "Aniversario de evento",
};
const KIND_LABEL_EN: Record<string, string> = {
  birthday: "Birthday",
  anniversary: "Wedding anniversary",
  event_anniversary: "Event anniversary",
};

// Mismos emoji que ya usa calendario-operacional-inteligente.html para estos
// mismos tipos (cumple/aniv) -- no se inventa un ícono nuevo, se reutiliza el
// oficial ya establecido en la Agenda.
const KIND_ICON: Record<string, string> = {
  birthday: "🎂",
  anniversary: "🎉",
  event_anniversary: "📅",
};

type ReminderItem = {
  kindKey: string;
  nombre: string;
  contexto: string;
  referencia: string;
  email: string;
  telefono: string;
  photoUrl: string;
  // DJ(s)/staff afiliados a este cliente (dj_client_affiliations) -- solo se
  // llena para birthday/anniversary (client_user_id = master_clients.id);
  // event_anniversary no tiene FK confiable a un DJ, solo el texto libre de
  // leads.assigned_dj_name, así que no se rutea aparte.
  ownerDjIds: string[];
};

// Todo el texto visible del correo, en los dos idiomas que hoy soporta
// dj_profiles.language -- se arma por destinatario (el owner y cada DJ dueño
// reciben en su propio idioma, no en uno fijo), nunca una sola vez global.
function buildLang(lang: "es" | "en") {
  return lang === "en" ? {
    kindLabel: KIND_LABEL_EN,
    kindFallback: "Annual date",
    actionTitles: { msg: "Message", call: "Call", facetime: "FaceTime", email: "Email", wa: "WhatsApp" },
    referido: "Referred by",
    recordatorio: "Reminder",
    abrir: "Open",
    subject: (n: number) => `Follow-up reminder${n === 1 ? "" : "s"} (${n})`,
    footer1: "Miami DJ Beat LLC · Internal notice — nothing has been sent to the client yet.",
    footer2: "This message was generated automatically. (No need to reply to this message)",
    htmlLang: "en",
    waText: {
      birthday: (n: string) => `Happy birthday, ${n}! 🎉🎂 From the whole Miami DJ Beat team.`,
      anniversary: (n: string) => `Happy anniversary, ${n}! 💍🥂 From the whole Miami DJ Beat team.`,
      event_anniversary: (n: string) => `Hi ${n}! 🎉 Today marks one more year since your event with us — from the whole Miami DJ Beat team.`,
      default: (n: string) => `Hi ${n}! 👋 From the whole Miami DJ Beat team.`,
    },
  } : {
    kindLabel: KIND_LABEL_ES,
    kindFallback: "Fecha anual",
    actionTitles: { msg: "Mensaje", call: "Llamar", facetime: "FaceTime", email: "Email", wa: "WhatsApp" },
    referido: "Referido",
    recordatorio: "Recordatorio",
    abrir: "Abrir",
    subject: (n: number) => `Recordatorio${n === 1 ? "" : "s"} de seguimiento (${n})`,
    footer1: "Miami DJ Beat LLC · Aviso interno, no se le escribió nada al cliente todavía.",
    footer2: "Este mensaje fue generado automáticamente. (No Es Necesario Que Respondas Este Mensaje)",
    htmlLang: "es",
    waText: {
      birthday: (n: string) => `¡Feliz cumpleaños, ${n}! 🎉🎂 De parte de todo el equipo Miami DJ Beat.`,
      anniversary: (n: string) => `¡Feliz aniversario, ${n}! 💍🥂 De parte de todo el equipo Miami DJ Beat.`,
      event_anniversary: (n: string) => `¡Hola ${n}! 🎉 Hoy se cumple un año más de tu evento con nosotros — de parte de todo el equipo Miami DJ Beat.`,
      default: (n: string) => `¡Hola ${n}! 👋 De parte de todo el equipo Miami DJ Beat.`,
    },
  };
}

// Arma el asunto + HTML completo para UN destinatario (owner o un DJ dueño),
// en su propio idioma -- se llama una vez por MANAGER_EMAIL y una vez más
// por cada DJ que aparezca en byOwnerDj, cada quien con su propio subconjunto
// de items y su propio idioma.
function renderEmail(items: ReminderItem[], lang: "es" | "en"): { subject: string; html: string } {
  const L = buildLang(lang);

  const cardsHtml = items.map((it) => {
    const waText = (L.waText[it.kindKey as keyof typeof L.waText] ?? L.waText.default)(it.nombre);
    const kindLabel = L.kindLabel[it.kindKey] || L.kindFallback;
    const smsHref = it.telefono ? `sms:${it.telefono}` : "";
    // tel:/facetime: -- en Mac con Continuity Calls, esto activa solo la
    // pantalla nativa roja/verde de llamada de Apple (contestar/colgar); no
    // hay nada que construir de nuestro lado, es comportamiento del sistema.
    const telHref = it.telefono ? `tel:${it.telefono}` : "";
    const faceHref = it.telefono ? `facetime:${it.telefono}` : "";
    const mailHref = it.email
      ? `mailto:${it.email}?subject=${encodeURIComponent("Miami DJ Beat")}&body=${encodeURIComponent(waText)}`
      : "";
    const waHref = it.telefono
      ? `https://wa.me/${it.telefono.replace(/[^\d]/g, "")}?text=${encodeURIComponent(waText)}`
      : "";
    // Mismo patrón exacto que la ficha real de Network (staff-admin.html,
    // quickActionsHtml/actionBtn): burbujas redondas de 38px, solo el ícono,
    // sin texto -- WhatsApp se distingue por color verde, no por dibujo.
    const bubble = (href: string, icoSrc: string, title: string, wa = false) => href
      ? `<a href="${href}" title="${title}" class="ab${wa ? " wa" : ""}"><img src="${icoSrc}" width="16" height="16" alt="${title}"></a>`
      : "";
    const actions = (smsHref || telHref || faceHref || mailHref || waHref)
      ? `<div class="actions">
          ${bubble(smsHref, ICO_MSG_PNG, L.actionTitles.msg)}
          ${bubble(telHref, ICO_PHONE_PNG, L.actionTitles.call)}
          ${bubble(faceHref, ICO_VIDEO_PNG, L.actionTitles.facetime)}
          ${bubble(mailHref, ICO_MAIL_PNG, L.actionTitles.email)}
          ${bubble(waHref, ICO_WA_PNG, L.actionTitles.wa, true)}
        </div>`
      : "";
    return `
    <div class="card">
      <div class="avatar-wrap"><img class="avatar" src="${it.photoUrl || AVATAR_FALLBACK_PNG}" alt=""></div>
      <div class="name-row">
        <div class="name">${escapeHtml(it.nombre)}</div>
        <span class="kind-bubble" title="${escapeHtml(kindLabel)}">${KIND_ICON[it.kindKey] || "📅"}</span>
      </div>
      ${it.contexto ? `<div class="context">${escapeHtml(it.contexto)}</div>` : ""}
      ${actions}
      <div class="recordatorio-tag">${L.recordatorio}</div>
      ${it.referencia ? `<div class="detail-row"><span class="k">${L.referido}</span><span>${escapeHtml(it.referencia)}</span></div>` : ""}
    </div>`;
  }).join("");

  const subject = L.subject(items.length);
  const html = `
<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Inter', Arial, sans-serif; background: linear-gradient(180deg, #0d0a07 0%, #171208 45%, #0d0a07 100%);
    color: #e9e4d8; margin: 0; padding: 0; }
  .wrap { max-width: 640px; margin: 0 auto; padding: 64px 20px; }
  .envelope { position: relative; background: linear-gradient(180deg, #8a6529 0%, #3a2e1c 40%, #1c1814 100%);
    border: 1px solid #332a17; border-radius: 20px; overflow: hidden; }
  .brand-watermark { position: absolute; top: -60px; left: 50%; transform: translateX(-50%); width: 480px; max-width: none;
    opacity: 0.14; pointer-events: none; z-index: 0; }
  .body { position: relative; z-index: 1; padding: 60px 32px 52px; }
  .card { text-align: center; padding: 0 0 28px; margin: 0 0 28px; border-bottom: 1px solid rgba(197,160,89,0.18); }
  .card:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
  .avatar-wrap { display: flex; justify-content: center; margin-bottom: 16px; }
  .avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid #c5a059; background: #1c1811; }
  .name-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 12px; }
  .kind-bubble { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; flex: none;
    font-size: 15px; line-height: 1;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(233,217,181,0.35); box-shadow: 0 4px 10px rgba(0,0,0,.3); }
  .name { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 700; color: #f5efe1; margin: 0; }
  .context { font-size: 13px; color: #a99b78; margin: 6px 0 0; }
  .recordatorio-tag { font-size: 11px; font-weight: 800; letter-spacing: 2.2px; color: #8a7c5c; text-transform: uppercase; margin-top: 18px; }
  .detail-row { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 14px; color: #c2bba9; margin-top: 16px; padding-top: 14px; border-top: 1px solid #2c2820; }
  .detail-row .k { color: #8a7c5c; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }
  .actions { display: flex; justify-content: center; gap: 12px; margin-top: 20px; }
  .ab { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px;
    border-radius: 50%; background: rgba(255,255,255,0.06); border: 1px solid rgba(233,217,181,0.3); text-decoration: none; }
  .ab.wa { background: rgba(37,153,64,0.22); border-color: rgba(74,222,128,0.5); }
  .cta-wrap { text-align: center; margin-top: 44px; padding-top: 28px;
    border-top: 1px solid transparent; border-image: linear-gradient(90deg, transparent, #f0d9a4, transparent) 1; }
  .cta { display: inline-block; padding: 17px 48px; background: linear-gradient(135deg, #d9bb80, #b8934f); color: #1a1207;
    font-weight: 800; font-size: 14px; text-decoration: none; border-radius: 10px; letter-spacing: 0.6px; box-shadow: 0 6px 16px rgba(197,160,89,.25); }
  .footer { margin-top: 32px; font-size: 11px; color: #55503f; text-align: center; line-height: 1.8; }
</style></head>
<body><div class="wrap">
  <div class="envelope">
    <img class="brand-watermark" alt="" src="https://www.miamidjbeat.com/Branding%20Invoice.png">
    <div class="body">
      ${cardsHtml}
      <div class="cta-wrap"><a class="cta" href="${CALENDAR_URL}">${L.abrir}</a></div>
    </div>
  </div>
  <div class="footer">
    ${L.footer1}<br>
    ${L.footer2}
  </div>
</div></body></html>`;

  return { subject, html };
}

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

  // Idioma del destinatario real (staff, no cliente): este correo llega a
  // MANAGER_EMAIL, así que el idioma se decide por dj_profiles.language de
  // esa cuenta -- mismo campo que ya usa el resto de la plataforma para
  // ES/EN. Sin match o distinto de 'en' -> español (default actual).
  const { data: staffProfile } = await ADMIN
    .from("dj_profiles")
    .select("language")
    .in("role", ["owner", "admin", "manager"])
    .eq("email", MANAGER_EMAIL)
    .maybeSingle();
  const OWNER_LANG: "es" | "en" = staffProfile?.language === "en" ? "en" : "es";

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

  // Enriquecer cada fila: nombre/telefono/correo del cliente + (si viene de
  // un evento pasado) el venue/tipo, o el/los DJ(s) afiliados. Para
  // cumpleaños/aniversario, client_user_id guarda master_clients.id (mismo
  // cambio que mdj-yearly-recall 2026-09-18) -- master_clients es la fuente
  // deduplicada real, la misma que ya usa get_master_calendar_events() para
  // el calendario.
  const items: ReminderItem[] = [];

  for (const row of pending) {
    const kind = String(row.dedup_key ?? "").split(":")[0] || "yearly_recall";

    let nombre = "Cliente";
    let referencia = "";
    let email = "";
    let telefono = "";
    let photoUrl = "";
    let ownerDjIds: string[] = [];
    // "birthday"/"anniversary" (cliente propio): client_user_id = master_clients.id.
    // "event_anniversary" (evento pasado): client_user_id sigue siendo un
    // client_profiles.user_id real, tal cual lo guarda leads -- no se tocó esa
    // parte de mdj-yearly-recall, así que no se busca en master_clients aquí.
    if (row.client_user_id && kind !== "event_anniversary") {
      const { data: mc } = await ADMIN
        .from("master_clients")
        .select("name, normalized_phone, normalized_email")
        .eq("id", row.client_user_id)
        .maybeSingle();
      nombre = mc?.name || nombre;
      telefono = mc?.normalized_phone || "";
      email = mc?.normalized_email || "";

      // Foto real: master_clients no guarda foto -- pedido del PO (2026-09-23),
      // se busca en Network (network_referencia_contactos), que sí tiene el
      // campo y ya está sincronizada con este mismo cliente (ver
      // master_client_sincronizar_network, 20260920_mis_clientes_conecta_
      // network.sql). Mismo criterio de coincidencia que esa sincronización:
      // últimos 10 dígitos del teléfono, o email exacto. Sin foto -> ícono
      // genérico (fallback), nunca se inventa ni se fuerza el logo de la
      // empresa como si fuera la persona.
      const phone10 = telefono ? telefono.replace(/\D/g, "").slice(-10) : "";
      if (phone10 || email) {
        const { data: refs } = await ADMIN
          .from("network_referencia_contactos")
          .select("telefono, email, photo_url")
          .not("photo_url", "is", null);
        const match = (refs ?? []).find((r: { telefono?: string; email?: string; photo_url?: string }) =>
          (phone10 && r.telefono && r.telefono.replace(/\D/g, "").slice(-10) === phone10) ||
          (email && r.email && r.email.toLowerCase().trim() === email)
        );
        if (match?.photo_url) photoUrl = match.photo_url;
      }

      // DJ(s) afiliados a este cliente maestro -- mismo join que usa
      // get_master_calendar_events() (dj_client_affiliations -> dj_profiles).
      const { data: affs } = await ADMIN
        .from("dj_client_affiliations")
        .select("dj_id")
        .eq("master_client_id", row.client_user_id);
      const djIds = (affs ?? []).map((a: { dj_id: string }) => a.dj_id).filter(Boolean);
      ownerDjIds = djIds;
      if (djIds.length) {
        const { data: djs } = await ADMIN
          .from("dj_profiles")
          .select("stage_name, dj_name, full_name")
          .in("id", djIds);
        const nombres = (djs ?? [])
          .map((d: { stage_name?: string; dj_name?: string; full_name?: string }) => d.stage_name || d.dj_name || d.full_name)
          .filter(Boolean);
        if (nombres.length) referencia = nombres.join(", ");
      }
    } else if (row.client_user_id) {
      const { data: cp } = await ADMIN
        .from("client_profiles")
        .select("full_name, photo_url")
        .eq("user_id", row.client_user_id)
        .maybeSingle();
      nombre = cp?.full_name || nombre;
      photoUrl = cp?.photo_url || "";
    }

    let contexto = "";
    if (row.event_id) {
      const { data: ev } = await ADMIN
        .from("leads")
        .select("event_type, venue, assigned_dj_name")
        .eq("id", row.event_id)
        .maybeSingle();
      if (ev) {
        contexto = `${ev.event_type || "Evento"}${ev.venue ? " en " + ev.venue : ""}`;
        if (ev.assigned_dj_name) referencia = ev.assigned_dj_name;
      }
    }

    items.push({ kindKey: kind, nombre, contexto, referencia, email, telefono, photoUrl, ownerDjIds });
  }

  const { subject, html } = renderEmail(items, OWNER_LANG);

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

  // Ruteo adicional al DJ/vendedor dueño de cada cliente (2026-09-23, pedido
  // del PO): además del resumen completo que recibe MANAGER_EMAIL, cada
  // cumpleaños/aniversario de un cliente afiliado a un DJ específico
  // (dj_client_affiliations, ver find_or_create_master_client) se le manda
  // TAMBIÉN a ese DJ, en su propio correo -- así queda constancia de quién
  // está trabajando/cerrando a ese cliente, para la comisión de esa venta.
  // No bloquea ni reintenta el aviso principal si algo falla aquí -- eso ya
  // quedó marcado 'sent' arriba, el fallo de un correo secundario se registra
  // y sigue.
  const byOwnerDj = new Map<string, ReminderItem[]>();
  for (const it of items) {
    for (const djId of it.ownerDjIds) {
      if (!byOwnerDj.has(djId)) byOwnerDj.set(djId, []);
      byOwnerDj.get(djId)!.push(it);
    }
  }
  for (const [djId, djItems] of byOwnerDj) {
    const { data: djProfile } = await ADMIN
      .from("dj_profiles")
      .select("email, language")
      .eq("id", djId)
      .maybeSingle();
    const djEmail = djProfile?.email?.trim();
    // Sin correo, o el mismo MANAGER_EMAIL (ya lo vio en el resumen de
    // arriba) -> no se duplica.
    if (!djEmail || djEmail.toLowerCase() === MANAGER_EMAIL.toLowerCase()) continue;
    const djLang: "es" | "en" = djProfile?.language === "en" ? "en" : "es";
    const { subject: djSubject, html: djHtml } = renderEmail(djItems, djLang);
    const rr = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [djEmail], subject: djSubject, html: djHtml }),
    });
    if (!rr.ok) {
      const rout = await rr.json().catch(() => ({}));
      console.error(`[notify-yearly-recall] no se pudo notificar al DJ dueño ${djId}:`, JSON.stringify(rout).slice(0, 300));
    }
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
