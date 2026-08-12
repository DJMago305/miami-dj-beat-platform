/**
 * MOD-204 Slice 1 — Artist Profile Read View (DOM).
 * Strictly READ-ONLY visualization — no forms, no save buttons, no mutators.
 */

import type { ArtistProfileReadDTO } from '../../shared/services/profiles/index';
import {
  toArtistProfileReadViewModel,
  type ArtistProfileReadViewModel,
} from './artist-profile-read-view-model';

export type RenderArtistProfileReadViewOptions = {
  readonly sourceLabel?: string;
};

function createSummaryRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'mdj-artist-profile-read__row';

  const dt = document.createElement('dt');
  dt.className = 'mdj-artist-profile-read__label';
  dt.textContent = label;

  const dd = document.createElement('dd');
  dd.className = 'mdj-artist-profile-read__value';
  dd.textContent = value;

  row.append(dt, dd);
  return row;
}

function createSection(title: string, sectionId: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-artist-profile-read__section';
  section.dataset.mdjArtistProfileSection = sectionId;

  const heading = document.createElement('h3');
  heading.className = 'mdj-artist-profile-read__section-title';
  heading.textContent = title;
  section.append(heading);
  return section;
}

function appendEmptyHint(section: HTMLElement, message: string): void {
  const hint = document.createElement('p');
  hint.className = 'mdj-artist-profile-read__empty';
  hint.textContent = message;
  section.append(hint);
}

function renderHeader(vm: ArtistProfileReadViewModel, sourceLabel: string): HTMLElement {
  const header = document.createElement('header');
  header.className = 'mdj-artist-profile-read__header';
  header.dataset.mdjArtistProfileSection = 'header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mdj-artist-profile-read__eyebrow';
  eyebrow.textContent = `MOD-204 · Read view · ${sourceLabel}`;

  const stage = document.createElement('h2');
  stage.className = 'mdj-artist-profile-read__stage';
  stage.textContent = vm.stageName;

  const badges = document.createElement('div');
  badges.className = 'mdj-artist-profile-read__badges';
  badges.setAttribute('aria-label', 'Artist tier and SFT gate');

  const tier = document.createElement('span');
  tier.className = 'mdj-artist-profile-read__badge mdj-artist-profile-read__badge--tier';
  tier.dataset.mdjArtistTier = vm.commercialTierLabel;
  tier.textContent = vm.commercialTierLabel;

  const category = document.createElement('span');
  category.className = 'mdj-artist-profile-read__badge';
  category.textContent = vm.artistCategoryLabel;

  const sft = document.createElement('span');
  sft.className = `mdj-artist-profile-read__badge mdj-artist-profile-read__badge--sft mdj-artist-profile-read__badge--sft-${vm.sftGateStatus}`;
  sft.dataset.mdjSftGate = vm.sftGateStatus;
  sft.textContent = vm.sftGateLabel;

  badges.append(tier, category, sft);

  const meta = document.createElement('dl');
  meta.className = 'mdj-artist-profile-read__meta';
  if (vm.usernameHandle) meta.append(createSummaryRow('Handle', vm.usernameHandle));
  if (vm.mdjbId) meta.append(createSummaryRow('MDJB ID', vm.mdjbId));
  meta.append(createSummaryRow('Song4Tips booth', vm.soundfortipsBoothLabel));

  header.append(eyebrow, stage, badges, meta);
  return header;
}

function renderBio(vm: ArtistProfileReadViewModel): HTMLElement {
  const section = createSection('Bio', 'bio');
  if (!vm.bioPrimary && !vm.bioShort && !vm.bioLong && !vm.bioEn) {
    appendEmptyHint(section, 'No bio on file.');
    return section;
  }

  if (vm.bioPrimary) {
    const primary = document.createElement('p');
    primary.className = 'mdj-artist-profile-read__bio-primary';
    primary.textContent = vm.bioPrimary;
    section.append(primary);
  }

  const list = document.createElement('dl');
  list.className = 'mdj-artist-profile-read__list';
  if (vm.bioShort && vm.bioShort !== vm.bioPrimary) {
    list.append(createSummaryRow('Short', vm.bioShort));
  }
  if (vm.bioLong && vm.bioLong !== vm.bioPrimary) {
    list.append(createSummaryRow('Long', vm.bioLong));
  }
  if (list.childElementCount > 0) section.append(list);
  return section;
}

function renderResidency(vm: ArtistProfileReadViewModel): HTMLElement {
  const section = createSection('Residency', 'residency');
  const list = document.createElement('dl');
  list.className = 'mdj-artist-profile-read__list';

  list.append(createSummaryRow('City', vm.residencyCity ?? '—'));
  if (vm.specialty) list.append(createSummaryRow('Specialty', vm.specialty));
  if (vm.availableLabel) list.append(createSummaryRow('Availability', vm.availableLabel));
  if (vm.verifiedLabel) list.append(createSummaryRow('Verification', vm.verifiedLabel));
  if (vm.ratingLabel) list.append(createSummaryRow('Rating', vm.ratingLabel));
  if (vm.hourlyRateLabel) list.append(createSummaryRow('Hourly rate', vm.hourlyRateLabel));

  section.append(list);

  if (!vm.residencyCity) {
    appendEmptyHint(section, 'Residency venue schedule not mapped on DTO yet (city only).');
  }
  return section;
}

function renderMedia(vm: ArtistProfileReadViewModel): HTMLElement {
  const section = createSection('Media & social', 'media');
  const list = document.createElement('dl');
  list.className = 'mdj-artist-profile-read__list';
  list.append(
    createSummaryRow('Photo', vm.photoUrl ?? '—'),
    createSummaryRow('Background', vm.backgroundUrl ?? '—'),
  );
  section.append(list);

  if (vm.socialLinksAvailable) {
    const socialList = document.createElement('ul');
    socialList.className = 'mdj-artist-profile-read__social-links';
    socialList.setAttribute('aria-label', 'Social media links');
    for (const link of vm.socialLinks) {
      const item = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.className = 'mdj-artist-profile-read__social-link';
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.dataset.mdjSocialPlatform = link.platform;
      anchor.textContent = link.label;
      item.append(anchor);
      socialList.append(item);
    }
    section.append(socialList);
  } else {
    appendEmptyHint(section, 'No social media links on file for this artist yet.');
  }

  if (vm.photoUrl) {
    const img = document.createElement('img');
    img.className = 'mdj-artist-profile-read__photo';
    img.src = vm.photoUrl;
    img.alt = `${vm.stageName} profile photo`;
    img.loading = 'lazy';
    section.append(img);
  }

  return section;
}

/**
 * Renders a read-only artist profile panel into `container` (replaces children).
 * Guarantees zero interactive writers (no form / submit / save controls).
 * No internal `.dj-hero` banner — the page-level identity hero (cover photo,
 * avatar, stage name) already renders once above the tab system
 * (v1-artist-portal-layout.ts); duplicating it here doubled the same photo
 * and name on screen (visual audit finding, 2026-08-12, fixed same day).
 * `renderHeader()` still carries the info the page-level hero doesn't show
 * (tier/category/SFT badges, handle, MDJB ID, Song4Tips booth status).
 * No Legal Identity section (full name / email) — that's owner-only account
 * data, edited exclusively in the Config tab (PO decision, 2026-08-12); it
 * was never public and doesn't belong in this public press-kit view.
 */
export function renderArtistProfileReadView(
  container: HTMLElement,
  profile: ArtistProfileReadDTO,
  options?: RenderArtistProfileReadViewOptions,
): ArtistProfileReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'ArtistProfileReadDTO';
  const vm = toArtistProfileReadViewModel(profile);

  const root = document.createElement('article');
  root.className = 'mdj-artist-profile-read mdj-v2-v1-artist-profile';
  root.dataset.mdjComponent = 'ArtistProfileReadView';
  root.dataset.mdjMod = 'MOD-204';
  root.setAttribute('aria-label', 'Artist profile read view');

  root.append(
    renderHeader(vm, sourceLabel),
    renderBio(vm),
    renderResidency(vm),
    renderMedia(vm),
  );

  for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) {
    el.remove();
  }

  container.replaceChildren(root);
  return vm;
}
