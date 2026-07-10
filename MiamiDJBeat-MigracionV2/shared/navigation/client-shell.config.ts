/** MOD-008 Client Portal Shell — navigation + module map — TICKET-MOD-008-PORTAL-SHELL-001 */

import type { PortalShellContent } from '../layout/types';

export const CLIENT_SHELL_CONTENT: PortalShellContent = Object.freeze({
  portalId: 'client',
  documentTitle: 'Miami DJ Beat — Client Portal',
  brandMark: 'Miami DJ Beat',
  brandSubtitle: 'Client Portal',
  heroEyebrow: 'Welcome back',
  heroTitle: 'Client Dashboard',
  heroSubtitle: 'Plan events, track orders, and manage your MDJ experience.',
  modulesSectionTitle: 'Your Client Modules',
  profileName: 'Guest Client',
  profileRole: 'Buyer',
  profileMeta: 'VIP pathway · placeholder',
  navItems: Object.freeze([
    { id: 'dashboard', label: 'Dashboard', active: true },
    { id: 'events', label: 'Event Planning' },
    { id: 'orders', label: 'Orders' },
    { id: 'payments', label: 'Payments' },
    { id: 'documents', label: 'Documents' },
    { id: 'vip', label: 'VIP & Commercial' },
  ]),
  kpis: Object.freeze([
    { id: 'events', label: 'Active Events', value: '—', hint: 'Coming soon' },
    { id: 'orders', label: 'Open Orders', value: '—', hint: 'Coming soon' },
    { id: 'payments', label: 'Pending Payments', value: '—', hint: 'Coming soon' },
    { id: 'documents', label: 'Documents', value: '—', hint: 'Coming soon' },
  ]),
  modules: Object.freeze([
    {
      id: 'event-planning',
      title: 'Event Planning',
      description: 'Venue, date, talent, and production slots — visual shell only.',
      tag: 'Events',
    },
    {
      id: 'orders',
      title: 'Orders',
      description: 'Booking and service order placeholders for future commerce flows.',
      tag: 'Commerce',
    },
    {
      id: 'payments',
      title: 'Payments',
      description: 'Invoice and payment status panels — no Stripe or backend wiring.',
      tag: 'Billing',
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Contracts, riders, and shared files — static module slot.',
      tag: 'Files',
    },
    {
      id: 'vip',
      title: 'VIP & Commercial',
      description: 'Loyalty tier and commercial perks placeholder for Client VIP.',
      tag: 'VIP',
    },
  ]),
});
