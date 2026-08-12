import { describe, expect, it } from 'vitest';
import { getLabPortalIdentity } from '../../shared/branding/lab-portal-identity-ssot';
import { buildV1SiteHeaderHtml } from '../../shared/branding/mount-v1-site-header';
import { buildStaffV1OpsLayout } from '../../staff/v1-staff-ops-layout';
import { buildArtistV1PortalLayout } from '../../artist/v1-artist-portal-layout';
import { createStaffDashboardDataProvider } from '../../staff/data/staff-dashboard-data-provider';

describe('lab portal identity SSOT wiring', () => {
  it('keeps three distinct identity rows (MDJB assets only)', () => {
    const a = getLabPortalIdentity('artist');
    const s = getLabPortalIdentity('staff');
    const c = getLabPortalIdentity('client');
    expect(a.displayName).toBe('DJMago305');
    expect(s.displayName).toBe('Gerardo A Valle');
    expect(c.displayName).toBe('Wendy');
    expect(a.photoUrl).toContain('djmago305-avatar');
    expect(a.backgroundUrl).toContain('djmago305-hero-cover');
    expect(s.photoUrl).toContain('gerardo-a-valle-owner-portrait');
    expect(s.backgroundUrl).toContain('gerardo-a-valle-owner-banner');
    expect(s.photoUrl).not.toContain('logo-transparent');
    expect(s.photoUrl).not.toContain('mdj_logo');
    expect(s.photoUrl).not.toContain('mdjpro');
    expect(s.backgroundUrl).not.toContain('djmago305');
    expect(c.photoUrl).toContain('wendy-ayala');
  });

  it('staff header + hero use Gerardo face portrait + corporate banner', () => {
    const html = buildV1SiteHeaderHtml('staff');
    expect(html).toContain('Gerardo A Valle');
    expect(html).toContain('gerardo-a-valle-owner-portrait.png');
    expect(html).not.toContain('mdj_logo');
    expect(html).toMatch(/class="avatar"[^>]*src="[^"]*gerardo-a-valle-owner-portrait\.png"/);

    const layout = buildStaffV1OpsLayout(createStaffDashboardDataProvider());
    const hero = layout.content.querySelector('.mdj-v2-owner-hero')!;
    expect(hero.querySelector('.mdj-v2-owner-hero__title')!.textContent).toBe('Gerardo A Valle');
    const bg = hero.querySelector('.mdj-v2-owner-hero__bg') as HTMLElement;
    expect(bg.getAttribute('style') || bg.style.backgroundImage).toContain('gerardo-a-valle-owner-banner');
    const inset = hero.querySelector('.mdj-v2-owner-hero__inset img') as HTMLImageElement;
    const insetSrc = inset.getAttribute('src') || inset.src;
    expect(insetSrc).toContain('gerardo-a-valle-owner-portrait');
    expect(insetSrc).not.toContain('logo-transparent');
    expect(insetSrc).not.toContain('mdj_logo');
  });

  it('artist hero consumes DJMago305 SSOT assets', () => {
    const html = buildV1SiteHeaderHtml('artist');
    expect(html).toContain('DJMago305');
    expect(html).toContain('djmago305-avatar');
    const layout = buildArtistV1PortalLayout();
    expect(layout.hero.innerHTML).toContain('djmago305-hero-cover');
    expect(layout.hero.innerHTML).toContain('djmago305-avatar');
    expect(layout.hero.innerHTML).toContain('DJMago305');
  });
});
