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
]);
const REGISTERED_WRITE_TOOLS = new Set([
    "crear_nota_lead",
    "registrar_evento_agenda",
    "generar_cotizacion_evento",
    // enviar_sms solo ENCOLA un borrador; no sale nada al mundo. El envio real
    // lo hace elixis-sms-dispatch, que exige owner/staff y una fila ya en cola,
    // y que el modelo no tiene en su inventario. Sin registrarlo aqui, el
    // porton lo negaba por "unregistered_tool" y la tarjeta de aprobacion no
    // llegaba a aparecer nunca.
    "enviar_sms",
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
