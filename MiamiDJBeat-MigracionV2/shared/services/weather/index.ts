/** Weather Engine domain — public barrel (Paso 2 read model + read fetch). */

export {
  asNumber,
  asRestRows,
  asString,
  buildOperationalAdvice,
  collectRiskDrivers,
  deriveBaseRiskLevel,
  filterAlertsForClient,
  filterAlertsForStaffMaster,
  filterRisksForArtist,
  mapEventWeatherRowToAlert,
  mapObservationRowToForecast,
  mapVenueWeatherRowToOutdoorRisk,
  resolveOutdoorRiskLevel,
  sortAlertsByRiskDesc,
  summarizeRiskCounts,
} from './weather.map-rows';

export {
  MOCK_WX_ALERT_CRITICAL,
  MOCK_WX_ALERT_STAFF_STORM,
  MOCK_WX_ALL_EVENT_ROWS,
  MOCK_WX_ARTIST_ASSIGNED_LEAD_IDS,
  MOCK_WX_ARTIST_USER_ID,
  MOCK_WX_CLIENT_OWNED_LEAD_IDS,
  MOCK_WX_CLIENT_USER_ID,
  MOCK_WX_DJ_PROFILE_ID,
  MOCK_WX_EVENT_CLEAR,
  MOCK_WX_EVENT_CRITICAL_STORM,
  MOCK_WX_EVENT_HEAT,
  MOCK_WX_EVENT_MODERATE_RAIN,
  MOCK_WX_EVENT_OTHER_CLIENT,
  MOCK_WX_FORECAST_CLEAR,
  MOCK_WX_OTHER_CLIENT_USER_ID,
  MOCK_WX_RISK_STORM,
} from './weather.mocks';

export {
  createWeatherService,
  listWeatherServiceReadMethods,
} from './weather.service';
export type {
  CreateWeatherServiceInput,
  FetchArtistGigWeatherResult,
  FetchClientEventWeatherResult,
  FetchMasterWeatherConsoleResult,
  WeatherDataPort,
  WeatherFetchOptions,
  WeatherService,
  WeatherServiceErrorCode,
} from './weather.service';
