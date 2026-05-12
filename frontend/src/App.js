import { useMemo } from 'react';
import { APP_CONFIG } from './config/appConfig';
import { useCanPolling } from './hooks/useCanPolling';
import { useDemographicsPolling } from './hooks/useDemographicsPolling';
import { deriveCanMetrics, deriveDemographicMetrics } from './utils/analytics';
import './App.css';

const formatTime = (date) => {
  if (!date) {
    return 'Never';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: '2-digit',
  }).format(date);
};

const formatEventTime = (date) =>
  new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);

const buildConnectionState = ({ isLoading, error, isStale }) => {
  if (isLoading) {
    return { label: 'Connecting', className: 'state-warn' };
  }

  if (error) {
    return { label: 'Offline', className: 'state-error' };
  }

  if (isStale) {
    return { label: 'Stale feed', className: 'state-warn' };
  }

  return { label: 'Live', className: 'state-ok' };
};

const collectRecentImages = (events, labelBuilder, maxItems = 6) => {
  const seen = new Set();
  const sorted = [...events].sort(
    (a, b) => b.timestamp.valueOf() - a.timestamp.valueOf()
  );

  const images = [];
  for (const event of sorted) {
    if (!event.imageUrl || seen.has(event.imageUrl)) {
      continue;
    }

    seen.add(event.imageUrl);
    images.push({
      id: event.id,
      url: event.imageUrl,
      label: labelBuilder(event),
    });

    if (images.length >= maxItems) {
      break;
    }
  }

  return images;
};

function App() {
  const {
    events: demographicEvents,
    isLoading: demoLoading,
    error: demoError,
    lastSuccessAt: demoLastSuccessAt,
    isStale: demoStale,
    endpointUrl: demoEndpointUrl,
  } = useDemographicsPolling();
  const {
    events: canEvents,
    isLoading: canLoading,
    error: canError,
    lastSuccessAt: canLastSuccessAt,
    isStale: canStale,
    endpointUrl: canEndpointUrl,
  } = useCanPolling();
  const demographicMetrics = useMemo(
    () => deriveDemographicMetrics(demographicEvents),
    [demographicEvents]
  );
  const canMetrics = useMemo(() => deriveCanMetrics(canEvents), [canEvents]);

  const demoConnection = useMemo(
    () => buildConnectionState({ isLoading: demoLoading, error: demoError, isStale: demoStale }),
    [demoLoading, demoError, demoStale]
  );
  const canConnection = useMemo(
    () => buildConnectionState({ isLoading: canLoading, error: canError, isStale: canStale }),
    [canLoading, canError, canStale]
  );

  const recentDemoImages = useMemo(
    () => collectRecentImages(demographicEvents, (event) => `${event.gender} / ${event.ageGroup}`),
    [demographicEvents]
  );
  const recentCanImages = useMemo(
    () => collectRecentImages(canEvents, (event) => event.label),
    [canEvents]
  );

  const weeklyMax = Math.max(
    1,
    ...demographicMetrics.weeklyCounts.map((item) => item.count)
  );

  return (
    <div className="app-shell">
      <div className="ambient-bg" aria-hidden="true" />
      <main className="dashboard" aria-label="Smart cooler analytics dashboard">
        <header className="hero-card panel">
          <div>
            <p className="eyebrow">Smart Cooler Intelligence</p>
            <h1>Retail Restock Command</h1>
            <p className="muted">
              Live demographics and can detections from both cameras, with captured
              frames surfaced for fast inventory decisions.
            </p>
          </div>
          <div className="status-cluster">
            <div className="status-row">
              <span className={`status-pill ${demoConnection.className}`}>
                Demographics: {demoConnection.label}
              </span>
              <span className={`status-pill ${canConnection.className}`}>
                Can model: {canConnection.label}
              </span>
            </div>
            <div className="meta-list">
              <p>
                <strong>Demographics API</strong>
                <span>{demoEndpointUrl}</span>
              </p>
              <p>
                <strong>Can API</strong>
                <span>{canEndpointUrl}</span>
              </p>
              <p>
                <strong>Polling</strong>
                <span>{APP_CONFIG.pollingIntervalMs} ms</span>
              </p>
              <p>
                <strong>Last demographics</strong>
                <span>{formatTime(demoLastSuccessAt)}</span>
              </p>
              <p>
                <strong>Last can event</strong>
                <span>{formatTime(canLastSuccessAt)}</span>
              </p>
            </div>
          </div>
        </header>

        <section className="kpi-grid" aria-label="Key metrics">
          <article className="panel kpi-card">
            <p>Detections today</p>
            <h2>{demographicMetrics.totalToday}</h2>
          </article>
          <article className="panel kpi-card">
            <p>Detections this week</p>
            <h2>{demographicMetrics.totalWeek}</h2>
          </article>
          <article className="panel kpi-card">
            <p>Peak hour today</p>
            <h2>{demographicMetrics.peakHour}</h2>
          </article>
          <article className="panel kpi-card">
            <p>Top can label</p>
            <h2>{canMetrics.topLabel}</h2>
          </article>
        </section>

        <section className="content-grid">
          <article className="panel section-card">
            <h3>Demographic split</h3>
            <div className="bar-row">
              <span>Male</span>
              <div className="bar-track">
                <div
                  className="bar-fill male"
                  style={{ width: `${demographicMetrics.malePct}%` }}
                />
              </div>
              <strong>{demographicMetrics.malePct}%</strong>
            </div>
            <div className="bar-row">
              <span>Female</span>
              <div className="bar-track">
                <div
                  className="bar-fill female"
                  style={{ width: `${demographicMetrics.femalePct}%` }}
                />
              </div>
              <strong>{demographicMetrics.femalePct}%</strong>
            </div>
            <div className="bar-row">
              <span>Unknown</span>
              <div className="bar-track">
                <div
                  className="bar-fill unknown"
                  style={{ width: `${demographicMetrics.unknownPct}%` }}
                />
              </div>
              <strong>{demographicMetrics.unknownPct}%</strong>
            </div>

            <h4>Age groups</h4>
            <div className="age-list">
              {demographicMetrics.ageDistribution.length ? (
                demographicMetrics.ageDistribution.map((group) => (
                  <p key={group.label}>
                    <span>{group.label}</span>
                    <span>
                      {group.count} ({group.pct}%)
                    </span>
                  </p>
                ))
              ) : (
                <p className="empty-text">No detections yet.</p>
              )}
            </div>
          </article>

          <article className="panel section-card">
            <h3>Weekly traffic pattern</h3>
            <div className="weekly-bars" role="img" aria-label="Weekly detections">
              {demographicMetrics.weeklyCounts.map((day) => (
                <div className="day-column" key={`${day.label}-${day.date.toISOString()}`}>
                  <div
                    className="day-bar"
                    style={{ height: `${(day.count / weeklyMax) * 100}%` }}
                    title={`${day.count} detections`}
                  />
                  <span>{day.label}</span>
                </div>
              ))}
            </div>

            <h4>Recent demographics events</h4>
            <ul className="event-list">
              {demographicMetrics.recentEvents.length ? (
                demographicMetrics.recentEvents.map((event) => (
                  <li key={event.id}>
                    <span>{formatEventTime(event.timestamp)}</span>
                    <span>
                      {event.gender} / {event.ageGroup}
                    </span>
                  </li>
                ))
              ) : (
                <li className="empty-text">Waiting for predictions...</li>
              )}
            </ul>
          </article>

          <article className="panel section-card can-panel">
            <h3>Can detections</h3>
            <div className="sim-stats">
              <p>
                <strong>Detections today</strong>
                <span>{canMetrics.totalToday}</span>
              </p>
              <p>
                <strong>Detections this week</strong>
                <span>{canMetrics.totalWeek}</span>
              </p>
              <p>
                <strong>Top label</strong>
                <span>{canMetrics.topLabel}</span>
              </p>
            </div>
            <div className="age-list">
              {Object.keys(canMetrics.labelCounts).length ? (
                Object.entries(canMetrics.labelCounts).map(([label, count]) => (
                  <p key={label}>
                    <span>{label}</span>
                    <span>{count}</span>
                  </p>
                ))
              ) : (
                <p className="empty-text">No detections yet.</p>
              )}
            </div>
            <h4>Recent can events</h4>
            <ul className="event-list">
              {canMetrics.recentEvents.length ? (
                canMetrics.recentEvents.map((event) => (
                  <li key={event.id}>
                    <span>{formatEventTime(event.timestamp)}</span>
                    <span>
                      {event.label}
                      {event.confidence ? ` (${event.confidence.toFixed(1)}%)` : ''}
                    </span>
                  </li>
                ))
              ) : (
                <li className="empty-text">Waiting for can detections...</li>
              )}
            </ul>
          </article>
        </section>

        <section className="capture-grid" aria-label="Recent captures">
          <article className="panel section-card">
            <h3>Recent demographics captures</h3>
            <div className="image-grid">
              {recentDemoImages.length ? (
                recentDemoImages.map((item) => (
                  <figure className="image-card" key={item.id}>
                    <img src={item.url} alt={item.label} loading="lazy" />
                    <figcaption>{item.label}</figcaption>
                  </figure>
                ))
              ) : (
                <p className="empty-text">No captures yet.</p>
              )}
            </div>
          </article>
          <article className="panel section-card">
            <h3>Recent can captures</h3>
            <div className="image-grid">
              {recentCanImages.length ? (
                recentCanImages.map((item) => (
                  <figure className="image-card" key={item.id}>
                    <img src={item.url} alt={item.label} loading="lazy" />
                    <figcaption>{item.label}</figcaption>
                  </figure>
                ))
              ) : (
                <p className="empty-text">No captures yet.</p>
              )}
            </div>
          </article>
        </section>

        {demoError || canError ? (
          <aside className="panel warning-panel" role="status">
            Edge connection failed: {demoError || canError}. Keep the board reachable
            and confirm CORS allows this frontend origin.
          </aside>
        ) : null}
      </main>
    </div>
  );
}

export default App;
