import React from 'react';
import type { ReactNode } from 'react';

export interface KpiCardProps {
  /** 상단 라벨 (작은 회색 텍스트) */
  label: ReactNode;

  /** 중앙 값 (크고 bold) */
  value: ReactNode;

  /** 값 옆의 단위 (작은 텍스트, 예: "명", "건", "%") */
  unit?: ReactNode;

  /** 추가 메타 (값 아래 회색 텍스트, 예: "전주 대비 +5") */
  hint?: ReactNode;

  /** 시각적 강조 */
  variant?: 'default' | 'danger' | 'warning' | 'success';

  /** 클릭 가능 여부 (필터 토글 등) */
  onClick?: () => void;

  /** 선택 상태 (클릭형 카드용) */
  selected?: boolean;

  testId?: string;
}

/**
 * KPI 수치 카드 단위.
 * - onClick 지정 시 `<button>` 렌더, 미지정 시 `<div>` 렌더.
 * - variant 로 위험도/상태 시각화.
 * - KpiGrid 안에 배치하여 격자 정렬.
 *
 * @example
 * <KpiCard label="총 후보" value={total} unit="명" />
 * <KpiCard label="고위험" value={highRisk} unit="명" variant="danger"
 *   onClick={() => toggleFilter('high')} selected={activeFilter === 'high'} />
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  unit,
  hint,
  variant = 'default',
  onClick,
  selected,
  testId,
}) => {
  const cls = [
    'kpi-card',
    `kpi-card--${variant}`,
    onClick && 'kpi-card--clickable',
    selected && 'kpi-card--selected',
  ]
    .filter(Boolean)
    .join(' ');

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      className={cls}
      onClick={onClick}
      data-testid={testId}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      <span className="kpi-card__label">{label}</span>
      <span className="kpi-card__value">
        {value}
        {unit && <small className="kpi-card__unit">{unit}</small>}
      </span>
      {hint && <span className="kpi-card__hint">{hint}</span>}
    </Tag>
  );
};

export default KpiCard;
