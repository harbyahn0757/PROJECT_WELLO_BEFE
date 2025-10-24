/**
 * API 호출 중복 방지 훅
 * debounce, throttle, 진행 중인 요청 취소 등을 통해 중복 API 호출 방지
 */
import { useRef, useCallback, useState } from 'react';

interface ApiCallOptions {
  debounceMs?: number;
  throttleMs?: number;
  preventDuplicates?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface ApiCallState {
  isLoading: boolean;
  error: Error | null;
  lastCallTime: number | null;
  callCount: number;
}

export const useApiCallPrevention = (options: ApiCallOptions = {}) => {
  const {
    debounceMs = 300,
    throttleMs = 1000,
    preventDuplicates = true,
    maxRetries = 3,
    retryDelayMs = 1000
  } = options;

  const [state, setState] = useState<ApiCallState>({
    isLoading: false,
    error: null,
    lastCallTime: null,
    callCount: 0
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastThrottleCallRef = useRef<number>(0);
  const activeCallsRef = useRef<Set<string>>(new Set());

  // 진행 중인 요청 취소
  const cancelPendingRequests = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  }, []);

  // Debounced API 호출
  const debouncedCall = useCallback(
    <T>(
      apiCall: (signal?: AbortSignal) => Promise<T>,
      callId?: string
    ): Promise<T> => {
      return new Promise((resolve, reject) => {
        // 기존 debounce 타이머 취소
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(async () => {
          try {
            // 중복 호출 체크
            if (preventDuplicates && callId && activeCallsRef.current.has(callId)) {
              console.log(`⚠️ [API중복방지] 이미 진행 중인 호출: ${callId}`);
              reject(new Error('Duplicate call prevented'));
              return;
            }

            // AbortController 생성
            abortControllerRef.current = new AbortController();
            
            setState(prev => ({
              ...prev,
              isLoading: true,
              error: null,
              lastCallTime: Date.now(),
              callCount: prev.callCount + 1
            }));

            if (callId) {
              activeCallsRef.current.add(callId);
            }

            console.log(`🚀 [API호출] Debounced 호출 시작: ${callId || 'unnamed'}`);
            const result = await apiCall(abortControllerRef.current.signal);

            setState(prev => ({
              ...prev,
              isLoading: false,
              error: null
            }));

            if (callId) {
              activeCallsRef.current.delete(callId);
            }

            resolve(result);
          } catch (error) {
            if (callId) {
              activeCallsRef.current.delete(callId);
            }

            if (error instanceof Error && error.name === 'AbortError') {
              console.log(`🛑 [API호출] 호출 취소됨: ${callId || 'unnamed'}`);
              reject(new Error('Request cancelled'));
            } else {
              console.error(`❌ [API호출] 호출 실패: ${callId || 'unnamed'}`, error);
              setState(prev => ({
                ...prev,
                isLoading: false,
                error: error instanceof Error ? error : new Error('Unknown error')
              }));
              reject(error);
            }
          }
        }, debounceMs);
      });
    },
    [debounceMs, preventDuplicates]
  );

  // Throttled API 호출
  const throttledCall = useCallback(
    <T>(
      apiCall: (signal?: AbortSignal) => Promise<T>,
      callId?: string
    ): Promise<T> => {
      return new Promise((resolve, reject) => {
        const now = Date.now();
        const timeSinceLastCall = now - lastThrottleCallRef.current;

        if (timeSinceLastCall < throttleMs) {
          // 아직 throttle 시간이 지나지 않음
          const remainingTime = throttleMs - timeSinceLastCall;
          console.log(`⏳ [API쓰로틀] ${remainingTime}ms 후 호출 가능: ${callId || 'unnamed'}`);
          
          if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
          }

          throttleTimerRef.current = setTimeout(() => {
            debouncedCall(apiCall, callId).then(resolve).catch(reject);
          }, remainingTime);
        } else {
          // 즉시 호출 가능
          lastThrottleCallRef.current = now;
          debouncedCall(apiCall, callId).then(resolve).catch(reject);
        }
      });
    },
    [throttleMs, debouncedCall]
  );

  // 재시도 로직이 포함된 API 호출
  const callWithRetry = useCallback(
    async <T>(
      apiCall: (signal?: AbortSignal) => Promise<T>,
      callId?: string,
      retryCount = 0
    ): Promise<T> => {
      try {
        return await throttledCall(apiCall, callId);
      } catch (error) {
        if (retryCount < maxRetries && error instanceof Error && error.message !== 'Request cancelled') {
          console.log(`🔄 [API재시도] ${retryCount + 1}/${maxRetries} 재시도: ${callId || 'unnamed'}`);
          
          // 재시도 전 대기
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * (retryCount + 1)));
          
          return callWithRetry(apiCall, callId, retryCount + 1);
        }
        throw error;
      }
    },
    [throttledCall, maxRetries, retryDelayMs]
  );

  // 안전한 API 호출 (모든 방지 로직 적용)
  const safeApiCall = useCallback(
    <T>(
      apiCall: (signal?: AbortSignal) => Promise<T>,
      callId?: string
    ): Promise<T> => {
      console.log(`🛡️ [API안전호출] 시작: ${callId || 'unnamed'}`);
      return callWithRetry(apiCall, callId);
    },
    [callWithRetry]
  );

  // 진행 중인 호출 상태 확인
  const isCallInProgress = useCallback((callId: string): boolean => {
    return activeCallsRef.current.has(callId);
  }, []);

  // 모든 진행 중인 호출 취소
  const cancelAllCalls = useCallback(() => {
    console.log('🛑 [API호출] 모든 진행 중인 호출 취소');
    cancelPendingRequests();
    activeCallsRef.current.clear();
    setState(prev => ({
      ...prev,
      isLoading: false
    }));
  }, [cancelPendingRequests]);

  return {
    // 상태
    isLoading: state.isLoading,
    error: state.error,
    lastCallTime: state.lastCallTime,
    callCount: state.callCount,
    
    // 호출 메서드
    debouncedCall,
    throttledCall,
    safeApiCall,
    
    // 유틸리티
    isCallInProgress,
    cancelAllCalls,
    cancelPendingRequests
  };
};

export default useApiCallPrevention;

