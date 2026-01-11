import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 폴링 타입
 */
export type PollingType =
  | 'status'          // 일반 상태 폴링
  | 'token'           // 토큰 모니터링
  | 'collection'      // 데이터 수집 상태 폴링
  | 'auth_status';    // 인증 상태 폴링

/**
 * 폴링 설정
 */
export interface PollingConfig {
  type: PollingType;
  interval?: number;      // 폴링 간격 (ms), 기본값은 타입별로 다름
  maxRetries?: number;    // 최대 재시도 횟수
  onPoll: () => Promise<void> | void;  // 폴링 콜백
  onError?: (error: Error) => void;    // 에러 콜백
  enabled?: boolean;      // 폴링 활성화 여부
}

/**
 * 폴링 상태
 */
export interface PollingState {
  isActive: boolean;
  retryCount: number;
  lastPollTime: number | null;
}

/**
 * 폴링 액션
 */
export interface PollingActions {
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * useAuthPolling 훅
 * 
 * 인증 관련 폴링을 관리하는 커스텀 훅입니다.
 * 여러 타입의 폴링을 동시에 관리할 수 있습니다.
 */
export function useAuthPolling(configs: PollingConfig[]) {
  // 각 폴링 타입별 interval/timeout ref
  const intervalRefs = useRef<Map<PollingType, NodeJS.Timeout>>(new Map());
  const timeoutRefs = useRef<Map<PollingType, NodeJS.Timeout>>(new Map());
  
  // 폴링 상태
  const [pollingStates, setPollingStates] = useState<Map<PollingType, PollingState>>(
    new Map(configs.map(config => [
      config.type,
      {
        isActive: false,
        retryCount: 0,
        lastPollTime: null,
      }
    ]))
  );
  
  // 폴링 중단 플래그 (수집 폴링용)
  const stoppedFlags = useRef<Map<PollingType, boolean>>(new Map());
  
  /**
   * 폴링 타입별 기본 간격
   */
  const getDefaultInterval = (type: PollingType): number => {
    switch (type) {
      case 'status':
        return 3000;        // 3초
      case 'token':
        return 5000;        // 5초
      case 'collection':
        return 2000;        // 2초
      case 'auth_status':
        return 3000;        // 3초
      default:
        return 3000;
    }
  };
  
  /**
   * 특정 타입의 폴링 시작
   */
  const startPolling = useCallback((type: PollingType) => {
    const config = configs.find(c => c.type === type);
    if (!config || config.enabled === false) return;
    
    // 이미 실행 중이면 중단
    stopPolling(type);
    
    const interval = config.interval ?? getDefaultInterval(type);
    
    console.log(`[폴링시작] ${type} 폴링 시작 (간격: ${interval}ms)`);
    
    // 폴링 함수
    const poll = async () => {
      try {
        // 중단 플래그 확인 (collection 타입용)
        if (stoppedFlags.current.get(type)) {
          console.log(`[폴링중단] ${type} 폴링 중단됨`);
          return;
        }
        
        await config.onPoll();
        
        // 상태 업데이트
        setPollingStates(prev => {
          const newMap = new Map(prev);
          const state = newMap.get(type);
          if (state) {
            newMap.set(type, {
              ...state,
              lastPollTime: Date.now(),
              retryCount: 0, // 성공 시 재시도 카운트 초기화
            });
          }
          return newMap;
        });
      } catch (error) {
        console.error(`[폴링에러] ${type} 폴링 중 오류:`, error);
        
        if (config.onError) {
          config.onError(error as Error);
        }
        
        // 재시도 카운트 증가
        setPollingStates(prev => {
          const newMap = new Map(prev);
          const state = newMap.get(type);
          if (state) {
            const newRetryCount = state.retryCount + 1;
            
            // 최대 재시도 횟수 초과 시 폴링 중단
            if (config.maxRetries && newRetryCount >= config.maxRetries) {
              console.warn(`[폴링중단] ${type} 최대 재시도 횟수 초과`);
              stopPolling(type);
            }
            
            newMap.set(type, {
              ...state,
              retryCount: newRetryCount,
            });
          }
          return newMap;
        });
      }
    };
    
    // 첫 폴링 실행
    poll();
    
    // interval 설정
    const intervalId = setInterval(poll, interval);
    intervalRefs.current.set(type, intervalId);
    
    // 상태 업데이트
    setPollingStates(prev => {
      const newMap = new Map(prev);
      const state = newMap.get(type);
      if (state) {
        newMap.set(type, { ...state, isActive: true });
      }
      return newMap;
    });
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs]);
  
  /**
   * 특정 타입의 폴링 중단
   */
  const stopPolling = useCallback((type: PollingType) => {
    console.log(`[폴링중단] ${type} 폴링 중단 요청`);
    
    // interval 정리
    const intervalId = intervalRefs.current.get(type);
    if (intervalId) {
      clearInterval(intervalId);
      intervalRefs.current.delete(type);
    }
    
    // timeout 정리
    const timeoutId = timeoutRefs.current.get(type);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(type);
    }
    
    // 중단 플래그 설정
    stoppedFlags.current.set(type, true);
    
    // 상태 업데이트
    setPollingStates(prev => {
      const newMap = new Map(prev);
      const state = newMap.get(type);
      if (state) {
        newMap.set(type, { ...state, isActive: false });
      }
      return newMap;
    });
  }, []);
  
  /**
   * 모든 폴링 중단
   */
  const stopAll = useCallback(() => {
    console.log('[폴링정리] 모든 폴링 중단');
    
    configs.forEach(config => {
      stopPolling(config.type);
    });
  }, [configs, stopPolling]);
  
  /**
   * 특정 타입의 폴링 리셋
   */
  const resetPolling = useCallback((type: PollingType) => {
    console.log(`[폴링리셋] ${type} 폴링 리셋`);
    
    // 중단 플래그 해제
    stoppedFlags.current.set(type, false);
    
    // 상태 초기화
    setPollingStates(prev => {
      const newMap = new Map(prev);
      newMap.set(type, {
        isActive: false,
        retryCount: 0,
        lastPollTime: null,
      });
      return newMap;
    });
  }, []);
  
  /**
   * 모든 폴링 리셋
   */
  const resetAll = useCallback(() => {
    console.log('[폴링리셋] 모든 폴링 리셋');
    
    configs.forEach(config => {
      resetPolling(config.type);
    });
  }, [configs, resetPolling]);
  
  /**
   * 컴포넌트 언마운트 시 모든 폴링 정리
   */
  useEffect(() => {
    return () => {
      stopAll();
    };
  }, [stopAll]);
  
  /**
   * 타입별 액션 생성
   */
  const createActions = (type: PollingType): PollingActions => ({
    start: () => startPolling(type),
    stop: () => stopPolling(type),
    reset: () => resetPolling(type),
  });
  
  return {
    // 전체 상태
    states: pollingStates,
    
    // 전체 액션
    startAll: () => {
      configs.forEach(config => {
        if (config.enabled !== false) {
          startPolling(config.type);
        }
      });
    },
    stopAll,
    resetAll,
    
    // 타입별 액션
    getActions: createActions,
    
    // 개별 폴링 제어
    start: startPolling,
    stop: stopPolling,
    reset: resetPolling,
  };
}
