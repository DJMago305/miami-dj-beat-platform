// R3 / V2 — human approval gate for agent tools.
// R5: first registered write tool (crear_nota_lead) may pass with policy auto_staff.

const REGISTERED_READ_TOOLS = new Set([
    "consultar_finanzas",
    "consultar_agenda_artista",
    "consultar_catalogo_precios",
    // buscar_cliente estaba marcado como lectura libre en elixis-chat pero
    // NUNCA se registro aqui, asi que el porton lo negaba con
    // "approval_required" y ELIXIS lo contaba como "requiere aprobacion del
    // sistema". Solo lee nombre/telefono de un cliente ya existente.
    "buscar_cliente",
    // consultar_musica: lee el catalogo publico de Apple Music a traves del
    // puente mdj-music. No toca datos del negocio ni de clientes.
    "consultar_musica",
    // consultar_efemerides (2026-09-01): solo lee birth_date/wedding_anniversary
    // ya guardados en client_profiles/dj_profiles. No escribe nada.
    "consultar_efemerides",
]);
const REGISTERED_WRITE_TOOLS = new Set([
    "crear_nota_lead",
    "registrar_evento_agenda",
    // modificar_agenda_evento (2026-08-31): agenda OPERATIVA de negocio
    // (elixis_agenda_eventos), separada de registrar_evento_agenda (hueco
    // personal en artist_agenda). RLS ya restringe quien puede leer/escribir
    // cada fila; el porton aqui solo decide si ELIXIS puede llamarla sin
    // aprobacion humana adicional, igual que el resto de escritura auto_staff.
    "modificar_agenda_evento",
    // gestionar_residency_schedule (2026-09-01): plantilla semanal recurrente
    // de residencias. Ticket "aparte" que el PO ya habia diferido -- este es
    // ese ticket. RLS de residency_schedule ya exige is_staff(); el RPC
    // (SECURITY DEFINER, solo service_role) agrega la validacion real.
    "gestionar_residency_schedule",
    // cambiar_precio_catalogo (2026-08-31): el porton solo decide si ELIXIS
    // puede llamarla sin aprobacion adicional -- el candado real (SOLO
    // owner/admin) esta en runCatalogPriceTool en elixis-chat, que revisa
    // gate.role antes de tocar la base.
    "cambiar_precio_catalogo",
    "generar_cotizacion_evento",
    // enviar_sms (2026-08-31: envio autonomo, orden directa del PO). ELIXIS
    // encola y, en el mismo turno, dispara elixis-sms-dispatch reusando el
    // JWT staff/owner de la conversacion -- ya no espera un click humano. El
    // candado real (telefono SOLO desde buscar_cliente, nunca dictado) sigue
    // intacto en runSmsQueueTool, no aqui.
    "enviar_sms",
    // enviar_email (2026-09-01, mismo patron que enviar_sms): correo SOLO
    // desde client_profiles.email via buscar_cliente. Ahora SOLO encola --
    // el despacho real espera confirmacion conversacional (ver abajo).
    "enviar_email",
    // confirmar_envio_mensaje (2026-09-01, orden directa del PO: reemplaza
    // el envio autonomo silencioso por una pregunta de si/no dentro del
    // mismo chat). Solo dispara enviar/cancelar sobre un id YA encolado por
    // enviar_sms/enviar_email -- nunca crea contenido nuevo.
    "confirmar_envio_mensaje",
]);

export type ApprovalMode = "read" | "write";
export type ApprovalPolicy = "none" | "auto_staff" | "require_approval" | string;

export type ApprovalDecision = {
    allowed: boolean;
    requires_approval: boolean;
    reason?: string;
};

export function approval_gate(input: {
    tool: string;
    policy: ApprovalPolicy;
    mode: ApprovalMode | string;
}): ApprovalDecision {
    const tool = String(input?.tool ?? "").trim();
    const policy = String(input?.policy ?? "").trim();
    const mode = String(input?.mode ?? "").trim();

    if (mode === "read") {
        if (REGISTERED_READ_TOOLS.has(tool) && policy === "none") {
            return { allowed: true, requires_approval: false };
        }
        return { allowed: false, requires_approval: true, reason: "approval_required" };
    }

    if (mode === "write") {
        if (!REGISTERED_WRITE_TOOLS.has(tool)) {
            return { allowed: false, requires_approval: true, reason: "unregistered_tool" };
        }
        if (policy === "auto_staff") {
            return { allowed: true, requires_approval: false };
        }
        return { allowed: false, requires_approval: true, reason: "write_requires_approval" };
    }

    return { allowed: false, requires_approval: true, reason: "approval_required" };
}
