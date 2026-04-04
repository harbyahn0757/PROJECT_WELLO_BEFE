/**
 * 비밀번호 세션 가드 훅
 * - 세션 만료 시: onSessionExpired 콜백 또는 메인 페이지 리디렉션
 * - 사용자 활동 감지 시: 세션 자동 연장
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PasswordSessionService } from '../services/PasswordSessionService';

interface PasswordSessionGuardOptions {
  enabled?: boolean;
  checkInterval?: number; // ms
  excludePaths?: string[]; // 체크하지 않을 경로들
  onSessionExpired?: (uuid: string, hospitalId: string) => void; // 만료 시 콜백 (리디렉션 대신)
  autoRefresh?: boolean; // 사용자 활동 시 자동 연장
}

export const usePasswordSessionGuard = (options: PasswordSessionGuardOptions = {}) => {
  const {
    enabled = true,
    checkInterval = 30000, // 30초마다 체크
    excludePaths = ['/'], // 메인 페이지는 제외
    onSessionExpired,
    autoRefresh = false
  } = options;

  const navigate = useNavigate();
  const location = useLocation();
  const lastRefreshRef = useRef<number>(0);

  const checkPasswordSession = useCallback(async (): Promise<boolean> => {
    try {
      if (excludePaths.some(path => location.pathname === path)) {
        return true;
      }

      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');

      if (!uuid || !hospital) {
        console.log('⚠️ [세션가드] UUID 또는 병원ID 없음 - 메인으로 리디렉션');
        navigate(`/?uuid=${uuid || ''}&hospital=${hospital || ''}`);
        return false;
      }

      const sessionResult = await PasswordSessionService.isSessionValid(uuid, hospital);

      if (!sessionResult.success) {
        console.log('🔒 [세션가드] 세션 만료:', sessionResult.message);
        if (onSessionExpired) {
          onSessionExpired(uuid, hospital);
        } else {
          navigate(`/?uuid=${uuid}&hospital=${hospital}`);
        }
        return false;
      }

      console.log('✅ [세션가드] 세션 유효 - 페이지 유지');
      return true;

    } catch (error) {
      console.error('❌ [세션가드] 세션 확인 실패:', error);
      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');
      if (onSessionExpired && uuid && hospital) {
        onSessionExpired(uuid, hospital);
      } else {
        navigate(`/?uuid=${uuid || ''}&hospital=${hospital || ''}`);
      }
      return false;
    }
  }, [location, navigate, excludePaths, onSessionExpired]);

  // 페이지 로드 시 즉시 세션 체크
  useEffect(() => {
    if (!enabled) return;
    checkPasswordSession();
  }, [enabled, checkPasswordSession]);

  // 주기적 세션 체크
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      checkPasswordSession();
    }, checkInterval);
    return () => clearInterval(interval);
  }, [enabled, checkInterval, checkPasswordSession]);

  // 사용자 활동 감지 → 세션 자동 연장
  useEffect(() => {
    if (!enabled || !autoRefresh) return;

    const handleActivity = () => {
      const now = Date.now();
      // 60초에 한 번만 갱신 (디바운스)
      if (now - lastRefreshRef.current < 60000) return;
      lastRefreshRef.current = now;

      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');
      if (uuid && hospital) {
        PasswordSessionService.refreshSession(uuid, hospital);
      }
    };

    const events = ['touchstart', 'click', 'keydown', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [enabled, autoRefresh, location.search]);

  // 페이지 새로고침 시 세션 상태 저장
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');

      if (uuid && hospital) {
        localStorage.setItem('welno_last_page', JSON.stringify({
          path: location.pathname,
          search: location.search,
          uuid,
          hospital,
          timestamp: Date.now()
        }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, location]);

  // 페이지 로드 시 이전 페이지 복구 체크
  useEffect(() => {
    if (!enabled) return;

    const handlePageRestore = async () => {
      const lastPageData = localStorage.getItem('welno_last_page');
      if (!lastPageData) return;

      try {
        const pageData = JSON.parse(lastPageData);
        const { uuid, hospital, timestamp } = pageData;

        if (Date.now() - timestamp > 5 * 60 * 1000) {
          localStorage.removeItem('welno_last_page');
          return;
        }

        if (location.pathname === '/' && pageData.path !== '/') {
          console.log('🔄 [세션가드] 페이지 복구 시도:', pageData.path);
          const sessionResult = await PasswordSessionService.isSessionValid(uuid, hospital);

          if (sessionResult.success) {
            console.log('✅ [세션가드] 세션 유효 - 이전 페이지 복구');
            navigate(pageData.path + pageData.search);
          } else {
            console.log('🔒 [세션가드] 세션 만료 - 메인 페이지 유지');
          }
        }

        localStorage.removeItem('welno_last_page');
      } catch (error) {
        console.error('❌ [세션가드] 페이지 복구 실패:', error);
        localStorage.removeItem('welno_last_page');
      }
    };

    const timer = setTimeout(handlePageRestore, 1000);
    return () => clearTimeout(timer);
  }, [enabled, location.pathname, navigate]);

  return {
    checkPasswordSession
  };
};

export default usePasswordSessionGuard;
