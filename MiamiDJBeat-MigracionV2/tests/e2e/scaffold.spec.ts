import { expect, test } from '@playwright/test';

/** TICKET-MOD-008-PORTAL-SHELL-001 · TICKET-MOD-010-CLIENT-DASHBOARD-MVP-001 */
test.describe('MOD-008 Portal Shell — client · artist · staff', () => {
  test('client portal renders Miami DJ Beat client dashboard MVP', async ({ page }) => {
    await page.goto('/client/');
    await expect(page.locator('[data-mdj-shell-region="header"]')).toBeVisible();
    await expect(page.locator('[data-mdj-shell-region="sidebar"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Your Miami DJ Beat Client Dashboard/i })).toBeVisible();
    await expect(page.locator('[data-mdj-client-section="quick-actions"]')).toBeVisible();
    await expect(page.locator('[data-mdj-client-section="upcoming-events"]')).toBeVisible();
    await expect(page.locator('[data-mdj-client-section="recent-orders"]')).toBeVisible();
    await expect(page.locator('[data-mdj-client-section="vip-membership"]')).toBeVisible();
    await expect(page.locator('[data-mdj-component="KpiCard"]')).toHaveCount(4);
    await expect(page.locator('[data-mdj-status="session"]')).toContainText('ready');
  });

  test('artist portal renders performer shell', async ({ page }) => {
    await page.goto('/artist/');
    await expect(page.getByRole('heading', { name: 'Artist Dashboard' })).toBeVisible();
    await expect(page.locator('[data-mdj-shell-region="profile"]')).toContainText('Artist');
    await expect(page.locator('[data-mdj-status="theme"]')).toContainText('ready');
    await expect(page.locator('.mdj-shell-module')).toHaveCount(6);
  });

  test('staff portal renders backoffice shell', async ({ page }) => {
    await page.goto('/staff/');
    await expect(page.getByRole('heading', { name: 'Staff Operations Dashboard' })).toBeVisible();
    await expect(page.locator('[data-mdj-shell-region="sidebar"]')).toContainText('Leads');
    await expect(page.locator('[data-mdj-status="session"]')).toContainText('ready');
    await expect(page.locator('.mdj-shell-module')).toHaveCount(7);
  });
});
