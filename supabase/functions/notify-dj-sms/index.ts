import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

serve(async (req) => {
  // CRÍTICO: Validación del Bearer Token local
  const authHeader = req.headers.get("Authorization");
  const expectedToken = `Bearer ${Deno.env.get("CRON_EDGE_AUTH_SECRET")}`;
  if (!authHeader || authHeader !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized request" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { reminder_id } = await req.json();
    if (!reminder_id) throw new Error("Missing reminder_id");

    // Idempotency Lock: Tomamos la fila solo si nadie más la ha enviado
    const { data: reminder, error: remError } = await supabase
      .from("event_reminders_queue")
      .update({ processing_started_at: new Date().toISOString() })
      .eq("id", reminder_id)
      .eq("status", "processing")
      .is("sent_at", null)
      .select(`
        *,
        dj:dj_id ( phone, dj_name, language ),
        event:event_id ( venue, start_time )
      `)
      .single();

    if (remError || !reminder) {
      return new Response(
        JSON.stringify({ error: "Idempotency halt: Target is unactionable or already processed" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    const nextAttempt = (reminder.attempt_count || 0) + 1;
    const phone = reminder.dj?.phone;

    // Validación Robusta de Teléfono
    if (!phone || !E164_REGEX.test(phone)) {
        await supabase.from("event_reminders_queue").update({
            status: nextAttempt >= 3 ? "failed" : "pending",
            attempt_count: nextAttempt,
            last_error: "E.164 verification failed. Phone empty or invalid format."
        }).eq("id", reminder_id);
        return new Response(JSON.stringify({ error: "Invalid phone" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Adaptación a la Zona Horaria de Miami para el SMS
    const eventTime = new Date(reminder.event.start_time);
    const miamiTimeDesc = eventTime.toLocaleString("en-US", { 
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
        hour12: true 
    });

    const isSpanish = reminder.dj?.language === 'en' ? false : true;
    let msgBody = "";
    
    // Motor de Traducción Dinámica
    if (reminder.reminder_type === "24h") {
        msgBody = isSpanish 
            ? `MDJPRO ALERT: Mañana tienes cobertura en ${reminder.event.venue} a las ${miamiTimeDesc}. Prepárate.`
            : `MDJPRO ALERT: Tomorrow you have coverage at ${reminder.event.venue} at ${miamiTimeDesc}. Get ready.`;
    } else if (reminder.reminder_type === "2h") {
        msgBody = isSpanish 
            ? `MDJPRO: Faltan 2 Horas para presenciar en ${reminder.event.venue}. Comienza despliegue a locación.`
            : `MDJPRO: 2 Hours until setlist time at ${reminder.event.venue}. Begin deployment to loc.`;
    } else {
        msgBody = isSpanish 
            ? `MDJPRO STANDBY: 30 Minutos. Verifica consola, audio y repórtate listo en cabina (${reminder.event.venue}).`
            : `MDJPRO STANDBY: 30 Minutes. Verify setup and hold ready in booth (${reminder.event.venue}).`;
    }

    // Disparo Nativo a TWILIO SMS REST API
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + btoa(`${sid}:${Deno.env.get("TWILIO_AUTH_TOKEN")!}`)
        },
        body: new URLSearchParams({
            To: phone,
            From: Deno.env.get("TWILIO_PHONE_NUMBER")!,
            Body: msgBody
        }).toString(),
    });

    if (!twilioRes.ok) {
        throw new Error(await twilioRes.text());
    }

    const payload = await twilioRes.json();

    // Sello de Finalización Exitosa
    await supabase.from("event_reminders_queue").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempt_count: nextAttempt,
        provider_message_id: payload.sid,
        last_error: null
    }).eq("id", reminder_id);

    return new Response(JSON.stringify({ success: true, sid: payload.sid }), { status: 200, headers: { "Content-Type": "application/json" } });

  } catch (e) {
      // Intento de rescate si el catch es general (Error de red)
      console.error(e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
