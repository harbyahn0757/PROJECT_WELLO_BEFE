/**
 * 건강 데이터 관리 훅
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { healthConnectService } from '../../services/health/HealthConnectService';
import {
  HealthData,
  HealthDataState,
  HealthConnectError,
  TilkoAuthRequest
} from '../../types/health';

interface UseHealthDataOptions {
  autoFetch?: boolean;
  cacheTime?: number;
  retryOnError?: boolean;
}

export const useHealthData = (options: UseHealthDataOptions = {}) => {
  const {
    autoFetch = false,
    cacheTime = 5 * 60 * 1000, // 5분
    retryOnError = true
  } = options;

  const [state, setState] = useState<HealthDataState>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null
  });

  const [authToken, setAuthToken] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  /**
   * 로딩 상태 설정
   */
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  /**
   * 에러 상태 설정
   */
  const setError = useCallback((error: HealthConnectError | null) => {
    setState(prev => ({ ...prev, error, loading: false }));
  }, []);

  /**
   * 데이터 설정
   */
  const setData = useCallback((data: HealthData | null) => {
    setState(prev => ({
      ...prev,
      data,
      loading: false,
      error: null,
      lastFetch: new Date().toISOString()
    }));
  }, []);

  /**
   * 캐시 유효성 검사
   */
  const isCacheValid = useCallback(() => {
    if (!state.lastFetch) return false;
    const lastFetchTime = new Date(state.lastFetch).getTime();
    const now = new Date().getTime();
    return (now - lastFetchTime) < cacheTime;
  }, [state.lastFetch, cacheTime]);

  /**
   * 사용자 인증
   */
  const authenticate = useCallback(async (authRequest: TilkoAuthRequest) => {
    try {
      setLoading(true);
      setError(null);

      const response = await healthConnectService.authenticate(authRequest);
      
      if (response.success && response.token) {
        setAuthToken(response.token);
        return response;
      } else {
        throw new Error(response.message || '인증에 실패했습니다');
      }
    } catch (error) {
      const healthError = error as HealthConnectError;
      setError(healthError);
      throw healthError;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * 건강 데이터 조회
   */
  const fetchHealthData = useCallback(async (
    token?: string,
    startDate?: string,
    endDate?: string,
    forceRefresh = false
  ) => {
    // 캐시가 유효하고 강제 새로고침이 아닌 경우 캐시된 데이터 사용
    if (!forceRefresh && isCacheValid() && state.data) {
      console.log('[useHealthData] 캐시된 데이터 사용');
      return state.data;
    }

    // 토큰 확인
    const targetToken = token || authToken;
    if (!targetToken) {
      const error = new Error('인증 토큰이 필요합니다') as HealthConnectError;
      error.code = 'NO_TOKEN';
      setError(error);
      throw error;
    }

    try {
      // 이전 요청 취소
      if (abortController.current) {
        abortController.current.abort();
      }
      abortController.current = new AbortController();

      setLoading(true);
      setError(null);

      const response = await healthConnectService.getHealthData(
        targetToken,
        startDate,
        endDate
      );

      if (response.success && response.data) {
        setData(response.data);
        return response.data;
      } else {
        throw new Error(response.message || '데이터 조회에 실패했습니다');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[useHealthData] 요청이 취소되었습니다');
        return;
      }

      const healthError = error as HealthConnectError;
      setError(healthError);
      
      // 자동 재시도
      if (retryOnError && healthError.code !== 'NO_TOKEN') {
        console.log('[useHealthData] 에러 발생, 재시도 예정');
        setTimeout(() => {
          fetchHealthData(targetToken, startDate, endDate, true);
        }, 3000);
      }
      
      throw healthError;
    }
  }, [authToken, isCacheValid, state.data, setLoading, setError, setData, retryOnError]);

  /**
   * 데이터 새로고침
   */
  const refresh = useCallback((startDate?: string, endDate?: string) => {
    return fetchHealthData(authToken || undefined, startDate, endDate, true);
  }, [fetchHealthData, authToken]);

  /**
   * 데이터 초기화
   */
  const reset = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort();
    }
    setState({
      data: null,
      loading: false,
      error: null,
      lastFetch: null
    });
    setAuthToken(null);
  }, []);

  /**
   * 자동 페치
   */
  useEffect(() => {
    if (autoFetch && authToken && !state.data && !state.loading) {
      fetchHealthData();
    }
  }, [autoFetch, authToken, state.data, state.loading, fetchHealthData]);

  /**
   * 컴포넌트 언마운트 시 정리
   */
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  return {
    // 상태
    data: state.data,
    loading: state.loading,
    error: state.error,
    lastFetch: state.lastFetch,
    isAuthenticated: !!authToken,
    
    // 액션
    authenticate,
    fetchHealthData,
    refresh,
    reset,
    
    // 유틸리티
    isCacheValid: isCacheValid()
  };
};
