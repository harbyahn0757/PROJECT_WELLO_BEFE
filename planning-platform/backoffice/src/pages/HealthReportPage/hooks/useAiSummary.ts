import { useState, useEffect, useCallback } from 'react';
import { fetchAiSummary, generateAiSummary, AiSummaryResponse } from './useMediarcApi';

export interface UseAiSummaryResult {
  summary: string | null;
  generatedAt: string | null;
  model: string | null;
  stale: boolean;
  loading: boolean;
  error: string | null;
  generate: () => Promise<void>;    // 신규 생성 (force=false)
  regenerate: () => Promise<void>;  // 강제 재생성 (force=true)
}

export default function useAiSummary(uuid: string, hospitalId?: string): UseAiSummaryResult {
  const [data, setData] = useState<AiSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 초기 GET — 캐시된 요약 조회
  useEffect(() => {
    if (!uuid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAiSummary(uuid, hospitalId)
      .then(res => { if (!cancelled) setData(res); })
      .catch(e => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uuid, hospitalId]);

  const run = useCallback(async (force: boolean) => {
    if (!uuid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateAiSummary(uuid, hospitalId, force);
      setData(res);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [uuid, hospitalId]);

  return {
    summary: data?.summary ?? null,
    generatedAt: data?.generated_at ?? null,
    model: data?.model ?? null,
    stale: !!data?.stale,
    loading,
    error,
    generate: () => run(false),
    regenerate: () => run(true),
  };
}
