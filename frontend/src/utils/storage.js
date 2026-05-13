const CAN_KEY = 'sc_can_events_v1';
const DEMO_KEY = 'sc_demo_events_v1';

const KEEP_DAYS = 30;

const serialize = (event) => ({
  ...event,
  timestamp: event.timestamp instanceof Date
    ? event.timestamp.toISOString()
    : event.timestamp,
});

const deserializeCan = (raw) => ({
  ...raw,
  timestamp: new Date(raw.timestamp),
});

const deserializeDemo = (raw) => ({
  ...raw,
  timestamp: new Date(raw.timestamp),
});

const pruneOld = (events) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  return events.filter((e) => e.timestamp >= cutoff);
};

export const loadCanEvents = () => {
  try {
    const raw = localStorage.getItem(CAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(deserializeCan) : null;
  } catch {
    return null;
  }
};

export const saveCanEvents = (events) => {
  try {
    localStorage.setItem(CAN_KEY, JSON.stringify(pruneOld(events).map(serialize)));
  } catch {
    // quota exceeded or private browsing — silently skip
  }
};

export const loadDemoEvents = () => {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(deserializeDemo) : null;
  } catch {
    return null;
  }
};

export const saveDemoEvents = (events) => {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(pruneOld(events).map(serialize)));
  } catch {}
};

export const clearStorage = () => {
  try {
    localStorage.removeItem(CAN_KEY);
    localStorage.removeItem(DEMO_KEY);
  } catch {}
};
