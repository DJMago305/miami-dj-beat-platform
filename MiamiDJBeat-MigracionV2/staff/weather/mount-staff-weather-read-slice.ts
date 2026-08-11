/**
 * MOD-301 Weather Slice — mount Staff Weather Risk Console into staff dashboard.
 * Lab default: LAB_STAFF_MASTER_WEATHER. Optional: WeatherService.fetchMasterWeatherConsole.
 */

import type { WeatherService } from '../../shared/services/weather/index';
import type {
  EventWeatherAlertDTO,
  VenueOutdoorRiskDTO,
  WeatherForecastReadDTO,
  WeatherRiskLevel,
  WeatherVisibilityAudience,
} from '../../shared/types/weather.types';
import { LAB_STAFF_MASTER_WEATHER } from './staff-weather-read-fixtures';
import { renderStaffWeatherReadView } from './render-staff-weather-read-view';
import {
  annotateStaffMountSourceLabel,
  staffDomainAccessAllowed,
  type StaffSessionWiringInjection,
} from '../session/staff-session-wiring-pilot';

export type MountStaffWeatherReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly weatherService?: WeatherService | null;
  readonly audience?: Extract<WeatherVisibilityAudience, 'staff_seller' | 'staff_master'>;
  readonly sessionWiring?: StaffSessionWiringInjection | null;
  readonly fallback?: {
    readonly alerts: readonly EventWeatherAlertDTO[];
    readonly risks: readonly VenueOutdoorRiskDTO[];
    readonly forecasts: readonly WeatherForecastReadDTO[];
    readonly riskCounts?: Readonly<Record<WeatherRiskLevel, number>> | null;
  };
};

export type MountStaffWeatherReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly eventCount: number;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-staff-section="master-weather"]');
}

function fillSlot(
  slot: HTMLElement,
  payload: {
    readonly alerts: readonly EventWeatherAlertDTO[];
    readonly risks: readonly VenueOutdoorRiskDTO[];
    readonly forecasts: readonly WeatherForecastReadDTO[];
    readonly riskCounts?: Readonly<Record<WeatherRiskLevel, number>> | null;
    readonly audience: Extract<WeatherVisibilityAudience, 'staff_seller' | 'staff_master'>;
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Weather Risk Console';

  const panel = document.createElement('div');
  panel.className = 'mdj-staff-weather-read-host';
  panel.dataset.mdjStaffWeatherHost = 'mod-301-wx';

  slot.replaceChildren(title, panel);
  renderStaffWeatherReadView(
    panel,
    {
      alerts: payload.alerts,
      risks: payload.risks,
      forecasts: payload.forecasts,
      riskCounts: payload.riskCounts,
      audience: payload.audience,
    },
    { sourceLabel: payload.sourceLabel },
  );
}

export async function mountStaffWeatherReadSlice(
  input: MountStaffWeatherReadSliceInput,
): Promise<MountStaffWeatherReadSliceResult> {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-301-WX: master-weather section slot missing');
  }

  const audience =
    input.audience ??
    (input.sessionWiring?.context.sessionRole === 'staff_seller' ? 'staff_seller' : 'staff_master');
  const fallback = input.fallback ?? LAB_STAFF_MASTER_WEATHER;
  let alerts = fallback.alerts;
  let risks = fallback.risks;
  let forecasts = fallback.forecasts;
  let riskCounts = fallback.riskCounts ?? null;
  let source: 'service' | 'mock' = 'mock';

  if (input.weatherService && staffDomainAccessAllowed(input.sessionWiring, 'weather')) {
    try {
      const result = await input.weatherService.fetchMasterWeatherConsole({ audience });
      if (result.ok && result.data) {
        alerts = result.data.alerts;
        risks = result.data.risks;
        forecasts = result.data.forecasts;
        riskCounts = result.data.riskCounts;
        source = 'service';
      }
    } catch {
      source = 'mock';
      alerts = fallback.alerts;
      risks = fallback.risks;
      forecasts = fallback.forecasts;
      riskCounts = fallback.riskCounts ?? null;
    }
  }

  fillSlot(slot, {
    alerts,
    risks,
    forecasts,
    riskCounts,
    audience,
    sourceLabel: annotateStaffMountSourceLabel(
      source === 'service' ? 'live fetchMasterWeatherConsole' : 'lab mock',
      input.sessionWiring,
      'weather',
    ),
  });

  return Object.freeze({
    ok: true as const,
    source,
    eventCount: alerts.length,
  });
}

export function mountStaffWeatherReadSliceSync(
  mainRegion: HTMLElement,
  fallback = LAB_STAFF_MASTER_WEATHER,
  audience: Extract<WeatherVisibilityAudience, 'staff_seller' | 'staff_master'> = 'staff_master',
  sessionWiring?: StaffSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  const resolvedAudience =
    sessionWiring?.context.sessionRole === 'staff_seller' ? 'staff_seller' : audience;
  fillSlot(slot, {
    alerts: fallback.alerts,
    risks: fallback.risks,
    forecasts: fallback.forecasts,
    riskCounts: fallback.riskCounts,
    audience: resolvedAudience,
    sourceLabel: annotateStaffMountSourceLabel('lab mock', sessionWiring, 'weather'),
  });
}
