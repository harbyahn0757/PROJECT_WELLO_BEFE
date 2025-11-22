/**
 * HealthTrendsToggle - 건강 추이 페이지 토글 컴포넌트
 * 2개의 큰 토글 버튼: "건강검진 결과 추이" / "의료 기록 타임라인"
 */
import React from 'react';
import './styles.scss';

interface HealthTrendsToggleProps {
  activeTab: 'trends' | 'timeline';
  onTabChange: (tab: 'trends' | 'timeline') => void;
}

const HealthTrendsToggle: React.FC<HealthTrendsToggleProps> = ({
  activeTab,
  onTabChange
}) => {
  return (
    <div className="health-trends-toggle">
      <button
        className={`health-trends-toggle__button ${activeTab === 'trends' ? 'health-trends-toggle__button--active' : ''}`}
        onClick={() => onTabChange('trends')}
        aria-label="건강검진 결과 추이"
      >
        건강검진 결과 추이
      </button>
      <button
        className={`health-trends-toggle__button ${activeTab === 'timeline' ? 'health-trends-toggle__button--active' : ''}`}
        onClick={() => onTabChange('timeline')}
        aria-label="의료 기록 타임라인"
      >
        의료 기록 타임라인
      </button>
    </div>
  );
};

export default HealthTrendsToggle;

