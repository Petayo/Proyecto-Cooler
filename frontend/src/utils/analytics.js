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
