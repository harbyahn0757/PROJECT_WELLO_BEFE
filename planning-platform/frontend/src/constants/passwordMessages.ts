/**
 * 비밀번호 시스템 관련 메시지 상수
 */

export const PASSWORD_MESSAGES = {
  // 검증 메시지
  VALIDATION: {
    REQUIRED: '6자리 숫자를 모두 입력해주세요',
    INVALID_FORMAT: '비밀번호는 정확히 6자리 숫자여야 합니다',
    MISMATCH: '비밀번호가 일치하지 않습니다',
    TOO_SHORT: '비밀번호가 너무 짧습니다',
    TOO_LONG: '비밀번호가 너무 깁니다'
  },
  
  // 성공 메시지
  SUCCESS: {
    SET: '비밀번호가 성공적으로 설정되었습니다',
    VERIFY: '비밀번호 확인 성공',
    CHANGE: '비밀번호가 성공적으로 변경되었습니다'
  },
  
  // 실패 메시지
  ERROR: {
    SET_FAILED: '비밀번호 설정에 실패했습니다',
    VERIFY_FAILED: '비밀번호가 일치하지 않습니다',
    CHANGE_FAILED: '비밀번호 변경에 실패했습니다',
    CHECK_FAILED: '비밀번호 확인에 실패했습니다',
    NETWORK_ERROR: '네트워크 오류가 발생했습니다',
    SERVER_ERROR: '서버 오류가 발생했습니다'
  },
  
  // 보안 메시지
  SECURITY: {
    LOCKED: '너무 많은 시도로 인해 잠금되었습니다. 30분 후 다시 시도해주세요',
    ATTEMPTS_WARNING: (attempts: number) => `비밀번호가 틀렸습니다. (${attempts}/5회 시도)`,
    SESSION_EXPIRED: '세션이 만료되었습니다. 다시 인증해주세요',
    INVALID_SESSION: '세션이 유효하지 않습니다'
  },
  
  // 권유 메시지
  PROMPT: {
    TITLE: '비밀번호 설정',
    SUBTITLE: '개인정보 보호를 위해 6자리 비밀번호를 설정해주세요',
    SETUP_BUTTON: '설정하기',
    LATER_BUTTON: '나중에 하기',
    CONFIRM_TITLE: '비밀번호 확인',
    CONFIRM_SUBTITLE: '설정한 비밀번호를 입력해주세요'
  }
} as const;

// 비밀번호 정책 상수
export const PASSWORD_POLICY = {
  LENGTH: 6,
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION: 30 * 60 * 1000, // 30분 (밀리초)
  AUTH_VALID_DURATION: 30 * 60 * 1000, // 30분 (밀리초)
  PROMPT_INTERVAL: 7 * 24 * 60 * 60 * 1000, // 7일 (밀리초)
  ACCESS_THRESHOLD: 30 * 24 * 60 * 60 * 1000 // 30일 (밀리초)
} as const;

// 비밀번호 검증 유틸리티
export class PasswordValidator {
  static validate(password: string): { isValid: boolean; message?: string } {
    if (!password) {
      return { isValid: false, message: PASSWORD_MESSAGES.VALIDATION.REQUIRED };
    }
    
    if (password.length !== PASSWORD_POLICY.LENGTH) {
      return { isValid: false, message: PASSWORD_MESSAGES.VALIDATION.INVALID_FORMAT };
    }
    
    if (!/^\d+$/.test(password)) {
      return { isValid: false, message: PASSWORD_MESSAGES.VALIDATION.INVALID_FORMAT };
    }
    
    return { isValid: true };
  }
  
  static validateMatch(password: string, confirmPassword: string): { isValid: boolean; message?: string } {
    if (password !== confirmPassword) {
      return { isValid: false, message: PASSWORD_MESSAGES.VALIDATION.MISMATCH };
    }
    
    return { isValid: true };
  }
}
