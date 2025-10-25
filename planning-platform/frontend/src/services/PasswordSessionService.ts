/**
 * 비밀번호 세션 관리 서비스
 * 서버 기반 세션 토큰을 통한 안전한 인증 상태 관리
 */

import { DeviceFingerprint } from './DeviceFingerprint';
import { API_ENDPOINTS } from '../config/api';
import { STORAGE_KEYS } from '../constants/storage';

interface SessionData {
  sessionToken: string;
  expiresAt: string;
  durationMinutes: number;
}

interface SessionVerifyResult {
  success: boolean;
  patientUuid?: string;
  hospitalId?: string;
  expiresAt?: string;
  message?: string;
}

export class PasswordSessionService {
  private static readonly STORAGE_KEY_PREFIX = STORAGE_KEYS.PASSWORD_SESSION_PREFIX;
  private static deviceFingerprint: string | null = null;
  
  // 사용자별 고유 세션 키 생성
  private static getStorageKey(uuid: string, hospitalId: string): string {
    return `${this.STORAGE_KEY_PREFIX}${hospitalId}_${uuid}`;
  }

  /**
   * 디바이스 핑거프린트 초기화
   */
  static async initializeDevice(): Promise<string> {
    if (!this.deviceFingerprint) {
      this.deviceFingerprint = await DeviceFingerprint.generate();
    }
    return this.deviceFingerprint;
  }

  /**
   * 비밀번호 인증 성공 후 세션 생성
   */
  static async createSession(uuid: string, hospitalId: string): Promise<boolean> {
    try {
      // 다른 사용자 세션 정리
      this.clearOtherUserSessions(uuid, hospitalId);
      
      const deviceFingerprint = await this.initializeDevice();
      
      console.log('🔐 [세션] 생성 요청:', {
        uuid: uuid.slice(0, 8) + '...',
        hospitalId,
        device: deviceFingerprint.slice(0, 16) + '...'
      });

      const response = await fetch(
        API_ENDPOINTS.PASSWORD.CREATE_SESSION(uuid, hospitalId),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceFingerprint
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [세션] 생성 실패:', errorData);
        return false;
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // 세션 데이터를 localStorage에 저장
        const sessionData: SessionData = {
          sessionToken: result.data.sessionToken,
          expiresAt: result.data.expiresAt,
          durationMinutes: result.data.durationMinutes
        };

        localStorage.setItem(this.getStorageKey(uuid, hospitalId), JSON.stringify(sessionData));
        
        console.log('✅ [세션] 생성 완료:', {
          token: result.data.sessionToken.slice(0, 8) + '...',
          expires: result.data.expiresAt,
          duration: result.data.durationMinutes + '분'
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ [세션] 생성 오류:', error);
      return false;
    }
  }

  /**
   * 현재 세션이 유효한지 확인
   */
  static async isSessionValid(uuid?: string, hospitalId?: string): Promise<SessionVerifyResult> {
    try {
      const sessionData = this.getStoredSession(uuid, hospitalId);
      if (!sessionData) {
        return { success: false, message: '저장된 세션이 없습니다.' };
      }

      // 로컬 만료 시간 확인
      const expiresAt = new Date(sessionData.expiresAt);
      const now = new Date();
      
      if (now >= expiresAt) {
        this.clearSession();
        return { success: false, message: '세션이 만료되었습니다.' };
      }

      const deviceFingerprint = await this.initializeDevice();

      console.log('🔍 [세션] 유효성 확인:', {
        token: sessionData.sessionToken.slice(0, 8) + '...',
        device: deviceFingerprint.slice(0, 16) + '...',
        expires: sessionData.expiresAt
      });

      const response = await fetch(API_ENDPOINTS.PASSWORD.VERIFY_SESSION(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionToken: sessionData.sessionToken,
          deviceFingerprint
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          // 서버에서 세션 무효 판정
          this.clearSession();
          return { success: false, message: '세션이 유효하지 않습니다.' };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('✅ [세션] 유효 확인:', {
          uuid: result.data.patientUuid.slice(0, 8) + '...',
          hospitalId: result.data.hospitalId,
          expires: result.data.expiresAt
        });

        return {
          success: true,
          patientUuid: result.data.patientUuid,
          hospitalId: result.data.hospitalId,
          expiresAt: result.data.expiresAt
        };
      }

      this.clearSession();
      return { success: false, message: result.message || '세션 확인 실패' };
      
    } catch (error) {
      console.error('❌ [세션] 확인 오류:', error);
      this.clearSession();
      return { success: false, message: '세션 확인 중 오류가 발생했습니다.' };
    }
  }

  /**
   * 세션 무효화 (로그아웃)
   */
  static async invalidateSession(): Promise<boolean> {
    try {
      const sessionData = this.getStoredSession();
      if (!sessionData) {
        return true; // 이미 세션이 없음
      }

      console.log('🚪 [세션] 무효화 요청:', {
        token: sessionData.sessionToken.slice(0, 8) + '...'
      });

      const response = await fetch(
        API_ENDPOINTS.PASSWORD.INVALIDATE_SESSION(sessionData.sessionToken),
        {
          method: 'DELETE'
        }
      );

      const result = await response.json();
      
      // 서버 응답과 관계없이 로컬 세션은 삭제
      this.clearSession();
      
      console.log('✅ [세션] 무효화 완료:', result.message);
      return true;
      
    } catch (error) {
      console.error('❌ [세션] 무효화 오류:', error);
      // 오류가 발생해도 로컬 세션은 삭제
      this.clearSession();
      return false;
    }
  }

  /**
   * 저장된 세션 데이터 조회
   */
  private static getStoredSession(uuid?: string, hospitalId?: string): SessionData | null {
    try {
      // uuid와 hospitalId가 제공되면 해당 사용자의 세션을 가져옴
      const storageKey = (uuid && hospitalId) ? this.getStorageKey(uuid, hospitalId) : this.STORAGE_KEY_PREFIX + 'default';
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        return null;
      }

      const sessionData: SessionData = JSON.parse(stored);
      
      // 필수 필드 확인
      if (!sessionData.sessionToken || !sessionData.expiresAt) {
        console.warn('⚠️ [세션] 잘못된 세션 데이터 형식');
        this.clearSession();
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('❌ [세션] 데이터 파싱 오류:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * 로컬 세션 데이터 삭제
   */
  static clearSession(uuid?: string, hospitalId?: string): void {
    if (uuid && hospitalId) {
      localStorage.removeItem(this.getStorageKey(uuid, hospitalId));
      console.log(`🧹 [세션] 사용자별 세션 삭제: ${hospitalId}_${uuid}`);
    } else {
      // 모든 세션 삭제 (폴백)
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.STORAGE_KEY_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log('🧹 [세션] 모든 세션 삭제 완료');
    }
  }

  /**
   * 세션 만료까지 남은 시간 (분)
   */
  static getTimeUntilExpiry(): number | null {
    const sessionData = this.getStoredSession();
    if (!sessionData) {
      return null;
    }

    const expiresAt = new Date(sessionData.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 0;
    }

    return Math.floor(diffMs / (1000 * 60)); // 분 단위
  }

  /**
   * 다른 사용자 세션 정리 (보안 강화)
   */
  private static clearOtherUserSessions(currentUuid: string, currentHospitalId: string): void {
    try {
      const keys = Object.keys(localStorage);
      const currentKey = this.getStorageKey(currentUuid, currentHospitalId);
      
      keys.forEach(key => {
        // 비밀번호 세션 키이면서 현재 사용자가 아닌 경우 삭제
        if (key.startsWith(this.STORAGE_KEY_PREFIX) && key !== currentKey) {
          localStorage.removeItem(key);
          console.log(`🧹 [세션] 다른 사용자 세션 삭제: ${key}`);
        }
        
        // 레거시 키들도 삭제
        if (key === STORAGE_KEYS.PASSWORD_AUTH_TIME_LEGACY || 
            key.startsWith('password_auth_time_')) {
          localStorage.removeItem(key);
          console.log(`🧹 [세션] 레거시 키 삭제: ${key}`);
        }
      });
    } catch (error) {
      console.error('❌ [세션] 다른 사용자 세션 정리 오류:', error);
    }
  }

  /**
   * 기존 전역 세션 데이터 정리 (마이그레이션용)
   */
  static cleanupLegacySessions(): void {
    try {
      // 모든 레거시 키들 제거
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key === STORAGE_KEYS.PASSWORD_AUTH_TIME_LEGACY || 
            key.startsWith('password_auth_time_') ||
            key === 'wello_password_session') {
          localStorage.removeItem(key);
          console.log(`🧹 [세션] 레거시 키 제거: ${key}`);
        }
      });
    } catch (error) {
      console.error('❌ [세션] 레거시 세션 정리 오류:', error);
    }
  }

  /**
   * 세션 상태 정보 조회
   */
  static getSessionInfo(): {
    hasSession: boolean;
    expiresAt?: string;
    timeUntilExpiry?: number;
    deviceFingerprint?: string;
  } {
    const sessionData = this.getStoredSession();
    const deviceFingerprint = DeviceFingerprint.getCached();
    
    if (!sessionData) {
      return {
        hasSession: false,
        deviceFingerprint: deviceFingerprint || undefined
      };
    }

    return {
      hasSession: true,
      expiresAt: sessionData.expiresAt,
      timeUntilExpiry: this.getTimeUntilExpiry() || undefined,
      deviceFingerprint: deviceFingerprint || undefined
    };
  }

  /**
   * 활성 세션 목록 조회 (관리용)
   */
  static async getActiveSessions(uuid: string, hospitalId: string): Promise<any> {
    try {
      console.log('📋 [세션] 활성 세션 조회:', {
        uuid: uuid.slice(0, 8) + '...',
        hospitalId
      });

      const response = await fetch(
        API_ENDPOINTS.PASSWORD.GET_SESSIONS(uuid, hospitalId)
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      console.log('📋 [세션] 활성 세션 목록:', result.data);
      return result;
      
    } catch (error: any) {
      console.error('❌ [세션] 목록 조회 오류:', error);
      return { success: false, error: error.message };
    }
  }
}
