// supabase/functions/mdj-yearly-recall/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pieza 3 (docs/diseno-calendario-cliente-fase2.md): "memoria anual". Corre
// una vez al día vía pg_cron y busca, entre los eventos YA REALIZADOS
// (leads.event_completed_at no nulo) y las fechas propias del cliente
// (master_clients.birthday / wedding_anniversary), cualquier mes/día que
// coincida con HOY + WINDOW_DAYS -- si hay coincidencia, encola un aviso en
// event_reminders_queue (reminder_type='yearly_recall') para que STAFF de
// seguimiento con tiempo de sobra, no el mismo día.
//
// 2026-09-18: corregido para leer master_clients (Fase 2, deduplicado por
// master_client -- el mismo que ya usa get_master_calendar_events() para el
// calendario) en vez de client_profiles (Fase 1). client_profiles tiene 0
// filas con birth_date/wedding_anniversary cargados -- la cola nunca se
// llenó por leer de la tabla equivocada, no por un bug de lógica. event_id
// sigue siendo real (leads.id) solo para la pieza 2 (aniversario de evento);
// para cumpleaños/aniversario de cliente, client_user_id ahora guarda
// master_clients.id (no tiene FK que lo impida -- columna libre).
//
// Mismo patrón de disparo que send-reminder-sms: pg_cron llama con
// Authorization: Bearer $CRON_EDGE_AUTH_SECRET (secreto estático de sistema,
// sin sesión de usuario). No hay disparo manual de staff todavía -- si hace
// falta forzar una corrida puntual, se agrega igual que el ?id= de
// send-reminder-sms cuando se necesite.
//
// No envía nada directo al cliente por su cuenta -- Pieza 3 es sobre
// AYUDAR a Miami DJ Beat a acordarse, no sobre escribirle solo al cliente.
// El texto final que STAFF (o ELIXIS, más adelante) le manda al cliente se
// redacta aparte; esta función solo detecta la fecha y dispara SEÑAL.
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

// Cuántos días antes de la fecha real se avisa a STAFF -- da tiempo real de
// planear seguimiento en vez de enterarse el mismo día.
const WINDOW_DAYS = 14;

function verifyCron(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cronSecret = Deno.env.get("CRON_EDGE_AUTH_SECRET") ?? "";
  return !!cronSecret && jwt === cronSecret;
}

function monthDay(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function targetMonthDays(): string[] {
  // Ventana de días futuros a vigilar desde hoy -- incluye hoy mismo por si
  // el cron se cae un día y hay que alcanzar la fecha exacta igual.
  const out: string[] = [];
  const base = new Date();
  for (let i = 0; i <= WINDOW_DAYS; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(monthDay(d));
  }
  return out;
}

async function alreadyQueued(dedupKey: string): Promise<boolean> {
  const { data } = await ADMIN
    .from("event_reminders_queue")
    .select("id")
    .eq("reminder_type", "yearly_recall")
    .eq("dedup_key", dedupKey)
    .maybeSingle();
  return !!data;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), { status: 405 });
  }
  if (!verifyCron(req)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_credentials" }), { status: 401 });
  }

  const wanted = new Set(targetMonthDays());
  const thisYear = new Date().getUTCFullYear();
  let queued = 0;

  // ── 1. Cumpleaños / aniversario de boda propios del cliente ──
  // master_clients, no client_profiles: es la fuente deduplicada real que ya
  // usa get_master_calendar_events() para el calendario -- un mismo cliente
  // atendido por varios DJs vive UNA sola vez aquí.
  const { data: clients, error: clientsErr } = await ADMIN
    .from("master_clients")
    .select("id, name, birthday, wedding_anniversary");

  if (clientsErr) {
    console.error("[mdj-yearly-recall] master_clients read failed:", clientsErr);
  } else {
    for (const c of clients ?? []) {
      const checks: Array<[string, string | null]> = [
        ["birthday", c.birthday],
        ["anniversary", c.wedding_anniversary],
      ];
      for (const [kind, dateStr] of checks) {
        if (!dateStr) continue;
        const d = new Date(dateStr + "T00:00:00Z");
        if (!wanted.has(monthDay(d))) continue;

        const yearTag = String(thisYear);
        const dedupKey = `${kind}:${c.id}:${yearTag}`;
        if (await alreadyQueued(dedupKey)) continue;

        const label = kind === "birthday" ? "cumpleaños" : "aniversario de boda";
        const { error: insErr } = await ADMIN.from("event_reminders_queue").insert({
          client_user_id: c.id,
          dedup_key: dedupKey,
          reminder_type: "yearly_recall",
          status: "pending",
          scheduled_for: new Date().toISOString(),
        });
        if (insErr) {
          console.error(`[mdj-yearly-recall] insert failed (${dedupKey}):`, insErr);
          continue;
        }
        console.log(`[mdj-yearly-recall] ${label} próximo: ${c.name ?? c.id}`);
        queued++;
      }
    }
  }

  // ── 2. Aniversario de un evento ya realizado (mismo mes/día, años atrás) ──
  const { data: pastEvents, error: leadsErr } = await ADMIN
    .from("leads")
    .select("id, client_user_id, event_type, event_date")
    .not("event_completed_at", "is", null)
    .not("client_user_id", "is", null)
    .not("event_date", "is", null);

  if (leadsErr) {
    console.error("[mdj-yearly-recall] leads read failed:", leadsErr);
  } else {
    for (const ev of pastEvents ?? []) {
      const d = new Date(ev.event_date + "T00:00:00Z");
      if (!wanted.has(monthDay(d))) continue;

      const yearTag = String(thisYear);
      const dedupKey = `event_anniversary:${ev.id}:${yearTag}`;
      if (await alreadyQueued(dedupKey)) continue;

      const { error: insErr } = await ADMIN.from("event_reminders_queue").insert({
        client_user_id: ev.client_user_id,
        event_id: ev.id,
        dedup_key: dedupKey,
        reminder_type: "yearly_recall",
        status: "pending",
        scheduled_for: new Date().toISOString(),
      });
      if (insErr) {
        console.error(`[mdj-yearly-recall] insert failed (${dedupKey}):`, insErr);
        continue;
      }
      console.log(`[mdj-yearly-recall] aniversario de evento (${ev.event_type ?? "evento"}) próximo: lead ${ev.id}`);
      queued++;
    }
  }

  return new Response(JSON.stringify({ ok: true, queued }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
