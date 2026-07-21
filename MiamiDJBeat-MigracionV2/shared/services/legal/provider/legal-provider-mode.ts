/** Legal provider mode — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 */

export const IMPLEMENTED_LEGAL_PROVIDER_MODES = ['IN_MEMORY'] as const;

export type ImplementedLegalProviderMode = (typeof IMPLEMENTED_LEGAL_PROVIDER_MODES)[number];

export const UNIMPLEMENTED_LEGAL_PROVIDER_MODES = ['SUPABASE', 'REMOTE', 'PRODUCTION'] as const;

export type UnimplementedLegalProviderMode = (typeof UNIMPLEMENTED_LEGAL_PROVIDER_MODES)[number];

export type LegalProviderMode = ImplementedLegalProviderMode | UnimplementedLegalProviderMode;

export const DEFAULT_LEGAL_PROVIDER_MODE: ImplementedLegalProviderMode = 'IN_MEMORY';
