/**
 * V2 lab — lift & shift artist portal chrome from ui-v1-clone/dj-profile.html
 * + admin-dashboard artist strip (STAFF + SoundForTips).
 */

import { MDJ_V1_ASSET_BASE } from '../shared/branding/mount-v1-site-header';
import { getLabPortalIdentity } from '../shared/branding/lab-portal-identity-ssot';
import { createArtistTabController } from './tabs/artist-tab-controller';
import {
  createArtistViewModeToggle,
  wireArtistViewModeToggle,
} from './profile/artist-view-mode-toggle';
import {
  resolveSocialLinks,
  SOCIAL_PLATFORM_ICON_SVG,
  SOCIAL_SHARE_ICON_SVG,
} from './profile/artist-profile-read-view-model';
import { LAB_ARTIST_PROFILE_DJMAGO305 } from './profile/artist-profile-read-fixtures';
import type { ArtistSocialLinksDTO } from '../shared/services/profiles/index';
import type { ArtistTier } from '../shared/permissions/runtime/types';
import { artistLabProfileStore } from './profile/artist-lab-profile-store';
import { renderArtistConfigForm } from './config/render-artist-config-form';
import {
  renderArtistBioCard,
  renderArtistReviewsCard,
  renderArtistAvailabilityCard,
  renderArtistInteractCard,
} from './profile/render-artist-profile-v1-extras';

export type ArtistV1LayoutOptions = {
  readonly profile?: {
    readonly photoUrl?: string | null;
    readonly backgroundUrl?: string | null;
    readonly stageName?: string | null;
    readonly socialLinks?: ArtistSocialLinksDTO | null;
    readonly city?: string | null;
    readonly rating?: number | null;
    readonly reviewCount?: number | null;
    /** Paid account tier (Lite = free, Pro/Elite = paid) — drives the hero's plan pill. */
    readonly commercialTier?: ArtistTier | null;
    /** Passed the MDJB certification course — independent of commercialTier. */
    readonly verified?: boolean | null;
  } | null;
};

export type ArtistV1LayoutSlots = {
  readonly root: HTMLElement;
  readonly hero: HTMLElement;
  readonly mainCol: HTMLElement;
  /** MOD-216 — the 4 content panels wrapper (Mi Perfil / Agenda · Gigs / Ingresos · Wallet / Config), switched by the top #owner-tabs strip — no button row of its own. */
  readonly tabPanelsWrap: HTMLElement;
  readonly mutationsHost: HTMLElement;
};

function createSectionSlot(sectionId: string, wide = false): HTMLElement {
  const section = document.createElement('section');
  section.className = `mdj-client-dashboard__section${wide ? ' mdj-client-dashboard__section--wide' : ''} dj-card mdj-v2-v1-slot`;
  section.dataset.mdjArtistSection = sectionId;
  return section;
}

/** 5-star row, filled count from the real rating (rounded) — same rating shown in the Residency section below. */
function buildHeroRatingStarsHtml(rating: number | null): string {
  const filled = rating != null ? Math.round(Math.min(5, Math.max(0, rating))) : 0;
  return Array.from({ length: 5 }, (_, i) =>
    i < filled
      ? '<span class="dj-rating__star dj-rating__star--filled">★</span>'
      : '<span class="dj-rating__star">★</span>',
  ).join('');
}

/** Shared by the initial hero build and the Config-store subscription (MOD-215), so both stay in sync. */
function buildSocialRowInnerHtml(links: ReturnType<typeof resolveSocialLinks>): string {
  return `${links
    .map(
      (link) =>
        `<a class="dj-social-icon" href="${link.url}" target="_blank" rel="noopener noreferrer" title="${link.label}" aria-label="${link.label}">${SOCIAL_PLATFORM_ICON_SVG[link.platform]}</a>`,
    )
    .join('')}<button type="button" class="dj-social-icon share-btn" data-mdj-hero-share-btn="1" title="Compartir perfil" aria-label="Compartir perfil">${SOCIAL_SHARE_ICON_SVG}</button>`;
}

const SHARE_FEEDBACK_RESET_MS = 1800;

/** Copies the profile URL to the clipboard; briefly swaps the button's label for feedback. */
function wireArtistHeroShareButton(hero: HTMLElement): void {
  const button = hero.querySelector<HTMLButtonElement>('[data-mdj-hero-share-btn="1"]');
  if (!button) return;

  const idleLabel = button.title;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  button.addEventListener('click', () => {
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        button.title = '¡Enlace copiado!';
        button.setAttribute('aria-label', '¡Enlace copiado!');
        button.classList.add('dj-social-icon--copied');
        if (resetTimer) clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          button.title = idleLabel;
          button.setAttribute('aria-label', idleLabel);
          button.classList.remove('dj-social-icon--copied');
        }, SHARE_FEEDBACK_RESET_MS);
      },
      () => {
        /* clipboard denied/unavailable — no-op, button stays a silent no-op rather than throwing */
      },
    );
  });
}

/** Capitan strip: INICIO / ACADEMIA / SHOP / AGENDA / CONFIG / DJ TOOLS / CASH FLOW / MI PERFIL / STAFF / SOUNDFORTIPS */
export function mountArtistOwnerTabs(): HTMLElement {
  let tabs = document.getElementById('owner-tabs');
  if (tabs?.dataset.mdjV2LabArtistTabs === '1') return tabs;

  tabs = document.createElement('nav');
  tabs.className = 'dj-owner-tabs';
  tabs.id = 'owner-tabs';
  tabs.dataset.mdjNoMarquee = '1';
  tabs.dataset.mdjV2LabArtistTabs = '1';
  tabs.setAttribute('aria-label', 'Navegación de artista');

  const container = document.createElement('div');
  container.className = 'container';
  container.innerHTML = `
    <a href="${MDJ_V1_ASSET_BASE}/index.html" class="dj-tab-btn dj-tab-btn--home" data-i18n="nav-home">Inicio</a>
    <a href="${MDJ_V1_ASSET_BASE}/academia.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-academia">Academia</a>
    <a href="${MDJ_V1_ASSET_BASE}/shop.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-shop">Shop</a>
    <a href="#agenda-fullpage" class="dj-tab-btn" data-i18n="dash-your-profile" data-mdj-agenda-fullpage-link="1">Agenda</a>
    <a href="#config" class="dj-tab-btn" data-i18n="nav-settings" data-mdj-config-tab-link="1">⚙️ CONFIG</a>
    <a href="${MDJ_V1_ASSET_BASE}/dj-tools.html?mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-tools">DJ Tools</a>
    <a href="#wallet" class="dj-tab-btn" data-i18n="flow-dash" data-mdj-wallet-tab-link="1">Cash Flow</a>
    <a href="/artist/" class="dj-tab-btn active" data-i18n="menu-account" data-mdj-profile-tab-link="1">Mi Perfil</a>
    <a href="/staff/" class="dj-tab-btn" data-mdj-nav="staff">STAFF</a>
    <a href="${MDJ_V1_ASSET_BASE}/dj-profile.html?tab=sft&amp;mdj_nav=profile" class="dj-tab-btn" data-i18n="nav-soundfortips">SoundForTips™</a>
  `.trim();

  tabs.append(container);

  const headerHost = document.getElementById('mdj-v2-v1-site-header-host');
  const app = document.getElementById('app');
  if (headerHost?.nextSibling) {
    headerHost.parentNode?.insertBefore(tabs, headerHost.nextSibling);
  } else if (app?.parentNode) {
    app.parentNode.insertBefore(tabs, app);
  } else {
    document.body.prepend(tabs);
  }

  document.body.classList.add('dj-profile', 'mdj-from-profile');
  return tabs;
}

export function buildArtistV1PortalLayout(options?: ArtistV1LayoutOptions): ArtistV1LayoutSlots {
  const root = document.createElement('div');
  root.className = 'mdj-v2-v1-artist-portal';
  root.dataset.mdjV1ArtistLayout = '1';

  /* SSOT: LabPortalIdentity · mirrors V1 dj_profiles photo_url / background_url / stage_name */
  const identity = getLabPortalIdentity('artist');
  /* MOD-215 — stageName/city/roleTag/socialLinks now default to the shared
     Config-tab store (artistLabProfileStore) instead of the static lab
     fixture directly, so editing Config re-renders the Hero live. Explicit
     `options?.profile?.X` still wins when passed (tests, future real data). */
  const labState = artistLabProfileStore.getState();
  const stageName = options?.profile?.stageName || labState.stageName || identity.stageName || identity.displayName;
  const photo = (options?.profile?.photoUrl || identity.photoUrl).trim();
  const cover = (options?.profile?.backgroundUrl || identity.backgroundUrl).trim();
  const socialLinks = resolveSocialLinks(options?.profile?.socialLinks ?? labState.socialLinks);
  const city = options?.profile?.city || labState.city || '';
  const roleTag = labState.roleTag || 'DJ · Producer';
  const roleLabel = city ? `${roleTag.toUpperCase()} · ${city.toUpperCase()}` : roleTag.toUpperCase();
  const rating = options?.profile?.rating ?? LAB_ARTIST_PROFILE_DJMAGO305.rating;
  const ratingHtml = buildHeroRatingStarsHtml(rating);
  /* MOD-213 — PRO/tier and VERIFIED are two independent real account flags
     (PO correction, 2026-08-12): commercialTier = paid vs. free account,
     verified = passed the MDJB certification course. Previously a single
     hardcoded "✦ ARTISTA · VERIFICADO" string conflated the two; now each
     renders its own pill from the real ArtistProfileReadDTO fields already
     mapped for the profile body below (never disagrees with it). */
  const commercialTier = options?.profile?.commercialTier ?? LAB_ARTIST_PROFILE_DJMAGO305.commercialTier;
  const verified = options?.profile?.verified ?? LAB_ARTIST_PROFILE_DJMAGO305.verified;
  const tierPillHtml = `<div id="pub-hero-plan-pill" class="dj-hero-plan-pill dj-hero-plan-pill--${commercialTier.toLowerCase()}">✦ PLAN ${commercialTier.toUpperCase()}</div>`;
  const verifiedPillHtml = verified
    ? '<div class="dj-hero-plan-pill dj-hero-plan-pill--verified">✓ VERIFICADO</div>'
    : '';
  const socialRowHtml = `<div class="dj-social-row">${buildSocialRowInnerHtml(socialLinks)}</div>`;

  const hero = document.createElement('div');
  hero.className = 'dj-hero mdj-v2-v1-dj-hero';
  hero.dataset.mdjIdentitySsot = identity.username;
  hero.dataset.mdjV1AssetMap = 'ssot:artist.photoUrl+backgroundUrl';
  hero.innerHTML = `
    <img class="dj-hero-bg-photo loaded" id="hero-bg-photo" src="${cover}" alt="Cover — ${stageName}" />
    <div class="dj-hero-overlay"></div>
    <div id="pub-hero-top-stack" class="dj-hero-top-stack">
      ${tierPillHtml}
      ${verifiedPillHtml}
    </div>
    <div class="dj-hero-inset">
      <img id="pub-photo-inset" class="loaded" src="${photo}" alt="${stageName}" />
    </div>
    <div class="dj-hero-content">
      <div class="dj-hero-left">
        <div class="dj-hero-role" id="pub-role-label">${roleLabel}</div>
        <h1 id="pub-name" class="dj-hero-name">${stageName}<span class="dot">.</span></h1>
        <div class="dj-rating" id="pub-hero-rating">${ratingHtml}</div>
        ${socialRowHtml}
      </div>
    </div>
  `.trim();

  wireArtistHeroShareButton(hero);

  /* MOD-215 — Config-tab save reflects into the Hero live: surgically patch
     just name/role/social-row, leaving the WebGL canvas, tabs, and other
     panels untouched (a full hero rebuild would clobber Agenda's mounted
     weather engine). Explicit `options?.profile?.X` overrides (tests) still
     win over store updates, same priority as the initial build above. */
  artistLabProfileStore.subscribe((state) => {
    const nextCity = options?.profile?.city || state.city || '';
    const nextRoleTag = state.roleTag || 'DJ · Producer';
    const nextRoleLabel = nextCity
      ? `${nextRoleTag.toUpperCase()} · ${nextCity.toUpperCase()}`
      : nextRoleTag.toUpperCase();
    const nextSocialLinks = resolveSocialLinks(options?.profile?.socialLinks ?? state.socialLinks);

    const nameEl = hero.querySelector('.dj-hero-name');
    if (nameEl) {
      nameEl.innerHTML = `${options?.profile?.stageName || state.stageName}<span class="dot">.</span>`;
    }
    const roleEl = hero.querySelector('.dj-hero-role');
    if (roleEl) roleEl.textContent = nextRoleLabel;
    const socialRow = hero.querySelector('.dj-social-row');
    if (socialRow) {
      socialRow.innerHTML = buildSocialRowInnerHtml(nextSocialLinks);
      wireArtistHeroShareButton(hero);
    }
  });

  const body = document.createElement('div');
  body.className = 'dj-body dj-body--no-sidebar';

  const mainCol = document.createElement('div');
  mainCol.className = 'dj-main-col';

  const jobsSlot = createSectionSlot('jobs-marketplace');
  jobsSlot.classList.add('mdj-v2-lab-legacy-mvp');
  const notifSlot = createSectionSlot('notifications');
  notifSlot.classList.add('mdj-v2-lab-legacy-mvp');
  const activitySlot = createSectionSlot('activity-timeline', true);
  activitySlot.classList.add('mdj-v2-lab-legacy-mvp');
  mainCol.append(jobsSlot, notifSlot, activitySlot);

  body.append(mainCol);

  /* MOD-206 — definitive tab distribution (Capitan, 2026-08-12):
     #profile = Perfil + Bio + Media/Analytics + SoundForTips (unchanged).
     #agenda  = Agenda Full-Page (Hero WebGL + Matrix, appended separately by
                mountArtistAgendaFullpage) + Writers/Mutations + real Schedule
                + Gig Weather Radar (moved in from mainCol, PO decision
                2026-08-12 — per-gig forecast now lives in Agenda's own
                context instead of sitting outside the tab system).
                Legacy "upcoming-gigs" (hardcoded ARTIST_UPCOMING_GIGS) REMOVED
                outright — fully superseded by the real artist-schedule slice,
                not just hidden.
     #wallet  = real Finance/Wallet slice (Cash Flow, SSOT balance, pending).
     #config  = MOD-215, Config tab (PO correction, 2026-08-12): editable
                stage name / city / role tag / social links live here, not
                inline in the read-only Mi Perfil view — writes go to
                artistLabProfileStore, which the Hero + Mi Perfil both
                subscribe to.
     MOD-216 — no second tab-button row (PO correction, 2026-08-12): the
     top #owner-tabs strip is the artist page's ONLY tab bar. A separate
     row here duplicated destinations already in #owner-tabs (Agenda,
     CONFIG, Mi Perfil) — createArtistTabController still builds these 4
     `panels` (content + hidden-attribute switching), but its `tabBar` is
     discarded; wireArtistOwnerTabsPanelSwitch (render-artist-dashboard-mvp.ts)
     drives visibility directly from #owner-tabs' own links instead. */
  const { panels } = createArtistTabController([
    { id: 'profile', label: 'Mi Perfil' },
    { id: 'agenda', label: 'Agenda · Gigs' },
    { id: 'wallet', label: 'Ingresos · Wallet' },
    { id: 'config', label: '⚙️ Config' },
  ]);

  /* MOD-209 — Vista Personal/Pública switch. Public mode hides
     [data-mdj-profile-visibility="private-only"] (Legal identity), the
     Analytics section, and the SoundForTips payment-config link — see the
     [data-mdj-view-mode="public"] rules in v1-portal-layouts.css.
     Right-aligned in its own slim row under the hero (Capitan correction,
     2026-08-12) — no longer paired with a tab-button bar, just this toggle. */
  const viewModeToggle = createArtistViewModeToggle();
  wireArtistViewModeToggle(viewModeToggle, panels.profile);

  const profileSlot = createSectionSlot('artist-profile');
  profileSlot.classList.add('owner-card');
  const songSlot = createSectionSlot('song4tips');
  const mediaSlot = createSectionSlot('media-library');
  const analyticsSlot = createSectionSlot('analytics');
  panels.profile.append(profileSlot);
  /* MOD-217 — clon 1:1 de secciones reales de V1 (ui-v1-clone/dj-profile.html),
     mismo orden de lectura: Opiniones justo después del info card, luego
     Bio propia, Disponibilidad, e Interactuar/QR al final. */
  renderArtistReviewsCard(panels.profile);
  renderArtistBioCard(panels.profile);
  renderArtistAvailabilityCard(panels.profile);
  renderArtistInteractCard(panels.profile);
  panels.profile.append(mediaSlot, analyticsSlot, songSlot);

  const mutationsCard = document.createElement('div');
  mutationsCard.className = 'dj-card mdj-v2-v1-ops-card';
  const mutationsTitle = document.createElement('h3');
  mutationsTitle.className = 'mdj-v2-v1-ops-card__title';
  mutationsTitle.textContent = 'Writers · Gig & Payout';
  const mutationsHost = createSectionSlot('artist-mutations', true);
  mutationsHost.classList.add('mdj-v2-v1-mutations-slot');
  mutationsCard.append(mutationsTitle, mutationsHost);

  const scheduleSlot = createSectionSlot('artist-schedule', true);
  scheduleSlot.classList.add('mdj-v2-v1-ops-card');

  const weatherSlot = createSectionSlot('artist-weather', true);
  weatherSlot.classList.add('mdj-v2-v1-ops-card');

  panels.agenda.append(mutationsCard, scheduleSlot, weatherSlot);
  /* The 100vh WebGL Hero + Matrix mounts itself directly into this panel
     (mountArtistAgendaFullpage looks up [data-tab-panel="agenda"]) — appended
     after this function returns, once main.ts calls it, landing right after
     weatherSlot in DOM order (i.e. just after the per-gig forecast). */

  const walletSlot = createSectionSlot('artist-wallet', true);
  walletSlot.classList.add('mdj-v2-v1-ops-card');
  panels.wallet.append(walletSlot);

  const configSlot = createSectionSlot('artist-config');
  configSlot.classList.add('owner-card');
  renderArtistConfigForm(configSlot);
  panels.config.append(configSlot);

  const tabPanelsWrap = document.createElement('div');
  tabPanelsWrap.className = 'mdj-artist-tab-panels';
  tabPanelsWrap.append(panels.profile, panels.agenda, panels.wallet, panels.config);

  const tabsRow = document.createElement('div');
  tabsRow.className = 'mdj-artist-tabs-row';
  tabsRow.append(viewModeToggle.root);

  root.append(hero, tabsRow, tabPanelsWrap, body);

  return { root, hero, mainCol, tabPanelsWrap, mutationsHost };
}
