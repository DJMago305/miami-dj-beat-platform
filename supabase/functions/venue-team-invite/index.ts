// supabase/functions/venue-team-invite/index.ts
// El DUEÑO de un local (la primera cuenta vinculada) da de alta a su equipo: manager o equipo.
//   · Crea la cuenta (Cliente Comercial, plantilla propia; nada de la plantilla de artista) con un link de activación para copiar y
//     enviar (generateLink: NO se manda correo automático) y la vincula a SU local con el rol elegido.
//   · Si el correo ya tiene una cuenta comercial, solo la vincula. Si es de otro tipo (cliente personal, staff, artista) se
//     rechaza: nunca se convierte una cuenta de otra categoría.
//   · Solo el dueño del local puede llamarla (se comprueba aquí con la clave de servicio); tope de personas por local.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEYS), SITE_URL
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getServiceRoleKey } from "../_shared/service-key.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://miamidjbeat.com").replace(/\/$/, "");
const MAX_TEAM = 20;
const ROLES = new Set(["manager", "team"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export type Alta = { venue_id: string; email: string; full_name: string; role: "manager" | "team" };

/** Valida y normaliza el cuerpo de la petición. */
export function validarAlta(body: Record<string, unknown>): { ok: true; value: Alta } | { ok: false; error: string } {
  const venue_id = String(body.venue_id ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const full_name = String(body.full_name ?? "").trim();
  const role = String(body.role ?? "").trim();
  if (!UUID_RE.test(venue_id)) return { ok: false, error: "Local inválido." };
  if (!email || email.length > 160 || !EMAIL_RE.test(email)) return { ok: false, error: "Escribe un correo válido." };
  if (!full_name || full_name.length > 120) return { ok: false, error: "El nombre es obligatorio (máximo 120 caracteres)." };
  if (!ROLES.has(role)) return { ok: false, error: "El rol debe ser manager o equipo." };
  return { ok: true, value: { venue_id, email, full_name, role: role as "manager" | "team" } };
}

/** ¿Qué hacer con un correo que YA tiene cuenta? Nunca se convierte una cuenta de otra categoría. */
export function decidirCuentaExistente(a: { perfilCliente: { is_commercial: boolean | null } | null; tienePerfilDj: boolean }): "vincular" | "crear_perfil" | "rechazar" {
  if (a.perfilCliente) return a.perfilCliente.is_commercial === true ? "vincular" : "rechazar";
  if (a.tienePerfilDj) return "rechazar";
  return "crear_perfil"; // usuario sin ningún perfil (huérfano): se le crea el perfil comercial
}

const adminSb = createClient(SUPABASE_URL, getServiceRoleKey(), { auth: { autoRefreshToken: false, persistSession: false } });

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Sesión requerida." }, 401);
    const { data: authData, error: authErr } = await adminSb.auth.getUser(token);
    const caller = authData?.user;
    if (authErr || !caller) return json({ error: "Sesión inválida." }, 401);

    const v = validarAlta(await req.json().catch(() => ({})) as Record<string, unknown>);
    if (!v.ok) return json({ error: v.error }, 400);
    const { venue_id, email, full_name, role } = v.value;

    // Solo el DUEÑO de ESTE local.
    const { data: mine, error: mineErr } = await adminSb.from("venue_staff").select("role").eq("venue_id", venue_id).eq("user_id", caller.id).maybeSingle();
    if (mineErr) return json({ error: "No se pudo comprobar tu rol." }, 500);
    if (!mine || mine.role !== "owner") return json({ error: "Solo el dueño del local puede agregar a su equipo." }, 403);

    const { count, error: cntErr } = await adminSb.from("venue_staff").select("user_id", { count: "exact", head: true }).eq("venue_id", venue_id);
    if (cntErr) return json({ error: "No se pudo comprobar el tamaño del equipo." }, 500);
    if ((count ?? 0) >= MAX_TEAM) return json({ error: `El equipo ya tiene el máximo de ${MAX_TEAM} personas.` }, 409);

    // Datos de la empresa del dueño: el equipo se crea bajo el mismo negocio.
    const { data: owner, error: ownerErr } = await adminSb.from("client_profiles").select("company_name, venue_type, is_commercial").eq("user_id", caller.id).maybeSingle();
    if (ownerErr || !owner || owner.is_commercial !== true) return json({ error: "Tu cuenta no es una cuenta comercial." }, 403);

    // ¿Ya existe una cuenta con ese correo?
    const { data: existingId, error: lookErr } = await adminSb.rpc("mdj_auth_user_id_by_email", { p_email: email });
    if (lookErr) return json({ error: "No se pudo comprobar el correo." }, 500);

    let userId: string | null = (existingId as string | null) ?? null;
    let actionLink: string | null = null;
    let crearPerfil = true;
    const cuentaNueva = !userId;

    if (userId) {
      const [{ data: cp }, { data: dj }] = await Promise.all([
        adminSb.from("client_profiles").select("is_commercial").eq("user_id", userId).maybeSingle(),
        adminSb.from("dj_profiles").select("user_id").eq("user_id", userId).maybeSingle(),
      ]);
      const decision = decidirCuentaExistente({ perfilCliente: cp ?? null, tienePerfilDj: !!dj });
      if (decision === "rechazar") return json({ error: "Ese correo ya pertenece a otro tipo de cuenta. Usa otro correo." }, 409);
      crearPerfil = decision === "crear_perfil";
    } else {
      const { data: linkData, error: linkErr } = await adminSb.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo: `${SITE_URL}/reset-password.html?invited=1&type=commercial_client`,
          data: { full_name, account_type: "commercial_client", created_by_id: caller.id, created_by_name: "Dueño del local" },
        },
      });
      if (linkErr || !linkData?.user?.id) return json({ error: "No se pudo crear la cuenta: " + (linkErr?.message ?? "sin respuesta") }, 400);
      userId = linkData.user.id;
      actionLink = linkData.properties?.action_link ?? null;
    }

    if (crearPerfil) {
      const { error: cpErr } = await adminSb.from("client_profiles").upsert(
        { user_id: userId, email, full_name, company_name: owner.company_name, venue_type: owner.venue_type, is_commercial: true },
        { onConflict: "user_id" },
      );
      if (cpErr) {
        console.error("[venue-team-invite] client_profiles:", cpErr.message);
        return json({ error: "No se pudo crear el perfil de la cuenta: " + cpErr.message }, 500);
      }
    }

    const { error: linkRowErr } = await adminSb.from("venue_staff").insert({ venue_id, user_id: userId, role, created_by: caller.id });
    if (linkRowErr) {
      if (linkRowErr.code === "23505") return json({ error: "Esa persona ya está en el equipo de este local." }, 409);
      console.error("[venue-team-invite] venue_staff:", linkRowErr.message);
      return json({ error: "No se pudo vincular la cuenta al local: " + linkRowErr.message }, 500);
    }

    return json({ success: true, user_id: userId, email, role, cuenta_nueva: cuentaNueva, action_link: actionLink });
  } catch (e) {
    console.error("[venue-team-invite]", e);
    return json({ error: "Error interno." }, 500);
  }
});
