/**
 * 전역 세션 감지 훅
 * 모든 페이지에서 진행 중인 Redis 세션을 감지하고 적절한 화면으로 리다이렉트
 */
import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// API 엔드포인트 (기존 config에서 가져오기)
const TILKO_API = {
  SESSION_STATUS: (sessionId: string) => `/wello-api/v1/tilko/session/status/${sessionId}`
};

interface SessionDetectionOptions {
  enabled?: boolean;
  checkInterval?: number; // ms
  maxSessionAge?: number; // ms
}

interface SessionStatus {
  sessionId: string | null;
  status: string | null;
  isActive: boolean;
  isCollecting: boolean;
  shouldRedirect: boolean;
  redirectPath: string | null;
}

export const useGlobalSessionDetection = (options: SessionDetectionOptions = {}) => {
  const {
    enabled = true,
    checkInterval = 30000, // 30초마다 체크
    maxSessionAge = 30 * 60 * 1000 // 30분
  } = options;

  const navigate = useNavigate();
  const location = useLocation();

  const checkSessionStatus = useCallback(async (): Promise<SessionStatus> => {
    const defaultStatus: SessionStatus = {
      sessionId: null,
      status: null,
      isActive: false,
      isCollecting: false,
      shouldRedirect: false,
      redirectPath: null
    };

    try {
      // 로컬 스토리지에서 세션 정보 확인
      const savedSessionId = localStorage.getItem('tilko_session_id');
      const savedSessionData = localStorage.getItem('tilko_session_data');

      if (!savedSessionId || !savedSessionData) {
        console.log('📭 [전역세션] 저장된 세션 없음');
        return defaultStatus;
      }

      const sessionData = JSON.parse(savedSessionData);
      
      // 세션 만료 시간 체크
      const sessionAge = Date.now() - new Date(sessionData.created_at).getTime();
      if (sessionAge > maxSessionAge) {
        console.log('⏰ [전역세션] 세션 만료됨 (30분 초과)');
        // 만료된 세션 정리
        localStorage.removeItem('tilko_session_id');
        localStorage.removeItem('tilko_session_data');
        return defaultStatus;
      }

      console.log('🔍 [전역세션] 서버 세션 상태 확인:', savedSessionId);

      // 서버에서 실제 세션 상태 확인
      const response = await fetch(TILKO_API.SESSION_STATUS(savedSessionId));
      
      if (!response.ok) {
        console.error('❌ [전역세션] 세션 상태 API 호출 실패:', response.status);
        return defaultStatus;
      }

      const result = await response.json();
      console.log('📊 [전역세션] 서버 응답:', result);

      if (!result.success || !result.status) {
        console.log('⚠️ [전역세션] 세션 상태 응답 오류');
        return defaultStatus;
      }

      const status = result.status;
      const isActive = !['error', 'completed'].includes(status);
      const isCollecting = ['fetching_health_data', 'fetching_prescription_data'].includes(status);

      // 리다이렉트 필요 여부 판단
      let shouldRedirect = false;
      let redirectPath = null;

      // 현재 URL 파라미터 확인
      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');

      if (isActive && uuid && hospital) {
        // 인증 관련 상태
        if (['auth_pending', 'auth_completed', 'authenticated', 'auth_waiting'].includes(status)) {
          // 현재 로그인 페이지가 아니면 리다이렉트
          if (!location.pathname.includes('/login')) {
            shouldRedirect = true;
            redirectPath = `/login?uuid=${uuid}&hospital=${hospital}`;
          }
        }
        // 데이터 수집 중 상태
        else if (isCollecting) {
          // 현재 수집 중 화면이 아니면 리다이렉트
          if (!location.pathname.includes('/collecting')) {
            shouldRedirect = true;
            redirectPath = `/collecting?uuid=${uuid}&hospital=${hospital}&session=${savedSessionId}`;
          }
        }
        // 완료 상태
        else if (status === 'completed') {
          // 결과 화면으로 리다이렉트
          if (!location.pathname.includes('/results')) {
            shouldRedirect = true;
            redirectPath = `/results-trend?uuid=${uuid}&hospital=${hospital}`;
          }
        }
      }

      return {
        sessionId: savedSessionId,
        status,
        isActive,
        isCollecting,
        shouldRedirect,
        redirectPath
      };

    } catch (error) {
      console.error('❌ [전역세션] 세션 상태 확인 실패:', error);
      return defaultStatus;
    }
  }, [location, maxSessionAge]);

  const handleSessionRedirect = useCallback(async () => {
    if (!enabled) return;

    const sessionStatus = await checkSessionStatus();

    if (sessionStatus.shouldRedirect && sessionStatus.redirectPath) {
      console.log('🔄 [전역세션] 리다이렉트:', sessionStatus.redirectPath);
      navigate(sessionStatus.redirectPath);
    }
  }, [enabled, checkSessionStatus, navigate]);

  // 초기 세션 체크
  useEffect(() => {
    handleSessionRedirect();
  }, [handleSessionRedirect]);

  // 주기적 세션 체크
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      handleSessionRedirect();
    }, checkInterval);

    return () => clearInterval(interval);
  }, [enabled, checkInterval, handleSessionRedirect]);

  // 스토리지 변경 감지 (다른 탭에서의 변경사항)
  useEffect(() => {
    if (!enabled) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tilko_session_id' || e.key === 'tilko_session_data') {
        console.log('🔄 [전역세션] 스토리지 변경 감지');
        handleSessionRedirect();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [enabled, handleSessionRedirect]);

  return {
    checkSessionStatus,
    handleSessionRedirect
  };
};

export default useGlobalSessionDetection;

