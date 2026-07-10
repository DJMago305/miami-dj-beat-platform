/** MOD-008 Staff Portal Shell — navigation + module map — TICKET-MOD-008-PORTAL-SHELL-001 */

import type { PortalShellContent } from '../layout/types';

export const STAFF_SHELL_CONTENT: PortalShellContent = Object.freeze({
  portalId: 'staff',
  documentTitle: 'Miami DJ Beat — Staff Portal',
  brandMark: 'Miami DJ Beat',
  brandSubtitle: 'Staff Operations',
  heroEyebrow: 'Backoffice control',
  heroTitle: 'Staff Operations Dashboard',
  heroSubtitle: 'Coordinate leads, production, matching, and reporting from one console.',
  modulesSectionTitle: 'Operations Console',
  profileName: 'Staff Operator',
  profileRole: 'Staff',
  profileMeta: 'Operations · placeholder',
  navItems: Object.freeze([
    { id: 'dashboard', label: 'Dashboard', active: true },
    { id: 'leads', label: 'Leads' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'crm', label: 'CRM' },
    { id: 'production', label: 'Production' },
    { id: 'matching', label: 'Matching' },
    { id: 'reports', label: 'Reports' },
    { id: 'users', label: 'Users & Settings' },
  ]),
  kpis: Object.freeze([
    { id: 'leads', label: 'Open Leads', value: '—', hint: 'Coming soon' },
    { id: 'invoices', label: 'Invoices Queue', value: '—', hint: 'Coming soon' },
    { id: 'production', label: 'Production Tasks', value: '—', hint: 'Coming soon' },
    { id: 'matching', label: 'Matching Queue', value: '—', hint: 'Coming soon' },
  ]),
  modules: Object.freeze([
    {
      id: 'leads',
      title: 'Leads',
      description: 'Inbound lead pipeline and qualification slots — no CRM backend.',
      tag: 'Leads',
    },
    {
      id: 'invoices',
      title: 'Invoices',
      description: 'Manual invoice operations placeholder — no real billing data.',
      tag: 'Billing',
    },
    {
      id: 'crm',
      title: 'CRM',
      description: 'Client and artist relationship panels — static module map.',
      tag: 'CRM',
    },
    {
      id: 'production',
      title: 'Production',
      description: 'Event production workflow slots for staff coordination.',
      tag: 'Production',
    },
    {
      id: 'matching',
      title: 'Matching',
      description: 'Talent and event matching placeholders for operations team.',
      tag: 'Matching',
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Operational reporting and exports — visual shell only.',
      tag: 'Reports',
    },
    {
      id: 'users-settings',
      title: 'Users & Settings',
      description: 'Staff user administration placeholder — no auth mutations.',
      tag: 'Admin',
    },
  ]),
});
