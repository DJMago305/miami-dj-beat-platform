/**
 * MOD-217 — Clon 1:1 de secciones reales de V1 dentro de Mi Perfil
 * (ui-v1-clone/dj-profile.html): Bio propia, Opiniones, Disponibilidad,
 * Interactuar/QR. Mismas clases reales de V1 (.dj-card, .pub-bio-*,
 * .pub-mobile-section-*, .pub-review-card*, .mdj-qr-*, #avail-check-card)
 * para fidelidad estructural — no se inventan componentes nuevos.
 * Lab-only: Opiniones/Disponibilidad usan datos mock locales, sin backend
 * real todavía (SoundForTips, que sí está cableado en producción, NO se
 * toca aquí — vive aparte en song4tips, sin modificar).
 */

import { artistLabProfileStore } from './artist-lab-profile-store';

type MockReview = {
  readonly rating: number;
  readonly comment: string;
  readonly reviewerName: string;
};

const MOCK_REVIEWS: readonly MockReview[] = Object.freeze([
  {
    rating: 5,
    comment:
      'Excelente energía toda la noche. Transiciones limpias y muy atento a lo que pedían los invitados. Lo volveríamos a contratar sin dudar.',
    reviewerName: 'Gerardo A. Valle',
  },
]);

function starsText(rating: number): string {
  const filled = Math.round(Math.min(5, Math.max(0, rating)));
  return '★'.repeat(filled) + '☆'.repeat(Math.max(0, 5 - filled));
}

/** .dj-card > <details class="pub-bio-details"> — matches ui-v1-clone's collapsible Bio card exactly. */
export function renderArtistBioCard(container: HTMLElement): void {
  const card = document.createElement('div');
  card.className = 'dj-card pub-bio-card';
  card.dataset.mdjArtistSection = 'bio-v1';

  const details = document.createElement('details');
  details.className = 'pub-bio-details';
  details.id = 'pub-bio-details';

  const summary = document.createElement('summary');
  summary.className = 'pub-bio-summary';
  summary.innerHTML = `
    <span class="pub-bio-summary-head">
      <span class="pub-bio-title">Bio</span>
      <span class="pub-bio-hint">Opcional — desplegar para leer</span>
    </span>
    <span class="pub-bio-rule" aria-hidden="true"></span>
    <span class="pub-bio-chevron" aria-hidden="true">▼</span>
  `.trim();

  const bioText = document.createElement('p');
  bioText.id = 'pub-bio';

  details.append(summary, bioText);
  card.append(details);
  container.append(card);

  const render = (): void => {
    bioText.textContent = artistLabProfileStore.getState().bio || '—';
  };
  render();
  artistLabProfileStore.subscribe(render);
}

/** #reviews-card .reviews-carousel > .pub-review-card — matches ui-v1-clone's Opiniones card (mock reviews, no live backend yet). */
export function renderArtistReviewsCard(container: HTMLElement): void {
  const card = document.createElement('div');
  card.className = 'dj-card';
  card.id = 'reviews-card';
  card.dataset.mdjArtistSection = 'reviews-v1';

  const header = document.createElement('div');
  header.className = 'dj-card-label';
  header.id = 'pub-reviews-header';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';

  const avgRating =
    MOCK_REVIEWS.reduce((sum, r) => sum + r.rating, 0) / Math.max(1, MOCK_REVIEWS.length);
  const title = document.createElement('span');
  title.id = 'pub-reviews-title';
  title.textContent = 'OPINIONES';
  const avg = document.createElement('span');
  avg.id = 'pub-reviews-avg';
  avg.style.color = 'var(--gold)';
  avg.style.fontSize = '11px';
  avg.style.fontWeight = '900';
  avg.textContent = `${avgRating.toFixed(1)} · ${MOCK_REVIEWS.length} reseña${MOCK_REVIEWS.length === 1 ? '' : 's'}`;
  header.append(title, avg);

  const carousel = document.createElement('div');
  carousel.id = 'pub-reviews-carousel';
  carousel.className = 'reviews-carousel';

  for (const review of MOCK_REVIEWS) {
    const article = document.createElement('article');
    article.className = 'pub-review-card pub-review-hero';

    const starsEl = document.createElement('div');
    starsEl.className = 'pub-review-card-stars';
    starsEl.setAttribute('aria-hidden', 'true');
    starsEl.textContent = starsText(review.rating);

    const commentEl = document.createElement('p');
    commentEl.className = 'pub-review-card-comment';
    commentEl.textContent = `“${review.comment}”`;

    const metaEl = document.createElement('div');
    metaEl.className = 'pub-review-card-meta';
    metaEl.textContent = review.reviewerName;

    article.append(starsEl, commentEl, metaEl);
    carousel.append(article);
  }

  card.append(header, carousel);
  container.append(card);
}

/* Mismas fechas mock usadas en My Schedule (Agenda), para que Disponibilidad no contradiga esa vista. */
const MOCK_BLOCKED_DATES: Readonly<Record<string, 'blocked' | 'busy'>> = Object.freeze({
  '2026-12-24': 'blocked',
  '2026-08-06': 'busy',
  '2026-08-23': 'blocked',
});

const MONTH_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  { value: '1', label: 'Enero' },
  { value: '2', label: 'Febrero' },
  { value: '3', label: 'Marzo' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Mayo' },
  { value: '6', label: 'Junio' },
  { value: '7', label: 'Julio' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

/** #avail-check-card — matches ui-v1-clone's month/day/year availability checker (checkDJAvailability(), local mock — no Supabase yet). */
export function renderArtistAvailabilityCard(container: HTMLElement): void {
  const card = document.createElement('div');
  card.className = 'dj-card';
  card.id = 'avail-check-card';
  card.dataset.mdjArtistSection = 'availability-v1';

  const details = document.createElement('details');
  details.className = 'pub-mobile-section-details';
  details.id = 'pub-avail-details';
  details.open = true;

  const summary = document.createElement('summary');
  summary.className = 'pub-mobile-section-summary';
  summary.innerHTML = `
    <span class="pub-mobile-section-summary-head">
      <span class="pub-mobile-section-title">DISPONIBILIDAD</span>
    </span>
    <span class="pub-mobile-section-rule" aria-hidden="true"></span>
    <span class="pub-mobile-section-chevron" aria-hidden="true">▼</span>
  `.trim();

  const body = document.createElement('div');
  body.className = 'pub-mobile-section-body';

  const label = document.createElement('div');
  label.className = 'dj-card-label';
  label.textContent = 'CONSULTA DISPONIBILIDAD · VISÍTANOS';

  const hint = document.createElement('p');
  hint.className = 'pub-avail-visit-hint';
  hint.textContent = 'Revisa fechas aquí; también puedes explorar el sitio oficial de Miami DJ Beat.';

  const selectRow = document.createElement('div');
  selectRow.className = 'artist-avail-select-row';

  const monthSelect = document.createElement('select');
  monthSelect.id = 'dj-avail-month';
  monthSelect.innerHTML =
    '<option value="" disabled selected>Mes</option>' +
    MONTH_OPTIONS.map((m) => `<option value="${m.value}">${m.label}</option>`).join('');

  const daySelect = document.createElement('select');
  daySelect.id = 'dj-avail-day';
  daySelect.innerHTML =
    '<option value="" disabled selected>Día</option>' +
    Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');

  const yearSelect = document.createElement('select');
  yearSelect.id = 'dj-avail-year';
  yearSelect.innerHTML =
    '<option value="" disabled selected>Año</option>' +
    ['2026', '2027'].map((y) => `<option value="${y}">${y}</option>`).join('');

  selectRow.append(monthSelect, daySelect, yearSelect);

  const checkBtn = document.createElement('button');
  checkBtn.id = 'dj-avail-check-btn';
  checkBtn.type = 'button';
  checkBtn.className = 'artist-avail-check-btn';
  checkBtn.textContent = 'CHECK ★';

  const result = document.createElement('div');
  result.id = 'dj-avail-result';
  result.className = 'artist-avail-result';

  checkBtn.addEventListener('click', () => {
    const m = monthSelect.value;
    const d = daySelect.value;
    const y = yearSelect.value;
    if (!m || !d || !y) {
      result.dataset.mdjAvailState = 'warn';
      result.textContent = '⚠️ Selecciona mes, día y año.';
      return;
    }
    const dateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const state = MOCK_BLOCKED_DATES[dateStr];
    if (state === 'blocked' || state === 'busy') {
      result.dataset.mdjAvailState = 'blocked';
      result.textContent = 'No disponible para esa fecha. Prueba otra fecha o contacta a Miami DJ Beat.';
    } else {
      result.dataset.mdjAvailState = 'ok';
      result.textContent = '✅ Disponible para ese día.';
    }
  });

  body.append(label, hint, selectRow, checkBtn, result);
  details.append(summary, body);
  card.append(details);
  container.append(card);
}

/* MOD-217 — mismo cargador de qrcodejs que usa ui-v1-clone (CDN, sin dependencia local nueva). */
let qrLoaderPromise: Promise<void> | null = null;
function ensureQrCodeLibraryLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as unknown as { QRCode?: unknown }).QRCode) return Promise.resolve();
  if (qrLoaderPromise) return qrLoaderPromise;

  qrLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcodejs/qrcode.min.js';
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('qrcodejs failed to load'));
    document.head.append(script);
  });
  return qrLoaderPromise;
}

/** .dj-card#public-action-buttons (QR only — SoundForTips ya vive, sin tocar, en song4tips aparte) */
export function renderArtistInteractCard(container: HTMLElement): void {
  const card = document.createElement('div');
  card.className = 'dj-card';
  card.id = 'public-action-buttons';
  card.dataset.mdjArtistSection = 'interact-v1';

  const label = document.createElement('div');
  label.className = 'dj-card-label artist-interact-label';
  label.textContent = 'INTERACTUAR';

  const qrPaper = document.createElement('div');
  qrPaper.id = 'qr-export-area';
  qrPaper.className = 'pub-qr-paper';

  const qrWrap = document.createElement('div');
  qrWrap.className = 'mdj-qr-wrap';
  qrWrap.title = 'Enlace a este perfil';

  const qrHost = document.createElement('div');
  qrHost.id = 'profile-qrcode';
  qrHost.className = 'mdj-qr-host';

  qrWrap.append(qrHost);

  const scanLabel = document.createElement('div');
  scanLabel.className = 'artist-interact-scan-label';
  scanLabel.textContent = 'SCAN FOR PUSH!';

  qrPaper.append(qrWrap, scanLabel);
  card.append(label, qrPaper);
  container.append(card);

  ensureQrCodeLibraryLoaded()
    .then(() => {
      const QRCodeCtor = (window as unknown as { QRCode?: new (el: HTMLElement, opts: Record<string, unknown>) => void })
        .QRCode;
      if (!QRCodeCtor) return;
      new QRCodeCtor(qrHost, {
        text: window.location.href,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
      });
    })
    .catch(() => {
      scanLabel.textContent = 'QR no disponible sin conexión';
    });
}
