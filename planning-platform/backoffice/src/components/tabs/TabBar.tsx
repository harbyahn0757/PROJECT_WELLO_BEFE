import React from 'react';
import type { ReactNode } from 'react';

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  /** 라벨 옆 뱃지 카운트 */
  badge?: number | string;
  /** 비활성 여부 */
  disabled?: boolean;
}

export interface TabBarProps<K extends string = string> {
  items: ReadonlyArray<TabItem<K>>;
  value: K;
  onChange: (key: K) => void;
  /** 탭 크기. 기본 "md" */
  size?: 'sm' | 'md';
  /** 우측 여백에 배치될 보조 요소 (예: 병원 드롭다운) */
  trailing?: ReactNode;
}

/**
 * 탭 전환 바.
 * - 기존 `.tabs` / `.tabs__item` SCSS 를 React 컴포넌트로 포장.
 * - trailing prop 으로 오른쪽에 드롭다운/버튼 배치 가능.
 * - 제네릭 K 로 탭 key 타입 안전성 보장.
 *
 * @example
 * type TabKey = 'consultation' | 'campaign' | 'history';
 * const TAB_ITEMS: TabItem<TabKey>[] = [
 *   { key: 'consultation', label: '상담 요청', badge: pendingCount },
 *   { key: 'campaign', label: '캠페인 발송' },
 * ];
 * <TabBar items={TAB_ITEMS} value={activeTab} onChange={setActiveTab}
 *   trailing={<HospitalSearch ... />} />
 */
export function TabBar<K extends string>({
  items,
  value,
  onChange,
  size = 'md',
  trailing,
}: TabBarProps<K>) {
  return (
    <div className={`tab-bar tab-bar--${size}`}>
      <div className="tab-bar__items">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`tab-bar__item${item.key === value ? ' tab-bar__item--active' : ''}`}
            disabled={item.disabled}
            onClick={() => onChange(item.key)}
          >
            {item.label}
            {item.badge != null && item.badge !== 0 && (
              <span className="tab-bar__badge">{item.badge}</span>
            )}
          </button>
        ))}
      </div>
      {trailing && <div className="tab-bar__trailing">{trailing}</div>}
    </div>
  );
}

export default TabBar;
