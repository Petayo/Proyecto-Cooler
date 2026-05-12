import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG, buildDemographicsUrl } from '../config/appConfig';
import { normalizeDemographicsPayload } from '../utils/normalizeDemographics';

const buildEventFingerprint = (event) =>
  [
    event.timestamp.toISOString(),
    event.gender,
    event.ageGroup,
    event.genderConfidence ?? 'na',
    event.ageConfidence ?? 'na',
  ].join('|');

export const useDemographicsPolling = () => {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSuccessAt, setLastSuccessAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  const seenFingerprints = useRef(new Set());

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

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

        if (!active) {
          return;
        }

        setEvents((previous) => {
          const fresh = [];

          for (const event of normalized) {
            const fingerprint = buildEventFingerprint(event);
            if (seenFingerprints.current.has(fingerprint)) {
              continue;
            }

            seenFingerprints.current.add(fingerprint);
            fresh.push(event);
          }

          if (!fresh.length) {
            return previous;
          }

          const next = [...previous, ...fresh].slice(-APP_CONFIG.maxDemographicEvents);

          if (seenFingerprints.current.size > APP_CONFIG.maxDemographicEvents * 3) {
            const retained = new Set(
              next.map((event) => buildEventFingerprint(event))
            );
            seenFingerprints.current = retained;
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
        if (active) {
          setIsLoading(false);
        }
      }
    };

    fetchPredictions();
    const interval = setInterval(fetchPredictions, APP_CONFIG.pollingIntervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const isStale = (() => {
    if (!lastSuccessAt) {
      return false;
    }

    return now - lastSuccessAt.valueOf() > APP_CONFIG.staleAfterMs;
  })();

  return {
    events,
    isLoading,
    error,
    lastSuccessAt,
    isStale,
    endpointUrl: buildDemographicsUrl(),
  };
};
