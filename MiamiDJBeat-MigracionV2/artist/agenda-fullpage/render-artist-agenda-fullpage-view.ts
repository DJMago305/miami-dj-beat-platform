/**
 * MOD-205 — Artist Agenda full-page layout.
 *
 * Hero = the real WebGL Atmospheric Engine, ported verbatim from
 * web/weather-experience/js/hero.js (see weather-hero-engine.ts) — raw
 * WebGL raymarched sky/sun/moon/stars/city/mountains + rain/snow/fog/
 * lightning overlays, driven by real astronomy (shared/weather-3d/).
 * Defaults to local mock weather data (same WEATHER table as the source
 * project); "🛰️ En vivo" fetches a real Edge Function if configured,
 * and gracefully falls back to mock with an honest status label if not —
 * same honesty pattern as the rest of this lab, not something added here.
 * Matrix area below stays a clearly-labeled placeholder (out of this
 * round's scope — only the Hero engine was authorized to be ported).
 */

function createLabMockBadge(text: string): HTMLElement {
  const badge = document.createElement('p');
  badge.className = 'mdj-agenda-fullpage__lab-badge';
  badge.textContent = text;
  return badge;
}

/** Markup 1:1 with web/weather-experience/index.html's #app body — the DOM
 * contract weather-hero-engine.ts's document.getElementById calls expect. */
function createHero(): HTMLElement {
  const hero = document.createElement('section');
  hero.className = 'mdj-agenda-fullpage__hero';
  hero.setAttribute('aria-label', 'Clima Atmosférico — Motor WebGL 3D');
  hero.dataset.mdjComponent = 'ArtistAgendaHero';
  hero.dataset.mdjHeroStatus = 'live-engine';

  const engineRoot = document.createElement('div');
  engineRoot.className = 'mdj-weather-hero-engine';
  engineRoot.innerHTML = `
    <canvas id="gl"></canvas>
    <div class="exp">
      <div class="date"><span class="dow" id="d-dow"></span><span class="num" id="d-num"></span><span class="my" id="d-my"></span></div>
      <aside class="rail">
        <div class="brand"><b>MIAMI <i>DJ</i> BEAT</b><span>CLIMA EN VIVO · 3D</span></div>
        <div class="panel glass">
          <h2>MEDICIONES ACTUALES</h2>
          <ul class="rows" id="metrics"></ul>
        </div>
        <div class="panel glass">
          <h2>PRONÓSTICO POR HORAS</h2>
          <div class="hr" id="hourly"></div>
        </div>
        <div class="ev glass panel">
          <h3>EVENTO DE HOY</h3>
          <p id="ev-lead">—</p>
          <div class="grid">
            <div><span class="k">START TIME</span><span class="vv" id="ev-start">—</span></div>
            <div><span class="k">END TIME</span><span class="vv" id="ev-end">—</span></div>
            <div><span class="k">BUFFER</span><span class="vv" id="ev-buffer">—</span></div>
          </div>
          <div class="grid two">
            <div><span class="k">LOCALIZACIÓN</span><span class="vv" id="ev-loc">—</span></div>
            <div><span class="k">ATARDECER</span><span class="vv gold" id="ev-sunset">—</span></div>
          </div>
        </div>
      </aside>
      <section class="center">
        <div class="temp" id="c-temp">—°</div>
        <div class="cond" id="c-cond">—</div>
        <div class="hilo" id="c-hilo"></div>
        <div class="divider"></div>
        <div class="loc"><span id="c-loc">📍 —</span><span class="sub">CONDICIONES ACTUALES</span></div>
        <div class="clock" aria-hidden="true"><div class="dial" id="clockdial"><div class="hand h" id="handH"></div><div class="hand m" id="handM"></div><span class="cap"></span></div></div>
        <div class="mstrip" id="mstrip"></div>
      </section>
      <button class="livebtn" id="livebtn" type="button" title="Conecta al clima real (Edge Function atmosphere). Sin endpoint configurado usa mock, con aviso honesto.">🛰️ En vivo</button>
      <div class="badge">MOTOR ATMOSFÉRICO <b>WebGL 3D</b> · ciclo día→noche en vivo · datos por defecto: mock local</div>
      <div class="datectl" id="datectl" title="Viaja por el año — mira la luna y las constelaciones cambiar">
        <span class="dlbl" id="dlbl">HOY</span>
        <input type="range" id="dslider" min="1" max="365" step="1" aria-label="Fecha del cielo" />
      </div>
      <div class="timeofday" id="timeofday">
        <button type="button" data-t="dawn">🌅 Amanecer</button>
        <button type="button" data-t="day">☀️ Día</button>
        <button type="button" data-t="dusk">🌇 Atardecer</button>
        <button type="button" data-t="night">🌙 Noche</button>
        <button type="button" data-t="cycle" class="on">🔄 Ciclo</button>
      </div>
      <div class="weather" id="weather">
        <button type="button" data-w="clear">☀️ Despejado</button>
        <button type="button" data-w="cloudy" class="on">⛅ Nublado</button>
        <button type="button" data-w="overcast">☁️ Cubierto</button>
        <button type="button" data-w="rain">🌧️ Lluvia</button>
        <button type="button" data-w="storm">⛈️ Tormenta</button>
        <button type="button" data-w="snow">🌨️ Nieve</button>
        <button type="button" data-w="fog">🌫️ Niebla</button>
        <button type="button" data-w="wind">🌬️ Viento</button>
      </div>
      <div class="scenes" id="scenes">
        <button type="button" data-s="0" class="on">🌊 Mar</button>
        <button type="button" data-s="1">🏙️ Ciudad</button>
        <button type="button" data-s="2">⛰️ Montañas</button>
      </div>
    </div>
  `.trim();

  const scrollCue = document.createElement('a');
  scrollCue.className = 'mdj-agenda-fullpage__scroll-cue';
  scrollCue.href = '#agenda-matrix';
  scrollCue.setAttribute('aria-label', 'Desplázate a la Matrix de Agenda');
  scrollCue.textContent = '↓';

  hero.append(engineRoot, scrollCue);
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
