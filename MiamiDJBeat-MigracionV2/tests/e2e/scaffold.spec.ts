import { expect, test } from '@playwright/test';

/** TICKET-MOD-008-PORTAL-SHELL-001 · TICKET-MOD-010-CLIENT-DASHBOARD-MVP-001 · TICKET-MOD-011-ARTIST-DASHBOARD-MVP-001 · TICKET-MOD-012-STAFF-DASHBOARD-MVP-001 */
test.describe('MOD-008 Portal Shell — client · artist · staff', () => {
  test('client portal renders Miami DJ Beat client dashboard MVP', async ({ page }) => {
    await page.goto('/client/');
    await expect(page.locator('[data-mdj-shell-region="header"]')).toBeVisible();
    await expect(page.locator('[data-mdj-shell-region="sidebar"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your Miami DJ Beat Client Dashboard/i })).toBeVisible();
    await expect(page.locator('[data-mdj-client-section="quick-actions"]')).toBeVisible();
    await expect(page.locator('[data-mdj-client-section="vip-membership"]')).toBeVisible();
    // MOD-207 — Eventos y Reservas tab: hidden until switched to.
    await page.locator('.mdj-client-tabs__btn[data-tab="bookings"]').click();
    await expect(page.locator('[data-mdj-client-section="recent-orders"]')).toBeVisible();
    await expect(page.locator('[data-mdj-component="KpiCard"]')).toHaveCount(4);
    await expect(page.locator('[data-mdj-status="session"]')).toContainText('ready');
  });

  test('artist portal renders Miami DJ Beat artist dashboard MVP', async ({ page }) => {
    await page.goto('/artist/');
    await expect(page.locator('[data-mdj-shell-region="header"]')).toBeVisible();
    await expect(page.locator('[data-mdj-shell-region="sidebar"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your Miami DJ Beat Artist Dashboard/i })).toBeVisible();
    await expect(page.locator('[data-mdj-artist-section="artist-profile"]')).toBeVisible();
    await expect(page.locator('[data-mdj-artist-section="song4tips"]')).toBeVisible();
    await expect(page.locator('[data-mdj-artist-section="jobs-marketplace"]')).toBeVisible();
    await expect(page.locator('[data-mdj-component="KpiCard"]')).toHaveCount(4);
    await expect(page.locator('[data-mdj-status="theme"]')).toContainText('ready');
  });

  test('staff portal renders Miami DJ Beat staff dashboard MVP', async ({ page }) => {
    await page.goto('/staff/');
    await expect(page.locator('[data-mdj-shell-region="header"]')).toBeVisible();
    await expect(page.locator('[data-mdj-shell-region="sidebar"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your Miami DJ Beat Staff Operations Dashboard/i })).toBeVisible();
    await expect(page.locator('[data-mdj-staff-section="leads-pipeline"]')).toBeVisible();
    await expect(page.locator('[data-mdj-staff-section="invoices-queue"]')).toBeVisible();
    await expect(page.locator('[data-mdj-staff-section="matching-queue"]')).toBeVisible();
    await expect(page.locator('[data-mdj-component="KpiCard"]')).toHaveCount(4);
    await expect(page.locator('[data-mdj-shell-region="sidebar"]')).toContainText('Leads');
    await expect(page.locator('[data-mdj-status="session"]')).toContainText('ready');
  });
});
