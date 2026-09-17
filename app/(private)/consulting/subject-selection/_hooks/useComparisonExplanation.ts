'use client';

import { useEffect, useRef, useState } from 'react';

import {
  type ComparisonRequest,
  type ComparisonResponse,
  validateComparisonResponse,
} from '@/features/subject-selection/comparison';

export function useComparisonExplanation() {
  const [result, setResult] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const cache = useRef(new Map<string, ComparisonResponse>());
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  function reset() {
    controller.current?.abort();
    controller.current = null;
    setResult(null);
    setError('');
    setLoading(false);
  }

  async function explain(payload: ComparisonRequest) {
    reset();
    const key = JSON.stringify(payload);
    const cached = cache.current.get(key);
    if (cached) {
      setResult(cached);
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setLoading(true);
    try {
      const response = await fetch(
        '/api/consulting/subject-selection/compare',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: key,
          signal: active.signal,
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'AI 설명을 가져오지 못했어요.');
      const parsed = validateComparisonResponse(data, payload);
      if (controller.current !== active) return;
      if (cache.current.size >= 20)
        cache.current.delete(cache.current.keys().next().value!);
      cache.current.set(key, parsed);
      setResult(parsed);
    } catch (error) {
      if (controller.current === active && !active.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : 'AI 설명을 가져오지 못했어요.',
        );
    } finally {
      if (controller.current === active) setLoading(false);
    }
  }
  return { result, loading, error, explain, reset };
}
