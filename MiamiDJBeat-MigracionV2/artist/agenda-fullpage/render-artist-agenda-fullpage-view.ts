/**
 * MOD-205 — Artist Agenda full-page layout (structural shell only).
 *
 * Builds the 100vh Weather Hero frame + the Matrix/extended-modules area
 * below it. The Hero's canvas is a clearly-labeled placeholder reserving
 * the exact WebGL proportions — the real engine lives in
 * web/weather-experience/ (plain JS, outside this Vite/TS lab) and is
 * ported in a separate, explicitly authorized step. Nothing here reads
 * live data; every block is honestly marked lab mock.
 */

const HERO_STATUS_LABEL = 'MOD-205 · Agenda Hero · lab mock / weather-experience port pending';

function createLabMockBadge(text: string): HTMLElement {
  const badge = document.createElement('p');
  badge.className = 'mdj-agenda-fullpage__lab-badge';
  badge.textContent = text;
  return badge;
}

function createHeroIndicators(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'mdj-agenda-fullpage__hero-indicators';
  wrap.setAttribute('aria-label', 'Indicadores meteorológicos (placeholder)');

  const items = [
    { label: 'Temp', value: '—°' },
    { label: 'Condición', value: '—' },
    { label: 'Viento', value: '—' },
    { label: 'Humedad', value: '—' },
  ];
  for (const item of items) {
    const chip = document.createElement('div');
    chip.className = 'mdj-agenda-fullpage__hero-indicator';
    const value = document.createElement('span');
    value.className = 'mdj-agenda-fullpage__hero-indicator-value';
    value.textContent = item.value;
    const label = document.createElement('span');
    label.className = 'mdj-agenda-fullpage__hero-indicator-label';
    label.textContent = item.label;
    chip.append(value, label);
    wrap.append(chip);
  }
  return wrap;
}

function createCycleControl(): HTMLElement {
  const control = document.createElement('div');
  control.className = 'mdj-agenda-fullpage__cycle-control';
  control.setAttribute('role', 'group');
  control.setAttribute('aria-label', 'Control de ciclo / capas (placeholder, no funcional)');

  const cycles = ['Día', 'Atardecer', 'Noche'];
  for (const cycle of cycles) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mdj-agenda-fullpage__cycle-btn';
    btn.textContent = cycle;
    btn.disabled = true;
    control.append(btn);
  }
  return control;
}

function createHero(): HTMLElement {
  const hero = document.createElement('section');
  hero.className = 'mdj-agenda-fullpage__hero';
  hero.setAttribute('aria-label', 'Clima Atmosférico — Hero (placeholder)');
  hero.dataset.mdjComponent = 'ArtistAgendaHero';
  hero.dataset.mdjHeroStatus = 'lab-mock';

  const frame = document.createElement('div');
  frame.className = 'mdj-agenda-fullpage__hero-canvas-frame';

  const badge = document.createElement('p');
  badge.className = 'mdj-agenda-fullpage__hero-badge';
  badge.textContent = HERO_STATUS_LABEL;

  frame.append(badge, createHeroIndicators(), createCycleControl());

  const scrollCue = document.createElement('a');
  scrollCue.className = 'mdj-agenda-fullpage__scroll-cue';
  scrollCue.href = '#agenda-matrix';
  scrollCue.setAttribute('aria-label', 'Desplázate a la Matrix de Agenda');
  scrollCue.textContent = '↓';

  hero.append(frame, scrollCue);
  return hero;
}

function createExtendedModule(title: string, ariaLabel: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-agenda-fullpage__extended-module';
  section.setAttribute('aria-label', ariaLabel);

  const heading = document.createElement('h3');
  heading.className = 'mdj-agenda-fullpage__extended-title';
  heading.textContent = title;

  section.append(heading, createLabMockBadge('lab mock — pendiente de integración real'));
  return section;
}

function createMatrix(): HTMLElement {
  const matrix = document.createElement('section');
  matrix.className = 'mdj-agenda-fullpage__matrix';
  matrix.id = 'agenda-matrix';
  matrix.setAttribute('aria-label', 'Matrix de Agenda');
  matrix.dataset.mdjComponent = 'ArtistAgendaMatrix';

  const heading = document.createElement('h2');
  heading.className = 'mdj-shell-section-header';
  heading.textContent = 'Matrix de Agenda';

  matrix.append(
    heading,
    createLabMockBadge('lab mock — Calendario/Gigs pendiente de integración real'),
    createExtendedModule('Pronóstico 10 días', 'Pronóstico extendido a 10 días (placeholder)'),
    createExtendedModule('DJ Advice', 'Recomendaciones operativas para el DJ (placeholder)'),
  );
  return matrix;
}

/**
 * Builds the full-page Agenda shell (Hero 100vh + Matrix area) and
 * appends it to `root`. Pure structure — no data, no adapters.
 */
export function renderArtistAgendaFullpageView(root: HTMLElement): void {
  const section = document.createElement('section');
  section.className = 'mdj-agenda-fullpage';
  section.id = 'agenda-fullpage';
  section.dataset.mdjComponent = 'ArtistAgendaFullpage';

  section.append(createHero(), createMatrix());
  root.append(section);
}
