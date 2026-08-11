/**
 * MOD-301 Slice 1 — Staff Identity Read View (DOM).
 * Strictly READ-ONLY — no role assignment, permission mutation, or edit forms.
 */

import type {
  AccessSnapshotDTO,
  StaffIdentityDTO,
} from '../../shared/services/profiles/index';
import {
  toStaffIdentityReadViewModel,
  type StaffIdentityReadViewModel,
} from './staff-identity-read-view-model';

export type RenderStaffIdentityReadViewOptions = {
  readonly sourceLabel?: string;
  readonly displayName?: string | null;
  readonly accessSnapshot?: AccessSnapshotDTO | null;
};

function createSummaryRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'mdj-staff-identity-read__row';

  const dt = document.createElement('dt');
  dt.className = 'mdj-staff-identity-read__label';
  dt.textContent = label;

  const dd = document.createElement('dd');
  dd.className = 'mdj-staff-identity-read__value';
  dd.textContent = value;

  row.append(dt, dd);
  return row;
}

function createSection(title: string, sectionId: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-staff-identity-read__section';
  section.dataset.mdjStaffIdentitySection = sectionId;

  const heading = document.createElement('h3');
  heading.className = 'mdj-staff-identity-read__section-title';
  heading.textContent = title;
  section.append(heading);
  return section;
}

function renderHeader(vm: StaffIdentityReadViewModel, sourceLabel: string): HTMLElement {
  const header = document.createElement('header');
  header.className = 'mdj-staff-identity-read__header';
  header.dataset.mdjStaffIdentitySection = 'header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mdj-staff-identity-read__eyebrow';
  eyebrow.textContent = `MOD-301 · Read view · ${sourceLabel}`;

  const name = document.createElement('h2');
  name.className = 'mdj-staff-identity-read__name';
  name.textContent = vm.displayName;

  const badges = document.createElement('div');
  badges.className = 'mdj-staff-identity-read__badges';
  badges.setAttribute('aria-label', 'Staff role and scope');

  const role = document.createElement('span');
  role.className = 'mdj-staff-identity-read__badge mdj-staff-identity-read__badge--role';
  role.dataset.mdjStaffRole = vm.roleLabel;
  role.textContent = vm.roleLabel;

  const scope = document.createElement('span');
  scope.className = `mdj-staff-identity-read__badge mdj-staff-identity-read__badge--scope mdj-staff-identity-read__badge--scope-${vm.scopeKind}`;
  scope.dataset.mdjStaffScope = vm.scopeKind;
  scope.textContent = vm.scopeLabel;

  const profileId = document.createElement('span');
  profileId.className = 'mdj-staff-identity-read__badge';
  profileId.dataset.mdjStaffProfileId = vm.staffProfileId;
  profileId.textContent = vm.staffProfileId;

  badges.append(role, scope, profileId);

  const meta = document.createElement('dl');
  meta.className = 'mdj-staff-identity-read__meta';
  if (vm.mdjbId) meta.append(createSummaryRow('MDJB ID', vm.mdjbId));
  meta.append(createSummaryRow('User id', vm.userIdShort));

  header.append(eyebrow, name, badges, meta);
  return header;
}

function renderPermissions(vm: StaffIdentityReadViewModel): HTMLElement {
  const section = createSection('Permission flags (read-only)', 'permissions');
  const list = document.createElement('ul');
  list.className = 'mdj-staff-identity-read__flags';

  for (const flag of vm.permissionFlags) {
    const li = document.createElement('li');
    li.className = `mdj-staff-identity-read__flag${flag.on ? ' is-on' : ' is-off'}`;
    li.dataset.mdjStaffFlag = flag.id;
    li.dataset.mdjStaffFlagOn = flag.on ? 'true' : 'false';
    li.textContent = `${flag.label}: ${flag.on ? 'ON' : 'OFF'}`;
    list.append(li);
  }

  section.append(list);
  return section;
}

function renderAccessSnapshot(vm: StaffIdentityReadViewModel): HTMLElement {
  const section = createSection('Access snapshot', 'access-snapshot');
  const list = document.createElement('dl');
  list.className = 'mdj-staff-identity-read__list';

  if (!vm.accessOk) {
    list.append(
      createSummaryRow('Status', 'Unavailable'),
      createSummaryRow('Reason', vm.accessFailureReason ?? '—'),
    );
    section.append(list);
    return section;
  }

  list.append(
    createSummaryRow('Status', 'OK'),
    createSummaryRow('profile_kind', vm.accessProfileKind ?? '—'),
    createSummaryRow('role', vm.accessRole ?? '—'),
    createSummaryRow('mdjb_id', vm.accessMdjbId ?? '—'),
    createSummaryRow('auth_uid', vm.accessAuthUidShort ?? '—'),
  );
  section.append(list);
  return section;
}

function renderOperationalScope(vm: StaffIdentityReadViewModel): HTMLElement {
  const section = createSection('Operational scope', 'operational-scope');
  const note = document.createElement('p');
  note.className = 'mdj-staff-identity-read__note';
  note.textContent =
    'Seller is limited staff. Owner/Manager are full management (is_staff_management). No role mutation from this view.';
  section.append(note);

  const list = document.createElement('dl');
  list.className = 'mdj-staff-identity-read__list';
  list.append(
    createSummaryRow('Scope', vm.scopeLabel),
    createSummaryRow('is_staff', vm.isStaff ? 'true' : 'false'),
    createSummaryRow('is_staff_management', vm.isStaffManagement ? 'true' : 'false'),
  );
  section.append(list);
  return section;
}

/**
 * Renders a read-only staff identity panel into `container` (replaces children).
 */
export function renderStaffIdentityReadView(
  container: HTMLElement,
  identity: StaffIdentityDTO,
  options?: RenderStaffIdentityReadViewOptions,
): StaffIdentityReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'StaffIdentityDTO';
  const vm = toStaffIdentityReadViewModel({
    identity,
    accessSnapshot: options?.accessSnapshot ?? null,
    displayName: options?.displayName ?? null,
  });

  const root = document.createElement('article');
  root.className = 'mdj-staff-identity-read';
  root.dataset.mdjComponent = 'StaffIdentityReadView';
  root.dataset.mdjMod = 'MOD-301';
  root.setAttribute('aria-label', 'Staff identity read view');

  root.append(
    renderHeader(vm, sourceLabel),
    renderPermissions(vm),
    renderAccessSnapshot(vm),
    renderOperationalScope(vm),
  );

  for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) {
    el.remove();
  }

  container.replaceChildren(root);
  return vm;
}
