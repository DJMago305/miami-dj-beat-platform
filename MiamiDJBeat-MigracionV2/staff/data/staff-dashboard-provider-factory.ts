/** Phase 11-A — Staff dashboard provider factory — mock-only portal entry point. */

import {
  getDefaultStaffDashboardDataProvider,
  resetStaffDashboardDataProviderForTests as resetModuleProviderForTests,
  setDefaultStaffDashboardDataProviderForTests as setModuleProviderForTests,
  type StaffDashboardDataProvider,
} from './staff-dashboard-data-provider';

/**
 * Resolves the Staff portal operational data provider.
 * Phase 11-A: mock/default implementation only — no Session, permissions, or API.
 */
export function resolveStaffDashboardDataProvider(): StaffDashboardDataProvider {
  return getDefaultStaffDashboardDataProvider();
}

/** Test-only override — delegates to the existing provider module singleton. */
export function setStaffDashboardDataProviderForTests(provider: StaffDashboardDataProvider): void {
  setModuleProviderForTests(provider);
}

/** Test-only reset — restores the approved mock provider. */
export function resetStaffDashboardDataProviderForTests(): void {
  resetModuleProviderForTests();
}
