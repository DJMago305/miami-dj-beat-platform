/**
 * MOD-204 Weather Slice — mount Artist Gig Weather Radar into artist dashboard.
 * Lab default: LAB_ARTIST_GIG_WEATHER. Optional: WeatherService.fetchArtistGigWeather.
 * Paso 4: session gate + assigned_dj_id scope for live reads.
 */

import type { WeatherService } from '../../shared/services/weather/index';
import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
} from '../../shared/types/weather.types';
import { LAB_ARTIST_GIG_WEATHER } from './artist-weather-read-fixtures';
import { renderArtistWeatherReadView } from './render-artist-weather-read-view';
import {
  annotateArtistMountSourceLabel,
  artistDomainAccessAllowed,
  resolveArtistScopedUserId,
  type ArtistSessionWiringInjection,
} from '../session/artist-session-wiring-pilot';

export type MountArtistWeatherReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly weatherService?: WeatherService | null;
  readonly artistUserId?: string;
  readonly artistProfileId?: string | null;
  readonly sessionWiring?: ArtistSessionWiringInjection | null;
  readonly fallback?: {
    readonly risks: readonly VenueOutdoorRiskDTO[];
    readonly forecasts: readonly WeatherForecastReadDTO[];
    readonly alerts?: readonly EventWeatherAlertDTO[];
  };
};

export type MountArtistWeatherReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly gigCount: number;
  readonly scopedArtistUserId?: string;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-artist-section="artist-weather"]');
}

function fillSlot(
  slot: HTMLElement,
  payload: {
    readonly risks: readonly VenueOutdoorRiskDTO[];
    readonly forecasts: readonly WeatherForecastReadDTO[];
    readonly alerts?: readonly EventWeatherAlertDTO[];
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Gig Weather Radar';

  const panel = document.createElement('div');
  panel.className = 'mdj-artist-weather-read-host';
  panel.dataset.mdjArtistWeatherHost = 'mod-204-wx';

  slot.replaceChildren(title, panel);
  renderArtistWeatherReadView(
    panel,
    {
      risks: payload.risks,
      forecasts: payload.forecasts,
      alerts: payload.alerts,
    },
    { sourceLabel: payload.sourceLabel },
  );
}

export async function mountArtistWeatherReadSlice(
  input: MountArtistWeatherReadSliceInput,
): Promise<MountArtistWeatherReadSliceResult> {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-204-WX: artist-weather section slot missing');
  }

  const fallback = input.fallback ?? LAB_ARTIST_GIG_WEATHER;
  let risks = fallback.risks;
  let forecasts = fallback.forecasts;
  let alerts = fallback.alerts;
  let source: 'service' | 'mock' = 'mock';
  const scopedArtistUserId = resolveArtistScopedUserId(
    input.sessionWiring,
    input.artistUserId,
    LAB_ARTIST_GIG_WEATHER.artistUserId,
  );

  if (input.weatherService && artistDomainAccessAllowed(input.sessionWiring, 'weather')) {
    try {
      const result = await input.weatherService.fetchArtistGigWeather({
        artistUserId: scopedArtistUserId,
        artistProfileId: input.artistProfileId ?? LAB_ARTIST_GIG_WEATHER.artistProfileId,
      });
      if (result.ok && result.data) {
        risks = result.data.risks;
        forecasts = result.data.forecasts;
        alerts = result.data.alerts;
        source = 'service';
      }
    } catch {
      source = 'mock';
      risks = fallback.risks;
      forecasts = fallback.forecasts;
      alerts = fallback.alerts;
    }
  }

  fillSlot(slot, {
    risks,
    forecasts,
    alerts,
    sourceLabel: annotateArtistMountSourceLabel(
      source === 'service' ? 'live fetchArtistGigWeather' : 'lab mock',
      input.sessionWiring,
      'weather',
    ),
  });

  return Object.freeze({
    ok: true as const,
    source,
    gigCount: risks.length,
    scopedArtistUserId,
  });
}

export function mountArtistWeatherReadSliceSync(
  mainRegion: HTMLElement,
  fallback = LAB_ARTIST_GIG_WEATHER,
  sessionWiring?: ArtistSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  fillSlot(slot, {
    risks: fallback.risks,
    forecasts: fallback.forecasts,
    alerts: fallback.alerts,
    sourceLabel: annotateArtistMountSourceLabel('lab mock', sessionWiring, 'weather'),
  });
}
