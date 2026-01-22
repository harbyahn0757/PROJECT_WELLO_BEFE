/**
 * ItemsList - 건강검진 항목 리스트
 * 항목별 값, 단위, 상태 표시
 */
import React from 'react';
import { CategoryItem } from '../../../../types/category';
import './styles.scss';

interface ItemsListProps {
  items: CategoryItem[];
  onItemClick: (itemName: string) => void;
  showStatus?: boolean;
}

const ItemsList: React.FC<ItemsListProps> = ({
  items,
  onItemClick,
  showStatus = true
}) => {
  const getStatusIcon = (status: 'normal' | 'borderline' | 'abnormal') => {
    switch (status) {
      case 'abnormal':
        return '⚠️';
      case 'borderline':
        return '⚠️';
      case 'normal':
        return '✓';
      default:
        return '';
    }
  };
  
  // 정상이 아닌 항목들을 위에 정렬
  const sortedItems = React.useMemo(() => {
    return [...items].sort((a, b) => {
      // 정상이 아닌 항목(abnormal, borderline)을 위로
      if (a.status === 'normal' && b.status !== 'normal') return 1;
      if (a.status !== 'normal' && b.status === 'normal') return -1;
      // 둘 다 정상이 아니면 abnormal > borderline 순서
      if (a.status === 'abnormal' && b.status === 'borderline') return -1;
      if (a.status === 'borderline' && b.status === 'abnormal') return 1;
      // 나머지는 원래 순서 유지
      return 0;
    });
  }, [items]);
  
  return (
    <div className="items-list">
      {sortedItems.map((item, idx) => (
        <div 
          key={idx}
          className={`item-row item-status-${item.status}`}
          onClick={() => onItemClick(item.name)}
          role="button"
          tabIndex={0}
          aria-label={`${item.name} ${item.value}${item.unit} ${item.refName || ''}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onItemClick(item.name);
            }
          }}
        >
          <div className="item-left">
            {showStatus && (
              <span className="item-icon">{getStatusIcon(item.status)}</span>
            )}
            <span className="item-name">{item.name}</span>
          </div>
          
          <div className="item-right">
            <div className="item-value-wrapper">
              <span className="item-value">{item.value}</span>
              <span className="item-unit">{item.unit}</span>
            </div>
            {item.refName && showStatus && (
              <span className={`item-status ${item.status}`}>
                {item.refName}
              </span>
            )}
            <button className="view-button">보기</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ItemsList;
