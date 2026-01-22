/**
 * HealthTrendsToggle - 건강 추이 페이지 토글 컴포넌트
 * 3개의 토글 버튼: "검진추이" / "카테고리" / "타임라인"
 */
import React from 'react';
import './styles.scss';

interface HealthTrendsToggleProps {
  activeTab: 'trends' | 'timeline' | 'category';
  onTabChange: (tab: 'trends' | 'timeline' | 'category') => void;
}

const HealthTrendsToggle: React.FC<HealthTrendsToggleProps> = ({
  activeTab,
  onTabChange
}) => {
  return (
    <div className="health-trends-toggle">
      <div className="health-trends-toggle__container three-buttons">
        <button
          className={`health-trends-toggle__button ${activeTab === 'category' ? 'health-trends-toggle__button--active' : ''}`}
          onClick={() => onTabChange('category')}
          aria-label="카테고리별 보기"
        >
          카테고리
        </button>
        <button
          className={`health-trends-toggle__button ${activeTab === 'trends' ? 'health-trends-toggle__button--active' : ''}`}
          onClick={() => onTabChange('trends')}
          aria-label="건강검진 결과 추이"
        >
          검진추이
        </button>
        <button
          className={`health-trends-toggle__button ${activeTab === 'timeline' ? 'health-trends-toggle__button--active' : ''}`}
          onClick={() => onTabChange('timeline')}
          aria-label="의료 기록 타임라인"
        >
          타임라인
        </button>
      </div>
    </div>
  );
};

export default HealthTrendsToggle;

