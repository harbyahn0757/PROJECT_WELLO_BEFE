/**
 * 프론트엔드 상태 디버깅 로거
 * localStorage 상태를 서버로 전송하여 모바일 디버깅 지원
 */

import { API_ENDPOINTS } from '../config/api';

interface FrontendStateLog {
  page_path: string;
  user_agent?: string;
  localStorage_state: Record<string, any>;
  session_storage_state?: Record<string, any>;
  url_params?: Record<string, string>;
  timestamp?: string;
}

/**
 * 현재 localStorage 상태를 수집
 */
function collectLocalStorageState(): Record<string, any> {
  const state: Record<string, any> = {};
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        try {
          // JSON 파싱 시도
          state[key] = value ? JSON.parse(value) : value;
        } catch {
          // 파싱 실패 시 문자열로 저장
          state[key] = value;
        }
      }
    }
  } catch (error) {
    console.warn('[DebugLogger] localStorage 수집 실패:', error);
  }
  
  return state;
}

/**
 * 현재 sessionStorage 상태를 수집
 */
function collectSessionStorageState(): Record<string, any> {
  const state: Record<string, any> = {};
  
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const value = sessionStorage.getItem(key);
        try {
          state[key] = value ? JSON.parse(value) : value;
        } catch {
          state[key] = value;
        }
      }
    }
  } catch (error) {
    console.warn('[DebugLogger] sessionStorage 수집 실패:', error);
  }
  
  return state;
}

/**
 * URL 파라미터를 수집
 */
function collectUrlParams(): Record<string, string> {
  const params: Record<string, string> = {};
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.forEach((value, key) => {
      params[key] = value;
    });
  } catch (error) {
    console.warn('[DebugLogger] URL 파라미터 수집 실패:', error);
  }
  
  return params;
}

/**
 * 프론트엔드 상태를 서버로 전송
 */
export async function sendFrontendStateToServer(
  customData?: Partial<FrontendStateLog>
): Promise<boolean> {
  try {
    const stateData: FrontendStateLog = {
      page_path: window.location.pathname,
      user_agent: navigator.userAgent,
      localStorage_state: collectLocalStorageState(),
      session_storage_state: collectSessionStorageState(),
      url_params: collectUrlParams(),
      timestamp: new Date().toISOString(),
      ...customData
    };

    const response = await fetch(API_ENDPOINTS.DEBUG.FRONTEND_STATE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stateData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[DebugLogger] 상태 전송 성공:', result);
      return true;
    } else {
      console.error('[DebugLogger] 상태 전송 실패:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('[DebugLogger] 상태 전송 오류:', error);
    return false;
  }
}

/**
 * 페이지 로드 시 자동으로 상태 전송
 */
export function sendStateOnPageLoad(): void {
  // 페이지 로드 후 1초 뒤에 전송 (초기화 완료 대기)
  setTimeout(() => {
    sendFrontendStateToServer({
      page_path: `${window.location.pathname} (페이지 로드)`
    });
  }, 1000);
}

/**
 * 플로팅 버튼 관련 핵심 상태만 추출
 */
export function getFloatingButtonStates(): Record<string, any> {
  const floatingButtonKeys = [
    'collectingStatus',
    'passwordModalOpen', 
    'tilko_auth_waiting',
    'tilko_auth_method_selection',
    'tilko_info_confirming',
    'tilko_manual_collect',
    'tilko_collecting_status',
    'isDataCollectionCompleted',
    'showPasswordModal',
    'authFlow',
    'welno_patient_uuid',
    'welno_hospital_id',
    'campaign_mode'
  ];
  
  const states: Record<string, any> = {};
  floatingButtonKeys.forEach(key => {
    const value = localStorage.getItem(key);
    if (value !== null) {
      try {
        states[key] = JSON.parse(value);
      } catch {
        states[key] = value;
      }
    }
  });
  
  return states;
}

/**
 * 플로팅 버튼 상태 변경 시 자동 전송
 */
export function sendStateOnFloatingButtonChange(): void {
  sendFrontendStateToServer({
    page_path: `${window.location.pathname} (플로팅 버튼 상태 변경)`
  });
}