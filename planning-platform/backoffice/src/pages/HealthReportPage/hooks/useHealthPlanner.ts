/**
 * useHealthPlanner — 클라이언트 사이드 경량 계산 훅 (Phase 3)
 * ratio_table 기반으로 서버 호출 없이 즉시 delta 계산.
 * ratio_table 없을 때는 null 반환 (하위 호환).
 */
import { useState, useMemo, useCallback } from 'react';
import type { ReportData } from './useMediarcApi';

// ── 타입 ──

export interface RatioTableDeltas {
  bmi_per_unit: {
    sbp: number;
    dbp: number;
    fbg_threshold: number;
    disease_factors: Record<string, number>;
  };
  quit_smoking: { disease_factors: Record<string, number> };
  quit_drinking: { sbp: number; dbp: number; disease_factors: Record<string, number> };
  exercise_moderate: { sbp: number; dbp: number; disease_factors: Record<string, number> };
  exercise_daily: { sbp: number; dbp: number; disease_factors: Record<string, number> };
  diet_low_sodium: { sbp: number; dbp: number; disease_factors: Record<string, number> };
}

export interface RatioTableBase {
  bodyage: number;
  age: number;
  bmi: number;
  sbp: number;
  dbp: number;
  fbg: number;
  disease_ratios: Record<string, number>;
}

export interface RatioTable {
  base: RatioTableBase;
  deltas: RatioTableDeltas;
  attenuation: Record<string, Record<string, Record<number, number>>>;
}

export interface PlannerSettings {
  bmiTarget: number | null;
  smokingTarget: 'quit' | null;
  drinkingTarget: 'none' | null;
  exerciseTarget: number | null;   // 주간 횟수 (0/1.5/3.5/7)
  dietTarget: string | null;       // 'high_sodium' | 'moderate' | 'low_sodium'
  timeHorizonMonths: 0 | 6 | 12 | 60;
}

export interface ComputedResult {
  bodyage: number;
  bodyageDelta: number;
  sbp: number;
  sbpDelta: number;
  dbp: number;
  dbpDelta: number;
  fbg: number;
  diseaseRatios: Record<string, number>;
  overallImprovement: number;  // % (0이면 변화 없음)
  hasImprovement: boolean;
}

export interface UseHealthPlannerReturn {
  baseResult: RatioTableBase | null;
  currentSettings: PlannerSettings;
  computedResult: ComputedResult | null;
  setBmiTarget: (bmi: number | null) => void;
  setSmokingTarget: (t: 'quit' | null) => void;
  setDrinkingTarget: (t: 'none' | null) => void;
  setExerciseTarget: (weekly: number | null) => void;
  setDietTarget: (t: string | null) => void;
  setTimeHorizon: (m: 0 | 6 | 12 | 60) => void;
  resetAll: () => void;
}

// ── 폴백 ratio_table (ratio_table API가 없을 때 BE 하드코딩 계수 사용) ──

function buildFallbackRatioTable(data: ReportData): RatioTable | null {
  const p = data.patient_info;
  if (!p?.bmi) return null;
  const sbp = (data as any).gauges?.all?.['sbp']?.value ?? 130;
  const dbp = (data as any).gauges?.all?.['dbp']?.value ?? 85;
  const fbg = (data as any).gauges?.all?.['fbg']?.value ?? 100;
  const disease_ratios: Record<string, number> = {};
  for (const [k, v] of Object.entries(data.diseases ?? {})) {
    if (typeof (v as any).ratio === 'number') disease_ratios[k] = (v as any).ratio;
  }
  return {
    base: {
      bodyage: data.bodyage?.bodyage ?? (p as any).age ?? 50,
      age: data.age ?? 50,
      bmi: p.bmi,
      sbp,
      dbp,
      fbg,
      disease_ratios,
    },
    deltas: {
      bmi_per_unit: { sbp: 1.5, dbp: 0.8, fbg_threshold: 2, disease_factors: {} },
      quit_smoking: { disease_factors: { lung_cancer: -0.5, cardiovascular: -0.25, stroke: -0.2 } },
      quit_drinking: { sbp: 4.0, dbp: 3.0, disease_factors: { liver: -0.3, cardiovascular: -0.1 } },
      exercise_moderate: { sbp: 5.0, dbp: 3.0, disease_factors: { cardiovascular: -0.1, diabetes: -0.1 } },
      exercise_daily: { sbp: 8.0, dbp: 5.0, disease_factors: { cardiovascular: -0.15, diabetes: -0.15 } },
      diet_low_sodium: { sbp: 5.0, dbp: 2.5, disease_factors: { hypertension: -0.1, cardiovascular: -0.05 } },
    },
    attenuation: {},
  };
}

// ── 클라이언트 계산 함수 ──

function computeLocal(
  base: RatioTableBase,
  deltas: RatioTableDeltas,
  attenuation: Record<string, Record<string, Record<number, number>>>,
  settings: PlannerSettings,
): ComputedResult {
  let sbpDelta = 0;
  let dbpDelta = 0;
  const diseaseFactors: Record<string, number[]> = {};

  const addDiseaseFactor = (factors: Record<string, number>) => {
    for (const [k, v] of Object.entries(factors)) {
      if (!diseaseFactors[k]) diseaseFactors[k] = [];
      diseaseFactors[k].push(v);
    }
  };

  // 1. BMI 변화
  if (settings.bmiTarget !== null && settings.bmiTarget < base.bmi) {
    const bmiDiff = base.bmi - settings.bmiTarget;
    sbpDelta -= bmiDiff * deltas.bmi_per_unit.sbp;
    dbpDelta -= bmiDiff * deltas.bmi_per_unit.dbp;
    addDiseaseFactor(
      Object.fromEntries(
        Object.entries(deltas.bmi_per_unit.disease_factors).map(([k, v]) => [k, -bmiDiff * v]),
      ),
    );
  }

  // 2. 금연
  if (settings.smokingTarget === 'quit') {
    addDiseaseFactor(deltas.quit_smoking.disease_factors);
  }

  // 3. 금주
  if (settings.drinkingTarget === 'none') {
    sbpDelta -= deltas.quit_drinking.sbp;
    dbpDelta -= deltas.quit_drinking.dbp;
    addDiseaseFactor(deltas.quit_drinking.disease_factors);
  }

  // 4. 운동 (주간 횟수 기준)
  if (settings.exerciseTarget !== null) {
    if (settings.exerciseTarget >= 5) {
      sbpDelta -= deltas.exercise_daily.sbp;
      dbpDelta -= deltas.exercise_daily.dbp;
      addDiseaseFactor(deltas.exercise_daily.disease_factors);
    } else if (settings.exerciseTarget >= 3) {
      sbpDelta -= deltas.exercise_moderate.sbp;
      dbpDelta -= deltas.exercise_moderate.dbp;
      addDiseaseFactor(deltas.exercise_moderate.disease_factors);
    }
  }

  // 5. 식습관 (저나트륨)
  if (settings.dietTarget === 'low_sodium') {
    sbpDelta -= deltas.diet_low_sodium.sbp;
    dbpDelta -= deltas.diet_low_sodium.dbp;
    addDiseaseFactor(deltas.diet_low_sodium.disease_factors);
  }

  // 6. 시간축 감쇠 적용
  const t = settings.timeHorizonMonths;
  const alphaAvg = t > 0 ? 0.85 : 1.0;  // ratio_table 감쇠 없으면 기본 85%
  const attApply = (factor: number, disease: string) => {
    const a = attenuation?.[disease]?.['bmi']?.[t] ?? alphaAvg;
    return factor * a;
  };

  // 질환별 ratio 계산
  const diseaseRatios: Record<string, number> = {};
  for (const [k, base_ratio] of Object.entries(base.disease_ratios)) {
    const factors = diseaseFactors[k] ?? [];
    const totalDelta = factors.reduce((acc, f) => acc + attApply(f, k), 0);
    diseaseRatios[k] = Math.max(0.5, base_ratio + totalDelta);
  }

  // 건강나이 delta 근사 (SBP -5당 -0.5세, DBP -3당 -0.3세, BMI -1당 -0.3세)
  const bmiContrib = settings.bmiTarget !== null ? (base.bmi - settings.bmiTarget) * 0.3 : 0;
  const bodyageDelta = -(Math.abs(sbpDelta) * 0.1 + Math.abs(dbpDelta) * 0.1 + bmiContrib);

  // 종합 개선률 (disease ratios 평균 변화)
  const ratioKeys = Object.keys(base.disease_ratios);
  const overallImprovement =
    ratioKeys.length > 0
      ? ratioKeys.reduce((acc, k) => {
          const d = base.disease_ratios[k] - (diseaseRatios[k] ?? base.disease_ratios[k]);
          return acc + d / base.disease_ratios[k];
        }, 0) /
        ratioKeys.length *
        100
      : 0;

  // fbg 간이 계산 (BMI 2이상 감소 시 5% 개선)
  const bmiDiffForFbg = settings.bmiTarget !== null ? base.bmi - settings.bmiTarget : 0;
  const fbgMult = bmiDiffForFbg >= deltas.bmi_per_unit.fbg_threshold ? 0.95 : 1.0;

  return {
    bodyage: base.bodyage + bodyageDelta,
    bodyageDelta,
    sbp: base.sbp + sbpDelta,
    sbpDelta,
    dbp: base.dbp + dbpDelta,
    dbpDelta,
    fbg: base.fbg * fbgMult,
    diseaseRatios,
    overallImprovement: parseFloat(overallImprovement.toFixed(1)),
    hasImprovement: sbpDelta < -0.1 || dbpDelta < -0.1 || bodyageDelta < -0.1,
  };
}

// ── 훅 ──

export function useHealthPlanner(data: ReportData | null): UseHealthPlannerReturn {
  const ratioTable: RatioTable | null = useMemo(() => {
    if (!data) return null;
    return (data as any).ratio_table ?? buildFallbackRatioTable(data);
  }, [data]);

  const baseBmi = ratioTable?.base?.bmi ?? data?.patient_info?.bmi ?? 22;

  const [settings, setSettings] = useState<PlannerSettings>({
    bmiTarget: null,
    smokingTarget: null,
    drinkingTarget: null,
    exerciseTarget: null,
    dietTarget: null,
    timeHorizonMonths: 0,
  });

  const computedResult = useMemo((): ComputedResult | null => {
    if (!ratioTable) return null;
    return computeLocal(
      ratioTable.base,
      ratioTable.deltas,
      ratioTable.attenuation,
      settings,
    );
  }, [ratioTable, settings]);

  const setBmiTarget = useCallback((bmi: number | null) => {
    setSettings((s) => ({ ...s, bmiTarget: bmi }));
  }, []);
  const setSmokingTarget = useCallback((t: 'quit' | null) => {
    setSettings((s) => ({ ...s, smokingTarget: t }));
  }, []);
  const setDrinkingTarget = useCallback((t: 'none' | null) => {
    setSettings((s) => ({ ...s, drinkingTarget: t }));
  }, []);
  const setExerciseTarget = useCallback((weekly: number | null) => {
    setSettings((s) => ({ ...s, exerciseTarget: weekly }));
  }, []);
  const setDietTarget = useCallback((t: string | null) => {
    setSettings((s) => ({ ...s, dietTarget: t }));
  }, []);
  const setTimeHorizon = useCallback((m: 0 | 6 | 12 | 60) => {
    setSettings((s) => ({ ...s, timeHorizonMonths: m }));
  }, []);
  const resetAll = useCallback(() => {
    setSettings({
      bmiTarget: null,
      smokingTarget: null,
      drinkingTarget: null,
      exerciseTarget: null,
      dietTarget: null,
      timeHorizonMonths: 0,
    });
  }, []);

  return {
    baseResult: ratioTable?.base ?? null,
    currentSettings: { ...settings, bmiTarget: settings.bmiTarget ?? baseBmi },
    computedResult,
    setBmiTarget,
    setSmokingTarget,
    setDrinkingTarget,
    setExerciseTarget,
    setDietTarget,
    setTimeHorizon,
    resetAll,
  };
}
