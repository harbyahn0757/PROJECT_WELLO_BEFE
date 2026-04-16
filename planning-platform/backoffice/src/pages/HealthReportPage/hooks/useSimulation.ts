/**
 * useSimulation — Phase 3-B/3-C 마일스톤 시나리오 시뮬레이션 hook
 * POST /partner-office/mediarc-report/{uuid}/simulate
 * AbortController 필수: 슬라이더 drag 중 이전 요청 취소 (race condition 방지)
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { getApiBase, fetchWithAuth } from '../../../utils/api';

export interface SimulationInput {
  bmi_target?: number;
  weight_delta_kg?: number;
  smoking_target?: 'quit';
  drinking_target?: 'none';
  time_horizon_months?: 0 | 6 | 12 | 60;
}

export interface SimulationResult {
  input: SimulationInput;
  input_digest: string;
  labels: { bmi?: string; smoking?: string; drinking?: string; time?: string };
  improved_sbp: number;
  improved_dbp: number;
  improved_fbg: number;
  ratios: Record<string, number>;
  five_year_improved: Record<string, number[]>;
  will_rogers: Record<string, {
    orig_ratio: number;
    improved_ratio: number;
    orig_rank: number;
    improved_rank: number;
    rank_change: number;
    arr_pct: number;
    cohort_fixed: boolean;
  }>;
  applied_attenuation: Record<string, number>;
  has_improvement: boolean;
  cached: boolean;
  generated_at: string;
  engine_version: string;
}

export function useSimulation(uuid: string, hospitalId?: string) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const call = useCallback(async (input: SimulationInput) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    try {
      const qs = hospitalId ? `?hospital_id=${encodeURIComponent(hospitalId)}` : '';
      const r = await fetchWithAuth(
        `${getApiBase()}/partner-office/mediarc-report/${uuid}/simulate${qs}`,
        {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
        },
      );
      if (!r.ok) throw new Error(`simulate 실패 (HTTP ${r.status})`);
      const data = (await r.json()) as SimulationResult;
      if (!ctrl.signal.aborted) setResult(data);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e as Error);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, [uuid, hospitalId]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { call, result, loading, error, reset };
}
