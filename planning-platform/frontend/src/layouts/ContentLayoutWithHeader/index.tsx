/**
 * ContentLayoutWithHeader
 * 공용 헤더가 있는 컨텐츠 레이아웃
 * 건강 추이 페이지 등에서 사용
 */
import React, { ReactNode, RefObject } from 'react';
import HealthTrendsHeader from '../../components/health/HealthTrendsHeader';
import HealthTrendsToggle from '../../components/health/HealthTrendsToggle';
import './styles.scss';

interface ContentLayoutWithHeaderProps {
  children: ReactNode;
  // 헤더 props
  onBack?: () => void;
  lastUpdateTime?: string | null;
  patientName?: string;
  onRefresh?: (withdraw?: boolean) => void | Promise<void>;
  // 토글 props
  showToggle?: boolean;
  activeTab?: 'trends' | 'timeline';
  onTabChange?: (tab: 'trends' | 'timeline') => void;
  // Pull-to-refresh props
  containerRef?: RefObject<HTMLDivElement | null>;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  transform?: string;
  transition?: string;
  pullToRefreshIndicator?: ReactNode;
}

const ContentLayoutWithHeader: React.FC<ContentLayoutWithHeaderProps> = ({
  children,
  onBack,
  lastUpdateTime,
  patientName,
  onRefresh,
  showToggle = true,
  activeTab,
  onTabChange,
  containerRef,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  transform,
  transition,
  pullToRefreshIndicator
}) => {
  return (
    <div className="content-layout-with-header">
      {/* 공용 헤더 (고정) - fixed */}
      <HealthTrendsHeader
        onBack={onBack || (() => {})}
        lastUpdateTime={lastUpdateTime}
        patientName={patientName}
        onRefresh={onRefresh}
      />

      {/* 공용 토글 (고정) - fixed, 헤더 아래 */}
      {showToggle && activeTab && onTabChange && (
        <div className="content-layout-with-header__toggle">
          <HealthTrendsToggle
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        </div>
      )}

      {/* 스크롤 가능한 컨텐츠 영역 (토글 아래부터 시작) */}
      <div 
        className="content-layout-with-header__body"
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: transform || 'translateY(0)',
          transition: transition || 'transform 0.3s ease-out'
        }}
      >
        {/* Pull-to-refresh 인디케이터 */}
        {pullToRefreshIndicator}
        
        {/* 페이지별 컨텐츠 (카드 또는 타임라인) */}
        <div className="content-layout-with-header__content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ContentLayoutWithHeader;

