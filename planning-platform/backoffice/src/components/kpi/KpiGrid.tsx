import React from 'react';
import type { ReactNode } from 'react';

export interface KpiGridProps {
  /**
   * 컬럼 수. 기본 4.
   * 반응형으로 1024px 이하에서 2열, 767px 이하에서 1열로 자동 전환.
   */
  cols?: 2 | 3 | 4;

  children: ReactNode;
}

/**
 * KPI 카드 격자 컨테이너.
 * - RevisitPage 의 4개 KPI 카드 패턴과 health-report__stats-grid 중복 제거.
 * - `cols` 로 열 수 지정. 반응형 브레이크포인트는 _kpi.scss 에 정의.
 *
 * @example
 * <KpiGrid>
 *   <KpiCard label="총 후보" value={total} unit="명" />
 *   <KpiCard label="고위험" value={highRisk} unit="명" variant="danger" />
 * </KpiGrid>
 *
 * <KpiGrid cols={3}>
 *   <KpiCard label="고혈압 의심" value={count} unit="명" variant="danger" />
 * </KpiGrid>
 */
export const KpiGrid: React.FC<KpiGridProps> = ({ cols = 4, children }) => (
  <div className={`kpi-grid kpi-grid--cols-${cols}`}>{children}</div>
);

export default KpiGrid;
