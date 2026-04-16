/**
 * BmiSlider — BMI 입력 슬라이더 (Phase 3-B)
 * controlled 컴포넌트. debounce는 상위 MilestoneSlot 에서 처리.
 * iframe embedMode 호환: <input type="range"> 네이티브 사용.
 */

interface BmiSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (bmi: number) => void;
  disabled?: boolean;
}

export default function BmiSlider({ min, max, step, value, onChange, disabled }: BmiSliderProps) {
  return (
    <div className={`report-view__milestone-slider${disabled ? ' report-view__milestone-slider--disabled' : ''}`}>
      <input
        type="range"
        className="report-view__milestone-slider-track"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label="BMI 목표 설정"
      />
      <span
        className="report-view__milestone-slider-value"
        aria-live="polite"
      >
        BMI {value.toFixed(1)}
      </span>
    </div>
  );
}
