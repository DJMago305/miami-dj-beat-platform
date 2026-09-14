// supabase/functions/admin-update/index.ts
//
// FIX-ADMIN-UPDATE-OWNER-AUTH (2026-09-13): antes este endpoint solo pedía un
// ADMIN_PASS compartido en texto plano dentro del body -- cualquiera con esa
// contraseña podía revocar cualquier certificado sin dejar rastro de quién lo
// hizo. Ahora exige el JWT real de la sesión (mismo patrón que
// create-course-checkout/index.ts) y compara auth.getUser(jwt).id contra
// OWNER_USER_ID (env var, nunca hardcodeado) -- solo esa cuenta puede tocar
// certificates desde aquí. Toda acción de gobernanza (revoke/suspend/
// reinstate) además exige board_case_number + reason y queda escrita en
// certificate_revocation_log, que es de solo-escritura (ver migración
// 20260913160000_certificates_status_and_revocation_log.sql).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OWNER_USER_ID = Deno.env.get("OWNER_USER_ID")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/** Acciones de gobernanza que cambian `status` y exigen expediente + motivo. */
type GovernanceAction = "revoke" | "suspend" | "reinstate";

serve(async (req) => {
    try {
        // ── Identidad real del Owner vía JWT (reemplaza ADMIN_PASS) ──────────
        const authHeader = req.headers.get("Authorization") ?? "";
        const jwt = authHeader.replace("Bearer ", "").trim();
        if (!jwt) {
            return new Response(JSON.stringify({ ok: false, error: "No authorization token" }), { status: 401 });
        }

        const { data: { user }, error: authError } = await sb.auth.getUser(jwt);
        if (authError || !user) {
            return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
        }
        if (!OWNER_USER_ID || user.id !== OWNER_USER_ID) {
            return new Response(JSON.stringify({ ok: false, error: "Forbidden: Owner-only endpoint" }), { status: 403 });
        }

        const body = await req.json();
        const cert_id = (body.cert_id || "").trim();
        if (!/^MDB-\d{8}-[0-9A-Z]{4}$/.test(cert_id)) {
            return new Response(JSON.stringify({ ok: false, error: "Invalid cert_id" }), { status: 400 });
        }

        // Only these fields are allowed to be updated
        const patch: Record<string, unknown> = {};
        if (typeof body.practical_score === "number") patch.practical_score = body.practical_score;
        if (typeof body.practical_pct === "number") patch.practical_pct = body.practical_pct;
        if (typeof body.graduated === "boolean") patch.graduated = body.graduated;
        if (typeof body.instructor === "string") patch.instructor = body.instructor;
        if (typeof body.venue === "string") patch.venue = body.venue;

        // ── Gobernanza: revoke / suspend / reinstate cambian `status` ────────
        let governanceAction: GovernanceAction | null = null;

        if (typeof body.revoked === "boolean") {
            patch.revoked = body.revoked;
            if (body.revoked) {
                patch.revoked_at = new Date().toISOString();
                patch.revoked_reason = typeof body.revoked_reason === "string" ? body.revoked_reason.trim() : "";
                governanceAction = "revoke";
            } else {
                patch.revoked_reason = null;
                patch.revoked_at = null;
                governanceAction = "reinstate";
            }
        }
        if (typeof body.suspended === "boolean") {
            patch.suspended = body.suspended;
            if (!governanceAction) governanceAction = body.suspended ? "suspend" : "reinstate";
        }

        // Expediente de The Board + motivo formal: obligatorios para cualquier
        // alteración de estatus. Sin esto, no se aplica el cambio.
        let boardCaseNumber = "";
        let reason = "";
        if (governanceAction) {
            boardCaseNumber = typeof body.board_case_number === "string" ? body.board_case_number.trim() : "";
            reason = typeof body.reason === "string" ? body.reason.trim()
                : (typeof body.revoked_reason === "string" ? body.revoked_reason.trim() : "");
            if (!boardCaseNumber || !reason) {
                return new Response(JSON.stringify({
                    ok: false,
                    error: "board_case_number and reason are required for revoke/suspend/reinstate actions",
                }), { status: 400 });
            }
        }

        // Renew: extend expires_at by 12 months from now (no altera `status`,
        // no requiere expediente -- es renovación de rutina, no una decisión
        // disciplinaria de The Board).
        if (body.action === "renew") {
            const renewed = new Date();
            renewed.setFullYear(renewed.getFullYear() + 1);
            patch.expires_at = renewed.toISOString();
        }

        // Public profile fields (directory display)
        if (typeof body.city === "string") patch.city = body.city.trim();
        if (typeof body.genres === "string") patch.genres = body.genres.trim();
        if (typeof body.instagram === "string") patch.instagram = body.instagram.trim();
        if (typeof body.photo_url === "string") patch.photo_url = body.photo_url.trim();
        if (typeof body.headline === "string") patch.headline = body.headline.trim();

        // Estado previo -- solo hace falta cuando se va a escribir la bitácora.
        let previousStatus: string | null = null;
        if (governanceAction) {
            const { data: before, error: beforeError } = await sb
                .from("certificates")
                .select("status")
                .eq("cert_id", cert_id)
                .single();
            if (beforeError) {
                return new Response(JSON.stringify({ ok: false, error: beforeError }), { status: 500 });
            }
            previousStatus = before?.status ?? null;
        }

        const { data, error } = await sb
            .from("certificates")
            .update(patch)
            .eq("cert_id", cert_id)
            .select("*")
            .single();

        if (error) {
            return new Response(JSON.stringify({ ok: false, error }), { status: 500 });
        }

        // ── Bitácora inmutable -- solo se agrega, nunca se edita ni se borra ──
        if (governanceAction) {
            // Firma simulada (no es una firma criptográfica real, es un token
            // determinístico) -- mismo criterio de honestidad que el "Security
            // Hash" del diploma: se etiqueta por lo que es.
            const signaturePayload = `${cert_id}-${governanceAction}-${boardCaseNumber}-${user.id}-${Date.now()}`;
            const ownerSignature = btoa(signaturePayload).replace(/[^A-Za-z0-9]/g, "").slice(0, 32).toUpperCase();

            const { error: logError } = await sb.from("certificate_revocation_log").insert({
                cert_id,
                action: governanceAction,
                previous_status: previousStatus,
                new_status: data.status,
                board_case_number: boardCaseNumber,
                reason,
                owner_user_id: user.id,
                owner_signature: ownerSignature,
            });

            if (logError) {
                console.error("[admin-update] Failed to write audit log:", logError);
                return new Response(JSON.stringify({
                    ok: true,
                    data,
                    warning: "Certificate updated but the audit log write failed — investigate immediately.",
                }), { status: 200 });
            }
        }

        return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
    }
});
