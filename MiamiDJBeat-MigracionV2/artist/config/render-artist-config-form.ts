/**
 * MOD-215 — Artist Config form (Perfil / Config tab). Real, functional
 * writer — unlike MOD-204's read views, this is deliberately editable: the
 * artist's stage name, city, role/category tag, and social links. Saves go
 * to artistLabProfileStore only (lab-local, no Supabase persistence yet);
 * the Hero and "Mi Perfil" both subscribe and update immediately.
 */

import { artistLabProfileStore, type ArtistLabProfileState } from '../profile/artist-lab-profile-store';
import type { ArtistSocialPlatform } from '../profile/artist-profile-read-view-model';

const FEEDBACK_RESET_MS = 2200;

const SOCIAL_FIELDS: ReadonlyArray<{ readonly platform: ArtistSocialPlatform; readonly label: string; readonly placeholder: string }> = [
  { platform: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/tu-usuario' },
  { platform: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@tu-canal' },
  { platform: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/artist/...' },
  { platform: 'soundcloud', label: 'SoundCloud', placeholder: 'https://soundcloud.com/tu-usuario' },
  { platform: 'mixcloud', label: 'Mixcloud', placeholder: 'https://mixcloud.com/tu-usuario' },
];

function field(name: string, label: string, input: HTMLInputElement | HTMLTextAreaElement): HTMLLabelElement {
  const wrap = document.createElement('label');
  wrap.className = 'mdj-artist-config-form__field';
  wrap.dataset.mdjField = name;
  const title = document.createElement('span');
  title.className = 'mdj-artist-config-form__label';
  title.textContent = label;
  wrap.append(title, input);
  return wrap;
}

function textInput(name: string, value: string, opts?: { readonly type?: string; readonly placeholder?: string; readonly required?: boolean }): HTMLInputElement {
  const input = document.createElement('input');
  input.className = 'mdj-artist-config-form__input';
  input.name = name;
  input.type = opts?.type ?? 'text';
  input.value = value;
  if (opts?.placeholder) input.placeholder = opts.placeholder;
  if (opts?.required) input.required = true;
  input.autocomplete = 'off';
  return input;
}

function textArea(name: string, value: string, opts?: { readonly placeholder?: string; readonly rows?: number }): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.className = 'mdj-artist-config-form__input mdj-artist-config-form__textarea';
  textarea.name = name;
  textarea.value = value;
  textarea.rows = opts?.rows ?? 3;
  if (opts?.placeholder) textarea.placeholder = opts.placeholder;
  return textarea;
}

function setFeedback(el: HTMLElement, kind: 'success' | 'idle', message: string): void {
  el.dataset.mdjFeedback = kind;
  el.textContent = message;
}

/** Renders the Config form into `container`, seeded from the current store state. */
export function renderArtistConfigForm(container: HTMLElement): void {
  const state = artistLabProfileStore.getState();

  const root = document.createElement('form');
  root.className = 'mdj-artist-config-form';
  root.dataset.mdjComponent = 'ArtistConfigForm';
  root.dataset.mdjMod = 'MOD-215';
  root.noValidate = true;

  const heading = document.createElement('h2');
  heading.className = 'mdj-shell-section-header';
  heading.textContent = 'Configuración de Perfil';

  const note = document.createElement('p');
  note.className = 'mdj-artist-config-form__note';
  note.textContent =
    'Estos datos alimentan tu Hero y tu Mi Perfil público. Lab local — los cambios se ven al instante, sin guardar todavía en la base de datos.';

  const stageNameInput = textInput('stageName', state.stageName, { required: true });
  const cityInput = textInput('city', state.city);
  const roleTagInput = textInput('roleTag', state.roleTag, { placeholder: 'DJ · Producer' });
  const bioInput = textArea('bio', state.bio, { placeholder: 'Cuéntale al público quién eres como artista…', rows: 4 });

  const socialFieldset = document.createElement('fieldset');
  socialFieldset.className = 'mdj-artist-config-form__social';
  const legend = document.createElement('legend');
  legend.textContent = 'Redes sociales';
  socialFieldset.append(legend);

  const socialInputs = new Map<ArtistSocialPlatform, HTMLInputElement>();
  for (const { platform, label, placeholder } of SOCIAL_FIELDS) {
    const input = textInput(platform, state.socialLinks[platform] ?? '', { type: 'url', placeholder });
    socialInputs.set(platform, input);
    socialFieldset.append(field(platform, label, input));
  }

  /* MOD-215 — owner-only account data (PO decision, 2026-08-12): edited
     exclusively here, never shown in the public "Mi Perfil" read view. */
  const privateFieldset = document.createElement('fieldset');
  privateFieldset.className = 'mdj-artist-config-form__social';
  const privateLegend = document.createElement('legend');
  privateLegend.textContent = 'Datos personales (privados)';
  const privateNote = document.createElement('p');
  privateNote.className = 'mdj-artist-config-form__note';
  privateNote.textContent = 'Nunca se muestran en tu Mi Perfil público — solo tú los ves aquí.';
  privateFieldset.append(privateLegend, privateNote);

  const legalFullNameInput = textInput('legalFullName', state.legalFullName);
  const emailInput = textInput('email', state.email, { type: 'email' });
  privateFieldset.append(
    field('legalFullName', 'Nombre legal', legalFullNameInput),
    field('email', 'Email', emailInput),
  );

  const actions = document.createElement('div');
  actions.className = 'mdj-artist-config-form__actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'mdj-artist-config-form__save';
  saveBtn.textContent = 'Guardar cambios';

  const feedback = document.createElement('span');
  feedback.className = 'mdj-artist-config-form__feedback';
  feedback.dataset.mdjFeedback = 'idle';
  feedback.setAttribute('aria-live', 'polite');

  actions.append(saveBtn, feedback);

  root.append(
    heading,
    note,
    field('stageName', 'Nombre artístico', stageNameInput),
    field('city', 'Ciudad', cityInput),
    field('roleTag', 'Categoría / Rol', roleTagInput),
    field('bio', 'Bio', bioInput),
    socialFieldset,
    privateFieldset,
    actions,
  );

  let feedbackResetTimer: ReturnType<typeof setTimeout> | null = null;

  root.addEventListener('submit', (event) => {
    event.preventDefault();

    const socialLinks = Object.fromEntries(
      [...socialInputs.entries()].map(([platform, input]) => [platform, input.value.trim() || null]),
    ) as ArtistLabProfileState['socialLinks'];

    artistLabProfileStore.setState({
      stageName: stageNameInput.value.trim() || state.stageName,
      city: cityInput.value.trim(),
      roleTag: roleTagInput.value.trim() || 'DJ · Producer',
      bio: bioInput.value.trim(),
      socialLinks,
      legalFullName: legalFullNameInput.value.trim(),
      email: emailInput.value.trim(),
    });

    setFeedback(feedback, 'success', 'Guardado ✓');
    if (feedbackResetTimer) clearTimeout(feedbackResetTimer);
    feedbackResetTimer = setTimeout(() => setFeedback(feedback, 'idle', ''), FEEDBACK_RESET_MS);
  });

  container.replaceChildren(root);
}
