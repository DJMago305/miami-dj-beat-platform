/** MOD-004 Event Bus — validation — TICKET-V2-RUNTIME-EVENT-BUS-001 */

import { getCatalogEntry, isValidEventName } from './catalog';
import { EventBusError } from './errors';
import type { CatalogEntry, PublishInput } from './types';

const MAX_PAYLOAD_BYTES = 64 * 1024;

export function lookupCatalogEntry(name: string): CatalogEntry {
  if (!isValidEventName(name)) {
    throw new EventBusError('EVENT_UNKNOWN', `Event name "${name}" is not valid UPPER_SNAKE.`);
  }

  const entry = getCatalogEntry(name);
  if (!entry) {
    throw new EventBusError('EVENT_UNKNOWN', `Event "${name}" is not registered in catalog.`);
  }

  return entry;
}

export function assertAuthorizedEmitter(entry: CatalogEntry, moduleId: string): void {
  if (!entry.authorizedEmitters.includes(moduleId)) {
    throw new EventBusError(
      'EVENT_UNAUTHORIZED_EMITTER',
      `Module "${moduleId}" is not authorized to emit "${entry.name}".`,
    );
  }
}

export function assertJsonSafePayload(value: unknown, path = 'payload'): void {
  if (value === null) {
    return;
  }

  const valueType = typeof value;

  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return;
  }

  if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol' || valueType === 'bigint') {
    throw new EventBusError(
      'EVENT_PAYLOAD_INVALID',
      `Payload at "${path}" is not JSON-safe (${valueType}).`,
    );
  }

  if (value instanceof Date) {
    throw new EventBusError(
      'EVENT_PAYLOAD_INVALID',
      `Payload at "${path}" must not contain Date instances.`,
    );
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertJsonSafePayload(item, `${path}[${String(index)}]`);
    });
    return;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assertJsonSafePayload(child, `${path}.${key}`);
  }
}

export function assertPayloadSchema(entry: CatalogEntry, payload: Record<string, unknown>): void {
  assertJsonSafePayload(payload);

  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    throw new EventBusError(
      'EVENT_PAYLOAD_INVALID',
      `Payload for "${entry.name}" exceeds ${String(MAX_PAYLOAD_BYTES)} bytes.`,
    );
  }

  for (const key of entry.requiredPayloadKeys) {
    if (!(key in payload)) {
      throw new EventBusError(
        'EVENT_PAYLOAD_INVALID',
        `Payload for "${entry.name}" is missing required key "${key}".`,
      );
    }
  }
}

export function validatePublishInput(input: PublishInput): {
  entry: CatalogEntry;
  version: number;
  scope: CatalogEntry['scope'];
} {
  const entry = lookupCatalogEntry(input.name);
  assertAuthorizedEmitter(entry, input.emitter.moduleId);
  assertPayloadSchema(entry, input.payload);

  const version = input.version ?? entry.defaultVersion;
  if (version !== entry.defaultVersion) {
    throw new EventBusError(
      'EVENT_PAYLOAD_INVALID',
      `Event "${entry.name}" version ${String(version)} is not supported (expected ${String(entry.defaultVersion)}).`,
    );
  }

  return {
    entry,
    version,
    scope: input.scope ?? entry.scope,
  };
}
