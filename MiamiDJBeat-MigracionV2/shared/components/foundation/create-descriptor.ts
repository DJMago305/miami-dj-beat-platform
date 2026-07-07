/** MOD-009 Components Foundation — immutable factory helper — TICKET-MOD-009-COMPONENTS-FOUNDATION-001 */

import type { MdjComponentDescriptor } from './types';

export function freezeComponentDescriptor<TProps extends object>(
  descriptor: MdjComponentDescriptor<TProps>,
): MdjComponentDescriptor<TProps> {
  return Object.freeze(descriptor);
}

export function slugifyAttributeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}
