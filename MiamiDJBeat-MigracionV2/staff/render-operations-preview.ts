/** Phase 9 — Operations Preview — first visible staff module (mock data + live permissions). */

import {
  asSessionSnapshotWithPermissions,
  getSessionPermissionFlagsForTests,
  getSessionPermissionProfileForTests,
  getSessionSnapshot,
  getSessionState,
  hasSessionCapability,
  isSessionError,
} from '@mdj/shared/session';
import type { SessionSnapshot } from '@mdj/shared/session';
import type { MdjThemeBinding } from '../shared/components/index';
import { createPanel, createSectionHeader } from '../shared/components/index';
import {
  STAFF_OPERATIONS_CAPABILITY_CARDS,
  STAFF_OPERATIONS_PREVIEW_EVENTS,
  STAFF_OPERATIONS_PREVIEW_METRICS,
  STAFF_PREVIEW_OPERATOR_NAMES,
  STAFF_PREVIEW_ROLE_DISPLAY,
} from './operations-preview-data';
import { mountComponentDescriptor } from './mount-component-descriptor';
import { buildStaffPreviewRoleUrl, type StaffPreviewRole } from './staff-preview-role';

function safeGetSessionSnapshot(): SessionSnapshot | null {
  try {
    return getSessionSnapshot();
  } catch (error) {
    if (isSessionError(error) && error.code === 'SESSION_ERROR_NOT_READY') {
      return null;
    }
    throw error;
  }
}

function safeGetSessionState(): string {
  try {
    return getSessionState();
  } catch (error) {
    if (isSessionError(error) && error.code === 'SESSION_ERROR_NOT_READY') {
      return 'SESSION_UNINITIALIZED';
    }
    throw error;
  }
}

function safeHasSessionCapability(capabilityId: string): boolean {
  try {
    return hasSessionCapability(capabilityId, 'staff');
  } catch (error) {
    if (isSessionError(error) && error.code === 'SESSION_ERROR_NOT_READY') {
      return false;
    }
    throw error;
  }
}

function createOperationsBlock(title: string, themeBinding: MdjThemeBinding): HTMLElement {
  const block = document.createElement('div');
  block.className = 'mdj-operations-preview__block';

  const panel = mountComponentDescriptor(
    createPanel({ title, variant: 'glass' }, themeBinding),
  );
  panel.classList.add('mdj-operations-preview__panel');
  block.append(panel);
  return block;
}

function resolveStaffRoleLabel(): string {
  const profile = getSessionPermissionProfileForTests();
  if (profile.kind === 'staff') {
    return STAFF_PREVIEW_ROLE_DISPLAY[profile.profileId] ?? profile.profileId.toUpperCase();
  }
  return 'GUEST';
}

function resolveOperatorName(): string {
  const snapshot = safeGetSessionSnapshot();
  const profile = getSessionPermissionProfileForTests();
  if (snapshot?.user?.email) {
    return snapshot.user.email;
  }
  if (profile.kind === 'staff') {
    return STAFF_PREVIEW_OPERATOR_NAMES[profile.profileId] ?? 'Staff Operator';
  }
  return 'Staff Operator';
}

function createActiveProfileBlock(themeBinding: MdjThemeBinding): HTMLElement {
  const block = createOperationsBlock('Active profile', themeBinding);
  const panel = block.querySelector('.mdj-operations-preview__panel');
  if (!panel) return block;

  const profile = getSessionPermissionProfileForTests();
  const list = document.createElement('dl');
  list.className = 'mdj-client-summary-list';
  list.innerHTML = `
    <div class="mdj-client-summary-list__row"><dt>User</dt><dd>${resolveOperatorName()}</dd></div>
    <div class="mdj-client-summary-list__row"><dt>Account type</dt><dd>${profile.kind === 'staff' ? 'Staff' : profile.kind}</dd></div>
    <div class="mdj-client-summary-list__row"><dt>Role</dt><dd>${resolveStaffRoleLabel()}</dd></div>
    <div class="mdj-client-summary-list__row"><dt>Lifecycle</dt><dd>${safeGetSessionState()}</dd></div>
  `;
  panel.append(list);
  return block;
}

function createCapabilityCardsBlock(themeBinding: MdjThemeBinding): HTMLElement {
  const block = createOperationsBlock('Capabilities', themeBinding);
  const panel = block.querySelector('.mdj-operations-preview__panel');
  if (!panel) return block;

  const grid = document.createElement('div');
  grid.className = 'mdj-operations-preview__capability-grid';

  for (const card of STAFF_OPERATIONS_CAPABILITY_CARDS) {
    const enabled = safeHasSessionCapability(card.capabilityId);
    const item = document.createElement('article');
    item.className = `mdj-operations-preview__capability${enabled ? ' mdj-operations-preview__capability--on' : ' mdj-operations-preview__capability--off'}`;
    item.dataset.mdjCapability = card.capabilityId;
    item.innerHTML = `
      <span class="mdj-operations-preview__capability-mark" aria-hidden="true">${enabled ? '✓' : '—'}</span>
      <span class="mdj-operations-preview__capability-label">${card.label}</span>
    `;
    grid.append(item);
  }

  panel.append(grid);
  return block;
}

function createMockEventsBlock(themeBinding: MdjThemeBinding): HTMLElement {
  const block = createOperationsBlock('Mock events', themeBinding);
  const panel = block.querySelector('.mdj-operations-preview__panel');
  if (!panel) return block;

  const table = document.createElement('table');
  table.className = 'mdj-client-table mdj-operations-preview__table';
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">Event</th>
        <th scope="col">Client</th>
        <th scope="col">Date</th>
        <th scope="col">Status</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  for (const row of STAFF_OPERATIONS_PREVIEW_EVENTS) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.event}</td>
      <td>${row.client}</td>
      <td>${row.date}</td>
      <td><span class="mdj-client-table__status">${row.status}</span></td>
    `;
    tbody.append(tr);
  }

  table.append(tbody);
  panel.append(table);
  return block;
}

function createMockMetricsBlock(themeBinding: MdjThemeBinding): HTMLElement {
  const block = createOperationsBlock('Mock metrics', themeBinding);
  const panel = block.querySelector('.mdj-operations-preview__panel');
  if (!panel) return block;

  const grid = document.createElement('div');
  grid.className = 'mdj-operations-preview__metrics';

  for (const metric of STAFF_OPERATIONS_PREVIEW_METRICS) {
    const card = document.createElement('article');
    card.className = 'mdj-operations-preview__metric';
    card.innerHTML = `
      <p class="mdj-operations-preview__metric-value">${metric.value}</p>
      <p class="mdj-operations-preview__metric-label">${metric.label}</p>
    `;
    grid.append(card);
  }

  panel.append(grid);
  return block;
}

function createDebugPanelBlock(themeBinding: MdjThemeBinding): HTMLElement {
  const block = createOperationsBlock('Debug panel (dev)', themeBinding);
  const panel = block.querySelector('.mdj-operations-preview__panel');
  if (!panel) return block;

  const snapshot = safeGetSessionSnapshot();
  const profile = getSessionPermissionProfileForTests();
  const flags = getSessionPermissionFlagsForTests();
  const permissions = snapshot
    ? asSessionSnapshotWithPermissions(snapshot).permissions
    : null;

  const pre = document.createElement('pre');
  pre.className = 'mdj-operations-preview__debug';
  pre.textContent = JSON.stringify(
    {
      permissionProfile: profile,
      flags,
      capabilities: permissions?.capabilities ?? snapshot?.capabilities ?? [],
      sessionLifecycle: safeGetSessionState(),
      documentedRole: permissions?.documentedRole ?? null,
      snapshotVersion: snapshot?.snapshotVersion ?? null,
    },
    null,
    2,
  );
  panel.append(pre);
  return block;
}

function createPreviewRoleSwitcher(): HTMLElement | null {
  if (!import.meta.env.DEV) {
    return null;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'mdj-operations-preview__role-switcher';
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Preview staff role');

  const label = document.createElement('span');
  label.className = 'mdj-operations-preview__role-switcher-label';
  label.textContent = 'Preview role:';
  toolbar.append(label);

  for (const role of ['owner', 'manager', 'seller'] as const satisfies readonly StaffPreviewRole[]) {
    const link = document.createElement('a');
    link.className = 'mdj-operations-preview__role-link';
    link.href = buildStaffPreviewRoleUrl(role);
    link.textContent = role.toUpperCase();
    toolbar.append(link);
  }

  return toolbar;
}

export function createOperationsPreviewSection(themeBinding: MdjThemeBinding): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-dashboard__section mdj-client-dashboard__section--wide mdj-operations-preview';
  section.dataset.mdjStaffSection = 'operations-preview';

  section.append(
    mountComponentDescriptor(
      createSectionHeader({ title: 'Operations Preview', variant: 'module-grid' }, themeBinding),
    ),
  );

  const roleSwitcher = createPreviewRoleSwitcher();
  if (roleSwitcher) {
    section.append(roleSwitcher);
  }

  const grid = document.createElement('div');
  grid.className = 'mdj-operations-preview__grid';
  grid.append(
    createActiveProfileBlock(themeBinding),
    createCapabilityCardsBlock(themeBinding),
    createMockEventsBlock(themeBinding),
    createMockMetricsBlock(themeBinding),
  );

  if (import.meta.env.DEV) {
    grid.append(createDebugPanelBlock(themeBinding));
  }

  section.append(grid);
  return section;
}
