import { useState, useEffect, useCallback } from 'react';
import { fetchHealth } from '../services/api';

export function useHealth(pollIntervalMs = 10000) {
  const [health, setHealth] = useState({
    status: 'checking',
    services: {
      chromadb: 'checking',
      neo4j: 'checking',
      llm_api: 'checking',
    },
  });
  const [lastChecked, setLastChecked] = useState(null);
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
      setLastChecked(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
      setHealth((prev) => ({
        ...prev,
        status: 'degraded',
        services: {
          chromadb: 'unknown',
          neo4j: 'unknown',
          llm_api: 'unknown',
        },
      }));
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, pollIntervalMs);
    return () => clearInterval(interval);
  }, [check, pollIntervalMs]);

  return { health, lastChecked, error, refetch: check };
}
