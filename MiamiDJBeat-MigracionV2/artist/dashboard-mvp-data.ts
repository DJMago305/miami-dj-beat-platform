/** MOD-011 Artist Dashboard — placeholder data — TICKET-MOD-011-ARTIST-DASHBOARD-MVP-001 */

export const ARTIST_DASHBOARD_KPIS = Object.freeze([
  { label: 'Upcoming Gigs', value: '3', hint: 'Next gig in 5 days' },
  { label: 'Monthly Revenue', value: '$4,820', hint: 'Placeholder earnings summary' },
  { label: 'Song Requests', value: '18', hint: 'Song4Tips queue preview' },
  { label: 'Jobs Available', value: '6', hint: 'Open marketplace listings' },
] as const);

export const ARTIST_PROFILE = Object.freeze({
  stageName: 'DJMago305',
  level: 'Artist PRO',
  status: 'Available for bookings',
  specialty: 'Open Format · Latin · EDM',
} as const);

export const ARTIST_UPCOMING_GIGS = Object.freeze([
  {
    date: 'Jul 11, 2026',
    title: 'South Beach Rooftop Set',
    venue: '1 Hotel · Miami Beach',
    payout: '$1,200',
  },
  {
    date: 'Jul 19, 2026',
    title: 'Private Villa Wedding',
    venue: 'Coral Gables Estate',
    payout: '$2,400',
  },
  {
    date: 'Aug 03, 2026',
    title: 'Corporate Summer Mixer',
    venue: 'Brickell City Centre',
    payout: '$1,650',
  },
] as const);

export const ARTIST_CALENDAR_EVENTS = Object.freeze([
  { date: 'Jul 11', label: 'Rooftop Set · Confirmed' },
  { date: 'Jul 19', label: 'Villa Wedding · Confirmed' },
  { date: 'Jul 26', label: 'Studio Session · Hold' },
  { date: 'Aug 03', label: 'Corporate Mixer · Confirmed' },
] as const);

export const ARTIST_CASH_FLOW = Object.freeze([
  { label: 'Pending payouts', value: '$2,180' },
  { label: 'Paid this month', value: '$4,820' },
  { label: 'Next deposit', value: 'Jul 14' },
] as const);

export const ARTIST_SONG4TIPS = Object.freeze({
  title: 'Song4Tips PRO',
  description:
    'Fan requests, live queue, and SMS handoff will appear here for active PRO artists. Placeholder only.',
  tag: 'PRO',
} as const);

export const ARTIST_JOBS = Object.freeze([
  'Wedding Reception DJ — Jul 25 · Miami Shores',
  'Club Residency Audition — Aug 08 · Wynwood',
  'Yacht Party Opening Set — Aug 16 · Miami Beach',
] as const);

export const ARTIST_MEDIA = Object.freeze([
  'Promo reel — 2026 summer edit',
  'Press photo pack — gold stage lighting',
  'SoundCloud highlight mix — 45 min',
] as const);

export const ARTIST_ANALYTICS = Object.freeze([
  { label: 'Profile views', value: '1,284' },
  { label: 'Booking inquiries', value: '23' },
  { label: 'Set completion rate', value: '98%' },
] as const);

export const ARTIST_NOTIFICATIONS = Object.freeze([
  'New booking inquiry for Aug 16 yacht party.',
  'Song4Tips queue opened for South Beach Rooftop Set.',
  'Cash Flow deposit scheduled for Jul 14.',
] as const);

export const ARTIST_ACTIVITY = Object.freeze([
  { time: 'Today · 1:05 PM', detail: 'Updated availability for August weekends.' },
  { time: 'Yesterday · 9:18 PM', detail: 'Uploaded new promo reel to media library.' },
  { time: 'Jul 02 · 3:40 PM', detail: 'Applied to Wynwood club residency audition.' },
] as const);
