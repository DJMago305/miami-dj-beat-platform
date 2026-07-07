/** MOD-011 Artist Dashboard MVP — unit tests — TICKET-MOD-011-ARTIST-DASHBOARD-MVP-001 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  ARTIST_DASHBOARD_KPIS,
  ARTIST_PROFILE,
  ARTIST_UPCOMING_GIGS,
} from '../../artist/dashboard-mvp-data';
import { renderArtistDashboardMvp } from '../../artist/render-artist-dashboard-mvp';

describe('MOD-011 Artist Dashboard MVP data', () => {
  it('defines four KPI placeholders including Jobs Available', () => {
    expect(ARTIST_DASHBOARD_KPIS).toHaveLength(4);
    expect(ARTIST_DASHBOARD_KPIS.map((entry) => entry.label)).toContain('Jobs Available');
    expect(ARTIST_PROFILE.stageName).toBe('DJMago305');
    expect(ARTIST_UPCOMING_GIGS).toHaveLength(3);
  });
});

describe('MOD-011 Artist Dashboard MVP render', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('renders all required artist dashboard sections using MOD-009 descriptors', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderArtistDashboardMvp(main);

    expect(main.classList.contains('mdj-client-dashboard')).toBe(true);
    expect(main.querySelector('[data-mdj-component="HeroBanner"]')).not.toBeNull();
    expect(main.querySelectorAll('[data-mdj-component="KpiCard"]')).toHaveLength(4);
    expect(main.querySelector('[data-mdj-artist-section="artist-profile"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-section="upcoming-gigs"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-section="calendar"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-section="cash-flow"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-section="song4tips"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-section="jobs-marketplace"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-section="media-library"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-section="analytics"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-section="notifications"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-section="activity-timeline"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ProfileCard"]')).not.toBeNull();
  });
});
