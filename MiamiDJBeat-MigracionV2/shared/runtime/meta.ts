/** TICKET-V2-BOOTSTRAP-RUNTIME-P0-001 — runtime version + meta */

import type { RuntimeMeta } from './types';

export const MDJ_V2_RUNTIME_VERSION = '0.1.0-runtime-p0';

/** @deprecated Use MDJ_V2_RUNTIME_VERSION — kept for transitional imports */
export const MDJ_V2_SCAFFOLD_VERSION = MDJ_V2_RUNTIME_VERSION;

export const RUNTIME_META: RuntimeMeta = {
  ticket: 'TICKET-V2-BOOTSTRAP-RUNTIME-P0-001',
  businessLogic: false,
};

/** @deprecated Use RUNTIME_META */
export const SCAFFOLD_META = RUNTIME_META;
