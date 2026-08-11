/**
 * MOD-103 Weather Slice — mount Client Event Weather into client dashboard.
 * Lab default: LAB_CLIENT_EVENT_WEATHER. Optional: WeatherService.fetchClientEventWeather.
 * Paso 5: session gate + client_id scope for live reads.
 */

import type { WeatherService } from '../../shared/services/weather/index';
import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
} from '../../shared/types/weather.types';
import { LAB_CLIENT_EVENT_WEATHER } from './client-weather-read-fixtures';
import { renderClientWeatherReadView } from './render-client-weather-read-view';
import {
  annotateClientMountSourceLabel,
  clientDomainAccessAllowed,
  resolveClientScopedUserId,
  type ClientSessionWiringInjection,
} from '../session/client-session-wiring-pilot';

export type MountClientWeatherReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly weatherService?: WeatherService | null;
  readonly clientUserId?: string;
  readonly sessionWiring?: ClientSessionWiringInjection | null;
  readonly fallback?: {
    readonly alerts: readonly EventWeatherAlertDTO[];
    readonly forecasts: readonly WeatherForecastReadDTO[];
    readonly risks?: readonly VenueOutdoorRiskDTO[];
  };
};

export type MountClientWeatherReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly eventCount: number;
  readonly scopedClientUserId?: string;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-client-section="client-weather"]');
}

function fillSlot(
  slot: HTMLElement,
  payload: {
    readonly alerts: readonly EventWeatherAlertDTO[];
    readonly forecasts: readonly WeatherForecastReadDTO[];
    readonly risks?: readonly VenueOutdoorRiskDTO[];
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Event Weather';

  const panel = document.createElement('div');
  panel.className = 'mdj-client-weather-read-host';
  panel.dataset.mdjClientWeatherHost = 'mod-103-wx';

  slot.replaceChildren(title, panel);
  renderClientWeatherReadView(
    panel,
    {
      alerts: payload.alerts,
      forecasts: payload.forecasts,
      risks: payload.risks,
    },
    { sourceLabel: payload.sourceLabel },
  );
}

export async function mountClientWeatherReadSlice(
  input: MountClientWeatherReadSliceInput,
): Promise<MountClientWeatherReadSliceResult> {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-103-WX: client-weather section slot missing');
  }

  const fallback = input.fallback ?? LAB_CLIENT_EVENT_WEATHER;
  let alerts = fallback.alerts;
  let forecasts = fallback.forecasts;
  let risks = fallback.risks;
  let source: 'service' | 'mock' = 'mock';
  const scopedClientUserId = resolveClientScopedUserId(
    input.sessionWiring,
    input.clientUserId,
    LAB_CLIENT_EVENT_WEATHER.clientUserId,
  );

  if (input.weatherService && clientDomainAccessAllowed(input.sessionWiring, 'weather')) {
    try {
      const result = await input.weatherService.fetchClientEventWeather({
        clientUserId: scopedClientUserId,
      });
      if (result.ok && result.data) {
        alerts = result.data.alerts;
        forecasts = result.data.forecasts;
        risks = result.data.risks;
        source = 'service';
      }
    } catch {
      source = 'mock';
      alerts = fallback.alerts;
      forecasts = fallback.forecasts;
      risks = fallback.risks;
    }
  }

  fillSlot(slot, {
    alerts,
    forecasts,
    risks,
    sourceLabel: annotateClientMountSourceLabel(
      source === 'service' ? 'live fetchClientEventWeather' : 'lab mock',
      input.sessionWiring,
      'weather',
    ),
  });

  return Object.freeze({
    ok: true as const,
    source,
    eventCount: alerts.length,
    scopedClientUserId,
  });
}

export function mountClientWeatherReadSliceSync(
  mainRegion: HTMLElement,
  fallback = LAB_CLIENT_EVENT_WEATHER,
  sessionWiring?: ClientSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  fillSlot(slot, {
    alerts: fallback.alerts,
    forecasts: fallback.forecasts,
    risks: fallback.risks,
    sourceLabel: annotateClientMountSourceLabel('lab mock', sessionWiring, 'weather'),
  });
}
