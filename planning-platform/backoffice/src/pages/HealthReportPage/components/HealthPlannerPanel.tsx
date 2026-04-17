/**
 * HealthPlannerPanel — 건강 플랜 시뮬레이터 (Phase 2+3)
 * 서버 호출 0 — ratio_table 또는 폴백 계수로 즉시 delta 계산.
 * ratio_table 없으면 (data === null) 기존 MilestoneSlot 그대로 렌더링.
 */
import { useRef, useEffect, useState } from 'react';
import type { ReportData } from '../hooks/useMediarcApi';
import { useHealthPlanner } from '../hooks/useHealthPlanner';
import BmiSlider from './BmiSlider';
import TimeDimToggle from './TimeDimToggle';

// ── 옵션 상수 ──

interface OptionCard {
  value: string;
  label: string;
  desc: string;
}

const EXERCISE_OPTIONS: OptionCard[] = [
  { value: 'none',     label: '안 함',  desc: '운동 안 해요' },
  { value: 'light',    label: '가끔',   desc: '주 1-2회' },
  { value: 'moderate', label: '보통',   desc: '주 3-4회' },
  { value: 'active',   label: '매일',   desc: '주 5회 이상' },
];

const DIET_OPTIONS: OptionCard[] = [
  { value: 'high_sodium', label: '짜게',   desc: '4000mg+' },
  { value: 'moderate',    label: '보통',   desc: '2000mg' },
  { value: 'low_sodium',  label: '싱겁게', desc: '1500mg-' },
];

const EXERCISE_VALUE_MAP: Record<string, number | null> = {
  none: 0, light: 1.5, moderate: 3.5, active: 7,
};

// ── 서브 컴포넌트 ──

interface CardGroupProps {
  options: OptionCard[];
  selected: string | null;
  onSelect: (v: string) => void;
}

function CardGroup({ options, selected, onSelect }: CardGroupProps) {
  return (
    <div className="health-planner__card-group">
      {options.map((opt) => {
        const isSelected = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={['health-planner__option-card', isSelected ? 'health-planner__option-card--selected' : ''].filter(Boolean).join(' ')}
            onClick={() => onSelect(opt.value)}
            aria-pressed={isSelected}
          >
            <span className="health-planner__option-card__label">{opt.label}</span>
            <span className="health-planner__option-card__desc">{opt.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  improved?: boolean;  // true=초록, false=빨강, undefined=기본
}

function AnimatedNumber({ value, decimals = 1, prefix = '', suffix = '', improved }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const [flash, setFlash] = useState<'improved' | 'worsened' | null>(null);

  useEffect(() => {
    if (prevRef.current === value) return;
    const direction = value < prevRef.current ? 'improved' : 'worsened';
    setFlash(direction);
    prevRef.current = value;

    // 간단한 카운트 애니메이션 (10 스텝)
    const start = display;
    const end = value;
    const steps = 10;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDisplay(start + (end - start) * (step / steps));
      if (step >= steps) {
        clearInterval(interval);
        setDisplay(end);
      }
    }, 30);

    const flashTimer = setTimeout(() => setFlash(null), 600);
    return () => {
      clearInterval(interval);
      clearTimeout(flashTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const cls = flash === 'improved'
    ? 'health-planner__result-value health-planner__result-value--improved'
    : flash === 'worsened'
    ? 'health-planner__result-value health-planner__result-value--worsened'
    : 'health-planner__result-value';

  return (
    <span className={cls}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}

// ── 메인 컴포넌트 ──

interface HealthPlannerPanelProps {
  data: ReportData;
}

export default function HealthPlannerPanel({ data }: HealthPlannerPanelProps) {
  const {
    baseResult,
    currentSettings,
    computedResult,
    setBmiTarget,
    setSmokingTarget,
    setDrinkingTarget,
    setExerciseTarget,
    setDietTarget,
    setTimeHorizon,
    resetAll,
  } = useHealthPlanner(data);

  // 흡연/음주 현재 상태 (ReportData에서 추출)
  const pInfo = data.patient_info as any;
  const isSmoker = pInfo?.smoking === 'current' || pInfo?.smoking_yn === 1;
  const isDrinker = pInfo?.drinking !== 'none' && pInfo?.drinking != null;

  // exercise 선택 key 추적
  const [exerciseKey, setExerciseKey] = useState<string | null>(null);
  const [dietKey, setDietKey] = useState<string | null>(null);

  const handleExerciseSelect = (v: string) => {
    setExerciseKey(v);
    setExerciseTarget(EXERCISE_VALUE_MAP[v] ?? null);
  };
  const handleDietSelect = (v: string) => {
    setDietKey(v);
    setDietTarget(v === 'high_sodium' ? null : v);
  };

  const base = baseResult;
  const result = computedResult;

  if (!base) {
    // ratio_table도 없고 patient_info.bmi도 없으면 패널 미표시
    return null;
  }

  const bmiForSlider = currentSettings.bmiTarget ?? base.bmi;
  const baseBmiStr = base.bmi.toFixed(1);
  const targetBmiStr = bmiForSlider.toFixed(1);
  const bodyageDelta = result?.bodyageDelta ?? 0;
  const bodyageDeltaStr =
    bodyageDelta < -0.05
      ? `(−${Math.abs(bodyageDelta).toFixed(1)}세)`
      : bodyageDelta > 0.05
      ? `(+${bodyageDelta.toFixed(1)}세)`
      : '';

  return (
    <div className="health-planner" data-testid="health-planner-panel">
      {/* 헤더: 건강나이 delta */}
      <div className="health-planner__header">
        <h4 className="health-planner__title">건강 플랜 시뮬레이터</h4>
        {result && (
          <div className="health-planner__bodyage-summary">
            <span className="health-planner__bodyage-label">예상 건강나이</span>
            <span className="health-planner__bodyage-current">{base.bodyage.toFixed(0)}세</span>
            <span className="health-planner__bodyage-arrow">→</span>
            <AnimatedNumber
              value={result.bodyage}
              decimals={0}
              suffix="세"
              improved={result.bodyageDelta < 0}
            />
            {bodyageDeltaStr && (
              <span
                className={
                  bodyageDelta < 0 ? 'health-planner__bodyage-delta health-planner__bodyage-delta--good' : 'health-planner__bodyage-delta'
                }
              >
                {bodyageDeltaStr}
              </span>
            )}
          </div>
        )}
        <button type="button" className="health-planner__reset-btn" onClick={resetAll}>
          초기화
        </button>
      </div>

      {/* 컨트롤 영역 */}
      <div className="health-planner__controls">
        {/* 체중 / BMI */}
        <div className="health-planner__control-row">
          <div className="health-planner__control-label">
            체중 (BMI)
            <span className="health-planner__control-current">
              현재 BMI {baseBmiStr}
              {bmiForSlider !== base.bmi && ` → 목표 ${targetBmiStr}`}
            </span>
          </div>
          <BmiSlider
            min={17.0}
            max={40.0}
            step={0.1}
            value={bmiForSlider}
            onChange={(bmi) => setBmiTarget(bmi === base.bmi ? null : bmi)}
          />
        </div>

        {/* 흡연 */}
        {isSmoker && (
          <div className="health-planner__control-row">
            <div className="health-planner__control-label">흡연</div>
            <div className="health-planner__toggle-group">
              <button
                type="button"
                className={['health-planner__toggle-btn', currentSettings.smokingTarget === null ? 'health-planner__toggle-btn--active' : ''].filter(Boolean).join(' ')}
                onClick={() => setSmokingTarget(null)}
                aria-pressed={currentSettings.smokingTarget === null}
              >
                현재 흡연 중
              </button>
              <button
                type="button"
                className={['health-planner__toggle-btn', currentSettings.smokingTarget === 'quit' ? 'health-planner__toggle-btn--active' : ''].filter(Boolean).join(' ')}
                onClick={() => setSmokingTarget('quit')}
                aria-pressed={currentSettings.smokingTarget === 'quit'}
              >
                금연 목표
              </button>
            </div>
          </div>
        )}

        {/* 음주 */}
        {isDrinker && (
          <div className="health-planner__control-row">
            <div className="health-planner__control-label">음주</div>
            <div className="health-planner__toggle-group">
              <button
                type="button"
                className={['health-planner__toggle-btn', currentSettings.drinkingTarget === null ? 'health-planner__toggle-btn--active' : ''].filter(Boolean).join(' ')}
                onClick={() => setDrinkingTarget(null)}
                aria-pressed={currentSettings.drinkingTarget === null}
              >
                현재 유지
              </button>
              <button
                type="button"
                className={['health-planner__toggle-btn', currentSettings.drinkingTarget === 'none' ? 'health-planner__toggle-btn--active' : ''].filter(Boolean).join(' ')}
                onClick={() => setDrinkingTarget('none')}
                aria-pressed={currentSettings.drinkingTarget === 'none'}
              >
                금주 목표
              </button>
            </div>
          </div>
        )}

        {/* 운동 */}
        <div className="health-planner__control-row">
          <div className="health-planner__control-label">운동</div>
          <CardGroup
            options={EXERCISE_OPTIONS}
            selected={exerciseKey}
            onSelect={handleExerciseSelect}
          />
        </div>

        {/* 식단 */}
        <div className="health-planner__control-row">
          <div className="health-planner__control-label">식단 (나트륨)</div>
          <CardGroup
            options={DIET_OPTIONS}
            selected={dietKey}
            onSelect={handleDietSelect}
          />
        </div>
      </div>

      {/* 결과 영역 */}
      {result && (
        <div className="health-planner__result">
          <div className="health-planner__result-row">
            <span className="health-planner__result-label">혈압 (수축기)</span>
            <span className="health-planner__result-before">{base.sbp.toFixed(0)}</span>
            <span className="health-planner__result-arrow">→</span>
            <AnimatedNumber
              value={result.sbp}
              decimals={0}
              improved={result.sbpDelta < 0}
            />
            {result.sbpDelta < -0.1 && (
              <span className="health-planner__result-delta health-planner__result-delta--improved">
                −{Math.abs(result.sbpDelta).toFixed(0)}
              </span>
            )}
          </div>
          <div className="health-planner__result-row">
            <span className="health-planner__result-label">혈압 (이완기)</span>
            <span className="health-planner__result-before">{base.dbp.toFixed(0)}</span>
            <span className="health-planner__result-arrow">→</span>
            <AnimatedNumber
              value={result.dbp}
              decimals={0}
              improved={result.dbpDelta < 0}
            />
            {result.dbpDelta < -0.1 && (
              <span className="health-planner__result-delta health-planner__result-delta--improved">
                −{Math.abs(result.dbpDelta).toFixed(0)}
              </span>
            )}
          </div>

          {/* 질환별 변화 (ratio 개선 상위 3개만) */}
          {(() => {
            const changes = Object.entries(result.diseaseRatios)
              .map(([k, after]) => ({
                key: k,
                before: base.disease_ratios[k] ?? after,
                after,
                delta: (base.disease_ratios[k] ?? after) - after,
              }))
              .filter((c) => c.delta > 0.01)
              .sort((a, b) => b.delta - a.delta)
              .slice(0, 3);
            if (changes.length === 0) return null;
            return (
              <div className="health-planner__disease-changes">
                <div className="health-planner__disease-title">질환별 위험도 변화</div>
                {changes.map((c) => (
                  <div key={c.key} className="health-planner__disease-row">
                    <span className="health-planner__disease-name">{c.key}</span>
                    <span className="health-planner__disease-before">{c.before.toFixed(2)}배</span>
                    <span className="health-planner__disease-arrow">→</span>
                    <span className="health-planner__disease-after health-planner__result-value--improved">
                      {c.after.toFixed(2)}배
                    </span>
                    <span className="health-planner__disease-pct health-planner__result-value--improved">
                      −{((c.delta / c.before) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* 시간축 토글 */}
          <div className="health-planner__timedim">
            <TimeDimToggle
              value={currentSettings.timeHorizonMonths}
              onChange={setTimeHorizon}
            />
          </div>
        </div>
      )}
    </div>
  );
}
