import { useState, useRef, useCallback, useEffect } from 'react';

export type EventType = 'SLIDE_ENTER' | 'OPTION_CLICK' | 'NAV_NEXT' | 'NAV_PREV' | 'INPUT_TYPING';

export interface InteractionEvent {
  timestamp: number;
  type: EventType;
  questionKey: string;
  value?: string;
  duration?: number; // 체류 시간 등 (ms)
}

export const useSurveyTracker = () => {
  const [events, setEvents] = useState<InteractionEvent[]>([]);
  const currentSlideEnterTime = useRef<number>(Date.now());
  const lastQuestionKey = useRef<string>('');

  // 슬라이드 진입 기록
  const trackSlideEnter = useCallback((questionKey: string) => {
    const now = Date.now();
    
    // 이전 슬라이드의 체류 시간 계산 (이전 슬라이드가 있었다면)
    if (lastQuestionKey.current) {
      // 이전 슬라이드 이탈 로그는 별도로 남기지 않고, 진입 시점에 이전 슬라이드 체류 시간을 계산할 수도 있음
      // 하지만 여기서는 간단하게 진입 시점만 기록하고, 나중에 분석기에서 시간 차이를 계산하도록 함
      // 또는 명시적으로 SLIDE_LEAVE 이벤트를 추가할 수도 있음.
      // 여기서는 기획에 따라 SLIDE_ENTER 간의 간격으로 체류 시간을 추정하거나,
      // 별도의 DWELL 이벤트를 발생시킬 수 있음.
      // 기획서에는 SLIDE_ENTER가 명시되어 있으므로 이를 활용.
    }

    currentSlideEnterTime.current = now;
    lastQuestionKey.current = questionKey;

    setEvents(prev => [...prev, {
      timestamp: now,
      type: 'SLIDE_ENTER',
      questionKey,
    }]);
  }, []);

  // 옵션 클릭 기록
  const trackOptionClick = useCallback((questionKey: string, value: string) => {
    setEvents(prev => [...prev, {
      timestamp: Date.now(),
      type: 'OPTION_CLICK',
      questionKey,
      value
    }]);
  }, []);

  // 네비게이션 기록 (이전/다음)
  const trackNavigation = useCallback((questionKey: string, direction: 'NEXT' | 'PREV') => {
    const now = Date.now();
    const duration = now - currentSlideEnterTime.current; // 해당 슬라이드에서 머문 시간

    setEvents(prev => [...prev, {
      timestamp: now,
      type: direction === 'NEXT' ? 'NAV_NEXT' : 'NAV_PREV',
      questionKey,
      duration // 버튼을 누를 때까지 걸린 시간
    }]);
  }, []);

  // 입력 시작/진행 기록 (Throttling 적용 가능)
  const trackInputTyping = useCallback((questionKey: string, length: number) => {
    // 너무 많은 이벤트가 쌓이지 않도록, 특정 길이 단위나 디바운싱을 고려할 수 있음
    // 여기서는 단순하게 호출 시점 기록
    setEvents(prev => [...prev, {
      timestamp: Date.now(),
      type: 'INPUT_TYPING',
      questionKey,
      value: `length:${length}`
    }]);
  }, []);

  return {
    events,
    trackSlideEnter,
    trackOptionClick,
    trackNavigation,
    trackInputTyping
  };
};

