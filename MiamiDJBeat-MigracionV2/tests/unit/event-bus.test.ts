import { beforeEach, describe, expect, it } from 'vitest';
import {
  getEventBus,
  getEventBusHandlerErrorsForTests,
  getEventBusState,
  initializeEventBus,
  resetEventBusForTests,
} from '@mdj/shared/events';

describe('MOD-004 Event Bus', () => {
  beforeEach(() => {
    resetEventBusForTests();
  });

  it('initializes to BUS_READY and emits BUS_READY (not SYSTEM_READY)', () => {
    const bus = initializeEventBus();
    expect(getEventBusState()).toBe('BUS_READY');
    expect(bus.getState()).toBe('BUS_READY');

    const history = bus.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0]?.name).toBe('BUS_READY');
    expect(history[0]?.payload).toEqual({ busVersion: '1.0.0' });
    expect(history[0]?.emitter.moduleId).toBe('MOD-004');
    expect(history.some((entry) => entry.name === 'SYSTEM_READY')).toBe(false);
    expect(Object.isFrozen(history[0])).toBe(true);
  });

  it('subscribe and publish deliver envelope in registration order', () => {
    const bus = initializeEventBus();
    const seen: string[] = [];

    bus.subscribe('THEME_CHANGED', (envelope) => {
      seen.push(`a:${String(envelope.payload.mode)}`);
    });
    bus.subscribe('THEME_CHANGED', (envelope) => {
      seen.push(`b:${String(envelope.payload.mode)}`);
    });

    const result = bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: 'dark' },
      emitter: { moduleId: 'MOD-007' },
    });

    expect(result.ok).toBe(true);
    expect(seen).toEqual(['a:dark', 'b:dark']);
  });

  it('unsubscribe stops delivery', () => {
    const bus = initializeEventBus();
    let count = 0;
    const id = bus.subscribe('THEME_CHANGED', () => {
      count += 1;
    });

    bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: 'dark' },
      emitter: { moduleId: 'MOD-007' },
    });
    expect(count).toBe(1);

    expect(bus.unsubscribe(id)).toBe(true);
    bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: 'light' },
      emitter: { moduleId: 'MOD-007' },
    });
    expect(count).toBe(1);
  });

  it('once auto-unsubscribes after first delivery', () => {
    const bus = initializeEventBus();
    let count = 0;

    bus.once('LANGUAGE_CHANGED', () => {
      count += 1;
    });

    bus.publish({
      name: 'LANGUAGE_CHANGED',
      payload: { locale: 'en' },
      emitter: { moduleId: 'MOD-015' },
    });
    bus.publish({
      name: 'LANGUAGE_CHANGED',
      payload: { locale: 'es' },
      emitter: { moduleId: 'MOD-015' },
    });

    expect(count).toBe(1);
  });

  it('catch-up invokes handler once when emit precedes subscribe', () => {
    const bus = initializeEventBus();
    let count = 0;

    bus.publish({
      name: 'LANGUAGE_CHANGED',
      payload: { locale: 'en' },
      emitter: { moduleId: 'MOD-015' },
    });

    bus.subscribe('LANGUAGE_CHANGED', () => {
      count += 1;
    });

    expect(count).toBe(1);
  });

  it('rejects unknown event names', () => {
    const bus = initializeEventBus();
    const result = bus.publish({
      name: 'UNKNOWN_EVENT',
      payload: {},
      emitter: { moduleId: 'MOD-004' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EVENT_UNKNOWN');
    }
  });

  it('rejects unauthorized emitters', () => {
    const bus = initializeEventBus();
    const result = bus.publish({
      name: 'USER_LOGIN',
      payload: { userId: 'u1' },
      emitter: { moduleId: 'MOD-004' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EVENT_UNAUTHORIZED_EMITTER');
    }
  });

  it('rejects invalid JSON-safe payloads', () => {
    const bus = initializeEventBus();
    const result = bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: (() => undefined) as unknown as string },
      emitter: { moduleId: 'MOD-007' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EVENT_PAYLOAD_INVALID');
    }
  });

  it('accepts nested JSON-safe payloads', () => {
    const bus = initializeEventBus();
    const result = bus.publish({
      name: 'ORDER_UPDATED',
      payload: { orderId: 'o1', status: 'open', changedFields: ['status'] },
      emitter: { moduleId: 'MOD-409' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.payload).toEqual({
        orderId: 'o1',
        status: 'open',
        changedFields: ['status'],
      });
    }
  });

  it('preserves publish order across sequential events', () => {
    const bus = initializeEventBus();
    const order: string[] = [];

    bus.subscribe('THEME_CHANGED', () => {
      order.push('theme');
    });
    bus.subscribe('LANGUAGE_CHANGED', () => {
      order.push('language');
    });

    bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: 'dark' },
      emitter: { moduleId: 'MOD-007' },
    });
    bus.publish({
      name: 'LANGUAGE_CHANGED',
      payload: { locale: 'en' },
      emitter: { moduleId: 'MOD-015' },
    });

    expect(order).toEqual(['theme', 'language']);
  });

  it('rejects publish when bus is not initialized', () => {
    expect(getEventBusState()).toBe('BUS_UNINITIALIZED');
    expect(() => getEventBus()).toThrowError(/not initialized/i);
  });

  it('duplicate once-eligible correlationId is rejected', () => {
    const bus = initializeEventBus();
    const input = {
      name: 'PORTAL_READY',
      payload: { portal: 'client', surface: 'shell' },
      emitter: { moduleId: 'MOD-PORTAL-SHELL' },
      correlationId: 'corr-nav-1',
    } as const;

    expect(bus.publish(input).ok).toBe(true);
    const duplicate = bus.publish(input);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.code).toBe('EVENT_DUPLICATE_ONCE');
    }
  });

  it('duplicate subscriptions invoke handler twice', () => {
    const bus = initializeEventBus();
    let count = 0;
    const handler = (): void => {
      count += 1;
    };

    bus.subscribe('THEME_CHANGED', handler);
    bus.subscribe('THEME_CHANGED', handler);

    bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: 'dark' },
      emitter: { moduleId: 'MOD-007' },
    });

    expect(count).toBe(2);
  });

  it('handler throw is isolated and recorded', () => {
    const bus = initializeEventBus();

    bus.subscribe('THEME_CHANGED', () => {
      throw new Error('handler boom');
    });

    const result = bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: 'dark' },
      emitter: { moduleId: 'MOD-007' },
    });

    expect(result.ok).toBe(true);
    expect(getEventBusHandlerErrorsForTests().length).toBe(1);
    expect(getEventBusState()).toBe('BUS_READY');
  });

  it('clear removes listeners for one event or all', () => {
    const bus = initializeEventBus();
    let themeCount = 0;
    let languageCount = 0;

    bus.subscribe('THEME_CHANGED', () => {
      themeCount += 1;
    });
    bus.subscribe('LANGUAGE_CHANGED', () => {
      languageCount += 1;
    });

    bus.clear('THEME_CHANGED');
    bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: 'dark' },
      emitter: { moduleId: 'MOD-007' },
    });
    bus.publish({
      name: 'LANGUAGE_CHANGED',
      payload: { locale: 'en' },
      emitter: { moduleId: 'MOD-015' },
    });

    expect(themeCount).toBe(0);
    expect(languageCount).toBe(1);

    bus.clear();
    bus.publish({
      name: 'LANGUAGE_CHANGED',
      payload: { locale: 'es' },
      emitter: { moduleId: 'MOD-015' },
    });
    expect(languageCount).toBe(1);
  });

  it('destroy shuts down bus and cleans memory', () => {
    const bus = initializeEventBus();
    bus.subscribe('THEME_CHANGED', () => undefined);
    bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: 'dark' },
      emitter: { moduleId: 'MOD-007' },
    });

    bus.destroy();
    expect(getEventBusState()).toBe('BUS_SHUTDOWN');
    expect(bus.getHistory().length).toBe(0);

    const rejected = bus.publish({
      name: 'THEME_CHANGED',
      payload: { mode: 'dark' },
      emitter: { moduleId: 'MOD-007' },
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe('EVENT_BUS_NOT_READY');
    }
  });
});
