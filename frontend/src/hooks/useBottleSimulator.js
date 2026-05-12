import { useCallback, useMemo, useState } from 'react';
import { APP_CONFIG } from '../config/appConfig';
import { deriveBottleMetrics, generateBottleEvent } from '../utils/analytics';

export const useBottleSimulator = () => {
  const [events, setEvents] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);

  const appendEvent = useCallback(() => {
    setEvents((previous) => [...previous, generateBottleEvent()].slice(-APP_CONFIG.maxCanEvents));
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
    setIsRunning(false);
  }, []);

  const metrics = useMemo(() => deriveBottleMetrics(events), [events]);

  return {
    events,
    metrics,
    isRunning,
    start,
    stop,
    clear,
    appendEvent,
  };
};
