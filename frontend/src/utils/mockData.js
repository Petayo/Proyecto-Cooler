const PRODUCTS = ['Coke', 'Sprite', 'Fanta', 'Water', 'Tea'];
const PRODUCT_OUT_WEIGHTS = [0.35, 0.20, 0.12, 0.25, 0.08];

const GENDERS = ['Male', 'Female', 'Unknown'];
const GENDER_WEIGHTS = [0.52, 0.40, 0.08];

const AGE_GROUPS = ['18-24', '25-34', '35-44', '45-54', '55+'];
const AGE_WEIGHTS = [0.25, 0.35, 0.22, 0.12, 0.06];

// Relative activity per hour (index = hour 0-23)
const HOURLY_WEIGHTS = [
  0.01, 0.01, 0.01, 0.01, 0.01, 0.02,
  0.05, 0.12, 0.20, 0.30, 0.45, 0.55,
  0.50, 0.60, 0.55, 0.48, 0.40, 0.35,
  0.25, 0.18, 0.12, 0.07, 0.04, 0.02,
];

// Relative traffic per day-of-week (0=Sun)
const DAY_WEIGHTS = [0.55, 0.90, 1.00, 0.88, 0.95, 1.10, 0.65];

const pickWeighted = (items, weights) => {
  let r = Math.random() * weights.reduce((s, w) => s + w, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
};

const uid = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const randomHour = () =>
  pickWeighted(Array.from({ length: 24 }, (_, i) => i), HOURLY_WEIGHTS);

const setHMS = (date, h, m, s) => {
  const d = new Date(date);
  d.setHours(h, m, s, Math.floor(Math.random() * 1000));
  return d;
};

export const generateMockCanEvents = (now = new Date()) => {
  const events = [];
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  // Past 6 full days
  for (let offset = 6; offset >= 1; offset--) {
    const dayStart = new Date(todayMidnight);
    dayStart.setDate(dayStart.getDate() - offset);
    const w = DAY_WEIGHTS[dayStart.getDay()];

    const outCount = Math.round(110 * w);
    const inCount = Math.round(outCount * 0.28);

    for (let i = 0; i < outCount; i++) {
      events.push({
        id: uid('mock-out'),
        timestamp: setHMS(
          dayStart,
          randomHour(),
          Math.floor(Math.random() * 60),
          Math.floor(Math.random() * 60)
        ),
        label: pickWeighted(PRODUCTS, PRODUCT_OUT_WEIGHTS),
        confidence: 82 + Math.random() * 16,
        action: 'OUT',
        imageUrl: null,
      });
    }

    // Morning restocking window 7-9 am plus occasional midday restock
    for (let i = 0; i < inCount; i++) {
      const h = Math.random() < 0.72 ? 7 + Math.floor(Math.random() * 2) : 12 + Math.floor(Math.random() * 3);
      events.push({
        id: uid('mock-in'),
        timestamp: setHMS(dayStart, h, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60)),
        label: pickWeighted(PRODUCTS, PRODUCT_OUT_WEIGHTS),
        confidence: null,
        action: 'IN',
        imageUrl: null,
      });
    }
  }

  // Today's seed: 8am up to 2 hours before now
  const seedCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const dayOpen = new Date(todayMidnight);
  dayOpen.setHours(8, 0, 0, 0);

  if (seedCutoff > dayOpen) {
    const w = DAY_WEIGHTS[todayMidnight.getDay()];
    const elapsed = (seedCutoff - dayOpen) / (1000 * 60 * 60);
    const todayOutCount = Math.round(14 * w * Math.min(elapsed / 8, 1));
    const todayInCount = Math.round(5 * w);

    for (let i = 0; i < todayInCount; i++) {
      const ts = new Date(dayOpen);
      ts.setMinutes(Math.floor(Math.random() * 100));
      events.push({
        id: uid('seed-in'),
        timestamp: ts,
        label: pickWeighted(PRODUCTS, PRODUCT_OUT_WEIGHTS),
        confidence: null,
        action: 'IN',
        imageUrl: null,
      });
    }

    for (let i = 0; i < todayOutCount; i++) {
      const ts = new Date(dayOpen.getTime() + Math.random() * (seedCutoff - dayOpen));
      events.push({
        id: uid('seed-out'),
        timestamp: ts,
        label: pickWeighted(PRODUCTS, PRODUCT_OUT_WEIGHTS),
        confidence: 82 + Math.random() * 16,
        action: 'OUT',
        imageUrl: null,
      });
    }
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
};

export const generateMockDemoEvents = (now = new Date()) => {
  const events = [];
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  for (let offset = 6; offset >= 1; offset--) {
    const dayStart = new Date(todayMidnight);
    dayStart.setDate(dayStart.getDate() - offset);
    const w = DAY_WEIGHTS[dayStart.getDay()];
    const count = Math.round(80 * w);

    for (let i = 0; i < count; i++) {
      events.push({
        id: uid('mock-demo'),
        timestamp: setHMS(
          dayStart,
          randomHour(),
          Math.floor(Math.random() * 60),
          Math.floor(Math.random() * 60)
        ),
        gender: pickWeighted(GENDERS, GENDER_WEIGHTS),
        ageGroup: pickWeighted(AGE_GROUPS, AGE_WEIGHTS),
        imageUrl: null,
      });
    }
  }

  const seedCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const dayOpen = new Date(todayMidnight);
  dayOpen.setHours(8, 0, 0, 0);

  if (seedCutoff > dayOpen) {
    const w = DAY_WEIGHTS[todayMidnight.getDay()];
    const elapsed = (seedCutoff - dayOpen) / (1000 * 60 * 60);
    const count = Math.round(18 * w * Math.min(elapsed / 8, 1));

    for (let i = 0; i < count; i++) {
      const ts = new Date(dayOpen.getTime() + Math.random() * (seedCutoff - dayOpen));
      events.push({
        id: uid('seed-demo'),
        timestamp: ts,
        gender: pickWeighted(GENDERS, GENDER_WEIGHTS),
        ageGroup: pickWeighted(AGE_GROUPS, AGE_WEIGHTS),
        imageUrl: null,
      });
    }
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
};
