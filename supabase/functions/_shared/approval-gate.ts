// R3 / V2 — human approval gate for agent tools.
// Declarative only: no pending-approval table, no write tools. R4 registry is the catalog.

const REGISTERED_READ_TOOLS = new Set(["consultar_finanzas"]);

export type ApprovalMode = "read" | "write";
export type ApprovalPolicy = "none" | string;

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
    const registered = REGISTERED_READ_TOOLS.has(tool);

    if (!registered || mode === "write") {
        return {
            allowed: false,
            requires_approval: true,
            reason: !registered ? "unregistered_tool" : "write_requires_approval",
        };
    }

    if (mode === "read" && policy === "none") {
        return { allowed: true, requires_approval: false };
    }

    return { allowed: false, requires_approval: true, reason: "approval_required" };
}
