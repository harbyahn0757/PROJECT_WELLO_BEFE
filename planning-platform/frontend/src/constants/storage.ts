/**
 * 로컬 스토리지 키 관리 및 유틸리티
 * localStorage 사용을 일관성 있게 관리
 */

// localStorage 키 상수
export const STORAGE_KEYS = {
  // Tilko 세션 관련
  TILKO_SESSION_ID: 'tilko_session_id',
  TILKO_SESSION_DATA: 'tilko_session_data',
  TILKO_AUTH_COMPLETED: 'tilko_auth_completed',
  TILKO_AUTH_REQUESTED: 'tilko_auth_requested',
  TILKO_COLLECTED_DATA: 'tilko_collected_data',
  TILKO_SELECTED_AUTH_TYPE: 'tilko_selected_auth_type',
  TILKO_TERMS_AGREED: 'tilko_terms_agreed',
  TILKO_MANUAL_COLLECT: 'tilko_manual_collect',
  TILKO_COLLECTING_STATUS: 'tilko_collecting_status',
  TILKO_AUTH_WAITING: 'tilko_auth_waiting',
  TILKO_AUTH_METHOD_SELECTION: 'tilko_auth_method_selection',
  
  // UI 상태 관리
  TILKO_INFO_CONFIRMING: 'tilko_info_confirming',
  START_INFO_CONFIRMATION: 'start_info_confirmation',
  
  // 환자 정보
  PATIENT_UUID: 'welno_patient_uuid',
  HOSPITAL_ID: 'welno_hospital_id',
  PATIENT_NAME: 'welno_patient_name',
  PATIENT_BIRTH_DATE: 'welno_patient_birth_date',
  
  // 데이터 캐시 (WelnoDataContext)
  CACHE_PREFIX: 'welno_cache_',
  
  // 사용자 설정
  USER_PREFERENCES: 'user_preferences',
  THEME_SETTING: 'theme_setting',
  
  // 비밀번호 시스템
  PASSWORD_MODAL_OPEN: 'password_modal_open',
  PASSWORD_SESSION_PREFIX: 'welno_password_session_',
  PASSWORD_AUTH_TIME_LEGACY: 'password_auth_time', // 제거 예정
  
  // 인트로 티저
  INTRO_TEASER_SHOWN: 'welno_intro_teaser_shown', // 인트로 티저 표시 여부
  
  // 로그인 입력 데이터 (이탈 복구용)
  LOGIN_INPUT_DATA: 'welno_login_input_data',
  LOGIN_INPUT_LAST_UPDATED: 'welno_login_input_last_updated',
} as const;

// 스토리지 데이터 타입 정의
export interface TilkoSessionData {
  session_id: string;
  user_info: {
    name: string;
    phone: string;
    birthday: string;
  };
  created_at: string;
  token_received?: boolean;
  token_received_at?: string;
}

export interface UserPreferences {
  language: 'ko' | 'en';
  notifications: boolean;
  autoSave: boolean;
}

// 로그인 입력 데이터 인터페이스
export interface LoginInputData {
  name: string;
  phone: string;
  birthday: string;
  gender?: string;
  currentStep: 'name' | 'phone' | 'birthday' | 'auth_method' | 'completed';
  lastUpdated: string;
}

// 메모리 fallback 저장소 (localStorage 실패 시 사용)
const memoryStorage: Map<string, string> = new Map();
let localStorageAvailable: boolean | null = null;

// localStorage 사용 가능 여부 확인
function checkLocalStorageAvailable(): boolean {
  if (localStorageAvailable !== null) {
    return localStorageAvailable;
  }
  
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    localStorageAvailable = true;
    return true;
  } catch (error) {
    localStorageAvailable = false;
    console.warn('[StorageManager] localStorage 사용 불가 - 메모리 모드로 전환');
    return false;
  }
}

// 스토리지 유틸리티 클래스
export class StorageManager {
  /**
   * 안전한 localStorage 아이템 가져오기 (메모리 fallback 지원)
   */
  static getItem<T = string>(key: string, defaultValue?: T): T | null {
    try {
      // localStorage 사용 가능하면 localStorage에서 읽기
      if (checkLocalStorageAvailable()) {
        const item = localStorage.getItem(key);
        if (item !== null) {
          // JSON 파싱 시도
          try {
            return JSON.parse(item) as T;
          } catch {
            // 파싱 실패 시 문자열로 반환
            return item as unknown as T;
          }
        }
      }
      
      // localStorage 실패 또는 값이 없으면 메모리에서 읽기
      if (memoryStorage.has(key)) {
        const item = memoryStorage.get(key);
        if (item !== undefined) {
          try {
            return JSON.parse(item) as T;
          } catch {
            return item as unknown as T;
          }
        }
      }
      
      return defaultValue || null;
    } catch (error) {
      console.warn(`스토리지 읽기 실패 (${key}):`, error);
      // 메모리에서도 읽기 시도
      if (memoryStorage.has(key)) {
        const item = memoryStorage.get(key);
        if (item !== undefined) {
          try {
            return JSON.parse(item) as unknown as T;
          } catch {
            return item as unknown as T;
          }
        }
      }
      return defaultValue || null;
    }
  }

  /**
   * 안전한 localStorage 아이템 저장 (메모리 fallback 지원)
   * @returns 저장 성공 여부
   */
  static setItem(key: string, value: any): boolean {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    // localStorage 사용 가능하면 localStorage에 저장 시도
    if (checkLocalStorageAvailable()) {
      try {
        localStorage.setItem(key, stringValue);
        // 저장 성공 확인 (QuotaExceededError 등 체크)
        const saved = localStorage.getItem(key);
        if (saved === stringValue) {
          return true;
        } else {
          // 저장 실패 - 메모리로 fallback
          console.warn(`[StorageManager] localStorage 저장 실패 (${key}) - 메모리로 저장`);
          memoryStorage.set(key, stringValue);
          return true; // 메모리 저장은 성공으로 간주
        }
      } catch (error: any) {
        // QuotaExceededError 또는 기타 에러
        if (error.name === 'QuotaExceededError') {
          console.warn(`[StorageManager] localStorage 용량 초과 (${key}) - 메모리로 저장`);
        } else {
          console.warn(`[StorageManager] localStorage 저장 실패 (${key}):`, error);
        }
        // 메모리로 fallback
        memoryStorage.set(key, stringValue);
        return true; // 메모리 저장은 성공으로 간주
      }
    } else {
      // localStorage 사용 불가 - 메모리에만 저장
      memoryStorage.set(key, stringValue);
      return true; // 메모리 저장은 성공으로 간주
    }
  }
  
  /**
   * 저장 성공 여부 확인 (localStorage 사용 가능 여부 포함)
   */
  static isStorageAvailable(): boolean {
    return checkLocalStorageAvailable();
  }
  
  /**
   * 메모리 모드인지 확인
   */
  static isMemoryMode(): boolean {
    return !checkLocalStorageAvailable();
  }

  /**
   * localStorage 아이템 제거 (메모리 fallback 지원)
   */
  static removeItem(key: string): boolean {
    try {
      // localStorage에서 제거 시도
      if (checkLocalStorageAvailable()) {
        localStorage.removeItem(key);
      }
      // 메모리에서도 제거
      memoryStorage.delete(key);
      return true;
    } catch (error) {
      console.warn(`스토리지 제거 실패 (${key}):`, error);
      // 메모리에서라도 제거 시도
      memoryStorage.delete(key);
      return true;
    }
  }

  /**
   * 이벤트와 함께 아이템 저장
   */
  static setItemWithEvent(key: string, value: any, eventName: string = 'tilko-status-change'): boolean {
    const success = this.setItem(key, value);
    if (success) {
      window.dispatchEvent(new CustomEvent(eventName));
    }
    return success;
  }

  /**
   * 이벤트와 함께 아이템 제거
   */
  static removeItemWithEvent(key: string, eventName: string = 'tilko-status-change'): boolean {
    const success = this.removeItem(key);
    if (success) {
      window.dispatchEvent(new CustomEvent(eventName));
    }
    return success;
  }

  /**
   * 패턴에 맞는 모든 키 제거
   */
  static removeByPattern(pattern: string): number {
    let removedCount = 0;
    try {
      const keysToRemove: string[] = [];
      
      // localStorage의 모든 키 확인
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(pattern)) {
          keysToRemove.push(key);
        }
      }
      
      // 수집된 키들 제거
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        removedCount++;
      });
      
    } catch (error) {
      console.warn(`패턴 기반 localStorage 제거 실패 (${pattern}):`, error);
    }
    
    return removedCount;
  }

  /**
   * Tilko 세션 관련 데이터 모두 제거
   */
  static clearTilkoSession(): void {
    this.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
    this.removeItem(STORAGE_KEYS.TILKO_SESSION_DATA);
    this.removeItem(STORAGE_KEYS.TILKO_AUTH_COMPLETED);
    this.removeItem(STORAGE_KEYS.TILKO_AUTH_REQUESTED);
    this.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
    this.removeItem(STORAGE_KEYS.START_INFO_CONFIRMATION);
    this.removeItem(STORAGE_KEYS.TILKO_SELECTED_AUTH_TYPE);
  }
  
  /**
   * 인증 페이지 진입 시 초기화 (인증 방식 선택 리셋)
   */
  static resetAuthPage(): void {
    console.log('[StorageManager] 인증 페이지 초기화 - 인증 방식 선택 리셋');
    this.removeItem(STORAGE_KEYS.TILKO_SELECTED_AUTH_TYPE);
    // 메모리에서도 제거
    memoryStorage.delete(STORAGE_KEYS.TILKO_SELECTED_AUTH_TYPE);
  }

  /**
   * 캐시 데이터 정리
   */
  static clearCache(): number {
    return this.removeByPattern(STORAGE_KEYS.CACHE_PREFIX);
  }

  /**
   * 스토리지 사용량 체크 (대략적)
   */
  static getStorageSize(): number {
    let totalSize = 0;
    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const value = localStorage.getItem(key);
          if (value) {
            totalSize += key.length + value.length;
          }
        }
      }
    } catch (error) {
      console.warn('스토리지 사이즈 계산 실패:', error);
    }
    return totalSize;
  }
}

// Tilko 세션 전용 헬퍼
export class TilkoSessionStorage {
  /**
   * 세션 데이터 저장
   */
  static saveSession(sessionId: string, sessionData: TilkoSessionData): boolean {
    const success1 = StorageManager.setItem(STORAGE_KEYS.TILKO_SESSION_ID, sessionId);
    const success2 = StorageManager.setItem(STORAGE_KEYS.TILKO_SESSION_DATA, sessionData);
    return success1 && success2;
  }

  /**
   * 세션 데이터 로드
   */
  static loadSession(): { sessionId: string | null; sessionData: TilkoSessionData | null } {
    const sessionId = StorageManager.getItem<string>(STORAGE_KEYS.TILKO_SESSION_ID);
    const sessionData = StorageManager.getItem<TilkoSessionData>(STORAGE_KEYS.TILKO_SESSION_DATA);
    
    return { sessionId, sessionData };
  }

  /**
   * 토큰 수신 상태 업데이트
   */
  static updateTokenReceived(received: boolean = true): boolean {
    const sessionData = StorageManager.getItem<TilkoSessionData>(STORAGE_KEYS.TILKO_SESSION_DATA);
    if (!sessionData) return false;

    sessionData.token_received = received;
    if (received) {
      sessionData.token_received_at = new Date().toISOString();
    }

    return StorageManager.setItem(STORAGE_KEYS.TILKO_SESSION_DATA, sessionData);
  }

  /**
   * 세션 완전 정리
   */
  static clearSession(): void {
    StorageManager.clearTilkoSession();
  }
}

// 스토리지 디버그 도구
export class StorageDebugger {
  /**
   * 현재 저장된 모든 키 출력
   */
  static logAllKeys(): void {
    console.group('📦 [스토리지] 현재 저장된 키들');
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          console.log(`${key}:`, value?.substring(0, 100) + (value && value.length > 100 ? '...' : ''));
        }
      }
    } catch (error) {
      console.error('스토리지 키 로깅 실패:', error);
    }
    console.groupEnd();
  }

  /**
   * Tilko 관련 키만 출력
   */
  static logTilkoKeys(): void {
    console.group('[Tilko스토리지] Tilko 관련 키들');
    Object.values(STORAGE_KEYS).forEach(key => {
      if (key.startsWith('tilko_') || key.startsWith('start_')) {
        const value = localStorage.getItem(key);
        console.log(`${key}:`, value);
      }
    });
    console.groupEnd();
  }
}
