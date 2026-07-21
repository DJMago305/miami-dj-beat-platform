/** LC-11 — Legal read pagination */

import { legalPersistenceError, type LegalPersistenceResult } from './legal-persistence-errors';

export type LegalReadPage<T> = {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
};

type CursorPayload = {
  readonly offset: number;
};

const MAX_PAGE_LIMIT = 100;
const DEFAULT_PAGE_LIMIT = 25;

export function normalizeReadLimit(limit?: number): LegalPersistenceResult<number> {
  if (limit === undefined) {
    return Object.freeze({ ok: true, value: DEFAULT_PAGE_LIMIT });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    return legalPersistenceError(
      'persistence_query_invalid',
      `Read limit must be an integer between 1 and ${MAX_PAGE_LIMIT}.`,
    );
  }
  return Object.freeze({ ok: true, value: limit });
}

export function encodeReadCursor(offset: number): string {
  const payload: CursorPayload = Object.freeze({ offset });
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeReadCursor(cursor: string | undefined): LegalPersistenceResult<number> {
  if (cursor === undefined || cursor.trim() === '') {
    return Object.freeze({ ok: true, value: 0 });
  }
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as CursorPayload;
    if (!payload || typeof payload.offset !== 'number' || payload.offset < 0) {
      return legalPersistenceError('persistence_cursor_invalid', 'Read cursor payload is invalid.');
    }
    return Object.freeze({ ok: true, value: payload.offset });
  } catch {
    return legalPersistenceError('persistence_cursor_invalid', 'Read cursor could not be decoded.');
  }
}

export function paginateRows<T>(
  rows: readonly T[],
  limit: number,
  cursorOffset: number,
): LegalReadPage<T> {
  const slice = rows.slice(cursorOffset, cursorOffset + limit);
  const nextOffset = cursorOffset + slice.length;
  const hasMore = nextOffset < rows.length;
  return Object.freeze({
    items: Object.freeze([...slice]),
    nextCursor: hasMore ? encodeReadCursor(nextOffset) : null,
    hasMore,
  });
}

export { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT };
