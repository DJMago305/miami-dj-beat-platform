/** MOD-008 Portal Shell — DOM mount — TICKET-MOD-008-PORTAL-SHELL-001 */

import {
  createShellKpiCard,
  createShellModuleCard,
  createShellStatusPill,
} from '../components/portal-shell-parts';
import type { PortalRuntimeStatus, PortalShellContent } from './types';

function createNavItem(item: PortalShellContent['navItems'][number]): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'mdj-shell-nav__item';

  const link = document.createElement('span');
  link.className = `mdj-shell-nav__link${item.active ? ' is-active' : ''}`;
  link.textContent = item.label;
  link.setAttribute('role', 'link');
  link.setAttribute('aria-current', item.active ? 'page' : 'false');

  li.append(link);
  return li;
}

function appendRuntimeStatus(container: HTMLElement, status: PortalRuntimeStatus): void {
  const pills = [
    createShellStatusPill({
      label: 'Configuration',
      value: status.configLoaded ? 'ready' : 'pending',
      ready: status.configLoaded,
    }),
    createShellStatusPill({
      label: 'Event Bus',
      value: status.busReady ? 'ready' : 'pending',
      ready: status.busReady,
    }),
    createShellStatusPill({
      label: 'Logging',
      value: status.loggingReady ? 'ready' : 'pending',
      ready: status.loggingReady,
    }),
    createShellStatusPill({
      label: 'Error Handler',
      value: status.errorHandlerReady ? 'ready' : 'pending',
      ready: status.errorHandlerReady,
    }),
    createShellStatusPill({
      label: 'Session',
      value: status.sessionReady ? 'ready' : 'pending',
      ready: status.sessionReady,
    }),
    createShellStatusPill({
      label: 'Runtime',
      value: status.runtimeReady
        ? status.systemReadyConfirmed
          ? 'ready'
          : 'pending'
        : 'pending',
      ready: status.runtimeReady && status.systemReadyConfirmed,
    }),
    createShellStatusPill({
      label: 'Theme',
      value: status.themeReady ? 'ready' : 'pending',
      ready: status.themeReady,
    }),
    createShellStatusPill({
      label: 'Permissions',
      value: status.permissionsReady
        ? `ready (${status.permissionComponentCount})`
        : 'pending',
      ready: status.permissionsReady,
    }),
  ];

  container.replaceChildren(...pills);
}

export function renderPortalShell(
  root: HTMLElement,
  content: PortalShellContent,
  status: PortalRuntimeStatus,
): void {
  document.title = content.documentTitle;
  root.className = 'mdj-portal-shell';
  root.dataset.mdjPortal = content.portalId;

  const layout = document.createElement('div');
  layout.className = 'mdj-portal-shell__layout';

  const header = document.createElement('header');
  header.className = 'mdj-portal-shell__header';
  header.dataset.mdjShellRegion = 'header';

  const brand = document.createElement('div');
  brand.className = 'mdj-shell-brand';

  const brandMonogram = document.createElement('span');
  brandMonogram.className = 'mdj-shell-brand__monogram';
  brandMonogram.textContent = 'MDJ';

  const brandCopy = document.createElement('div');
  brandCopy.className = 'mdj-shell-brand__copy';

  const brandMark = document.createElement('p');
  brandMark.className = 'mdj-shell-brand__mark';
  brandMark.textContent = content.brandMark;

  const brandSubtitle = document.createElement('p');
  brandSubtitle.className = 'mdj-shell-brand__subtitle';
  brandSubtitle.textContent = content.brandSubtitle;

  brandCopy.append(brandMark, brandSubtitle);
  brand.append(brandMonogram, brandCopy);

  const headerStatus = document.createElement('div');
  headerStatus.className = 'mdj-shell-header-status';
  headerStatus.dataset.mdjShellRegion = 'runtime-status';
  appendRuntimeStatus(headerStatus, status);

  const profile = document.createElement('div');
  profile.className = 'mdj-shell-profile';
  profile.dataset.mdjShellRegion = 'profile';

  const profileName = document.createElement('p');
  profileName.className = 'mdj-shell-profile__name';
  profileName.textContent = content.profileName;

  const profileRole = document.createElement('p');
  profileRole.className = 'mdj-shell-profile__role';
  profileRole.textContent = content.profileRole;

  const profileMeta = document.createElement('p');
  profileMeta.className = 'mdj-shell-profile__meta';
  profileMeta.textContent = content.profileMeta;

  profile.append(profileName, profileRole, profileMeta);
  header.append(brand, headerStatus, profile);

  const body = document.createElement('div');
  body.className = 'mdj-portal-shell__body';

  const sidebar = document.createElement('aside');
  sidebar.className = 'mdj-portal-shell__sidebar';
  sidebar.dataset.mdjShellRegion = 'sidebar';

  const navTitle = document.createElement('p');
  navTitle.className = 'mdj-shell-nav__title';
  navTitle.textContent = 'Navigation';

  const nav = document.createElement('nav');
  nav.className = 'mdj-shell-nav';
  nav.setAttribute('aria-label', `${content.brandSubtitle} navigation`);

  const navList = document.createElement('ul');
  navList.className = 'mdj-shell-nav__list';
  navList.replaceChildren(...content.navItems.map((item) => createNavItem(item)));
  nav.append(navList);
  sidebar.append(navTitle, nav);

  const main = document.createElement('main');
  main.className = 'mdj-portal-shell__main';
  main.dataset.mdjShellRegion = 'main';

  const hero = document.createElement('section');
  hero.className = 'mdj-shell-hero';
  hero.dataset.mdjShellRegion = 'hero';

  const heroEyebrow = document.createElement('p');
  heroEyebrow.className = 'mdj-shell-hero__eyebrow';
  heroEyebrow.textContent = content.heroEyebrow;

  const heroTitle = document.createElement('h1');
  heroTitle.className = 'mdj-shell-hero__title';
  heroTitle.textContent = content.heroTitle;

  const heroSubtitle = document.createElement('p');
  heroSubtitle.className = 'mdj-shell-hero__subtitle';
  heroSubtitle.textContent = content.heroSubtitle;

  hero.append(heroEyebrow, heroTitle, heroSubtitle);

  const kpiSection = document.createElement('section');
  kpiSection.className = 'mdj-shell-kpi-grid';
  kpiSection.dataset.mdjShellRegion = 'kpis';
  kpiSection.replaceChildren(
    ...content.kpis.map((kpi) =>
      createShellKpiCard({
        label: kpi.label,
        value: kpi.value,
        hint: kpi.hint,
      }),
    ),
  );

  const moduleSection = document.createElement('section');
  moduleSection.className = 'mdj-shell-module-grid';
  moduleSection.dataset.mdjShellRegion = 'modules';

  const moduleTitle = document.createElement('h2');
  moduleTitle.className = 'mdj-shell-module-grid__title';
  moduleTitle.textContent = content.modulesSectionTitle;

  const moduleGrid = document.createElement('div');
  moduleGrid.className = 'mdj-shell-module-grid__items';
  moduleGrid.replaceChildren(
    ...content.modules.map((module) =>
      createShellModuleCard({
        title: module.title,
        description: module.description,
        tag: module.tag,
      }),
    ),
  );

  moduleSection.append(moduleTitle, moduleGrid);

  if (status.bootErrorCode) {
    const error = document.createElement('p');
    error.className = 'mdj-shell-error';
    error.textContent = `Boot error: ${status.bootErrorCode}`;
    main.append(error);
  }

  main.append(hero, kpiSection, moduleSection);
  body.append(sidebar, main);
  layout.append(header, body);
  root.replaceChildren(layout);
}

export function buildPortalRuntimeStatus(input: {
  readonly content: PortalShellContent;
  readonly environment: string;
  readonly configLoaded: boolean;
  readonly busReady: boolean;
  readonly loggingReady: boolean;
  readonly errorHandlerReady: boolean;
  readonly sessionReady: boolean;
  readonly runtimeReady: boolean;
  readonly systemReadyConfirmed: boolean;
  readonly themeReady: boolean;
  readonly permissionsReady: boolean;
  readonly permissionComponentCount: number;
  readonly businessLogic: boolean;
  readonly version: string;
  readonly bootErrorCode?: string;
}): PortalRuntimeStatus {
  return Object.freeze({
    portalId: input.content.portalId,
    environment: input.environment,
    configLoaded: input.configLoaded,
    busReady: input.busReady,
    loggingReady: input.loggingReady,
    errorHandlerReady: input.errorHandlerReady,
    sessionReady: input.sessionReady,
    runtimeReady: input.runtimeReady,
    systemReadyConfirmed: input.systemReadyConfirmed,
    themeReady: input.themeReady,
    permissionsReady: input.permissionsReady,
    permissionComponentCount: input.permissionComponentCount,
    businessLogic: input.businessLogic,
    version: input.version,
    bootErrorCode: input.bootErrorCode,
  });
}
