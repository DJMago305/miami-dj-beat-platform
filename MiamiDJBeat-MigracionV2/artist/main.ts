import { bootScaffold } from '@mdj/bootstrap/boot';
import { bootstrapPortal } from '../shared/runtime/index';
import { ARTIST_SHELL_CONTENT } from '../shared/navigation/artist-shell.config';
import { applyV1LabDocumentClasses } from '../shared/branding/apply-v1-brand-shell';
import { resolveArtistPortalComponentGuards } from './component-guards-wire';
import { resolveArtistLegalPortalBundle } from './legal/artist-legal-provider-wire';
import { renderArtistDashboardMvp } from './render-artist-dashboard-mvp';
import { mountArtistProfileReadSlice } from './profile/mount-artist-profile-read-slice';
import { artistLabProfileStore, buildEffectiveArtistProfile } from './profile/artist-lab-profile-store';
import { mountArtistScheduleReadSlice } from './schedule/mount-artist-schedule-read-slice';
import { mountArtistFinanceReadSlice } from './finance/mount-artist-finance-read-slice';
import { mountArtistWeatherReadSlice } from './weather/mount-artist-weather-read-slice';
import { mountArtistMutationsSlice } from './mutations/mount-artist-mutations-slice';
import { mountArtistAgendaFullpage } from './agenda-fullpage/mount-artist-agenda-fullpage';
import { resolveArtistSessionWiringPilot } from './session/artist-session-wiring-pilot';
import { createArtistMutationsAdapter } from '../shared/services/artist-mutations/index';
/* Priority 2 · Paso 1 — V1 clone visual identity (ui-v1-clone only). */
import '../shared/branding/v1-visual-entry.css';
import '../shared/branding/v1-lab-bridge.css';
import '../shared/branding/v1-profile-shell.css';
import '../shared/branding/v1-portal-layouts.css';
import '../shared/layout/portal-shell.css';
import '../shared/services/legal/ui/legal-center-shell.css';
import './dashboard-mvp.css';
import './profile/artist-profile-read-view.css';
import './schedule/artist-schedule-read-view.css';
import './finance/artist-finance-read-view.css';
import './weather/artist-weather-read-view.css';
import './session/artist-session-wiring-pilot.css';
import './mutations/artist-mutations-view.css';
import './agenda-fullpage/artist-agenda-fullpage-view.css';
import './config/artist-config-form.css';
/* MOD-217 — real V1 reviews-carousel styling (ui-v1-clone/profile.css), artist-only. */
import '../ui-v1-clone/profile.css';
import './profile/artist-profile-v1-extras.css';

function main(): void {
  applyV1LabDocumentClasses('artist');
  const app = document.querySelector('#app') as HTMLElement | null;
  if (!app) return;

  const boot = bootScaffold(undefined, 'artist');
  const artistLegalBundle = resolveArtistLegalPortalBundle();
  const guards = boot.ok ? resolveArtistPortalComponentGuards() : { componentCount: 0 };
  // Paso 4 — read-only session wiring pilot (lab fixtures; assigned_dj_id scope).
  const sessionWiring = resolveArtistSessionWiringPilot('artist');
  // Writers Phase · Slice 2 · Paso 3 — lab mutations adapter (no HTTP / no Supabase).
  const mutationsAdapter = createArtistMutationsAdapter();

  bootstrapPortal({
    shellContent: ARTIST_SHELL_CONTENT,
    boot,
    root: app,
    permissionComponentCount: guards.componentCount,
    mountDashboard: (root) => {
      const mainRegion = root.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
      if (!mainRegion) return;
      renderArtistDashboardMvp(mainRegion, sessionWiring, mutationsAdapter);
      void mountArtistProfileReadSlice({ mainRegion, sessionWiring });
      // MOD-215 — Config-tab saves (stage name / city / social links) re-render
      // Mi Perfil with the merged profile so it never disagrees with the Hero.
      artistLabProfileStore.subscribe(() => {
        void mountArtistProfileReadSlice({
          mainRegion,
          sessionWiring,
          fallbackProfile: buildEffectiveArtistProfile(),
        });
      });
      // MOD-204 Slice 2 — schedule (lab mock; gated + scoped by session wiring).
      void mountArtistScheduleReadSlice({ mainRegion, sessionWiring });
      // MOD-204 Financial Slice — wallet (lab mock; gated + scoped by session wiring).
      void mountArtistFinanceReadSlice({ mainRegion, sessionWiring });
      // MOD-204 Weather Slice — gig weather radar (lab mock; gated + scoped by session wiring).
      void mountArtistWeatherReadSlice({ mainRegion, sessionWiring });
      // Writers Phase · Slice 2 · Paso 3 — gig decision + payout ack forms.
      if (sessionWiring.assignedDjUserId) {
        mountArtistMutationsSlice({
          mainRegion,
          adapter: mutationsAdapter,
          sessionContext: sessionWiring.context,
          artistUserId: sessionWiring.assignedDjUserId,
          sessionWiring,
        });
      }
      // MOD-205 — Agenda full-page shell (100vh Hero placeholder + Matrix area).
      mountArtistAgendaFullpage(mainRegion, sessionWiring);
      const contentGrid = mainRegion.querySelector('.mdj-client-dashboard__grid');
      artistLegalBundle.renderLegalCenterShell(contentGrid ?? mainRegion);
    },
  });
}

main();
