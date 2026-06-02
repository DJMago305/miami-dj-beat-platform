/**
 * notify-portal-message — Miami DJ Beat
 * Triggered by Postgres (pg_net) or client invoke on INSERT into portal_messages.
 * Sends transactional email via Resend (HTML + plain text, deliverability headers).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
const PORTAL_NOTIFY_SECRET = Deno.env.get("PORTAL_NOTIFY_SECRET");
const PORTAL_BASE_URL = (Deno.env.get("SITE_URL") || "https://miamidjbeat.com").replace(/\/$/, "");
const OWNER_EMAIL = normalizeEmail(Deno.env.get("MDJ_OWNER_EMAIL") || "miamidjbeat@gmail.com");
const REPLY_TO_EMAIL = normalizeEmail(Deno.env.get("REPLY_TO_EMAIL") || OWNER_EMAIL);
const FROM_EMAIL_RAW = Deno.env.get("FROM_EMAIL") || "";
const RESEND_FROM_DOMAIN = (Deno.env.get("RESEND_FROM_DOMAIN") || "").trim();
const BRAND_NAME = "Miami DJ Beat";
const POSTAL_ADDRESS = "Miami DJ Beat LLC · Miami, FL · United States";

const DEBOUNCE_MS = 120_000;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204 });
    }
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            return new Response(JSON.stringify({ error: "Supabase env missing" }), { status: 500 });
        }

        const rawBody = await req.text();
        if (!rawBody || !rawBody.trim()) {
            console.warn("[notify-portal-message] empty request body — ignored");
            return new Response(JSON.stringify({ error: "empty_body" }), { status: 400 });
        }

        let payload: Record<string, unknown>;
        try {
            payload = JSON.parse(rawBody);
        } catch (parseErr) {
            console.error("[notify-portal-message] invalid JSON body", {
                preview: rawBody.slice(0, 240),
                error: String(parseErr)
            });
            return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
        }

        const msg = (payload?.record ?? payload) as {
            id?: string;
            lead_id?: string;
            sender_id?: string;
            sender_role?: string;
            body?: string;
        };

        const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
        const authOk = await authorizeRequest(req, sb, msg);
        if (!authOk) {
            console.error("[notify-portal-message] Unauthorized");
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        if (!RESEND_API_KEY) {
            console.error("[notify-portal-message] RESEND_API_KEY missing");
            return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
        }

        console.log("[notify-portal-message] triggered — sender_role:", msg?.sender_role, "lead:", msg?.lead_id);

        if (!msg?.lead_id || !msg?.body) {
            return new Response(JSON.stringify({ aborted: true, reason: "invalid_record" }), { status: 200 });
        }

        const senderRole = String(msg.sender_role || "").toLowerCase();
        const isClientMsg = senderRole === "client";
        const isStaffMsg = senderRole === "manager" || senderRole === "admin" || senderRole === "owner";

        if (!isClientMsg && !isStaffMsg) {
            return new Response(JSON.stringify({ aborted: true, reason: "unsupported_sender_role" }), { status: 200 });
        }

        const direction = isClientMsg ? "client_to_staff" : "staff_to_client";

        const debounced = await shouldDebounceEmail(sb, msg.lead_id, direction);
        if (debounced) {
            console.log("[notify-portal-message] debounced", direction, msg.lead_id);
            return new Response(JSON.stringify({ debounced: true, direction, lead_id: msg.lead_id }), { status: 200 });
        }

        const { data: lead } = await sb
            .from("leads")
            .select("id, email, full_name, event_type, event_date, assigned_staff_id, assigned_staff_name, client_user_id")
            .eq("id", msg.lead_id)
            .maybeSingle();

        if (!lead) {
            return new Response(JSON.stringify({ aborted: true, reason: "lead_not_found" }), { status: 200 });
        }

        const eventLabel = [lead.event_type, lead.event_date].filter(Boolean).join(" · ");
        const clientName = lead.full_name || lead.email || "Your client";
        const snippet = String(msg.body).length > 120
            ? String(msg.body).slice(0, 117) + "…"
            : String(msg.body);

        const clientPortalLink = `${PORTAL_BASE_URL}/client-portal.html?lead=${lead.id}`;
        const staffPortalLink = `${PORTAL_BASE_URL}/client-portal.html?mode=manager&lead=${lead.id}`;

        if (isClientMsg) {
            let staffEmail = OWNER_EMAIL;
            let staffName = "Miami DJ Beat Team";

            if (lead.assigned_staff_id) {
                try {
                    const { data: staffUser } = await sb.auth.admin.getUserById(lead.assigned_staff_id);
                    const staffAddr = normalizeEmail(staffUser?.user?.email);
                    if (staffAddr) {
                        staffEmail = staffAddr;
                        staffName = lead.assigned_staff_name || staffEmail;
                    }
                } catch (e) {
                    console.warn("[notify-portal-message] staff email lookup failed:", e);
                }
            }

            const mail = buildStaffEmail({
                staffName,
                clientName,
                snippet,
                eventLabel,
                portalLink: staffPortalLink,
                leadId: lead.id
            });

            const resStaff = await sendEmail({
                to: staffEmail,
                subject: mail.subject,
                html: mail.html,
                text: mail.text,
                preheader: mail.preheader
            });

            const ownerNorm = OWNER_EMAIL.toLowerCase();
            const staffNorm = staffEmail.toLowerCase();
            let resOwner: SendEmailResult | null = null;
            if (ownerNorm && ownerNorm !== staffNorm) {
                resOwner = await sendEmail({
                    to: OWNER_EMAIL,
                    subject: `[Owner] ${mail.subject}`,
                    html: mail.html,
                    text: mail.text,
                    preheader: mail.preheader
                });
            }

            await markEmailSent(sb, msg.lead_id, direction);
            return new Response(
                JSON.stringify({
                    sent: true,
                    to: "staff",
                    email: staffEmail,
                    resend_id: resStaff.id,
                    owner_copy: !!resOwner,
                    owner_resend_id: resOwner?.id ?? null
                }),
                { status: 200 }
            );
        }

        const clientEmail = normalizeEmail(lead.email);
        if (!clientEmail) {
            return new Response(JSON.stringify({ aborted: true, reason: "no_client_email" }), { status: 200 });
        }

        const handlerName = lead.assigned_staff_name || "Your Miami DJ Beat team";
        const mailClient = buildClientEmail({
            clientName,
            handlerName,
            snippet,
            eventLabel,
            portalLink: clientPortalLink
        });

        const resClient = await sendEmail({
            to: clientEmail,
            subject: mailClient.subject,
            html: mailClient.html,
            text: mailClient.text,
            preheader: mailClient.preheader
        });

        await markEmailSent(sb, msg.lead_id, direction);
        return new Response(
            JSON.stringify({ sent: true, to: "client", email: clientEmail, resend_id: resClient.id }),
            { status: 200 }
        );
    } catch (err) {
        console.error("[notify-portal-message] unhandled", err);
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
});

// ── Resend / deliverability ───────────────────────────────────────────────────

function normalizeEmail(raw: string | null | undefined): string {
    if (!raw) return "";
    const s = String(raw).trim().toLowerCase();
    const m = s.match(/<([^>]+)>/);
    const addr = (m ? m[1] : s).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return "";
    return addr;
}

/** Professional From — prefer verified domain: RESEND_FROM_DOMAIN or FROM_EMAIL secret. */
function resolveFromHeader(): string {
    const raw = FROM_EMAIL_RAW.trim();
    if (raw) {
        if (/<[^>]+@[^>]+>/.test(raw)) return raw;
        if (raw.includes("@")) return `${BRAND_NAME} <${raw}>`;
    }
    if (RESEND_FROM_DOMAIN && !RESEND_FROM_DOMAIN.includes("@")) {
        return `${BRAND_NAME} <no-reply@${RESEND_FROM_DOMAIN}>`;
    }
    return `${BRAND_NAME} <onboarding@resend.dev>`;
}

function sanitizeSubject(subject: string): string {
    return String(subject || "")
        .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);
}

type SendEmailResult = { ok: true; id?: string; to: string; status: number };

async function sendEmail(opts: {
    to: string;
    subject: string;
    html: string;
    text: string;
    preheader?: string;
}): Promise<SendEmailResult> {
    const to = normalizeEmail(opts.to);
    if (!to) {
        throw new Error("Invalid recipient email");
    }

    const from = resolveFromHeader();
    const subject = sanitizeSubject(opts.subject);
    const replyTo = REPLY_TO_EMAIL || OWNER_EMAIL;

    const payload: Record<string, unknown> = {
        from,
        to: [to],
        subject,
        html: opts.html,
        text: opts.text,
        reply_to: replyTo ? [replyTo] : undefined,
        headers: {
            "List-Unsubscribe": `<mailto:${replyTo || OWNER_EMAIL}?subject=unsubscribe-portal-notifications>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "X-Entity-Ref-ID": `portal-chat-${Date.now()}`
        },
        tags: [
            { name: "category", value: "portal_chat" },
            { name: "brand", value: "miami_dj_beat" }
        ]
    };

    console.log("[notify-portal-message] Resend request", {
        from,
        to,
        subject,
        reply_to: replyTo,
        html_bytes: opts.html.length,
        text_bytes: opts.text.length
    });

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const rawBody = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try {
        parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {
        parsed = null;
    }

    if (!res.ok) {
        console.error("[notify-portal-message] Resend API error", {
            http_status: res.status,
            http_status_text: res.statusText,
            resend_body: parsed ?? rawBody,
            from,
            to,
            subject,
            hint: res.status === 403
                ? "Domain not verified in Resend — set FROM_EMAIL to a verified sender or add RESEND_FROM_DOMAIN"
                : res.status === 422
                ? "Invalid from/to — check FROM_EMAIL format: Name <email@verified-domain.com>"
                : "See https://resend.com/docs/api-reference/emails/send-email"
        });
        throw new Error(`Resend error ${res.status}: ${rawBody}`);
    }

    const resendId = typeof parsed?.id === "string" ? parsed.id : undefined;
    console.log("[notify-portal-message] Resend accepted", {
        http_status: res.status,
        resend_id: resendId,
        resend_body: parsed ?? rawBody,
        to,
        from,
        subject
    });

    return { ok: true, id: resendId, to, status: res.status };
}

// ── Email content builders ────────────────────────────────────────────────────

type EmailContent = { subject: string; html: string; text: string; preheader: string };

function buildStaffEmail(opts: {
    staffName: string;
    clientName: string;
    snippet: string;
    eventLabel: string;
    portalLink: string;
    leadId: string;
}): EmailContent {
    const { staffName, clientName, snippet, eventLabel, portalLink, leadId } = opts;
    const subject = `New client message from ${clientName} — ${BRAND_NAME}`;
    const preheader = `${clientName} wrote in the event portal. Open to reply.`;
    const headline = `${clientName} sent you a message about their event.`;
    return {
        subject,
        preheader,
        html: emailShell({
            lang: "en",
            title: "New client message",
            preheader,
            greeting: `Hi ${escHtml(staffName)},`,
            headline: escHtml(headline),
            snippet,
            eventLabel,
            ctaLabel: "View and reply in portal",
            ctaHref: portalLink,
            footerLine1: POSTAL_ADDRESS,
            footerLine2: `Lead reference: ${escHtml(leadId)}`
        }),
        text: emailPlainText({
            greeting: `Hi ${staffName},`,
            headline,
            snippet,
            eventLabel,
            ctaHref: portalLink,
            footer: `${POSTAL_ADDRESS}\nLead: ${leadId}`
        })
    };
}

function buildClientEmail(opts: {
    clientName: string;
    handlerName: string;
    snippet: string;
    eventLabel: string;
    portalLink: string;
}): EmailContent {
    const { clientName, handlerName, snippet, eventLabel, portalLink } = opts;
    const subject = `Your event team replied — ${BRAND_NAME}`;
    const preheader = `${handlerName} replied in your Miami DJ Beat event portal.`;
    const headline = `${handlerName} replied to your message.`;
    return {
        subject,
        preheader,
        html: emailShell({
            lang: "en",
            title: "Your team replied",
            preheader,
            greeting: `Hi ${escHtml(clientName)},`,
            headline: escHtml(headline),
            snippet,
            eventLabel,
            ctaLabel: "Open your event portal",
            ctaHref: portalLink,
            footerLine1: POSTAL_ADDRESS,
            footerLine2: `Questions? Reply to ${escHtml(REPLY_TO_EMAIL || OWNER_EMAIL)}`
        }),
        text: emailPlainText({
            greeting: `Hi ${clientName},`,
            headline,
            snippet,
            eventLabel,
            ctaHref: portalLink,
            footer: POSTAL_ADDRESS
        })
    };
}

function emailPlainText(opts: {
    greeting: string;
    headline: string;
    snippet: string;
    eventLabel: string;
    ctaHref: string;
    footer: string;
}): string {
    const lines = [
        opts.greeting,
        "",
        opts.headline,
        "",
        `"${opts.snippet}"`,
        opts.eventLabel ? `\nEvent: ${opts.eventLabel}` : "",
        "",
        `Open your portal: ${opts.ctaHref}`,
        "",
        opts.footer,
        "",
        `${BRAND_NAME} — transactional notification about your event portal.`
    ];
    return lines.filter((l) => l !== undefined).join("\n");
}

function emailShell(opts: {
    lang: string;
    title: string;
    preheader: string;
    greeting: string;
    headline: string;
    snippet: string;
    eventLabel: string;
    ctaLabel: string;
    ctaHref: string;
    footerLine1: string;
    footerLine2: string;
}): string {
    const safeHref = escHtml(opts.ctaHref);
    return `<!DOCTYPE html>
<html lang="${escHtml(opts.lang)}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escHtml(opts.title)} — ${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;">${escHtml(opts.preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#12141c;border-radius:10px;border:1px solid #c9a84c;overflow:hidden;">
          <tr>
            <td style="background-color:#d4af37;padding:18px 28px;">
              <h1 style="margin:0;font-size:16px;line-height:1.3;color:#0a0a0a;font-weight:800;letter-spacing:0.04em;">${BRAND_NAME.toUpperCase()} — ${escHtml(opts.title.toUpperCase())}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#b8bcc8;">${opts.greeting}</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#ffffff;font-weight:700;">${opts.headline}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background-color:rgba(255,255,255,0.06);border-left:3px solid #d4af37;border-radius:4px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0;font-size:13px;line-height:1.55;color:#e2e4ea;font-style:italic;">&ldquo;${escHtml(opts.snippet)}&rdquo;</p>
                  </td>
                </tr>
              </table>
              ${opts.eventLabel ? `<p style="margin:0 0 20px;font-size:12px;line-height:1.5;color:#9ca3af;">Event: ${escHtml(opts.eventLabel)}</p>` : ""}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-radius:6px;background-color:#d4af37;">
                    <a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:800;color:#0a0a0a;text-decoration:none;letter-spacing:0.02em;">${escHtml(opts.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 8px;font-size:11px;line-height:1.5;color:#6b7280;">${opts.footerLine1}</p>
              <p style="margin:0;font-size:10px;line-height:1.5;color:#4b5563;">${opts.footerLine2}</p>
              <p style="margin:16px 0 0;font-size:10px;line-height:1.5;color:#4b5563;">If the button does not work, copy this link:<br /><a href="${safeHref}" style="color:#d4af37;word-break:break-all;" rel="noopener noreferrer">${safeHref}</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escHtml(s: string) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ── Auth & debounce (unchanged logic) ─────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const pad = "=".repeat((4 - (b64.length % 4)) % 4);
        return JSON.parse(atob(b64 + pad)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function bearerIsServiceRole(token: string): boolean {
    const payload = decodeJwtPayload(token);
    return payload?.role === "service_role";
}

async function authorizeRequest(
    req: Request,
    sb: ReturnType<typeof createClient>,
    msg: { id?: string; lead_id?: string; sender_id?: string; sender_role?: string; body?: string }
): Promise<boolean> {
    const auth = (req.headers.get("Authorization") || "").trim();
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    const apikey = (req.headers.get("apikey") || "").trim();

    if (serviceKey && bearer && bearer === serviceKey) {
        return true;
    }
    if (serviceKey && apikey && apikey === serviceKey) {
        return true;
    }
    if (bearer && bearerIsServiceRole(bearer)) {
        return true;
    }

    const secret = req.headers.get("x-webhook-secret");
    if (WEBHOOK_SECRET && secret && secret === WEBHOOK_SECRET) {
        return true;
    }
    const portalSecret = req.headers.get("x-portal-notify-secret");
    if (PORTAL_NOTIFY_SECRET && portalSecret && portalSecret === PORTAL_NOTIFY_SECRET) {
        return true;
    }

    if (bearer && msg?.sender_id) {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
        if (anonKey) {
            try {
                const userClient = createClient(SUPABASE_URL!, anonKey, {
                    global: { headers: { Authorization: `Bearer ${bearer}` } }
                });
                const { data: userData } = await userClient.auth.getUser();
                const uid = userData?.user?.id;
                if (uid && uid === msg.sender_id && await verifyPortalMessageRow(sb, msg)) {
                    return true;
                }
            } catch (e) {
                console.warn("[notify-portal-message] user jwt auth failed", e);
            }
        }
    }

    if (await verifyPortalMessageRow(sb, msg)) {
        return true;
    }

    console.warn("[notify-portal-message] auth rejected", {
        has_bearer: !!bearer,
        bearer_len: bearer.length,
        service_key_len: serviceKey.length,
        has_apikey: !!apikey
    });
    return false;
}

async function verifyPortalMessageRow(
    sb: ReturnType<typeof createClient>,
    msg: { id?: string; lead_id?: string; sender_id?: string; sender_role?: string; body?: string }
): Promise<boolean> {
    if (!msg?.lead_id || !msg?.body || !msg?.sender_role) {
        return false;
    }
    try {
        if (msg.id) {
            const { data: byId } = await sb
                .from("portal_messages")
                .select("id, lead_id, sender_id, sender_role, body")
                .eq("id", msg.id)
                .maybeSingle();
            if (byId && byId.lead_id === msg.lead_id && byId.body === msg.body) {
                return true;
            }
        }
        const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data: recent } = await sb
            .from("portal_messages")
            .select("id")
            .eq("lead_id", msg.lead_id)
            .eq("sender_role", msg.sender_role)
            .eq("body", msg.body)
            .gte("created_at", since)
            .limit(1)
            .maybeSingle();
        return !!recent?.id;
    } catch (e) {
        console.warn("[notify-portal-message] verify row failed", e);
        return false;
    }
}

async function shouldDebounceEmail(
    sb: ReturnType<typeof createClient>,
    leadId: string,
    direction: string
): Promise<boolean> {
    const { data: row } = await sb
        .from("portal_chat_email_notify_log")
        .select("last_sent_at")
        .eq("lead_id", leadId)
        .eq("direction", direction)
        .maybeSingle();

    if (!row?.last_sent_at) {
        return false;
    }
    const elapsed = Date.now() - new Date(row.last_sent_at).getTime();
    return elapsed < DEBOUNCE_MS;
}

async function markEmailSent(
    sb: ReturnType<typeof createClient>,
    leadId: string,
    direction: string
): Promise<void> {
    const { error } = await sb.from("portal_chat_email_notify_log").upsert(
        { lead_id: leadId, direction, last_sent_at: new Date().toISOString() },
        { onConflict: "lead_id,direction" }
    );
    if (error) {
        console.warn("[notify-portal-message] debounce log upsert failed:", error.message);
    }
}
