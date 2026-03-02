// supabase/functions/admin-update/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASS = Deno.env.get("ADMIN_PASS")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req) => {
    try {
        const body = await req.json();
        const pass = (body.pass || "").trim();
        if (!pass || pass !== ADMIN_PASS) {
            return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
        }

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

        // Revocation controls
        if (typeof body.revoked === "boolean") {
            patch.revoked = body.revoked;
            if (body.revoked) {
                patch.revoked_at = new Date().toISOString();
                patch.revoked_reason = typeof body.revoked_reason === "string"
                    ? body.revoked_reason.trim() : "Revoked by admin.";
            }
        }
        if (typeof body.suspended === "boolean") patch.suspended = body.suspended;

        // Renew: extend expires_at by 12 months from now
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

        const { data, error } = await sb
            .from("certificates")
            .update(patch)
            .eq("cert_id", cert_id)
            .select("*")
            .single();

        if (error) {
            return new Response(JSON.stringify({ ok: false, error }), { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
    }
});
