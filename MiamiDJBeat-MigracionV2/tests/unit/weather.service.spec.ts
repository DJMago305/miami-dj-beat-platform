/**
 * weather.service.spec.ts — Paso 2 read-only weather service + mappers.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ApiMetadata, ApiResponse } from '../../shared/api/runtime';
import { createStaticSessionReader } from '../../shared/api/runtime';
import {
  MOCK_WX_ALL_EVENT_ROWS,
  MOCK_WX_ARTIST_USER_ID,
  MOCK_WX_CLIENT_USER_ID,
  MOCK_WX_DJ_PROFILE_ID,
  MOCK_WX_EVENT_CLEAR,
  MOCK_WX_EVENT_CRITICAL_STORM,
  MOCK_WX_EVENT_HEAT,
  MOCK_WX_EVENT_MODERATE_RAIN,
  MOCK_WX_EVENT_OTHER_CLIENT,
  buildOperationalAdvice,
  collectRiskDrivers,
  createWeatherService,
  listWeatherServiceReadMethods,
  mapEventWeatherRowToAlert,
  mapObservationRowToForecast,
  mapVenueWeatherRowToOutdoorRisk,
  resolveOutdoorRiskLevel,
  type WeatherDataPort,
} from '../../shared/services/weather/index';
import {
  elevateRiskFromWindAndRain,
  mapV1LogisticsAdviceTypeToRiskLevel,
} from '../../shared/types/weather.types';

const meta: ApiMetadata = Object.freeze({
  requestId: 'req_weather',
  correlationId: 'corr_weather',
  durationMs: 1,
  attempt: 1,
  context: Object.freeze({
    requestId: 'req_weather',
    correlationId: 'corr_weather',
    portal: 'client' as const,
    sessionId: 'ses_1',
    actorType: 'authenticated',
  }),
});

function ok<T>(data: T): ApiResponse<T> {
  return Object.freeze({ ok: true, status: 200, data, metadata: meta });
}

function createPort(partial: Partial<WeatherDataPort> = {}): WeatherDataPort {
  return Object.freeze({
    selectEventWeatherForClient: vi.fn(async () => ok([])),
    selectEventWeatherForArtist: vi.fn(async () => ok([])),
    selectEventWeatherForStaff: vi.fn(async () => ok([])),
    ...partial,
  });
}

const authed = () =>
  createStaticSessionReader({
    portal: 'client',
    sessionId: 'ses_1',
    authorizationHeader: 'Bearer test',
    actorType: 'authenticated',
  });

describe('weather.map-rows — risk evaluation', () => {
  it('maps logistics advice types to WeatherRiskLevel', () => {
    expect(mapV1LogisticsAdviceTypeToRiskLevel('success').level).toBe('Low');
    expect(mapV1LogisticsAdviceTypeToRiskLevel('warning').level).toBe('Moderate');
    expect(mapV1LogisticsAdviceTypeToRiskLevel('danger').level).toBe('Critical');
  });

  it('elevates to Critical when heavy rain and wind > 30 mph', () => {
    expect(
      elevateRiskFromWindAndRain({ base: 'Moderate', windMph: 34, heavyRain: true }),
    ).toBe('Critical');
    expect(resolveOutdoorRiskLevel(MOCK_WX_EVENT_CRITICAL_STORM)).toBe('Critical');
  });

  it('keeps Low for clear outdoor conditions', () => {
    expect(resolveOutdoorRiskLevel(MOCK_WX_EVENT_CLEAR)).toBe('Low');
  });

  it('marks Moderate for rain caution fixture', () => {
    expect(resolveOutdoorRiskLevel(MOCK_WX_EVENT_MODERATE_RAIN)).toBe('Moderate');
  });

  it('builds operational advice for storm (tent, booth, lightning)', () => {
    const drivers = collectRiskDrivers(MOCK_WX_EVENT_CRITICAL_STORM);
    expect(drivers).toEqual(expect.arrayContaining(['rain', 'wind', 'storm', 'lightning']));
    const advice = buildOperationalAdvice('Critical', drivers);
    const codes = advice.map((a) => a.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'bring_tent_cover',
        'protect_electronics',
        'relocate_dj_booth',
        'secure_light_structures',
        'monitor_lightning',
      ]),
    );
  });

  it('returns all_clear for Low risk', () => {
    const advice = buildOperationalAdvice('Low', ['other']);
    expect(advice).toHaveLength(1);
    expect(advice[0]?.code).toBe('all_clear');
  });

  it('maps observation to forecast without provider secrets', () => {
    const forecast = mapObservationRowToForecast(MOCK_WX_EVENT_CLEAR, 'client_event');
    expect(forecast.forecastId).toBe('wx:event:wx-lead-clear-001');
    expect(forecast.visibility).toBe('client_event');
    expect(forecast.providerAttribution).toBe('lab_mock');
    expect(JSON.stringify(forecast)).not.toMatch(/api[_-]?key|appid|secret/i);
  });

  it('maps heat gig to Moderate outdoor risk with hydrate advice', () => {
    const risk = mapVenueWeatherRowToOutdoorRisk(MOCK_WX_EVENT_HEAT, 'artist_gig');
    expect(risk.riskLevel).toBe('Moderate');
    expect(risk.drivers).toEqual(expect.arrayContaining(['heat', 'humidity']));
    expect(risk.advice.some((a) => a.code === 'hydrate_heat')).toBe(true);
    expect(risk.visibility).toBe('artist_gig');
  });
});

describe('weather.service — session & surface', () => {
  it('exposes only read methods (no writers)', () => {
    const methods = listWeatherServiceReadMethods();
    expect(methods).toEqual([
      'fetchClientEventWeather',
      'fetchArtistGigWeather',
      'fetchMasterWeatherConsole',
    ]);
    const service = createWeatherService({ dataPort: createPort(), sessionReader: authed() });
    expect(Object.keys(service).sort()).toEqual([...methods].sort());
    expect(JSON.stringify(service)).not.toMatch(
      /insert|update|delete|cancel|reschedule|persistAlert|charge/i,
    );
  });

  it('requires session for fetchClientEventWeather', async () => {
    const guest = createStaticSessionReader({
      portal: 'client',
      sessionId: null,
      authorizationHeader: null,
      actorType: 'guest',
    });
    const service = createWeatherService({ dataPort: createPort(), sessionReader: guest });
    const result = await service.fetchClientEventWeather({
      clientUserId: MOCK_WX_CLIENT_USER_ID,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details).toBe('WEATHER_SESSION_REQUIRED');
  });
});

describe('weather.service — fetchClientEventWeather', () => {
  it('returns only own contracted event weather (isolates other client)', async () => {
    const port = createPort({
      selectEventWeatherForClient: vi.fn(async () => ok([...MOCK_WX_ALL_EVENT_ROWS])),
    });
    const service = createWeatherService({ dataPort: port, sessionReader: authed() });
    const result = await service.fetchClientEventWeather({
      clientUserId: MOCK_WX_CLIENT_USER_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.alerts.every((a) => a.visibility === 'client_event')).toBe(true);
    expect(result.data.alerts.some((a) => a.leadId === MOCK_WX_EVENT_OTHER_CLIENT.lead_id)).toBe(
      false,
    );
    expect(result.data.alerts.some((a) => a.leadId === MOCK_WX_EVENT_CRITICAL_STORM.lead_id)).toBe(
      true,
    );
    expect(result.data.alerts[0]?.riskLevel).toBe('Critical');
    expect(
      result.data.alerts
        .find((a) => a.leadId === MOCK_WX_EVENT_CRITICAL_STORM.lead_id)
        ?.recommendations.some((r) => r.code === 'relocate_dj_booth'),
    ).toBe(true);
  });
});

describe('weather.service — fetchArtistGigWeather', () => {
  it('returns outdoor risk for assigned gigs with operational advice', async () => {
    const port = createPort({
      selectEventWeatherForArtist: vi.fn(async () =>
        ok([
          MOCK_WX_EVENT_CLEAR,
          MOCK_WX_EVENT_CRITICAL_STORM,
          MOCK_WX_EVENT_HEAT,
          MOCK_WX_EVENT_OTHER_CLIENT,
        ]),
      ),
    });
    const service = createWeatherService({
      dataPort: port,
      sessionReader: createStaticSessionReader({
        portal: 'artist',
        sessionId: 'ses_a',
        authorizationHeader: 'Bearer artist',
        actorType: 'authenticated',
      }),
    });
    const result = await service.fetchArtistGigWeather({
      artistUserId: MOCK_WX_ARTIST_USER_ID,
      artistProfileId: MOCK_WX_DJ_PROFILE_ID,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.risks.every((r) => r.visibility === 'artist_gig')).toBe(true);
    expect(result.data.risks.some((r) => r.leadId === MOCK_WX_EVENT_OTHER_CLIENT.lead_id)).toBe(
      false,
    );
    const storm = result.data.risks.find((r) => r.leadId === MOCK_WX_EVENT_CRITICAL_STORM.lead_id);
    expect(storm?.riskLevel).toBe('Critical');
    expect(storm?.advice.some((a) => a.code === 'relocate_dj_booth')).toBe(true);
  });
});

describe('weather.service — fetchMasterWeatherConsole', () => {
  it('returns multi-event console with risk counts for staff_master', async () => {
    const port = createPort({
      selectEventWeatherForStaff: vi.fn(async () => ok([...MOCK_WX_ALL_EVENT_ROWS])),
    });
    const service = createWeatherService({
      dataPort: port,
      sessionReader: createStaticSessionReader({
        portal: 'staff',
        sessionId: 'ses_s',
        authorizationHeader: 'Bearer staff',
        actorType: 'staff',
      }),
    });
    const result = await service.fetchMasterWeatherConsole({ audience: 'staff_master' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.alerts.length).toBe(MOCK_WX_ALL_EVENT_ROWS.length);
    expect(result.data.risks.length).toBe(MOCK_WX_ALL_EVENT_ROWS.length);
    expect(result.data.riskCounts.Critical).toBeGreaterThanOrEqual(1);
    expect(result.data.alerts[0]?.riskLevel).toBe('Critical');
    expect(result.data.alerts.every((a) => a.visibility === 'staff_master')).toBe(true);
  });

  it('rejects non-staff audience', async () => {
    const service = createWeatherService({ dataPort: createPort(), sessionReader: authed() });
    const result = await service.fetchMasterWeatherConsole({
      audience: 'client_event' as 'staff_master',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.details).toBe('WEATHER_FORBIDDEN');
  });
});

describe('weather.mocks — alert mapping', () => {
  it('maps storm fixture to Critical alert with relocate recommendation', () => {
    const alert = mapEventWeatherRowToAlert(MOCK_WX_EVENT_CRITICAL_STORM, 'client_event');
    expect(alert.riskLevel).toBe('Critical');
    expect(alert.sourceKind).toBe('derived_risk');
    expect(alert.recommendations.some((r) => r.code === 'relocate_dj_booth')).toBe(true);
  });
});
