/**
 * TimeDimToggle — 시간 차원 선택 탭 (Phase 3-C)
 * 현재 / 6개월 후 / 1년 후 / 5년 후 4 옵션
 * iframe embedMode: 너비 400px 이하 시 2x2 wrap (CSS 담당)
 */

type TimeDimMonths = 0 | 6 | 12 | 60;

const TIME_OPTIONS: { value: TimeDimMonths; label: string }[] = [
  { value: 0,  label: '현재' },
  { value: 6,  label: '6개월 후' },
  { value: 12, label: '1년 후' },
  { value: 60, label: '5년 후' },
];

interface TimeDimToggleProps {
  value: TimeDimMonths;
  onChange: (months: TimeDimMonths) => void;
  disabled?: boolean;
}

export default function TimeDimToggle({ value, onChange, disabled }: TimeDimToggleProps) {
  return (
    <div
      className="report-view__timedim-toggle"
      role="tablist"
      aria-label="시간 차원 선택"
    >
      {TIME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={value === opt.value}
          className={[
            'report-view__timedim-toggle-option',
            value === opt.value ? 'report-view__timedim-toggle-option--selected' : '',
            disabled ? 'report-view__timedim-toggle-option--disabled' : '',
          ].filter(Boolean).join(' ')}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
