import { useMemo, useState } from 'react';
import { APP_CONFIG } from './config/appConfig';
import { useCapturesPolling } from './hooks/useCapturesPolling';
import { useCanPolling } from './hooks/useCanPolling';
import { useDemographicsPolling } from './hooks/useDemographicsPolling';
import {
  deriveCanMetrics,
  deriveDemographicMetrics,
  deriveProductMetrics,
  deriveProductTimeline,
  deriveProductDemographics,
} from './utils/analytics';
import './App.css';

const fmt = (date) =>
  date
    ? new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        month: 'short',
        day: '2-digit',
      }).format(date)
    : 'Never';

const fmtTime = (date) =>
  new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);

const connectionState = ({ isLoading, error, isStale }) => {
  if (isLoading) return { label: 'Connecting', cls: 'state-warn' };
  if (error) return { label: 'Offline', cls: 'state-error' };
  if (isStale) return { label: 'Stale', cls: 'state-warn' };
  return { label: 'Live', cls: 'state-ok' };
};

const collectRecentImages = (events, labelFn, max = 6) => {
  const seen = new Set();
  return [...events]
    .sort((a, b) => b.timestamp - a.timestamp)
    .reduce((acc, e) => {
      if (!e.imageUrl || seen.has(e.imageUrl) || acc.length >= max) return acc;
      seen.add(e.imageUrl);
      acc.push({ id: e.id, url: e.imageUrl, label: labelFn(e), timestamp: e.timestamp });
      return acc;
    }, []);
};

const parseCaptureTimestamp = (filename) => {
  if (typeof filename !== 'string') return null;
  const match = filename.match(/_(\d{8})_(\d{6})_/);
  if (!match) return null;

  const dateStr = match[1];
  const timeStr = match[2];
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(4, 6));
  const day = Number(dateStr.slice(6, 8));
  const hour = Number(timeStr.slice(0, 2));
  const minute = Number(timeStr.slice(2, 4));
  const second = Number(timeStr.slice(4, 6));

  if (
    [year, month, day, hour, minute, second].some((v) => Number.isNaN(v))
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};

const extractCaptureImages = (captures, prefix, labelFn, labelMap = {}, max = 6) =>
  captures
    .filter((c) => c.filename?.startsWith(prefix))
    .map((c) => ({
      id: c.filename,
      url: c.url,
      label: labelMap[c.filename] || labelFn(c),
      timestamp: parseCaptureTimestamp(c.filename),
    }))
    .sort((a, b) => (b.timestamp?.valueOf() || 0) - (a.timestamp?.valueOf() || 0))
    .slice(0, max);

const mergeRecentImages = (eventImages, captureImages, max = 6) => {
  const byUrl = new Map();
  const add = (item) => {
    if (!item?.url) return;
    const existing = byUrl.get(item.url);
    if (!existing) {
      byUrl.set(item.url, item);
      return;
    }

    const existingTime = existing.timestamp?.valueOf() || 0;
    const nextTime = item.timestamp?.valueOf() || 0;
    if (nextTime > existingTime) {
      byUrl.set(item.url, item);
    }
  };

  eventImages.forEach(add);
  captureImages.forEach(add);

  return [...byUrl.values()]
    .sort((a, b) => (b.timestamp?.valueOf() || 0) - (a.timestamp?.valueOf() || 0))
    .slice(0, max);
};

const buildCaptureLabelMap = (events, labelFn) => {
  const map = {};
  for (const event of events || []) {
    if (!event.imageUrl) continue;
    const filename = event.imageUrl.split('/').pop();
    if (!filename) continue;
    map[filename] = labelFn(event);
  }
  return map;
};

// Demand level: 0=ok, 1=moderate, 2=high
const demandLevel = (out, maxOut) => {
  if (!maxOut) return 0;
  const ratio = out / maxOut;
  if (ratio >= 0.75) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
};

function AxisChart({ bins, renderBars, minWidth }) {
  const maxVal = Math.max(1, ...bins.map((b) =>
    'count' in b ? b.count : Math.max(b.in ?? 0, b.out ?? 0)
  ));
  const midVal = Math.ceil(maxVal / 2);

  return (
    <div className="chart-wrap">
      <div className="y-axis-col" aria-hidden="true">
        <span className="y-tick">{maxVal}</span>
        <span className="y-tick">{midVal}</span>
        <span className="y-tick">0</span>
      </div>
      <div className="chart-col">
        <div className="chart-plot" style={minWidth ? { minWidth } : undefined}>
          <div className="gridline-h" style={{ top: 0 }} />
          <div className="gridline-h" style={{ top: '50%' }} />
          <div className="gridline-h" style={{ bottom: 0 }} />
          <div className="bars-row">
            {bins.map((bin, i) => renderBars(bin, i, maxVal))}
          </div>
        </div>
        <div className="x-axis-row" style={minWidth ? { minWidth } : undefined}>
          {bins.map((bin, i) => (
            <span key={i} className="x-tick">{bin.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductTimelineChart({ canEvents, product }) {
  const [view, setView] = useState('week');
  const data = useMemo(
    () => deriveProductTimeline(canEvents, product),
    [canEvents, product]
  );

  const bins = view === 'week' ? data.weekly : data.hourly;

  return (
    <div className="chart-inner">
      <div className="chart-toggle">
        <button
          className={`toggle-btn${view === 'week' ? ' active' : ''}`}
          onClick={() => setView('week')}
        >
          This week
        </button>
        <button
          className={`toggle-btn${view === 'today' ? ' active' : ''}`}
          onClick={() => setView('today')}
        >
          Today hourly
        </button>
      </div>
      <div className="tl-scroll">
        <AxisChart
          bins={bins}
          minWidth={view === 'today' ? '460px' : undefined}
          renderBars={(bin, i, maxVal) => (
            <div key={i} className="bar-slot">
              <div className="tl-pair">
                <div
                  className="bar-in-slot tl-out"
                  style={{ height: `${(bin.out / maxVal) * 100}%` }}
                  title={`${bin.out} taken`}
                />
                <div
                  className="bar-in-slot tl-in"
                  style={{ height: `${(bin.in / maxVal) * 100}%` }}
                  title={`${bin.in} restocked`}
                />
              </div>
            </div>
          )}
        />
      </div>
      <div className="chart-legend">
        <span><span className="legend-dot ld-out" />Taken out</span>
        <span><span className="legend-dot ld-in" />Restocked</span>
      </div>
    </div>
  );
}

function ProductDemographicsChart({ canEvents, demoEvents, product }) {
  const allData = useMemo(
    () => deriveProductDemographics(canEvents, demoEvents),
    [canEvents, demoEvents]
  );
  const data = allData[product] || { genders: {}, ageGroups: {}, correlatedCount: 0 };

  const totalGender = Object.values(data.genders).reduce((s, v) => s + v, 0) || 1;
  const totalAge = Object.values(data.ageGroups).reduce((s, v) => s + v, 0) || 1;

  const genderRows = [
    { key: 'Male',    cls: 'male' },
    { key: 'Female',  cls: 'female' },
    { key: 'Unknown', cls: 'unknown' },
  ];

  const ageEntries = Object.entries(data.ageGroups).sort(([, a], [, b]) => b - a);

  return (
    <div className="chart-inner">
      <h4 className="chart-sub-heading">Gender split</h4>
      {genderRows.map(({ key, cls }) => {
        const count = data.genders[key] || 0;
        const pct = Math.round((count / totalGender) * 100);
        return (
          <div key={key} className="bar-row">
            <span>{key}</span>
            <div className="bar-track">
              <div className={`bar-fill ${cls}`} style={{ width: `${pct}%` }} />
            </div>
            <strong>{pct}%</strong>
          </div>
        );
      })}

      <h4 className="chart-sub-heading">Age groups</h4>
      <div className="age-list">
        {ageEntries.length ? (
          ageEntries.map(([group, count]) => (
            <p key={group}>
              <span>{group}</span>
              <span>
                {count} ({Math.round((count / totalAge) * 100)}%)
              </span>
            </p>
          ))
        ) : (
          <p className="empty-text">No correlated data yet.</p>
        )}
      </div>

      {data.correlatedCount > 0 ? (
        <p className="chart-note">
          Based on {data.correlatedCount} shoppers detected before a {product}-out detection
        </p>
      ) : (
        <p className="chart-note muted">
          Demographics are linked to can detections within a 3-minute window.
          More data accumulates over time.
        </p>
      )}
    </div>
  );
}

function InsightsSection({ canEvents, demoEvents }) {
  const products = useMemo(() => {
    const labels = [...new Set(canEvents.map((e) => e.label).filter(Boolean))].sort();
    return labels;
  }, [canEvents]);

  const [tlProduct, setTlProduct] = useState(null);
  const [demoProduct, setDemoProduct] = useState(null);

  const activeTl = tlProduct || products[0] || '';
  const activeDemo = demoProduct || products[0] || '';

  if (!products.length) return null;

  return (
    <section className="two-col">
      <article className="panel section-card">
        <div className="chart-header">
          <h3>Ins &amp; Outs Over Time</h3>
          <select
            className="product-select"
            value={activeTl}
            onChange={(e) => setTlProduct(e.target.value)}
            aria-label="Select product for timeline"
          >
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <ProductTimelineChart canEvents={canEvents} product={activeTl} />
      </article>

      <article className="panel section-card">
        <div className="chart-header">
          <h3>Shopper Demographics by Product</h3>
          <select
            className="product-select"
            value={activeDemo}
            onChange={(e) => setDemoProduct(e.target.value)}
            aria-label="Select product for demographics"
          >
            {products.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <ProductDemographicsChart
          canEvents={canEvents}
          demoEvents={demoEvents}
          product={activeDemo}
        />
      </article>
    </section>
  );
}

function ProductRow({ product, maxOut }) {
  const level = demandLevel(product.out, maxOut);
  const demandCls = ['demand-ok', 'demand-moderate', 'demand-high'][level];
  const outPct = maxOut ? Math.round((product.out / maxOut) * 100) : 0;

  return (
    <div className="product-row">
      <div className="product-name">{product.name}</div>
      <div className="product-stat out">
        <span className="stat-icon">-</span>
        <strong>{product.out}</strong>
        <span className="stat-label">taken</span>
      </div>
      <div className="product-stat in">
        <span className="stat-icon">+</span>
        <strong>{product.in}</strong>
        <span className="stat-label">restocked</span>
      </div>
      <div className="product-net" style={{ color: product.net >= 0 ? 'var(--accent-cool)' : 'var(--accent-rose)' }}>
        {product.net >= 0 ? '+' : ''}{product.net}
      </div>
      <div className="product-bar-wrap">
        <div className={`product-bar-fill ${demandCls}`} style={{ width: `${outPct}%` }} />
      </div>
    </div>
  );
}

function WeeklyBars({ weeklyCounts, color }) {
  return (
    <AxisChart
      bins={weeklyCounts}
      renderBars={(day, i, maxVal) => (
        <div key={day.date.toISOString()} className="bar-slot">
          <div
            className="bar-in-slot"
            style={{
              height: `${(day.count / maxVal) * 100}%`,
              background: color,
            }}
            title={`${day.count} detections`}
          />
        </div>
      )}
    />
  );
}

function App() {
  const {
    events: demoEvents,
    isLoading: demoLoading,
    error: demoError,
    lastSuccessAt: demoLastAt,
    isStale: demoStale,
    endpointUrl: demoUrl,
  } = useDemographicsPolling();

  const {
    events: canEvents,
    isLoading: canLoading,
    error: canError,
    lastSuccessAt: canLastAt,
    isStale: canStale,
    endpointUrl: canUrl,
  } = useCanPolling();

  const { captures } = useCapturesPolling();

  const demoMetrics = useMemo(() => deriveDemographicMetrics(demoEvents), [demoEvents]);
  const canMetrics = useMemo(() => deriveCanMetrics(canEvents), [canEvents]);
  const productMetrics = useMemo(() => deriveProductMetrics(canEvents), [canEvents]);

  const demoCon = useMemo(
    () => connectionState({ isLoading: demoLoading, error: demoError, isStale: demoStale }),
    [demoLoading, demoError, demoStale]
  );
  const canCon = useMemo(
    () => connectionState({ isLoading: canLoading, error: canError, isStale: canStale }),
    [canLoading, canError, canStale]
  );

  const demoCaptureLabels = useMemo(
    () => buildCaptureLabelMap(demoEvents, (e) => `${e.gender} / ${e.ageGroup}`),
    [demoEvents]
  );
  const canCaptureLabels = useMemo(
    () => buildCaptureLabelMap(canEvents, (e) => e.label),
    [canEvents]
  );

  const recentDemoImages = useMemo(() => {
    const fromEvents = collectRecentImages(
      demoEvents,
      (e) => `${e.gender} / ${e.ageGroup}`
    );
    const fromCaptures = extractCaptureImages(
      captures,
      'demo_',
      (c) => c.gender && c.age_group ? `${c.gender} / ${c.age_group}` : 'Demographics capture',
      demoCaptureLabels
    );
    return mergeRecentImages(fromEvents, fromCaptures);
  }, [demoEvents, captures, demoCaptureLabels]);

  const recentCanImages = useMemo(() => {
    const fromEvents = collectRecentImages(canEvents, (e) => e.label);
    const fromCaptures = extractCaptureImages(
      captures,
      'can_',
      (c) => c.label || 'No detection',
      canCaptureLabels
    );
    return mergeRecentImages(fromEvents, fromCaptures);
  }, [canEvents, captures, canCaptureLabels]);

  const maxProductOut = Math.max(0, ...productMetrics.products.map((p) => p.out));

  const recentFeed = useMemo(() => {
    const demoItems = demoEvents.slice(-50).map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      type: 'demo',
      text: `${e.gender} / ${e.ageGroup}`,
    }));
    const canItems = canEvents.slice(-50).map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      type: e.action === 'IN' ? 'can-in' : 'can-out',
      text: `${e.label}${e.confidence ? ` ${e.confidence.toFixed(0)}%` : ''} ${e.action === 'IN' ? '(restocked)' : '(taken)'}`,
    }));
    return [...demoItems, ...canItems]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
  }, [demoEvents, canEvents]);

  return (
    <div className="app-shell">
      <div className="ambient-bg" aria-hidden="true" />
      <main className="dashboard" aria-label="Smart cooler analytics dashboard">

        {/* Header */}
        <header className="hero-card panel">
          <div className="hero-title">
            <p className="eyebrow">Smart Cooler Intelligence</p>
            <h1>Retail Restock Command</h1>
            <p className="muted">
              Live product activity and shopper demographics from the edge AI board.
            </p>
            <div className="status-row">
              <span className={`status-pill ${demoCon.cls}`}>
                Demographics: {demoCon.label}
              </span>
              <span className={`status-pill ${canCon.cls}`}>
                Can model: {canCon.label}
              </span>
            </div>
          </div>
          <div className="meta-list">
            <p><strong>Demographics API</strong><span>{demoUrl}</span></p>
            <p><strong>Can API</strong><span>{canUrl}</span></p>
            <p><strong>Polling</strong><span>{APP_CONFIG.pollingIntervalMs} ms</span></p>
            <p><strong>Last demo update</strong><span>{fmt(demoLastAt)}</span></p>
            <p><strong>Last can update</strong><span>{fmt(canLastAt)}</span></p>
          </div>
        </header>

        {/* KPIs */}
        <section className="kpi-grid" aria-label="Key metrics">
          <article className="panel kpi-card">
            <p>Shoppers today</p>
            <h2>{demoMetrics.totalToday}</h2>
            <span className="kpi-sub">{demoMetrics.totalWeek} this week</span>
          </article>
          <article className="panel kpi-card">
            <p>Peak hour today</p>
            <h2>{demoMetrics.peakHour}</h2>
            <span className="kpi-sub">highest foot traffic</span>
          </article>
          <article className="panel kpi-card accent-out">
            <p>Products taken today</p>
            <h2>{productMetrics.totalOut}</h2>
            <span className="kpi-sub">{productMetrics.totalIn} restocked</span>
          </article>
          <article className="panel kpi-card accent-top">
            <p>Top demand</p>
            <h2>{canMetrics.topLabel}</h2>
            <span className="kpi-sub">most taken this week</span>
          </article>
        </section>

        {/* Product Activity — full width, star of the show */}
        <section className="panel product-activity" aria-label="Product activity today">
          <div className="section-header">
            <div>
              <h3>Product Activity Today</h3>
              <p className="muted section-sub">Updates automatically with each detection from the can camera.</p>
            </div>
            <div className="activity-totals">
              <span className="total-badge out-badge">{productMetrics.totalOut} taken</span>
              <span className="total-badge in-badge">{productMetrics.totalIn} restocked</span>
            </div>
          </div>

          {productMetrics.products.length ? (
            <div className="product-table">
              <div className="product-table-head">
                <span>Product</span>
                <span>Taken OUT</span>
                <span>Restocked IN</span>
                <span>Net</span>
                <span>Demand</span>
              </div>
              {productMetrics.products.map((product) => (
                <ProductRow
                  key={product.name}
                  product={product}
                  maxOut={maxProductOut}
                />
              ))}
            </div>
          ) : (
            <p className="empty-text">Waiting for first detections today...</p>
          )}
        </section>

        {/* Per-product insights: timeline + demographics */}
        <InsightsSection canEvents={canEvents} demoEvents={demoEvents} />

        {/* Weekly trends row */}
        <section className="two-col">
          <article className="panel section-card">
            <h3>Shopper Traffic — This Week</h3>
            <WeeklyBars
              weeklyCounts={demoMetrics.weeklyCounts}
              color="linear-gradient(180deg, var(--accent-night), #4a7ab5)"
            />
          </article>
          <article className="panel section-card">
            <h3>Can Detections — This Week</h3>
            <WeeklyBars
              weeklyCounts={canMetrics.weeklyCounts}
              color="linear-gradient(180deg, var(--accent-cool), #4eb7aa)"
            />
            <div className="label-grid">
              {Object.entries(canMetrics.labelCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([label, count]) => (
                  <span key={label} className="label-chip">
                    {label} <strong>{count}</strong>
                  </span>
                ))}
            </div>
          </article>
        </section>

        {/* Demographics + live feed */}
        <section className="two-col">
          <article className="panel section-card">
            <h3>Shopper Demographics</h3>
            <div className="bar-row">
              <span>Male</span>
              <div className="bar-track">
                <div className="bar-fill male" style={{ width: `${demoMetrics.malePct}%` }} />
              </div>
              <strong>{demoMetrics.malePct}%</strong>
            </div>
            <div className="bar-row">
              <span>Female</span>
              <div className="bar-track">
                <div className="bar-fill female" style={{ width: `${demoMetrics.femalePct}%` }} />
              </div>
              <strong>{demoMetrics.femalePct}%</strong>
            </div>
            <div className="bar-row">
              <span>Unknown</span>
              <div className="bar-track">
                <div className="bar-fill unknown" style={{ width: `${demoMetrics.unknownPct}%` }} />
              </div>
              <strong>{demoMetrics.unknownPct}%</strong>
            </div>
            <h4>Age groups (this week)</h4>
            <div className="age-list">
              {demoMetrics.ageDistribution.length ? (
                demoMetrics.ageDistribution.map((g) => (
                  <p key={g.label}>
                    <span>{g.label}</span>
                    <span>{g.count} ({g.pct}%)</span>
                  </p>
                ))
              ) : (
                <p className="empty-text">No detections yet.</p>
              )}
            </div>
          </article>

          <article className="panel section-card">
            <h3>Live Event Feed</h3>
            <ul className="event-list">
              {recentFeed.length ? (
                recentFeed.map((item) => (
                  <li key={item.id} className={`feed-item feed-${item.type}`}>
                    <span className="feed-time">{fmtTime(item.timestamp)}</span>
                    <span className="feed-dot" />
                    <span className="feed-text">{item.text}</span>
                  </li>
                ))
              ) : (
                <li className="empty-text">Waiting for events...</li>
              )}
            </ul>
          </article>
        </section>

        {/* Captures */}
        <section className="two-col" aria-label="Recent captures">
          {recentDemoImages.length > 0 && (
            <article className="panel section-card">
              <h3>Recent demographics captures</h3>
              <div className="image-grid">
                {recentDemoImages.map((item) => (
                  <figure className="image-card" key={item.id}>
                    <img src={item.url} alt={item.label} loading="lazy" />
                    <figcaption>{item.label}</figcaption>
                  </figure>
                ))}
              </div>
            </article>
          )}
          <article className="panel section-card">
            <h3>Can camera — live view</h3>
            {recentCanImages.length > 0 ? (
              <div className="image-grid">
                {recentCanImages.map((item) => (
                  <figure className="image-card" key={item.id}>
                    <img src={item.url} alt={item.label} loading="lazy" />
                    <figcaption>
                      {item.label || 'No detection'}
                      {item.timestamp ? ` · ${fmtTime(item.timestamp)}` : ''}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="empty-text">Waiting for can camera frames...</p>
            )}
          </article>
        </section>

        {demoError || canError ? (
          <aside className="panel warning-panel" role="status">
            Edge connection failed: {demoError || canError}. Data shown is from local storage — live updates will resume when the board is reachable.
          </aside>
        ) : null}

      </main>
    </div>
  );
}

export default App;
