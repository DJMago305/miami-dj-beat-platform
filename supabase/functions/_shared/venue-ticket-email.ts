// Boleto de correo = el MISMO boleto de la página del ticket (web/t.html): tarjeta oscura con borde dorado, evento, fecha·sala, mesa/asiento o admisión,
// titular y, abajo del corte, el QR de ESE pase. El QR codifica https://…/t/<id del pase> (igual que la página); la puerta lee el UUID de ahí.
// Módulo puro (sin APIs de Deno) para poder probarlo fuera del webhook.

export interface EmailPass { id: string; seq: number; label: string; guestName: string | null }
export interface EmailTicketCtx { title: string; when: string; room: string; kind: "tickets" | "tables" }

export function escHtml(v: unknown): string {
    return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

// «Mesa 5 · VIP · asiento 3» → { kind: 'seat', table: '5 · VIP', seat: '3' }; una entrada → { kind: 'adm', adm: tipo } (misma regla que slotOf() de t.html).
export function slotOf(label: string, kind: "tickets" | "tables"): { adm?: string; table?: string; seat?: string } {
    const m = /^(.*?)\s*·\s*asiento\s+(\d+)\s*$/i.exec(String(label || ""));
    if (kind === "tables" || m) {
        const tb = m ? m[1] : String(label || "");
        return { table: tb.replace(/^Mesa\s+/i, ""), seat: m ? m[2] : "" };
    }
    return { adm: String(label || "") };
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const GOLD = "#d4af37";
const DIM = "#a3a7b3";

function slotCell(k: string, v: string): string {
    return `<td style="padding:0 26px 0 0;vertical-align:top"><div style="font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${DIM}">${escHtml(k)}</div><div style="margin-top:2px;font-size:24px;font-weight:800;color:${GOLD};line-height:1.1">${escHtml(v)}</div></td>`;
}

// Una tarjeta de boleto. cid = content_id del QR adjunto (null si no se pudo generar: la tarjeta sale con el enlace).
export function passCardHtml(ctx: EmailTicketCtx, p: EmailPass, cid: string | null, passUrl: string): string {
    const sl = slotOf(p.label, ctx.kind);
    const slot = sl.adm !== undefined
        ? slotCell("Admisión / Admission", sl.adm || (ctx.kind === "tables" ? "Mesa" : "Entrada"))
        : slotCell("Mesa / Table", sl.table || "—") + (sl.seat ? slotCell("Asiento / Seat", sl.seat) : "");
    const meta = [ctx.when, ctx.room].filter(Boolean).join(" · ");
    const holder = p.guestName && p.guestName.trim() ? p.guestName.trim() : "Invitado / Guest";
    const ref = p.id.slice(0, 8).toUpperCase();
    const qr = cid
        ? `<img src="cid:${escHtml(cid)}" alt="QR ${escHtml(ref)}" width="190" height="190" style="display:block;margin:0 auto;width:190px;height:190px;background:#ffffff;padding:10px;border-radius:12px">`
        : "";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;margin:18px 0;background:#12151f;border:1px solid #2b2f3d;border-top:3px solid ${GOLD};border-radius:20px;font-family:${FONT};color:#f3f5ff">
<tr><td style="padding:20px 22px 16px">
<div style="font-size:10.5px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:${GOLD}">Miami DJ Beat</div>
<div style="margin-top:10px;font-size:21px;font-weight:800;line-height:1.15;letter-spacing:.02em;text-transform:uppercase;color:#f3f5ff">${escHtml(ctx.title)}</div>
${meta ? `<div style="margin-top:6px;font-size:13px;line-height:1.45;color:${DIM}">${escHtml(meta)}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>${slot}</tr></table>
<div style="margin-top:16px;font-size:13px;color:${DIM}">Titular / Holder: <b style="color:#f3f5ff">${escHtml(holder)}</b></div>
</td></tr>
<tr><td style="padding:0 16px"><div style="border-top:2px dashed #3a3f4f;height:0;line-height:0;font-size:0">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:20px 22px 22px;text-align:center">
${qr}
<div style="margin-top:10px;font-size:12px;letter-spacing:.18em;color:${DIM}">REF ${escHtml(ref)}</div>
<div style="margin-top:8px;font-size:12px;color:${DIM}">Muestra este código en la puerta. Entra una sola vez. / Show this code at the door. Single entry.</div>
<div style="margin-top:8px;font-size:12px"><a href="${escHtml(passUrl)}" style="color:${GOLD};text-decoration:underline">Abrir este pase / Open this pass</a></div>
</td></tr></table>`;
}

// Todos los boletos de la compra (uno por persona o asiento). Los que pasan del tope (maxInline) se listan con su enlace.
export function passCardsHtml(ctx: EmailTicketCtx, passes: EmailPass[], cidOf: (p: EmailPass) => string | null, urlOf: (p: EmailPass) => string, maxInline: number): string {
    const dentro = passes.slice(0, maxInline), fuera = passes.slice(maxInline);
    let html = dentro.map((p) => passCardHtml(ctx, p, cidOf(p), urlOf(p))).join("\n");
    if (fuera.length) {
        html += `\n<p style="font-size:13px;color:#555">Pases adicionales / More passes (${fuera.length}):<br>${fuera.map((p) => `<a href="${escHtml(urlOf(p))}">${escHtml(p.label || "Pase")} · ${escHtml(p.id.slice(0, 8).toUpperCase())}</a>`).join("<br>")}</p>`;
    }
    return html;
}
