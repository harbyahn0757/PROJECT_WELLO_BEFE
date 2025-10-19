/**
 * VirtualScroll - 가상 스크롤링 컴포넌트
 * 대용량 데이터를 효율적으로 렌더링하기 위한 가상화 컴포넌트
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { performanceService } from '../../../services/PerformanceService';
import './styles.scss';

export interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number | ((index: number, item: T) => number);
  containerHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  overscan?: number;
  onScroll?: (scrollTop: number) => void;
  className?: string;
  loading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  estimatedItemHeight?: number;
}

const VirtualScroll = <T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  onScroll,
  className = '',
  loading = false,
  loadingComponent,
  emptyComponent,
  estimatedItemHeight = 50
}: VirtualScrollProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  
  // 아이템 높이 캐시 (동적 높이인 경우)
  const itemHeightCache = useRef<Map<number, number>>(new Map());
  const itemOffsetCache = useRef<Map<number, number>>(new Map());

  // 고정 높이인지 확인
  const isFixedHeight = typeof itemHeight === 'number';

  // 아이템 높이 계산
  const getItemHeight = useCallback((index: number): number => {
    if (isFixedHeight) {
      return itemHeight as number;
    }

    // 캐시에서 확인
    if (itemHeightCache.current.has(index)) {
      return itemHeightCache.current.get(index)!;
    }

    // 동적 높이 계산
    if (typeof itemHeight === 'function' && items[index]) {
      const height = itemHeight(index, items[index]);
      itemHeightCache.current.set(index, height);
      return height;
    }

    return estimatedItemHeight;
  }, [itemHeight, items, isFixedHeight, estimatedItemHeight]);

  // 아이템 오프셋 계산
  const getItemOffset = useCallback((index: number): number => {
    if (isFixedHeight) {
      return index * (itemHeight as number);
    }

    // 캐시에서 확인
    if (itemOffsetCache.current.has(index)) {
      return itemOffsetCache.current.get(index)!;
    }

    // 누적 높이 계산
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i);
    }

    itemOffsetCache.current.set(index, offset);
    return offset;
  }, [getItemHeight, isFixedHeight, itemHeight]);

  // 전체 높이 계산
  const totalHeight = useMemo(() => {
    if (isFixedHeight) {
      return items.length * (itemHeight as number);
    }

    let height = 0;
    for (let i = 0; i < items.length; i++) {
      height += getItemHeight(i);
    }
    return height;
  }, [items.length, getItemHeight, isFixedHeight, itemHeight]);

  // 보이는 아이템 범위 계산
  const visibleRange = useMemo(() => {
    if (items.length === 0) {
      return { startIndex: 0, endIndex: 0, offsetY: 0 };
    }

    if (isFixedHeight) {
      return performanceService.calculateVisibleItems(
        scrollTop,
        containerHeight,
        itemHeight as number,
        items.length,
        overscan
      );
    }

    // 동적 높이인 경우 이진 탐색으로 시작 인덱스 찾기
    let startIndex = 0;
    let endIndex = items.length - 1;

    while (startIndex < endIndex) {
      const mid = Math.floor((startIndex + endIndex) / 2);
      const offset = getItemOffset(mid);
      
      if (offset < scrollTop) {
        startIndex = mid + 1;
      } else {
        endIndex = mid;
      }
    }

    startIndex = Math.max(0, startIndex - overscan);

    // 끝 인덱스 계산
    let currentOffset = getItemOffset(startIndex);
    let visibleEndIndex = startIndex;

    while (visibleEndIndex < items.length && currentOffset < scrollTop + containerHeight) {
      currentOffset += getItemHeight(visibleEndIndex);
      visibleEndIndex++;
    }

    visibleEndIndex = Math.min(items.length - 1, visibleEndIndex + overscan);

    return {
      startIndex,
      endIndex: visibleEndIndex,
      offsetY: getItemOffset(startIndex)
    };
  }, [scrollTop, containerHeight, items.length, overscan, getItemOffset, getItemHeight, isFixedHeight, itemHeight]);

  // 스크롤 핸들러
  const handleScroll = useCallback(
    performanceService.throttle((e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      setScrollTop(newScrollTop);
      onScroll?.(newScrollTop);
    }, 16), // 60fps
    [onScroll]
  );

  // 아이템이 변경되면 캐시 초기화
  useEffect(() => {
    itemHeightCache.current.clear();
    itemOffsetCache.current.clear();
  }, [items]);

  // 렌더링할 아이템들
  const visibleItems = useMemo(() => {
    const result: React.ReactNode[] = [];
    
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      if (i >= items.length) break;
      
      const item = items[i];
      const itemTop = getItemOffset(i) - visibleRange.offsetY;
      const itemHeightValue = getItemHeight(i);
      
      const style: React.CSSProperties = {
        position: 'absolute',
        top: itemTop,
        left: 0,
        right: 0,
        height: itemHeightValue,
      };

      result.push(
        <div key={i} style={style}>
          {renderItem(item, i, style)}
        </div>
      );
    }
    
    return result;
  }, [visibleRange, items, getItemOffset, getItemHeight, renderItem]);

  // 로딩 상태
  if (loading) {
    return (
      <div className={`virtual-scroll virtual-scroll--loading ${className}`}>
        {loadingComponent || (
          <div className="virtual-scroll__loading">
            <div className="loading-spinner" />
            <p>데이터를 불러오는 중...</p>
          </div>
        )}
      </div>
    );
  }

  // 빈 상태
  if (items.length === 0) {
    return (
      <div className={`virtual-scroll virtual-scroll--empty ${className}`}>
        {emptyComponent || (
          <div className="virtual-scroll__empty">
            <p>표시할 데이터가 없습니다.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-scroll ${className}`}
      style={{ height: containerHeight }}
    >
      <div
        ref={scrollElementRef}
        className="virtual-scroll__container"
        style={{ height: totalHeight }}
        onScroll={handleScroll}
      >
        <div
          className="virtual-scroll__content"
          style={{
            transform: `translateY(${visibleRange.offsetY}px)`,
            position: 'relative'
          }}
        >
          {visibleItems}
        </div>
      </div>
    </div>
  );
};

export default VirtualScroll;
