/**
 * MOD-209 — Vista Personal (Edición) ↔ Vista Pública (Cliente) switch for
 * the "Mi Perfil" (#profile) tab. Personal (default) shows everything;
 * Public hides owner-only/internal content (Legal identity, Analytics, the
 * SoundForTips payment-config link) so the panel matches what a client
 * would actually see, without a route/reload.
 *
 * Minimalist by design (Capitan correction, 2026-08-12): no permanent text
 * labels flanking the switch. State change is communicated via a toast that
 * auto-dismisses after 2.5s; the "what does this do" explanation lives only
 * behind the "?" help affordance (native title/aria-label — no static copy
 * in the layout).
 */

const TOAST_AUTO_DISMISS_MS = 2500;
const HELP_TEXT =
  'Vista Personal (Edición): ves todo — métricas y configuración interna. Vista Pública (Cliente): solo lo que ve un cliente — Bio, Media, SoundForTips™.';

export type ArtistViewModeToggleParts = {
  readonly root: HTMLElement;
  readonly switchEl: HTMLButtonElement;
  readonly toastEl: HTMLElement;
};

function createToast(): HTMLElement {
  const toast = document.createElement('p');
  toast.className = 'mdj-artist-view-mode-toast';
  toast.dataset.mdjArtistViewModeToast = '1';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  return toast;
}

export function createArtistViewModeToggle(): ArtistViewModeToggleParts {
  const root = document.createElement('div');
  root.className = 'mdj-artist-view-mode-toggle';
  root.dataset.mdjComponent = 'ArtistViewModeToggle';

  const switchEl = document.createElement('button');
  switchEl.type = 'button';
  switchEl.className = 'mdj-artist-view-mode-toggle__switch';
  switchEl.dataset.artistViewModeToggle = '1';
  switchEl.setAttribute('role', 'switch');
  switchEl.setAttribute('aria-checked', 'true');
  switchEl.setAttribute('aria-label', 'Alternar entre Vista Personal y Vista Pública del perfil');

  const thumb = document.createElement('span');
  thumb.className = 'mdj-artist-view-mode-toggle__thumb';
  switchEl.append(thumb);

  const help = document.createElement('button');
  help.type = 'button';
  help.className = 'mdj-artist-view-mode-toggle__help';
  help.textContent = '?';
  help.title = HELP_TEXT;
  help.setAttribute('aria-label', HELP_TEXT);

  const toastEl = createToast();

  root.append(switchEl, help, toastEl);

  return { root, switchEl, toastEl };
}

function showToast(toastEl: HTMLElement, message: string): void {
  toastEl.textContent = message;
  toastEl.classList.add('is-visible');

  const pending = Number(toastEl.dataset.mdjToastTimer ?? '0');
  if (pending) window.clearTimeout(pending);

  const timer = window.setTimeout(() => {
    toastEl.classList.remove('is-visible');
  }, TOAST_AUTO_DISMISS_MS);
  toastEl.dataset.mdjToastTimer = String(timer);
}

/**
 * Wires the switch to toggle `data-mdj-view-mode` ("private" | "public") on
 * `panelRoot` (the #profile tab panel). CSS keyed off that attribute hides
 * `[data-mdj-profile-visibility="private-only"]`, the Analytics section, and
 * the payment-config link when set to "public". Every toggle fires a
 * self-dismissing toast instead of a static label.
 */
export function wireArtistViewModeToggle(
  parts: ArtistViewModeToggleParts,
  panelRoot: HTMLElement,
): void {
  panelRoot.dataset.mdjViewMode = 'private';

  parts.switchEl.addEventListener('click', () => {
    const isPrivate = parts.switchEl.getAttribute('aria-checked') === 'true';
    const next = isPrivate ? 'public' : 'private';

    parts.switchEl.setAttribute('aria-checked', String(!isPrivate));
    panelRoot.dataset.mdjViewMode = next;

    showToast(
      parts.toastEl,
      next === 'public' ? 'Vista Pública (Cliente)' : 'Vista Personal (Edición)',
    );
  });
}
