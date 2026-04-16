/**
 * MilestoneSlot — Phase 3-B Action 섹션 전면 재작성
 * - 5개 BMI 마일스톤 카드 (현재 / -2kg / -5kg / -10kg / 정상 BMI 22.9)
 * - BmiSlider: 자유 BMI 목표 입력 (debounce 300ms)
 * - useSimulation hook 으로 각 카드 초기 로드 + 슬라이더 실시간 계산
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSimulation, SimulationResult } from '../hooks/useSimulation';
import MilestoneCard from './MilestoneCard';
import BmiSlider from './BmiSlider';

type CardState = 'idle' | 'loading' | 'ok' | 'error';
type MilestoneKey = 'current' | 'minus2' | 'minus5' | 'minus10' | 'normal';

interface MilestoneAnchor {
  key: MilestoneKey;
  label: string;
  bmi: number;
  weightDeltaKg?: number;
}

function buildAnchors(baseBmi: number, baseWeight: number | null, baseHeight: number | null): MilestoneAnchor[] {
  // bmi_target 계산: weight_delta_kg 있으면 BE가 역산하므로 FE는 근사값만 표시
  const calcBmi = (deltaKg: number): number => {
    if (baseWeight && baseHeight && baseHeight > 0) {
      const newW = Math.max(baseWeight - deltaKg, 30);
      return parseFloat((newW / (baseHeight / 100) ** 2).toFixed(1));
    }
    // height/weight 없으면 근사: bmi 직접 감소 추정 (kg/m^2 단위로 deltaKg/height^2)
    return parseFloat(Math.max(baseBmi - deltaKg / 7, 15).toFixed(1));
  };

  return [
    { key: 'current', label: '현재', bmi: baseBmi },
    { key: 'minus2',  label: '-2 kg',  bmi: calcBmi(2),  weightDeltaKg: 2 },
    { key: 'minus5',  label: '-5 kg',  bmi: calcBmi(5),  weightDeltaKg: 5 },
    { key: 'minus10', label: '-10 kg', bmi: calcBmi(10), weightDeltaKg: 10 },
    { key: 'normal',  label: '정상 BMI', bmi: 22.9 },
  ];
}

interface MilestoneSlotProps {
  patientUuid: string;
  hospitalId: number | null;
  baseBmi: number;
  baseWeight?: number | null;
  baseHeight?: number | null;
  timeHorizonMonths: 0 | 6 | 12 | 60;
  embedMode?: boolean;
  onCardClick?: (key: MilestoneKey) => void;
}

export default function MilestoneSlot({
  patientUuid,
  hospitalId,
  baseBmi,
  baseWeight,
  baseHeight,
  timeHorizonMonths,
  embedMode,
  onCardClick,
}: MilestoneSlotProps) {
  const hospitalIdStr = hospitalId != null ? String(hospitalId) : undefined;

  const anchors = buildAnchors(baseBmi, baseWeight ?? null, baseHeight ?? null);

  const [cardsResult, setCardsResult] = useState<Partial<Record<MilestoneKey, SimulationResult>>>({});
  const [cardsState, setCardsState] = useState<Record<MilestoneKey, CardState>>({
    current: 'idle', minus2: 'idle', minus5: 'idle', minus10: 'idle', normal: 'idle',
  });
  const [selectedKey, setSelectedKey] = useState<MilestoneKey>('current');
  const [sliderBmi, setSliderBmi] = useState<number>(baseBmi);
  const sliderHook = useSimulation(patientUuid, hospitalIdStr);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 카드 5장 병렬 초기 로드
  useEffect(() => {
    if (!patientUuid) return;

    const load = async () => {
      const results: Partial<Record<MilestoneKey, SimulationResult>> = {};
      const states: Partial<Record<MilestoneKey, CardState>> = {};

      setCardsState((prev) => {
        const next = { ...prev };
        anchors.forEach((a) => { next[a.key] = 'loading'; });
        return next;
      });

      await Promise.all(
        anchors.map(async (anchor) => {
          const qs = hospitalIdStr ? `?hospital_id=${encodeURIComponent(hospitalIdStr)}` : '';
          const input: Record<string, unknown> = { time_horizon_months: timeHorizonMonths };
          if (anchor.key !== 'current') {
            if (anchor.weightDeltaKg != null) {
              input['weight_delta_kg'] = anchor.weightDeltaKg;
            } else {
              input['bmi_target'] = anchor.bmi;
            }
          }
          try {
            const { fetchWithAuth, getApiBase } = await import('../../../utils/api');
            const r = await fetchWithAuth(
              `${getApiBase()}/partner-office/mediarc-report/${patientUuid}/simulate${qs}`,
              {
                method: 'POST',
                body: JSON.stringify(input),
                headers: { 'Content-Type': 'application/json' },
              },
            );
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = (await r.json()) as SimulationResult;
            results[anchor.key] = data;
            states[anchor.key] = 'ok';
          } catch {
            states[anchor.key] = 'error';
          }
        }),
      );

      setCardsResult(results);
      setCardsState((prev) => ({ ...prev, ...states }));
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientUuid, hospitalIdStr, timeHorizonMonths]);

  // 슬라이더 debounce 300ms
  const handleSliderChange = useCallback((bmi: number) => {
    setSliderBmi(bmi);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      sliderHook.call({ bmi_target: bmi, time_horizon_months: timeHorizonMonths });
    }, 300);
  }, [sliderHook, timeHorizonMonths]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleCardClick = (key: MilestoneKey) => {
    setSelectedKey(key);
    onCardClick?.(key);
  };

  // 평균 ARR 계산: will_rogers의 arr_pct 평균
  const calcAvgArr = (res: SimulationResult | undefined): number | null => {
    if (!res?.will_rogers) return null;
    const vals = Object.values(res.will_rogers).map((v) => v.arr_pct);
    if (vals.length === 0) return null;
    return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
  };

  return (
    <div className="report-view__milestone-slot">
      <h4 className="report-view__slot-title">체중 감량별 건강 효과</h4>
      <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
        목표 체중에 따라 질환 위험이 어떻게 변하는지 확인하세요.
      </p>

      {/* 카드 그리드 */}
      <div
        className="report-view__milestone-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: embedMode
            ? 'repeat(auto-fit, minmax(140px, 1fr))'
            : 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        {anchors.map((anchor) => (
          <MilestoneCard
            key={anchor.key}
            label={anchor.label}
            bmi={anchor.bmi}
            bodyage={cardsResult[anchor.key]?.labels ? null : null}
            arrPct={calcAvgArr(cardsResult[anchor.key])}
            selected={selectedKey === anchor.key}
            state={cardsState[anchor.key]}
            onClick={() => handleCardClick(anchor.key)}
          />
        ))}
      </div>

      {/* 슬라이더 구간 */}
      <BmiSlider
        min={17.0}
        max={40.0}
        step={0.1}
        value={sliderBmi}
        onChange={handleSliderChange}
        disabled={sliderHook.loading}
      />

      {/* 슬라이더 결과 요약 */}
      {sliderHook.result && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#444' }}>
          <strong>BMI {sliderBmi.toFixed(1)} 시나리오</strong>
          {' '}—{' '}
          평균 ARR {calcAvgArr(sliderHook.result) ?? '-'}%,
          SBP {sliderHook.result.improved_sbp} / DBP {sliderHook.result.improved_dbp},
          FBG {sliderHook.result.improved_fbg}
        </div>
      )}
      {sliderHook.error && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#c00' }}>
          계산 오류: {sliderHook.error.message}
        </div>
      )}
    </div>
  );
}
