// supabase/functions/send-certificate/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Miami DJ Beat <no-reply@yourdomain.com>";

serve(async (req) => {
    try {
        if (!RESEND_API_KEY) {
            return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY not configured" }), { status: 500 });
        }
        const body = await req.json();
        const email = (body.email || "").trim();
        const dj_name = (body.dj_name || "").trim();
        const cert_id = (body.cert_id || "").trim();
        const status = (body.status || "").trim();
        const public_year = body.public_year ?? null;
        const public_seq = body.public_seq ?? null;
        const reg = (public_year && public_seq)
            ? `${public_year}-${String(public_seq).padStart(6, "0")}` : null;

        if (!email || !cert_id) {
            return new Response(JSON.stringify({ ok: false, error: "Missing email or cert_id" }), { status: 400 });
        }

        const verifyLink = `${body.verify_base_url || "https://miamidjbeat.vercel.app/verify.html"}?id=${encodeURIComponent(cert_id)}`;

        const subject = `Miami DJ Beat — Certificate ID ${cert_id}`;
        const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.4">
        <h2>Miami DJ Beat — Certification</h2>
        <p><strong>DJ:</strong> ${escapeHtml(dj_name || "DJ")}</p>
        <p><strong>Certificate ID:</strong> ${escapeHtml(cert_id)}</p>
        ${reg ? `<p><strong>Registry:</strong> ${reg}</p>` : ""}
        ${status ? `<p><strong>Status:</strong> ${escapeHtml(status)}</p>` : ""}
        <p>Verify anytime here:</p>
        <p><a href="${verifyLink}">${verifyLink}</a></p>
        <hr />
        <p style="color:#666">This email was generated automatically.</p>
      </div>
    `;

        const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [email],
                subject,
                html,
            }),
        });

        const out = await r.json();
        if (!r.ok) {
            return new Response(JSON.stringify({ ok: false, resend: out }), { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true, resend: out }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
    }
});

function escapeHtml(s: string) {
    return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
