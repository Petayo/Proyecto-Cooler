import { useEffect, useMemo } from 'react';
import { APP_CONFIG } from './config/appConfig';
import { useBottleSimulator } from './hooks/useBottleSimulator';
import { useDemographicsPolling } from './hooks/useDemographicsPolling';
import { deriveDemographicMetrics } from './utils/analytics';
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

function App() {
  const { events, isLoading, error, lastSuccessAt, isStale, endpointUrl } =
    useDemographicsPolling();
  const bottle = useBottleSimulator();
  const { isRunning, appendEvent } = bottle;

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const interval = setInterval(() => {
      appendEvent();
    }, 2100);

    return () => clearInterval(interval);
  }, [appendEvent, isRunning]);

  const demographicMetrics = useMemo(() => deriveDemographicMetrics(events), [events]);

  const connectionState = useMemo(() => {
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
  }, [error, isLoading, isStale]);

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
              Live demographics from the outside camera, plus simulated bottle traffic
              while inventory detection model integration is pending.
            </p>
          </div>
          <div className="status-cluster">
            <span className={`status-pill ${connectionState.className}`}>
              {connectionState.label}
            </span>
            <div className="meta-list">
              <p>
                <strong>Endpoint</strong>
                <span>{endpointUrl}</span>
              </p>
              <p>
                <strong>Polling</strong>
                <span>{APP_CONFIG.pollingIntervalMs} ms</span>
              </p>
              <p>
                <strong>Last update</strong>
                <span>{formatTime(lastSuccessAt)}</span>
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
            <p>Top simulated demand</p>
            <h2>{bottle.metrics.topDemand}</h2>
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

          <article className="panel section-card bottle-panel">
            <h3>Bottle model placeholder</h3>
            <p className="muted">
              Model not ready yet. Use simulator to test downstream restock analytics.
            </p>
            <div className="sim-controls">
              {bottle.isRunning ? (
                <button type="button" onClick={bottle.stop} className="btn secondary">
                  Pause simulator
                </button>
              ) : (
                <button type="button" onClick={bottle.start} className="btn primary">
                  Start simulator
                </button>
              )}
              <button type="button" onClick={bottle.appendEvent} className="btn ghost">
                Add single event
              </button>
              <button type="button" onClick={bottle.clear} className="btn ghost">
                Clear
              </button>
            </div>

            <div className="sim-stats">
              <p>
                <strong>OUT today</strong>
                <span>{bottle.metrics.outToday}</span>
              </p>
              <p>
                <strong>IN today</strong>
                <span>{bottle.metrics.inToday}</span>
              </p>
              <p>
                <strong>Net OUT</strong>
                <span>{bottle.metrics.netOutToday}</span>
              </p>
            </div>

            <ul className="event-list bottle-events">
              {bottle.metrics.recentEvents.length ? (
                bottle.metrics.recentEvents.map((event) => (
                  <li key={event.id}>
                    <span>{formatEventTime(event.timestamp)}</span>
                    <span>
                      {event.product} {event.action}
                    </span>
                  </li>
                ))
              ) : (
                <li className="empty-text">No simulated bottle events yet.</li>
              )}
            </ul>
          </article>
        </section>

        {error ? (
          <aside className="panel warning-panel" role="status">
            Edge connection failed: {error}. Keep the board reachable and confirm CORS
            allows this frontend origin.
          </aside>
        ) : null}
      </main>
    </div>
  );
}

export default App;
