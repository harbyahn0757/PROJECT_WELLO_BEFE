/**
 * 비밀번호 모달 관련 타입 정의
 */

export type PasswordModalType = 'setup' | 'confirm' | 'change' | 'prompt';

export interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (type: PasswordModalType) => void;
  onCancel?: () => void;
  type: PasswordModalType;
  uuid: string;
  hospitalId: string;
  initialMessage?: string;
}

export interface PasswordKeypadProps {
  onNumberClick: (number: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

export interface PasswordDotsProps {
  length: number;
  maxLength: number;
}

export interface PasswordState {
  hasPassword: boolean;
  isPasswordRequired: boolean;
  showPasswordModal: boolean;
  passwordModalType: PasswordModalType;
  attempts: number;
  isLocked: boolean;
  lockoutTime?: Date;
}

export interface PasswordServiceResponse {
  success: boolean;
  message: string;
  hasPassword?: boolean;
  isLocked?: boolean;
  shouldPrompt?: boolean;
}

export interface PasswordCheckResponse {
  has_password: boolean;
  is_locked: boolean;
}

export interface PasswordPromptCheckResponse {
  should_prompt: boolean;
}

export interface PasswordSetRequest {
  password: string;
}

export interface PasswordVerifyRequest {
  password: string;
}

export interface PasswordChangeRequest {
  old_password: string;
  new_password: string;
}

export interface PasswordApiResponse {
  success: boolean;
  message?: string;
  data?: {
    hasPassword: boolean;
    attempts: number;
    isLocked: boolean;
    lockoutTime?: string;
    shouldPrompt?: boolean;
  };
}

export const PASSWORD_POLICY = {
  LENGTH: 6,                    // 정확히 6자리
  MAX_ATTEMPTS: 5,              // 최대 시도 횟수
  LOCKOUT_DURATION: 30 * 60,    // 30분 잠금 (초)
  PROMPT_INTERVAL: 30 * 24 * 60 * 60, // 30일마다 설정 권유 (초)
  HASH_ROUNDS: 12,              // bcrypt 라운드
  AUTH_VALID_DURATION: 5 * 60,  // 5분 동안 재인증 불필요 (초)
} as const;
