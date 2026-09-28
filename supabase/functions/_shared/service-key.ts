// supabase/functions/_shared/service-key.ts
// ─────────────────────────────────────────────────────────────────────────────
// Clave de servicio para el cliente admin de Supabase (bypasea RLS).
//
// Supabase migró de la clave legacy `service_role` (JWT) al sistema nuevo de
// claves (`SUPABASE_SECRET_KEYS`, un JSON con la clave "default"). Esta
// función prefiere la nueva y cae a la vieja si no existe todavía o viene
// vacía — así sigue funcionando sin importar el orden en que se migre cada
// pieza del proyecto, y no depende de que la clave legacy quede activa en el
// dashboard.
//
// Origen: 2026-09-28, tras un incidente real donde se desactivó la clave
// legacy sin haber migrado antes estas funciones — ver docs/ESTADO_MAESTRO.md,
// entrada "Incidente de seguridad — clave expuesta...". Nunca se rompió nada
// en producción (verificado con logs reales), pero pudo haber pasado.
// ─────────────────────────────────────────────────────────────────────────────

export function getServiceRoleKey(): string {
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw);
      if (parsed && typeof parsed.default === "string" && parsed.default) {
        return parsed.default;
      }
    } catch {
      // JSON inválido o ausente — cae a la clave legacy abajo.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
