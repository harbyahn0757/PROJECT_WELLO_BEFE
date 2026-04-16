/**
 * MilestoneCard — 마일스톤 카드 단일 표시 (Phase 3-B)
 * 순수 표시 컴포넌트. state 없음.
 * 세로 레이아웃: 라벨(상) -> 신체나이(중, 굵게) -> ARR %(하)
 */

type CardState = 'idle' | 'loading' | 'ok' | 'error';

interface MilestoneCardProps {
  label: string;
  bmi: number;
  bodyage: number | null;
  arrPct: number | null;
  selected: boolean;
  state: CardState;
  onClick: () => void;
  /** E2E 셀렉터용 key (없으면 label 기반 slug) */
  milestoneKey?: string;
}

export default function MilestoneCard({
  label,
  bmi,
  bodyage,
  arrPct,
  selected,
  state,
  onClick,
  milestoneKey,
}: MilestoneCardProps) {
  const mKey = milestoneKey ?? label.replace(/\s+/g, '-');
  const cls = [
    'report-view__milestone-card',
    selected ? 'report-view__milestone-card--selected' : '',
    state === 'loading' ? 'report-view__milestone-card--loading' : '',
    state === 'error' ? 'report-view__milestone-card--error' : '',
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} onClick={onClick} aria-pressed={selected} type="button">
      <span className="report-view__milestone-card-label">{label}</span>
      <span className="report-view__milestone-card-label" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
        BMI {bmi.toFixed(1)}
      </span>
      <span
        className="report-view__milestone-card-bodyage"
        data-test={`milestone-card-${mKey}-bodyage`}
      >
        {state === 'loading' && '...'}
        {state === 'error' && '-'}
        {state === 'idle' && '-'}
        {state === 'ok' && bodyage !== null && `${bodyage}세`}
      </span>
      {state === 'ok' && arrPct !== null && (
        <span
          className="report-view__milestone-card-arr"
          data-test={`milestone-card-${mKey}-arr`}
        >
          ARR {arrPct > 0 ? `-${arrPct.toFixed(1)}` : arrPct.toFixed(1)}%
        </span>
      )}
    </button>
  );
}
