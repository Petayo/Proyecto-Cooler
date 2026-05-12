import { useEffect, useState } from 'react';
import { APP_CONFIG, buildCapturesUrl } from '../config/appConfig';

export const useCapturesPolling = () => {
  const [captures, setCaptures] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchCaptures = async () => {
      try {
        const response = await fetch(`${buildCapturesUrl()}?limit=20`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Edge endpoint returned ${response.status}`);
        }

        const payload = await response.json();
        const list = Array.isArray(payload.captures) ? payload.captures : [];

        if (active) {
          setCaptures(list);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || 'Unable to reach edge endpoint');
        }
      }
    };

    fetchCaptures();
    const interval = setInterval(fetchCaptures, APP_CONFIG.pollingIntervalMs);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { captures, error };
};
