/**
 * useTouch - 터치 제스처 처리 훅
 * 스와이프, 핀치, 탭 등 모바일 터치 제스처 지원
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export interface TouchPosition {
  x: number;
  y: number;
}

export interface SwipeDirection {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  velocity: number;
}

export interface PinchGesture {
  scale: number;
  center: TouchPosition;
}

export interface TouchGestureOptions {
  swipeThreshold?: number; // 스와이프 인식 최소 거리 (px)
  velocityThreshold?: number; // 스와이프 인식 최소 속도 (px/ms)
  pinchThreshold?: number; // 핀치 인식 최소 스케일 변화
  tapTimeout?: number; // 탭 인식 최대 시간 (ms)
  doubleTapTimeout?: number; // 더블탭 인식 최대 간격 (ms)
}

const defaultOptions: TouchGestureOptions = {
  swipeThreshold: 50,
  velocityThreshold: 0.3,
  pinchThreshold: 0.1,
  tapTimeout: 300,
  doubleTapTimeout: 300
};

export const useTouch = (
  elementRef: React.RefObject<HTMLElement | null>,
  options: TouchGestureOptions = {}
) => {
  const opts = { ...defaultOptions, ...options };
  
  const [isTouch, setIsTouch] = useState(false);
  const [touchCount, setTouchCount] = useState(0);
  
  // 터치 상태 추적
  const touchStartRef = useRef<TouchPosition | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const lastTapTimeRef = useRef<number>(0);
  const initialPinchDistanceRef = useRef<number>(0);
  const currentPinchDistanceRef = useRef<number>(0);

  // 콜백 함수들
  const [callbacks, setCallbacks] = useState<{
    onSwipe?: (swipe: SwipeDirection) => void;
    onPinch?: (pinch: PinchGesture) => void;
    onTap?: (position: TouchPosition) => void;
    onDoubleTap?: (position: TouchPosition) => void;
    onLongPress?: (position: TouchPosition) => void;
    onTouchStart?: (position: TouchPosition) => void;
    onTouchEnd?: (position: TouchPosition) => void;
  }>({});

  // 두 점 사이의 거리 계산
  const getDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // 핀치 중심점 계산
  const getPinchCenter = useCallback((touch1: Touch, touch2: Touch): TouchPosition => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }, []);

  // 터치 시작 처리
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const position = { x: touch.clientX, y: touch.clientY };
    
    setIsTouch(true);
    setTouchCount(e.touches.length);
    touchStartRef.current = position;
    touchStartTimeRef.current = Date.now();
    
    // 핀치 제스처 초기화
    if (e.touches.length === 2) {
      initialPinchDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
      currentPinchDistanceRef.current = initialPinchDistanceRef.current;
    }
    
    callbacks.onTouchStart?.(position);
  }, [callbacks.onTouchStart, getDistance]);

  // 터치 이동 처리
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current > 0) {
      // 핀치 제스처 처리
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialPinchDistanceRef.current;
      const center = getPinchCenter(e.touches[0], e.touches[1]);
      
      if (Math.abs(scale - 1) > opts.pinchThreshold!) {
        callbacks.onPinch?.({ scale, center });
      }
      
      currentPinchDistanceRef.current = currentDistance;
    }
  }, [callbacks.onPinch, getDistance, getPinchCenter, opts.pinchThreshold]);

  // 터치 종료 처리
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTimeRef.current;
    
    if (touchStartRef.current && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const endPosition = { x: touch.clientX, y: touch.clientY };
      
      const deltaX = endPosition.x - touchStartRef.current.x;
      const deltaY = endPosition.y - touchStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const velocity = distance / touchDuration;
      
      // 스와이프 제스처 감지
      if (distance > opts.swipeThreshold! && velocity > opts.velocityThreshold!) {
        let direction: SwipeDirection['direction'];
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          direction = deltaX > 0 ? 'right' : 'left';
        } else {
          direction = deltaY > 0 ? 'down' : 'up';
        }
        
        callbacks.onSwipe?.({ direction, distance, velocity });
      }
      // 탭 제스처 감지
      else if (distance < opts.swipeThreshold! && touchDuration < opts.tapTimeout!) {
        const currentTime = Date.now();
        const timeSinceLastTap = currentTime - lastTapTimeRef.current;
        
        if (timeSinceLastTap < opts.doubleTapTimeout!) {
          // 더블탭
          callbacks.onDoubleTap?.(endPosition);
        } else {
          // 단일탭
          callbacks.onTap?.(endPosition);
        }
        
        lastTapTimeRef.current = currentTime;
      }
      // 롱프레스 제스처 감지
      else if (distance < opts.swipeThreshold! && touchDuration >= opts.tapTimeout!) {
        callbacks.onLongPress?.(endPosition);
      }
      
      callbacks.onTouchEnd?.(endPosition);
    }
    
    setIsTouch(false);
    setTouchCount(0);
    touchStartRef.current = null;
    initialPinchDistanceRef.current = 0;
    currentPinchDistanceRef.current = 0;
  }, [callbacks, opts]);

  // 이벤트 리스너 등록
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // 패시브 리스너로 성능 최적화
    const options = { passive: false };
    
    element.addEventListener('touchstart', handleTouchStart, options);
    element.addEventListener('touchmove', handleTouchMove, options);
    element.addEventListener('touchend', handleTouchEnd, options);
    element.addEventListener('touchcancel', handleTouchEnd, options);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [elementRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // 콜백 등록 함수들
  const onSwipe = useCallback((callback: (swipe: SwipeDirection) => void) => {
    setCallbacks(prev => ({ ...prev, onSwipe: callback }));
  }, []);

  const onPinch = useCallback((callback: (pinch: PinchGesture) => void) => {
    setCallbacks(prev => ({ ...prev, onPinch: callback }));
  }, []);

  const onTap = useCallback((callback: (position: TouchPosition) => void) => {
    setCallbacks(prev => ({ ...prev, onTap: callback }));
  }, []);

  const onDoubleTap = useCallback((callback: (position: TouchPosition) => void) => {
    setCallbacks(prev => ({ ...prev, onDoubleTap: callback }));
  }, []);

  const onLongPress = useCallback((callback: (position: TouchPosition) => void) => {
    setCallbacks(prev => ({ ...prev, onLongPress: callback }));
  }, []);

  const onTouchStart = useCallback((callback: (position: TouchPosition) => void) => {
    setCallbacks(prev => ({ ...prev, onTouchStart: callback }));
  }, []);

  const onTouchEnd = useCallback((callback: (position: TouchPosition) => void) => {
    setCallbacks(prev => ({ ...prev, onTouchEnd: callback }));
  }, []);

  return {
    isTouch,
    touchCount,
    onSwipe,
    onPinch,
    onTap,
    onDoubleTap,
    onLongPress,
    onTouchStart,
    onTouchEnd
  };
};
