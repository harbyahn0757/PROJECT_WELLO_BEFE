/**
 * 비밀번호 세션 가드 훅
 * 다른 페이지에서 세션 만료 시 메인 페이지로 리디렉션
 */
import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PasswordSessionService } from '../services/PasswordSessionService';

interface PasswordSessionGuardOptions {
  enabled?: boolean;
  checkInterval?: number; // ms
  excludePaths?: string[]; // 체크하지 않을 경로들
}

export const usePasswordSessionGuard = (options: PasswordSessionGuardOptions = {}) => {
  const {
    enabled = true,
    checkInterval = 30000, // 30초마다 체크
    excludePaths = ['/'] // 메인 페이지는 제외 (basename="/wello"이므로 내부적으로는 "/"가 메인)
  } = options;

  const navigate = useNavigate();
  const location = useLocation();

  const checkPasswordSession = useCallback(async (): Promise<boolean> => {
    try {
      // 현재 경로가 제외 경로에 포함되면 체크하지 않음
      if (excludePaths.some(path => location.pathname === path)) {
        return true;
      }

      // URL에서 uuid와 hospital 파라미터 추출
      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');

      if (!uuid || !hospital) {
        console.log('⚠️ [세션가드] UUID 또는 병원ID 없음 - 메인으로 리디렉션');
        navigate(`/?uuid=${uuid || ''}&hospital=${hospital || ''}`);
        return false;
      }

      // 비밀번호 세션 유효성 확인
      const sessionResult = await PasswordSessionService.isSessionValid(uuid, hospital);
      
      if (!sessionResult.success) {
        console.log('🔒 [세션가드] 세션 만료 - 메인으로 리디렉션:', sessionResult.message);
        navigate(`/?uuid=${uuid}&hospital=${hospital}`);
        return false;
      }

      console.log('✅ [세션가드] 세션 유효 - 페이지 유지');
      return true;

    } catch (error) {
      console.error('❌ [세션가드] 세션 확인 실패:', error);
      
      // 에러 발생 시에도 메인으로 리디렉션
      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');
      navigate(`/?uuid=${uuid || ''}&hospital=${hospital || ''}`);
      return false;
    }
  }, [location, navigate, excludePaths]);

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

  // 페이지 새로고침 시 세션 체크
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      // 페이지 새로고침 시 세션 상태를 localStorage에 저장
      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital');
      
      if (uuid && hospital) {
        localStorage.setItem('wello_last_page', JSON.stringify({
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
      const lastPageData = localStorage.getItem('wello_last_page');
      if (!lastPageData) return;

      try {
        const pageData = JSON.parse(lastPageData);
        const { uuid, hospital, timestamp } = pageData;

        // 5분 이내의 데이터만 유효
        if (Date.now() - timestamp > 5 * 60 * 1000) {
          localStorage.removeItem('wello_last_page');
          return;
        }

        // 현재 페이지가 메인 페이지이고, 이전에 다른 페이지에 있었다면
        if (location.pathname === '/' && pageData.path !== '/') {
          console.log('🔄 [세션가드] 페이지 복구 시도:', pageData.path);
          
          // 세션 유효성 확인
          const sessionResult = await PasswordSessionService.isSessionValid(uuid, hospital);
          
          if (sessionResult.success) {
            console.log('✅ [세션가드] 세션 유효 - 이전 페이지 복구');
            navigate(pageData.path + pageData.search);
          } else {
            console.log('🔒 [세션가드] 세션 만료 - 메인 페이지 유지');
          }
        }

        // 복구 시도 후 데이터 삭제
        localStorage.removeItem('wello_last_page');

      } catch (error) {
        console.error('❌ [세션가드] 페이지 복구 실패:', error);
        localStorage.removeItem('wello_last_page');
      }
    };

    // 페이지 로드 후 약간의 지연을 두고 복구 시도
    const timer = setTimeout(handlePageRestore, 1000);
    return () => clearTimeout(timer);
  }, [enabled, location.pathname, navigate]);

  return {
    checkPasswordSession
  };
};

export default usePasswordSessionGuard;
