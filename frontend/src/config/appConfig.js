const toNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const APP_CONFIG = {
  edgeBaseUrl: process.env.REACT_APP_EDGE_BASE_URL || 'http://192.168.1.153:8000',
  demographicsEventsPath:
    process.env.REACT_APP_DEMOGRAPHICS_EVENTS_PATH || '/events/demographics',
  canEventsPath: process.env.REACT_APP_CAN_EVENTS_PATH || '/events/can',
  capturesPath: process.env.REACT_APP_CAPTURES_PATH || '/captures',
  pollingIntervalMs: toNumber(process.env.REACT_APP_POLLING_INTERVAL_MS, 1500),
  staleAfterMs: toNumber(process.env.REACT_APP_STALE_AFTER_MS, 12000),
  maxDemographicEvents: toNumber(process.env.REACT_APP_MAX_DEMOGRAPHIC_EVENTS, 2000),
  maxCanEvents: toNumber(process.env.REACT_APP_MAX_CAN_EVENTS, 600),
};

export const buildDemographicsUrl = () => {
  const base = APP_CONFIG.edgeBaseUrl.replace(/\/$/, '');
  const path = APP_CONFIG.demographicsEventsPath.startsWith('/')
    ? APP_CONFIG.demographicsEventsPath
    : `/${APP_CONFIG.demographicsEventsPath}`;

  return `${base}${path}`;
};

export const buildCanUrl = () => {
  const base = APP_CONFIG.edgeBaseUrl.replace(/\/$/, '');
  const path = APP_CONFIG.canEventsPath.startsWith('/')
    ? APP_CONFIG.canEventsPath
    : `/${APP_CONFIG.canEventsPath}`;

  return `${base}${path}`;
};

export const buildCapturesUrl = () => {
  const base = APP_CONFIG.edgeBaseUrl.replace(/\/$/, '');
  const path = APP_CONFIG.capturesPath.startsWith('/')
    ? APP_CONFIG.capturesPath
    : `/${APP_CONFIG.capturesPath}`;

  return `${base}${path}`;
};
