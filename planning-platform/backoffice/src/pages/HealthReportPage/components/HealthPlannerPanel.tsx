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
  icon: string;
  desc: string;
  color?: string;  // 테두리/배경 틴트
}

const EXERCISE_OPTIONS: OptionCard[] = [
  { value: 'none',     label: '안 함', icon: '🛋️', desc: '운동 안 해요',   color: '#ef4444' },
  { value: 'light',    label: '가끔',   icon: '🚶', desc: '주 1-2회',      color: '#f59e0b' },
  { value: 'moderate', label: '보통',   icon: '🏃', desc: '주 3-4회',      color: '#22c55e' },
  { value: 'active',   label: '매일',   icon: '💪', desc: '주 5회 이상',   color: '#15803d' },
];

const DIET_OPTIONS: OptionCard[] = [
  { value: 'high_sodium', label: '짜게',    icon: '🧂', desc: '소금 4000mg+', color: '#ef4444' },
  { value: 'moderate',    label: '보통',    icon: '🍱', desc: '소금 2000mg',  color: '#f59e0b' },
  { value: 'low_sodium',  label: '싱겁게',  icon: '🥗', desc: '소금 1500mg-', color: '#22c55e' },
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
    <div className="hp-card-group">
      {options.map((opt) => {
        const isSelected = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            className={['hp-card', isSelected ? 'hp-card--selected' : ''].filter(Boolean).join(' ')}
            style={isSelected ? { borderColor: opt.color, backgroundColor: opt.color + '18' } : {}}
            onClick={() => onSelect(opt.value)}
            aria-pressed={isSelected}
          >
            <span className="hp-card__icon">{opt.icon}</span>
            <span className="hp-card__label">{opt.label}</span>
            <span className="hp-card__desc">{opt.desc}</span>
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
    ? 'hp-result__value hp-result__value--improved'
    : flash === 'worsened'
    ? 'hp-result__value hp-result__value--worsened'
    : 'hp-result__value';

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
    <div className="hp-panel" data-testid="health-planner-panel">
      {/* 헤더: 건강나이 delta */}
      <div className="hp-panel__header">
        <h4 className="hp-panel__title">건강 플랜 시뮬레이터</h4>
        {result && (
          <div className="hp-panel__bodyage-summary">
            <span className="hp-panel__bodyage-label">예상 건강나이</span>
            <span className="hp-panel__bodyage-current">{base.bodyage.toFixed(0)}세</span>
            <span className="hp-panel__bodyage-arrow">→</span>
            <AnimatedNumber
              value={result.bodyage}
              decimals={0}
              suffix="세"
              improved={result.bodyageDelta < 0}
            />
            {bodyageDeltaStr && (
              <span
                className={
                  bodyageDelta < 0 ? 'hp-panel__bodyage-delta hp-panel__bodyage-delta--good' : 'hp-panel__bodyage-delta'
                }
              >
                {bodyageDeltaStr}
              </span>
            )}
          </div>
        )}
        <button type="button" className="hp-panel__reset-btn" onClick={resetAll}>
          초기화
        </button>
      </div>

      {/* 컨트롤 영역 */}
      <div className="hp-panel__controls">
        {/* 체중 / BMI */}
        <div className="hp-panel__row">
          <div className="hp-panel__row-label">
            체중 (BMI)
            <span className="hp-panel__row-current">
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
          <div className="hp-panel__row">
            <div className="hp-panel__row-label">흡연</div>
            <div className="hp-toggle-group">
              <button
                type="button"
                className={['hp-toggle', currentSettings.smokingTarget === null ? 'hp-toggle--selected' : ''].filter(Boolean).join(' ')}
                onClick={() => setSmokingTarget(null)}
                aria-pressed={currentSettings.smokingTarget === null}
              >
                현재 흡연 중
              </button>
              <button
                type="button"
                className={['hp-toggle', 'hp-toggle--good', currentSettings.smokingTarget === 'quit' ? 'hp-toggle--selected' : ''].filter(Boolean).join(' ')}
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
          <div className="hp-panel__row">
            <div className="hp-panel__row-label">음주</div>
            <div className="hp-toggle-group">
              <button
                type="button"
                className={['hp-toggle', currentSettings.drinkingTarget === null ? 'hp-toggle--selected' : ''].filter(Boolean).join(' ')}
                onClick={() => setDrinkingTarget(null)}
                aria-pressed={currentSettings.drinkingTarget === null}
              >
                현재 유지
              </button>
              <button
                type="button"
                className={['hp-toggle', 'hp-toggle--good', currentSettings.drinkingTarget === 'none' ? 'hp-toggle--selected' : ''].filter(Boolean).join(' ')}
                onClick={() => setDrinkingTarget('none')}
                aria-pressed={currentSettings.drinkingTarget === 'none'}
              >
                금주 목표
              </button>
            </div>
          </div>
        )}

        {/* 운동 */}
        <div className="hp-panel__row">
          <div className="hp-panel__row-label">운동</div>
          <CardGroup
            options={EXERCISE_OPTIONS}
            selected={exerciseKey}
            onSelect={handleExerciseSelect}
          />
        </div>

        {/* 식단 */}
        <div className="hp-panel__row">
          <div className="hp-panel__row-label">식단 (나트륨)</div>
          <CardGroup
            options={DIET_OPTIONS}
            selected={dietKey}
            onSelect={handleDietSelect}
          />
        </div>
      </div>

      {/* 결과 영역 */}
      {result && (
        <div className="hp-panel__results">
          <div className="hp-panel__result-row">
            <span className="hp-result__label">혈압 (수축기)</span>
            <span className="hp-result__before">{base.sbp.toFixed(0)}</span>
            <span className="hp-result__arrow">→</span>
            <AnimatedNumber
              value={result.sbp}
              decimals={0}
              improved={result.sbpDelta < 0}
            />
            {result.sbpDelta < -0.1 && (
              <span className="hp-result__delta hp-result__delta--good">
                (−{Math.abs(result.sbpDelta).toFixed(0)})
              </span>
            )}
          </div>
          <div className="hp-panel__result-row">
            <span className="hp-result__label">혈압 (이완기)</span>
            <span className="hp-result__before">{base.dbp.toFixed(0)}</span>
            <span className="hp-result__arrow">→</span>
            <AnimatedNumber
              value={result.dbp}
              decimals={0}
              improved={result.dbpDelta < 0}
            />
            {result.dbpDelta < -0.1 && (
              <span className="hp-result__delta hp-result__delta--good">
                (−{Math.abs(result.dbpDelta).toFixed(0)})
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
              <div className="hp-panel__disease-changes">
                <div className="hp-panel__disease-changes-title">질환별 위험도 변화</div>
                {changes.map((c) => (
                  <div key={c.key} className="hp-disease-row">
                    <span className="hp-disease-row__name">{c.key}</span>
                    <span className="hp-disease-row__before">{c.before.toFixed(2)}배</span>
                    <span className="hp-disease-row__arrow">→</span>
                    <span className="hp-disease-row__after hp-result__value--improved">
                      {c.after.toFixed(2)}배
                    </span>
                    <span className="hp-disease-row__pct hp-result__value--improved">
                      −{((c.delta / c.before) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* 시간축 토글 */}
          <div className="hp-panel__timedim">
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
