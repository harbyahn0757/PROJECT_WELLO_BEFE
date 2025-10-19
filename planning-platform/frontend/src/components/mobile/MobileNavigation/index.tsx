/**
 * MobileNavigation - 모바일 전용 네비게이션 컴포넌트
 * 하단 탭 네비게이션 및 스와이프 제스처 지원
 */
import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTouch } from '../../../hooks/useTouch';
import './styles.scss';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  badge?: number;
  disabled?: boolean;
}

export interface MobileNavigationProps {
  items: NavigationItem[];
  onItemClick?: (item: NavigationItem) => void;
  showLabels?: boolean;
  enableSwipeGestures?: boolean;
  className?: string;
}

const MobileNavigation: React.FC<MobileNavigationProps> = ({
  items,
  onItemClick,
  showLabels = true,
  enableSwipeGestures = true,
  className = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(() => {
    const currentIndex = items.findIndex(item => location.pathname.includes(item.path));
    return currentIndex >= 0 ? currentIndex : 0;
  });

  // 터치 제스처 설정
  const touch = useTouch(navRef, {
    swipeThreshold: 100,
    velocityThreshold: 0.5
  });

  // 스와이프 제스처 처리
  if (enableSwipeGestures) {
    touch.onSwipe((swipe) => {
      if (swipe.direction === 'left' && activeIndex < items.length - 1) {
        const nextIndex = activeIndex + 1;
        handleItemClick(items[nextIndex], nextIndex);
      } else if (swipe.direction === 'right' && activeIndex > 0) {
        const prevIndex = activeIndex - 1;
        handleItemClick(items[prevIndex], prevIndex);
      }
    });
  }

  // 아이템 클릭 처리
  const handleItemClick = (item: NavigationItem, index: number) => {
    if (item.disabled) return;

    setActiveIndex(index);
    navigate(item.path);
    onItemClick?.(item);

    // 햅틱 피드백 (지원하는 경우)
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  // 현재 활성 아이템 확인
  const isActive = (item: NavigationItem, index: number) => {
    return location.pathname.includes(item.path) || activeIndex === index;
  };

  return (
    <nav 
      ref={navRef}
      className={`mobile-navigation ${className}`}
      role="navigation"
      aria-label="메인 네비게이션"
    >
      <div className="mobile-navigation__container">
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`mobile-navigation__item ${
              isActive(item, index) ? 'mobile-navigation__item--active' : ''
            } ${
              item.disabled ? 'mobile-navigation__item--disabled' : ''
            }`}
            onClick={() => handleItemClick(item, index)}
            disabled={item.disabled}
            aria-label={item.label}
            aria-current={isActive(item, index) ? 'page' : undefined}
          >
            <div className="mobile-navigation__icon">
              <span className="icon">{item.icon}</span>
              {item.badge && item.badge > 0 && (
                <span className="badge" aria-label={`${item.badge}개의 알림`}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            
            {showLabels && (
              <span className="mobile-navigation__label">
                {item.label}
              </span>
            )}
            
            {/* 활성 상태 인디케이터 */}
            {isActive(item, index) && (
              <div className="mobile-navigation__indicator" />
            )}
          </button>
        ))}
      </div>
      
      {/* 스와이프 힌트 (처음 방문 시) */}
      {enableSwipeGestures && (
        <div className="mobile-navigation__swipe-hint">
          <div className="swipe-hint-line" />
        </div>
      )}
    </nav>
  );
};

export default MobileNavigation;
