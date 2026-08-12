/** MOD-010 Client Dashboard MVP — unit tests — TICKET-MOD-010-CLIENT-DASHBOARD-MVP-001 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLIENT_ACTIVITY,
  CLIENT_DASHBOARD_KPIS,
  CLIENT_QUICK_ACTIONS,
  CLIENT_UPCOMING_EVENTS,
} from '../../client/dashboard-mvp-data';
import { renderClientDashboardMvp } from '../../client/render-client-dashboard-mvp';

describe('MOD-010 Client Dashboard MVP data', () => {
  it('defines four KPI placeholders including VIP Status', () => {
    expect(CLIENT_DASHBOARD_KPIS).toHaveLength(4);
    expect(CLIENT_DASHBOARD_KPIS.map((entry) => entry.label)).toContain('VIP Status');
  });

  it('defines five quick actions and three upcoming events', () => {
    expect(CLIENT_QUICK_ACTIONS).toHaveLength(5);
    expect(CLIENT_UPCOMING_EVENTS).toHaveLength(3);
    expect(CLIENT_ACTIVITY.length).toBeGreaterThan(0);
  });
});

describe('MOD-010 Client Dashboard MVP render', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('renders all required dashboard sections using MOD-009 descriptors', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderClientDashboardMvp(main);

    expect(main.classList.contains('mdj-client-dashboard')).toBe(true);
    expect(main.querySelector('[data-mdj-component="HeroBanner"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="DashboardCard"]')).not.toBeNull();
    expect(main.querySelectorAll('[data-mdj-component="KpiCard"]')).toHaveLength(4);
    expect(main.querySelector('[data-mdj-client-section="quick-actions"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="client-profile"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ClientProfileReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="client-bookings"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ClientBookingsReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="client-payments"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ClientFinanceReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="client-weather"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ClientWeatherReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="client-mutations"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="recent-orders"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="documents"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="vip-membership"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="notifications"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-section="activity-timeline"]')).not.toBeNull();
  });
});
