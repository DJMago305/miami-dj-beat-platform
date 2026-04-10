import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

// El secreto configurado en los Environment Variables de Supabase (sin fallbacks hardcodeados)
const EXPECTED_SECRET = Deno.env.get("WEBHOOK_SECRET")

serve(async (req) => {
    try {
        // --- 1. BLOQUEO DE SEGURIDAD (WEBHOOK SECRET) ---
        const secretHeader = req.headers.get("x-webhook-secret");
        if (!EXPECTED_SECRET || !secretHeader || secretHeader !== EXPECTED_SECRET) {
            console.error("Acceso Denegado: Secreto Invalido o no configurado en Entorno");
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }
        
        // --- 2. CONTROL DE ALCANCE OPERATIVO ---
        const payload = await req.json();
        const note = payload.record; 
        
        // Ignorar si no es nota del manager (Eliminando ruido logístico irrelevante)
        if (!note || note.type !== 'manager') {
            return new Response(JSON.stringify({ aborted: true, reason: "No es nota operativa" }), { status: 200 });
        }

        // --- 3. REGLA DE NEGOCIO (PREFERENCIAS) ---
        const supabase = createClient(supabaseUrl!, supabaseKey!); // Usa Service Role para leer
        const { data: profile } = await supabase
            .from('dj_profiles')
            .select('email, notify_inbox_email, stage_name')
            .eq('user_id', note.dj_uuid)
            .single();

        // Abortar silenciosamente si desactivó alertas o su email está roto
        if (!profile || profile.notify_inbox_email === false || !profile.email) {
            return new Response(JSON.stringify({ aborted: true, reason: "DJ opt-out o no tiene email configurado" }), { status: 200 });
        }

        // --- 4. EJECUCIÓN DEL ENVÍO ---
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                from: "MDJPRO Operaciones <ops@miamidjbeat.com>",
                to: profile.email,
                subject: `📌 Mensaje Logístico Operativo: ${note.title || 'Evento'}`,
                html: `
                    <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; background: #fff; padding: 20px;">
                        <h2 style="color: #000;">Hola ${profile.stage_name},</h2>
                        <p>Tienes un nuevo mensaje logístico pendiente enviado por el Manager:</p>
                        <div style="padding: 15px; border-left: 4px solid #C5A059; background: #f9f9f9; color: #333; margin: 20px 0;">
                            ${note.body}
                        </div>
                        <p style="font-size: 0.9em; color: #666;"><strong>Prioridad:</strong> ${note.priority}</p>
                        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
                        <p style="font-size: 0.85em;"><a href="https://app.miamidjbeat.com/dj-dashboard.html" style="color: #C5A059; text-decoration: none; font-weight: bold;">► Entrar a tu Dashboard para ver detalles</a></p>
                    </div>
                `
            })
        });

        const resData = await response.json();
        return new Response(JSON.stringify(resData), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
})
