/**
 * BaseChart - 모든 차트 컴포넌트의 기본 클래스
 * 공통 기능: 로딩, 에러 처리, 반응형 레이아웃, 접근성
 */
import React, { useRef, useEffect, useState } from 'react';
// BaseChart는 독립적인 Props 정의 사용
import './styles.scss';

export interface BaseChartProps {
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  subtitle?: string;
  loading?: boolean;
  error?: string;
  height?: number;
  width?: number;
  responsive?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  theme?: 'light' | 'dark';
  onChartReady?: () => void;
  onDataPointClick?: (data: any) => void;
}

export interface ChartDimensions {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

interface BaseChartWithChildrenProps extends BaseChartProps {
  children: (dimensions: ChartDimensions) => React.ReactNode;
}

const BaseChart: React.FC<BaseChartWithChildrenProps> = ({
  title,
  subtitle,
  loading = false,
  error,
  height = 300,
  width,
  responsive = true,
  showLegend = true,
  showTooltip = true,
  theme = 'light',
  onChartReady,
  onDataPointClick,
  children,
  className = '',
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width: width || 400,
    height,
    margin: { top: 15, right: 20, bottom: 25, left: 50 } // 하단 마진 줄여서 그래프 영역 확보
  });

  // 반응형 크기 조정
  useEffect(() => {
    if (!responsive || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const containerWidth = entry.contentRect.width;
        setDimensions(prev => ({
          ...prev,
          width: width || Math.max(containerWidth - 40, 300)
        }));
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [responsive, width]);

  // 차트 준비 완료 알림
  useEffect(() => {
    if (!loading && !error && onChartReady) {
      onChartReady();
    }
  }, [loading, error, onChartReady]);

  if (loading) {
    return (
      <div 
        ref={containerRef}
        className={`wello-chart wello-chart--loading ${className}`}
        style={{ height }}
        {...props}
      >
        <div className="wello-chart__loading">
          <div className="wello-chart__spinner" />
          <p>차트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        ref={containerRef}
        className={`wello-chart wello-chart--error ${className}`}
        style={{ height }}
        {...props}
      >
        <div className="wello-chart__error">
          <div className="wello-chart__error-icon"></div>
          <h4>차트를 불러올 수 없습니다</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`wello-chart wello-chart--${theme} ${className}`}
      style={{ height }}
      {...props}
    >
      {/* 차트 헤더 */}
      {(title || subtitle) && (
        <div className="wello-chart__header">
          {title && (
            <h3 className="wello-chart__title">{title}</h3>
          )}
          {subtitle && (
            <p className="wello-chart__subtitle">{subtitle}</p>
          )}
        </div>
      )}

      {/* 차트 컨텐츠 */}
      <div className="wello-chart__content">
        {children(dimensions)}
      </div>

      {/* 범례 (필요시) */}
      {showLegend && (
        <div className="wello-chart__legend" role="img" aria-label="차트 범례">
          {/* 각 차트에서 구현 */}
        </div>
      )}
    </div>
  );
};

export default BaseChart;
