/**
 * HealthTrendsContentLayout
 * 건강 추이 페이지 전용 컨텐츠 레이아웃
 * 토글 하단부터 시작하는 컨텐츠 영역 관리
 */
import React, { ReactNode } from 'react';
import './styles.scss';

interface HealthTrendsContentLayoutProps {
  children: ReactNode;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  transform?: string;
  transition?: string;
  pullToRefreshIndicator?: ReactNode;
}

const HealthTrendsContentLayout: React.FC<HealthTrendsContentLayoutProps> = ({
  children,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  transform,
  transition,
  pullToRefreshIndicator
}) => {
  return (
    <div 
      className="health-trends-content-layout"
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
      
      {/* 컨텐츠 영역 */}
      <div className="health-trends-content-layout__content">
        {children}
      </div>
    </div>
  );
};

export default HealthTrendsContentLayout;






