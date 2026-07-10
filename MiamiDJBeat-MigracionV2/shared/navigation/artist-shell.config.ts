/** MOD-008 Artist Portal Shell — navigation + module map — TICKET-MOD-008-PORTAL-SHELL-001 */

import type { PortalShellContent } from '../layout/types';

export const ARTIST_SHELL_CONTENT: PortalShellContent = Object.freeze({
  portalId: 'artist',
  documentTitle: 'Miami DJ Beat — Artist Portal',
  brandMark: 'Miami DJ Beat',
  brandSubtitle: 'Artist Portal',
  heroEyebrow: 'Performer workspace',
  heroTitle: 'Artist Dashboard',
  heroSubtitle: 'Your stage, bookings, earnings, and creative presence in one place.',
  modulesSectionTitle: 'Artist Workspace',
  profileName: 'Stage Name',
  profileRole: 'Artist',
  profileMeta: 'PRO tier · placeholder',
  navItems: Object.freeze([
    { id: 'dashboard', label: 'Dashboard', active: true },
    { id: 'profile', label: 'Profile' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'cash-flow', label: 'Cash Flow' },
    { id: 'song4tips', label: 'Song4Tips' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'media', label: 'Media & Analytics' },
  ]),
  kpis: Object.freeze([
    { id: 'bookings', label: 'Upcoming Gigs', value: '—', hint: 'Coming soon' },
    { id: 'cash', label: 'Cash Flow', value: '—', hint: 'Coming soon' },
    { id: 'tips', label: 'Song4Tips', value: '—', hint: 'Coming soon' },
    { id: 'jobs', label: 'Open Jobs', value: '—', hint: 'Coming soon' },
  ]),
  modules: Object.freeze([
    {
      id: 'profile-card',
      title: 'Profile Card',
      description: 'Public artist identity, media, and tier badges — visual only.',
      tag: 'Profile',
    },
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'Agenda and availability module slot for performer scheduling.',
      tag: 'Agenda',
    },
    {
      id: 'cash-flow',
      title: 'Cash Flow',
      description: 'Economic panel placeholder — separate from Song4Tips PRO gating.',
      tag: 'Finance',
    },
    {
      id: 'song4tips',
      title: 'Song4Tips',
      description: 'PRO feature shell — no fan requests or SMS wiring in this ticket.',
      tag: 'PRO',
    },
    {
      id: 'jobs',
      title: 'Jobs',
      description: 'Roster and gig opportunities module slot.',
      tag: 'Jobs',
    },
    {
      id: 'media-analytics',
      title: 'Media & Analytics',
      description: 'Performance insights and promo assets — placeholder analytics.',
      tag: 'Insights',
    },
  ]),
});
