const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const isSameDay = (left, right) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const percentage = (value, total) => {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 100);
};

export const deriveDemographicMetrics = (events, now = new Date()) => {
  const validEvents = Array.isArray(events) ? events : [];
  const todayStart = startOfDay(now);
  const weekWindowStart = new Date(now);
  weekWindowStart.setDate(weekWindowStart.getDate() - 6);
  weekWindowStart.setHours(0, 0, 0, 0);

  const todayEvents = validEvents.filter((event) => event.timestamp >= todayStart);
  const weekEvents = validEvents.filter((event) => event.timestamp >= weekWindowStart);

  const genderCounts = { Male: 0, Female: 0, Unknown: 0 };
  const ageCounts = {};
  const hourlyCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, '0')}:00`,
    count: 0,
  }));

  const weeklyMap = new Map(
    Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(weekWindowStart);
      date.setDate(date.getDate() + offset);
      return [date.toDateString(), { label: DAY_LABELS[date.getDay()], count: 0, date }];
    })
  );

  for (const event of weekEvents) {
    const eventDate = new Date(event.timestamp);

    if (isSameDay(eventDate, now)) {
      const hour = eventDate.getHours();
      hourlyCounts[hour].count += 1;
    }

    const dayKey = eventDate.toDateString();
    const dayBucket = weeklyMap.get(dayKey);
    if (dayBucket) {
      dayBucket.count += 1;
    }

    genderCounts[event.gender] = (genderCounts[event.gender] || 0) + 1;
    ageCounts[event.ageGroup] = (ageCounts[event.ageGroup] || 0) + 1;
  }

  const totalWeek = weekEvents.length;
  const totalToday = todayEvents.length;
  const recentEvents = [...validEvents]
    .sort((a, b) => b.timestamp.valueOf() - a.timestamp.valueOf())
    .slice(0, 12);

  const peakHour = [...hourlyCounts].sort((a, b) => b.count - a.count)[0];

  const ageDistribution = Object.entries(ageCounts)
    .map(([label, count]) => ({ label, count, pct: percentage(count, totalWeek) }))
    .sort((a, b) => b.count - a.count);

  return {
    totalToday,
    totalWeek,
    malePct: percentage(genderCounts.Male || 0, totalWeek),
    femalePct: percentage(genderCounts.Female || 0, totalWeek),
    unknownPct: percentage(genderCounts.Unknown || 0, totalWeek),
    peakHour: peakHour?.label || '--:--',
    genderCounts,
    ageDistribution,
    hourlyCounts,
    weeklyCounts: Array.from(weeklyMap.values()),
    recentEvents,
  };
};

const PRODUCTS = ['Coke', 'Sprite', 'Fanta', 'Water', 'Tea'];

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

export const generateBottleEvent = () => {
  const action = Math.random() > 0.35 ? 'OUT' : 'IN';
  const product = pickRandom(PRODUCTS);

  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date(),
    action,
    product,
  };
};

export const deriveBottleMetrics = (events, now = new Date()) => {
  const validEvents = Array.isArray(events) ? events : [];
  const today = startOfDay(now);
  const todayEvents = validEvents.filter((event) => event.timestamp >= today);

  const perProduct = {};
  let outCount = 0;
  let inCount = 0;

  for (const event of todayEvents) {
    if (!perProduct[event.product]) {
      perProduct[event.product] = { out: 0, in: 0 };
    }

    if (event.action === 'OUT') {
      outCount += 1;
      perProduct[event.product].out += 1;
    } else {
      inCount += 1;
      perProduct[event.product].in += 1;
    }
  }

  const topDemand = Object.entries(perProduct)
    .sort(([, left], [, right]) => right.out - left.out)[0]?.[0] || 'N/A';

  return {
    outToday: outCount,
    inToday: inCount,
    netOutToday: outCount - inCount,
    topDemand,
    perProduct,
    recentEvents: [...validEvents]
      .sort((a, b) => b.timestamp.valueOf() - a.timestamp.valueOf())
      .slice(0, 10),
  };
};

export const deriveCanMetrics = (events, now = new Date()) => {
  const validEvents = Array.isArray(events) ? events : [];
  const today = startOfDay(now);
  const weekWindowStart = new Date(now);
  weekWindowStart.setDate(weekWindowStart.getDate() - 6);
  weekWindowStart.setHours(0, 0, 0, 0);

  const todayEvents = validEvents.filter((event) => event.timestamp >= today);
  const weekEvents = validEvents.filter((event) => event.timestamp >= weekWindowStart);

  const weeklyMap = new Map(
    Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(weekWindowStart);
      date.setDate(date.getDate() + offset);
      return [date.toDateString(), { label: DAY_LABELS[date.getDay()], count: 0, date }];
    })
  );

  const labelCounts = {};
  for (const event of weekEvents) {
    labelCounts[event.label] = (labelCounts[event.label] || 0) + 1;

    const dayKey = new Date(event.timestamp).toDateString();
    const bucket = weeklyMap.get(dayKey);
    if (bucket) bucket.count += 1;
  }

  const topLabel = Object.entries(labelCounts)
    .sort(([, left], [, right]) => right - left)[0]?.[0] || 'N/A';

  const recentEvents = [...validEvents]
    .sort((a, b) => b.timestamp.valueOf() - a.timestamp.valueOf())
    .slice(0, 12);

  return {
    totalToday: todayEvents.length,
    totalWeek: weekEvents.length,
    topLabel,
    labelCounts,
    weeklyCounts: Array.from(weeklyMap.values()),
    recentEvents,
  };
};

export const deriveProductMetrics = (canEvents, now = new Date()) => {
  const validEvents = Array.isArray(canEvents) ? canEvents : [];
  const todayStart = startOfDay(now);
  const todayEvents = validEvents.filter((e) => e.timestamp >= todayStart);

  const perProduct = {};
  for (const event of todayEvents) {
    if (!perProduct[event.label]) {
      perProduct[event.label] = { out: 0, in: 0 };
    }
    if (event.action === 'OUT') {
      perProduct[event.label].out += 1;
    } else if (event.action === 'IN') {
      perProduct[event.label].in += 1;
    }
  }

  const products = Object.entries(perProduct)
    .map(([name, counts]) => ({
      name,
      out: counts.out,
      in: counts.in,
      net: counts.in - counts.out,
    }))
    .sort((a, b) => b.out - a.out);

  const totalOut = products.reduce((s, p) => s + p.out, 0);
  const totalIn = products.reduce((s, p) => s + p.in, 0);

  return { products, totalOut, totalIn };
};

// Hourly slots shown in the "today" timeline view
const TIMELINE_HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 – 22:00

export const deriveProductTimeline = (canEvents, product, now = new Date()) => {
  const filtered = (Array.isArray(canEvents) ? canEvents : []).filter(
    (e) => e.label === product
  );

  const todayStart = startOfDay(now);
  const weekWindowStart = new Date(now);
  weekWindowStart.setDate(weekWindowStart.getDate() - 6);
  weekWindowStart.setHours(0, 0, 0, 0);

  const hourlyBins = TIMELINE_HOURS.map((h) => ({
    label: `${h}h`,
    hour: h,
    in: 0,
    out: 0,
  }));

  const weeklyMap = new Map(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekWindowStart);
      d.setDate(d.getDate() + i);
      return [d.toDateString(), { label: DAY_LABELS[d.getDay()], in: 0, out: 0, date: d }];
    })
  );

  for (const e of filtered) {
    if (e.timestamp >= todayStart) {
      const h = new Date(e.timestamp).getHours();
      const bin = hourlyBins.find((b) => b.hour === h);
      if (bin) {
        if (e.action === 'OUT') bin.out += 1;
        else if (e.action === 'IN') bin.in += 1;
      }
    }
    if (e.timestamp >= weekWindowStart) {
      const key = new Date(e.timestamp).toDateString();
      const bucket = weeklyMap.get(key);
      if (bucket) {
        if (e.action === 'OUT') bucket.out += 1;
        else if (e.action === 'IN') bucket.in += 1;
      }
    }
  }

  return {
    hourly: hourlyBins,
    weekly: Array.from(weeklyMap.values()),
  };
};

const CORR_WINDOW_MS = 3 * 60 * 1000; // 3-minute association window

export const deriveProductDemographics = (canEvents, demoEvents) => {
  const validCan = Array.isArray(canEvents) ? canEvents : [];
  const validDemo = Array.isArray(demoEvents) ? demoEvents : [];

  // Group OUT timestamps by product
  const outsByProduct = {};
  for (const e of validCan) {
    if (e.action !== 'OUT') continue;
    if (!outsByProduct[e.label]) outsByProduct[e.label] = [];
    outsByProduct[e.label].push(e.timestamp.valueOf());
  }

  const result = {};

  for (const [product, timestamps] of Object.entries(outsByProduct)) {
    const genders = {};
    const ageGroups = {};
    const seen = new Set();

    for (const demoEvt of validDemo) {
      if (seen.has(demoEvt.id)) continue;
      const t = demoEvt.timestamp.valueOf();
      const isNear = timestamps.some((ts) => Math.abs(t - ts) <= CORR_WINDOW_MS);
      if (!isNear) continue;
      seen.add(demoEvt.id);
      genders[demoEvt.gender] = (genders[demoEvt.gender] || 0) + 1;
      ageGroups[demoEvt.ageGroup] = (ageGroups[demoEvt.ageGroup] || 0) + 1;
    }

    result[product] = { genders, ageGroups, correlatedCount: seen.size };
  }

  return result;
};
