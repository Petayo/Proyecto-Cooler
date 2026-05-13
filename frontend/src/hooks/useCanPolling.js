import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG, buildCanUrl } from '../config/appConfig';
import { loadCanEvents, saveCanEvents } from '../utils/storage';
import { generateMockCanEvents } from '../utils/mockData';

// Window size for smoothing counts and detecting in/out changes.
const WINDOW_MS = 3000;

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

  const windowStartRef = useRef(null);
  const windowSumsRef = useRef({});
  const windowFramesRef = useRef(0);
  const windowLastImageRef = useRef(null);
  const windowLastTimeRef = useRef(null);
  const prevWindowAvgRef = useRef(null);
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

    const accumulateCounts = (target, counts) => {
      for (const [label, count] of Object.entries(counts)) {
        target[label] = (target[label] || 0) + count;
      }
    };

    const finalizeWindow = () => {
      const frames = windowFramesRef.current;
      if (!frames) return [];

      const avgCounts = {};
      for (const [label, sum] of Object.entries(windowSumsRef.current)) {
        avgCounts[label] = Math.round(sum / frames);
      }

      const previous = prevWindowAvgRef.current;
      prevWindowAvgRef.current = avgCounts;

      if (!previous) return [];

      const allLabels = new Set([
        ...Object.keys(previous),
        ...Object.keys(avgCounts),
      ]);
      const newEvents = [];
      const imageUrl = windowLastImageRef.current;
      const eventTime = windowLastTimeRef.current || new Date();

      for (const label of allLabels) {
        const prevCount = previous[label] ?? 0;
        const currCount = avgCounts[label] ?? 0;
        const delta = currCount - prevCount;
        if (!delta) continue;

        const action = delta > 0 ? 'IN' : 'OUT';
        for (let i = 0; i < Math.abs(delta); i++) {
          newEvents.push({
            id: `cnt-${eventTime.valueOf()}-${label}-${i}-${Math.random()
              .toString(36)
              .slice(2, 6)}`,
            timestamp: new Date(eventTime),
            label,
            confidence: null,
            action,
            imageUrl,
          });
        }
      }

      return newEvents;
    };

    const processFrame = (frame) => {
      const frameCounts = countLabelsInFrame(frame);
      const frameTime = new Date(frame.timestamp || Date.now());
      if (Number.isNaN(frameTime.valueOf())) {
        return [];
      }

      if (windowStartRef.current === null) {
        windowStartRef.current = frameTime;
        windowSumsRef.current = { ...frameCounts };
        windowFramesRef.current = 1;
        windowLastImageRef.current =
          typeof frame.image_url === 'string' ? frame.image_url : null;
        windowLastTimeRef.current = frameTime;
        return [];
      }

      const elapsed = frameTime.valueOf() - windowStartRef.current.valueOf();
      if (elapsed < WINDOW_MS) {
        accumulateCounts(windowSumsRef.current, frameCounts);
        windowFramesRef.current += 1;
        windowLastImageRef.current =
          typeof frame.image_url === 'string' ? frame.image_url : null;
        windowLastTimeRef.current = frameTime;
        return [];
      }

      const newEvents = finalizeWindow();

      windowStartRef.current = frameTime;
      windowSumsRef.current = { ...frameCounts };
      windowFramesRef.current = 1;
      windowLastImageRef.current =
        typeof frame.image_url === 'string' ? frame.image_url : null;
      windowLastTimeRef.current = frameTime;

      return newEvents;
    };

    const parseFrameTime = (frame) => {
      const time = new Date(frame?.timestamp);
      return Number.isNaN(time.valueOf()) ? null : time;
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
          const ordered = [...frames].sort((a, b) => {
            const aTime = parseFrameTime(a);
            const bTime = parseFrameTime(b);
            if (!aTime && !bTime) return 0;
            if (!aTime) return 1;
            if (!bTime) return -1;
            return aTime - bTime;
          });

          const freshEvents = [];
          for (const frame of ordered) {
            const frameTime = parseFrameTime(frame);
            if (!frameTime) continue;

            const frameKey = frameTime.toISOString();
            if (lastFrameTsRef.current && frameKey <= lastFrameTsRef.current) {
              continue;
            }

            const newEvents = processFrame(frame);
            if (newEvents.length > 0) {
              freshEvents.push(...newEvents);
            }

            lastFrameTsRef.current = frameKey;
          }

          if (freshEvents.length > 0) {
            setEvents((prev) =>
              [...prev, ...freshEvents].slice(-APP_CONFIG.maxCanEvents)
            );
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
