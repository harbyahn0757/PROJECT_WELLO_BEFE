/**
 * ContentLayoutWithoutHeader
 * 헤더가 없는 컨텐츠 레이아웃
 * 헤더가 필요 없는 페이지에서 사용
 */
import React, { ReactNode, RefObject } from 'react';
import './styles.scss';

interface ContentLayoutWithoutHeaderProps {
  children: ReactNode;
  // Pull-to-refresh props
  containerRef?: RefObject<HTMLDivElement>;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  transform?: string;
  transition?: string;
  pullToRefreshIndicator?: ReactNode;
}

const ContentLayoutWithoutHeader: React.FC<ContentLayoutWithoutHeaderProps> = ({
  children,
  containerRef,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  transform,
  transition,
  pullToRefreshIndicator
}) => {
  return (
    <div className="content-layout-without-header">
      {/* 컨텐츠 영역 */}
      <div 
        className="content-layout-without-header__content"
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
        
        {/* 페이지별 컨텐츠 */}
        {children}
      </div>
    </div>
  );
};

export default ContentLayoutWithoutHeader;








