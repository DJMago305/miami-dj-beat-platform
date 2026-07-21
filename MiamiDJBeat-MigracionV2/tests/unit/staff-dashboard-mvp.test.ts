/** MOD-012 Staff Dashboard MVP — unit tests — TICKET-MOD-012-STAFF-DASHBOARD-MVP-001 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  STAFF_DASHBOARD_KPIS,
  STAFF_LEADS,
  STAFF_PROFILE,
  STAFF_QUICK_ACTIONS,
} from '../../staff/dashboard-mvp-data';
import { getDefaultStaffDashboardDataProvider } from '../../staff/data/staff-dashboard-data-provider';
import { renderStaffDashboardMvp } from '../../staff/render-staff-dashboard-mvp';

describe('MOD-012 Staff Dashboard MVP data', () => {
  it('defines four KPI placeholders including Matching Queue', () => {
    expect(STAFF_DASHBOARD_KPIS).toHaveLength(4);
    expect(STAFF_DASHBOARD_KPIS.map((entry) => entry.label)).toContain('Matching Queue');
    expect(STAFF_PROFILE.operatorName).toBe('Staff Operator');
    expect(STAFF_QUICK_ACTIONS).toHaveLength(5);
    expect(STAFF_LEADS).toHaveLength(3);
  });
});

describe('MOD-012 Staff Dashboard MVP render', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('renders all required staff dashboard sections using MOD-009 descriptors', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    expect(main.classList.contains('mdj-client-dashboard')).toBe(true);
    expect(main.querySelector('[data-mdj-component="HeroBanner"]')).not.toBeNull();
    expect(main.querySelectorAll('[data-mdj-component="KpiCard"]')).toHaveLength(4);
    expect(main.querySelector('[data-mdj-staff-section="operations-preview"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="quick-actions"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="staff-profile"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="leads-pipeline"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="invoices-queue"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="crm-snapshot"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="production-tasks"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="matching-queue"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="reports-preview"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="notifications"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-section="activity-timeline"]')).not.toBeNull();
    expect(main.querySelectorAll('.mdj-operations-preview__capability')).toHaveLength(6);
    expect(main.querySelector('[data-mdj-component="ProfileCard"]')).not.toBeNull();
  });
});
