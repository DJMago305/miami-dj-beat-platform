// R3 / V2 — human approval gate for agent tools.
// R5: first registered write tool (crear_nota_lead) may pass with policy auto_staff.

const REGISTERED_READ_TOOLS = new Set([
    "consultar_finanzas",
    "consultar_agenda_artista",
    "consultar_catalogo_precios",
]);
const REGISTERED_WRITE_TOOLS = new Set([
    "crear_nota_lead",
    "registrar_evento_agenda",
    "generar_cotizacion_evento",
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
