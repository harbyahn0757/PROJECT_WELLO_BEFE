/**
 * CategoryTabs - 카테고리 탭 메뉴 (수평 스크롤)
 */
import React, { useRef, useEffect } from 'react';
import { CategoryDefinition } from '../../../../types/category';
import './styles.scss';

interface CategoryTabsProps {
  categories: CategoryDefinition[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  showSummary?: boolean;
}

const CategoryTabs: React.FC<CategoryTabsProps> = ({
  categories,
  activeTab,
  onTabChange,
  showSummary = true
}) => {
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  
  // 활성 탭으로 스크롤
  useEffect(() => {
    if (activeTabRef.current && tabsRef.current) {
      const tabElement = activeTabRef.current;
      const containerElement = tabsRef.current;
      
      const tabLeft = tabElement.offsetLeft;
      const tabWidth = tabElement.offsetWidth;
      const containerWidth = containerElement.offsetWidth;
      const scrollLeft = containerElement.scrollLeft;
      
      // 탭이 보이도록 스크롤
      if (tabLeft < scrollLeft) {
        containerElement.scrollTo({
          left: tabLeft - 16,
          behavior: 'smooth'
        });
      } else if (tabLeft + tabWidth > scrollLeft + containerWidth) {
        containerElement.scrollTo({
          left: tabLeft + tabWidth - containerWidth + 16,
          behavior: 'smooth'
        });
      }
    }
  }, [activeTab]);
  
  return (
    <div className="category-tabs">
      <div className="tabs-scroll" ref={tabsRef}>
        {showSummary && (
          <button
            ref={activeTab === 'summary' ? activeTabRef : null}
            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => onTabChange('summary')}
          >
            요약
          </button>
        )}
        {categories.map((cat) => (
          <button
            key={cat.id}
            ref={activeTab === cat.id ? activeTabRef : null}
            className={`tab ${activeTab === cat.id ? 'active' : ''}`}
            onClick={() => onTabChange(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryTabs;
