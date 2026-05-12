const toNumber = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const APP_CONFIG = {
  edgeBaseUrl: process.env.REACT_APP_EDGE_BASE_URL || 'http://192.168.1.131:8000',
  demographicsPath: process.env.REACT_APP_DEMOGRAPHICS_PATH || '/demographics',
  pollingIntervalMs: toNumber(process.env.REACT_APP_POLLING_INTERVAL_MS, 1500),
  staleAfterMs: toNumber(process.env.REACT_APP_STALE_AFTER_MS, 12000),
  maxDemographicEvents: toNumber(process.env.REACT_APP_MAX_DEMOGRAPHIC_EVENTS, 2000),
  maxBottleEvents: toNumber(process.env.REACT_APP_MAX_BOTTLE_EVENTS, 600),
};

export const buildDemographicsUrl = () => {
  const base = APP_CONFIG.edgeBaseUrl.replace(/\/$/, '');
  const path = APP_CONFIG.demographicsPath.startsWith('/')
    ? APP_CONFIG.demographicsPath
    : `/${APP_CONFIG.demographicsPath}`;

  return `${base}${path}`;
};
