import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG, buildCanUrl } from '../config/appConfig';
import { loadCanEvents, saveCanEvents } from '../utils/storage';
import { generateMockCanEvents } from '../utils/mockData';

// How many consecutive frames with the same new count before we confirm a change.
// Filters out CV flicker where a can is briefly mis-detected.
const DEBOUNCE_FRAMES = 3;

const initEvents = () => {
  const stored = loadCanEvents();
  if (stored && stored.length > 0) return stored;
  return generateMockCanEvents();
};

const countLabelsInFrame = (frame) => {
  const counts = {};
  for (const det of Array.isArray(frame.detections) ? frame.detections : []) {
    const label = typeof det.label === 'string' ? det.label.trim() : null;
    if (label) counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
};

export const useCanPolling = () => {
  const [events, setEvents] = useState(initEvents);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSuccessAt, setLastSuccessAt] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Per-label stable count — null until we see the first frame
  const stableCountsRef = useRef(null);
  // Per-label pending candidate: { count, frames }
  const pendingRef = useRef({});
  // Timestamp string of the last frame we processed (avoid re-processing same frame)
  const lastFrameTsRef = useRef(null);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    saveCanEvents(events);
  }, [events]);

  useEffect(() => {
    let active = true;

    const processFrame = (frame) => {
      const frameCounts = countLabelsInFrame(frame);

      // First frame ever — establish baseline, emit nothing
      if (stableCountsRef.current === null) {
        stableCountsRef.current = { ...frameCounts };
        return [];
      }

      const stable = stableCountsRef.current;
      const allLabels = new Set([
        ...Object.keys(stable),
        ...Object.keys(frameCounts),
      ]);
      const newEvents = [];

      for (const label of allLabels) {
        const stableCount = stable[label] ?? 0;
        const frameCount = frameCounts[label] ?? 0;

        if (frameCount === stableCount) {
          // Back to stable — cancel any pending change for this label
          delete pendingRef.current[label];
          continue;
        }

        const pending = pendingRef.current[label];

        if (pending && pending.count === frameCount) {
          // Same candidate as before — increment confidence counter
          pending.frames += 1;

          if (pending.frames >= DEBOUNCE_FRAMES) {
            // Change confirmed — emit one event per unit of delta
            const delta = frameCount - stableCount;
            const action = delta > 0 ? 'IN' : 'OUT';
            const imageUrl =
              typeof frame.image_url === 'string' ? frame.image_url : null;

            for (let i = 0; i < Math.abs(delta); i++) {
              newEvents.push({
                id: `cnt-${Date.now()}-${label}-${i}-${Math.random()
                  .toString(36)
                  .slice(2, 6)}`,
                timestamp: new Date(),
                label,
                confidence: null,
                action,
                imageUrl,
              });
            }

            stable[label] = frameCount;
            delete pendingRef.current[label];
          }
        } else {
          // New candidate (or candidate changed mid-debounce) — start over
          pendingRef.current[label] = { count: frameCount, frames: 1 };
        }
      }

      return newEvents;
    };

    const fetchPredictions = async () => {
      try {
        const response = await fetch(buildCanUrl(), {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Edge endpoint returned ${response.status}`);
        }

        const payload = await response.json();
        const frames = Array.isArray(payload.events) ? payload.events : [];

        if (!active) return;

        if (frames.length > 0) {
          // Only care about the most recent frame
          const latest = frames.reduce((best, f) =>
            new Date(f.timestamp) > new Date(best.timestamp) ? f : best
          );

          // Skip if we already processed this exact frame
          if (latest.timestamp !== lastFrameTsRef.current) {
            lastFrameTsRef.current = latest.timestamp;
            const newEvents = processFrame(latest);

            if (newEvents.length > 0) {
              setEvents((prev) =>
                [...prev, ...newEvents].slice(-APP_CONFIG.maxCanEvents)
              );
            }
          }
        }

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
    endpointUrl: buildCanUrl(),
  };
};
