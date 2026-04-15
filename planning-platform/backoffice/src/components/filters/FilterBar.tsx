import React from 'react';
import type { ReactNode } from 'react';

export interface FilterBarProps {
  children: ReactNode;
  /** 오른쪽 정렬 영역 (검색창 등) */
  trailing?: ReactNode;
  /** 여러 줄 허용 (기본 "wrap" — flex-wrap 허용) */
  layout?: 'nowrap' | 'wrap';
}

/**
 * 필터 영역 래퍼.
 * - `revisit-page__filters` 등 select+input 배치 패턴을 통일.
 * - children 에 select/input/chip 등 필터 요소 배치.
 * - trailing 에 검색창 등 오른쪽 고정 요소 배치.
 *
 * @example
 * <FilterBar trailing={<input type="search" placeholder="이름/병원 검색" />}>
 *   <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
 *     <option value="">위험도 전체</option>
 *     <option value="high">고위험</option>
 *   </select>
 *   <select value={intentFilter} onChange={e => setIntentFilter(e.target.value)}>
 *     <option value="">의향 전체</option>
 *   </select>
 * </FilterBar>
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  trailing,
  layout = 'wrap',
}) => (
  <div className={`filter-bar filter-bar--${layout}`}>
    <div className="filter-bar__main">{children}</div>
    {trailing && <div className="filter-bar__trailing">{trailing}</div>}
  </div>
);

export default FilterBar;
