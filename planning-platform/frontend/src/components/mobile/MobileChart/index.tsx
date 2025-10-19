/**
 * MobileChart - 모바일 최적화된 차트 컴포넌트
 * 터치 제스처, 확대/축소, 스와이프 네비게이션 지원
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useTouch } from '../../../hooks/useTouch';
import LineChart, { LineChartProps } from '../../charts/LineChart';
import BarChart, { BarChartProps } from '../../charts/BarChart';
import PieChart, { PieChartProps } from '../../charts/PieChart';
import './styles.scss';

export type ChartType = 'line' | 'bar' | 'pie';

export interface MobileChartProps {
  type: ChartType;
  data: LineChartProps | BarChartProps | PieChartProps;
  enableZoom?: boolean;
  enableSwipe?: boolean;
  enableFullscreen?: boolean;
  onDataPointClick?: (data: any) => void;
  onFullscreenToggle?: (isFullscreen: boolean) => void;
}

const MobileChart: React.FC<MobileChartProps> = ({
  type,
  data,
  enableZoom = true,
  enableSwipe = true,
  enableFullscreen = true,
  onDataPointClick,
  onFullscreenToggle
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // 터치 제스처 설정
  const touch = useTouch(chartRef, {
    swipeThreshold: 50,
    velocityThreshold: 0.3,
    pinchThreshold: 0.1
  });

  // 핀치 줌 처리
  if (enableZoom) {
    touch.onPinch(useCallback((pinch) => {
      const newScale = Math.max(0.5, Math.min(3, scale * pinch.scale));
      setScale(newScale);
      
      // 햅틱 피드백
      if ('vibrate' in navigator && Math.abs(pinch.scale - 1) > 0.1) {
        navigator.vibrate(20);
      }
    }, [scale]));
  }

  // 스와이프 네비게이션 처리
  if (enableSwipe) {
    touch.onSwipe(useCallback((swipe) => {
      if (type === 'line' || type === 'bar') {
        // 차트 데이터 네비게이션 (시계열 데이터의 경우)
        const direction = swipe.direction;
        console.log(`차트 스와이프: ${direction}`);
        
        // 햅틱 피드백
        if ('vibrate' in navigator) {
          navigator.vibrate(30);
        }
      }
    }, [type]));
  }

  // 더블탭으로 줌 리셋
  touch.onDoubleTap(useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    
    // 햅틱 피드백
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]);
    }
  }, []));

  // 롱프레스로 풀스크린 토글
  if (enableFullscreen) {
    touch.onLongPress(useCallback(() => {
      const newFullscreen = !isFullscreen;
      setIsFullscreen(newFullscreen);
      onFullscreenToggle?.(newFullscreen);
      
      // 햅틱 피드백
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }
    }, [isFullscreen, onFullscreenToggle]));
  }

  // 차트 컴포넌트 렌더링
  const renderChart = useMemo(() => {
    const commonProps = {
      ...data,
      height: isFullscreen ? window.innerHeight - 100 : data.height || 250,
      onDataPointClick
    };

    switch (type) {
      case 'line':
        return <LineChart {...(commonProps as LineChartProps)} />;
      case 'bar':
        return <BarChart {...(commonProps as BarChartProps)} />;
      case 'pie':
        return <PieChart {...(commonProps as PieChartProps)} />;
      default:
        return null;
    }
  }, [type, data, isFullscreen, onDataPointClick]);

  // 줌 컨트롤 버튼
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(3, prev * 1.2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(0.5, prev / 1.2));
  }, []);

  const handleZoomReset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div 
      className={`mobile-chart ${isFullscreen ? 'mobile-chart--fullscreen' : ''}`}
      ref={chartRef}
    >
      {/* 차트 컨테이너 */}
      <div 
        className="mobile-chart__container"
        style={{
          transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.2s ease'
        }}
      >
        {renderChart}
      </div>

      {/* 모바일 컨트롤 */}
      <div className="mobile-chart__controls">
        {/* 줌 컨트롤 */}
        {enableZoom && (
          <div className="zoom-controls">
            <button
              className="control-button zoom-out"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              aria-label="축소"
            >
              −
            </button>
            <span className="zoom-level">{Math.round(scale * 100)}%</span>
            <button
              className="control-button zoom-in"
              onClick={handleZoomIn}
              disabled={scale >= 3}
              aria-label="확대"
            >
              +
            </button>
            <button
              className="control-button zoom-reset"
              onClick={handleZoomReset}
              aria-label="원래 크기"
            >
              ⌂
            </button>
          </div>
        )}

        {/* 풀스크린 토글 */}
        {enableFullscreen && (
          <button
            className="control-button fullscreen-toggle"
            onClick={() => {
              const newFullscreen = !isFullscreen;
              setIsFullscreen(newFullscreen);
              onFullscreenToggle?.(newFullscreen);
            }}
            aria-label={isFullscreen ? "풀스크린 해제" : "풀스크린"}
          >
            {isFullscreen ? '⤓' : '⤢'}
          </button>
        )}
      </div>

      {/* 제스처 힌트 */}
      <div className="mobile-chart__hints">
        {enableZoom && <div className="hint">핀치로 확대/축소</div>}
        {enableSwipe && <div className="hint">스와이프로 네비게이션</div>}
        <div className="hint">더블탭으로 리셋</div>
        {enableFullscreen && <div className="hint">길게 눌러서 풀스크린</div>}
      </div>

      {/* 로딩 오버레이 */}
      {data.loading && (
        <div className="mobile-chart__loading">
          <div className="loading-spinner" />
          <p>차트를 불러오는 중...</p>
        </div>
      )}

      {/* 에러 오버레이 */}
      {data.error && (
        <div className="mobile-chart__error">
          <div className="error-icon">⚠️</div>
          <p>{data.error}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileChart;
