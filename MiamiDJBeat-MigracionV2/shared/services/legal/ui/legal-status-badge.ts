/** LegalStatusBadge — LC-4 — TICKET-V2-LEGAL-CENTER-UI-SHELL-001 */

import type { LegalAggregateStatus } from '../contracts/legal-enums';
import type { LegalDocumentCardStatus } from './legal-shell-types';

export type LegalStatusBadgeProps = {
  readonly label: string;
  readonly tone: LegalAggregateStatus | LegalDocumentCardStatus | 'neutral';
  /** Softer presentation for aggregate header badges (e.g. staff roster attention). */
  readonly emphasis?: 'default' | 'soft';
};

const TONE_CLASS: Record<LegalStatusBadgeProps['tone'], string> = {
  GREEN: 'mdj-legal-status-badge--green',
  YELLOW: 'mdj-legal-status-badge--yellow',
  RED: 'mdj-legal-status-badge--red',
  draft: 'mdj-legal-status-badge--neutral',
  pending: 'mdj-legal-status-badge--yellow',
  sent: 'mdj-legal-status-badge--neutral',
  viewed: 'mdj-legal-status-badge--yellow',
  signed: 'mdj-legal-status-badge--green',
  expired: 'mdj-legal-status-badge--red',
  rejected: 'mdj-legal-status-badge--red',
  neutral: 'mdj-legal-status-badge--neutral',
};

export function createLegalStatusBadge(props: LegalStatusBadgeProps): HTMLElement {
  const badge = document.createElement('span');
  const emphasisClass = props.emphasis === 'soft' ? ' mdj-legal-status-badge--soft' : '';
  badge.className = `mdj-legal-status-badge ${TONE_CLASS[props.tone]}${emphasisClass}`;
  badge.dataset.mdjLegalStatusBadge = props.tone;
  badge.textContent = props.label;
  return badge;
}
