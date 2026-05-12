import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG, buildDemographicsUrl } from '../config/appConfig';
import { normalizeDemographicsPayload } from '../utils/normalizeDemographics';
import { loadDemoEvents, saveDemoEvents } from '../utils/storage';
import { generateMockDemoEvents } from '../utils/mockData';

const buildEventFingerprint = (event) =>
  [
    event.timestamp.toISOString(),
    event.gender,
    event.ageGroup,
    event.genderConfidence ?? 'na',
    event.ageConfidence ?? 'na',
  ].join('|');

const initEvents = () => {
  const stored = loadDemoEvents();
  if (stored && stored.length > 0) return stored;
  return generateMockDemoEvents();
};

export const useDemographicsPolling = () => {
  const [events, setEvents] = useState(initEvents);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSuccessAt, setLastSuccessAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  const seenFingerprints = useRef(new Set());

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setEvents((current) => {
      for (const event of current) {
        seenFingerprints.current.add(buildEventFingerprint(event));
      }
      return current;
    });
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    saveDemoEvents(events);
  }, [events]);

  useEffect(() => {
    let active = true;

    const fetchPredictions = async () => {
      try {
        const response = await fetch(buildDemographicsUrl(), {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Edge endpoint returned ${response.status}`);
        }

        const payload = await response.json();
        const normalized = normalizeDemographicsPayload(payload);

        if (!active) return;

        setEvents((previous) => {
          const fresh = [];

          for (const event of normalized) {
            const fingerprint = buildEventFingerprint(event);
            if (seenFingerprints.current.has(fingerprint)) continue;
            seenFingerprints.current.add(fingerprint);
            fresh.push(event);
          }

          if (!fresh.length) return previous;

          const next = [...previous, ...fresh].slice(-APP_CONFIG.maxDemographicEvents);

          if (seenFingerprints.current.size > APP_CONFIG.maxDemographicEvents * 3) {
            seenFingerprints.current = new Set(
              next.map(buildEventFingerprint)
            );
          }

          return next;
        });

        setError(null);
        setLastSuccessAt(new Date());
      } catch (requestError) {
        if (active) {
          setError(requestError.message || 'Unable to reach edge endpoint');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchPredictions();
    const interval = setInterval(fetchPredictions, APP_CONFIG.pollingIntervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const isStale = lastSuccessAt
    ? now - lastSuccessAt.valueOf() > APP_CONFIG.staleAfterMs
    : false;

  return {
    events,
    isLoading,
    error,
    lastSuccessAt,
    isStale,
    endpointUrl: buildDemographicsUrl(),
  };
};
