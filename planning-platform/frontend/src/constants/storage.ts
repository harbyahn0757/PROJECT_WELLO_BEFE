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
  
  // UI 상태 관리
  TILKO_INFO_CONFIRMING: 'tilko_info_confirming',
  START_INFO_CONFIRMATION: 'start_info_confirmation',
  
  // 데이터 캐시 (WelloDataContext)
  CACHE_PREFIX: 'wello_cache_',
  
  // 사용자 설정
  USER_PREFERENCES: 'user_preferences',
  THEME_SETTING: 'theme_setting'
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

// 스토리지 유틸리티 클래스
export class StorageManager {
  /**
   * 안전한 localStorage 아이템 가져오기
   */
  static getItem<T = string>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue || null;
      
      // JSON 파싱 시도
      try {
        return JSON.parse(item) as T;
      } catch {
        // 파싱 실패 시 문자열로 반환
        return item as unknown as T;
      }
    } catch (error) {
      console.warn(`localStorage 읽기 실패 (${key}):`, error);
      return defaultValue || null;
    }
  }

  /**
   * 안전한 localStorage 아이템 저장
   */
  static setItem(key: string, value: any): boolean {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, stringValue);
      return true;
    } catch (error) {
      console.warn(`localStorage 저장 실패 (${key}):`, error);
      return false;
    }
  }

  /**
   * localStorage 아이템 제거
   */
  static removeItem(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`localStorage 제거 실패 (${key}):`, error);
      return false;
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
    console.group('🔑 [Tilko스토리지] Tilko 관련 키들');
    Object.values(STORAGE_KEYS).forEach(key => {
      if (key.startsWith('tilko_') || key.startsWith('start_')) {
        const value = localStorage.getItem(key);
        console.log(`${key}:`, value);
      }
    });
    console.groupEnd();
  }
}
