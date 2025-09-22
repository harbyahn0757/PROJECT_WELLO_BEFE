/**
 * 인증 관련 상태 타입 정의
 * AuthForm의 상태를 구조화하고 일관성 있게 관리
 */

// 인증 입력 데이터
export interface AuthInput {
  name: string;
  phoneNo: string;
  birthday: string;
  gender: string;
}

// 확인 단계 타입
export type ConfirmationStep = 'name' | 'phone' | 'birthday' | 'completed';

// 인증 상태 타입
export type AuthStatus = 
  | 'start' 
  | 'auth_requesting' 
  | 'auth_pending' 
  | 'authenticating' 
  | 'authenticated' 
  | 'fetching_health_data' 
  | 'fetching_prescription_data' 
  | 'completed' 
  | 'error';

// 에러 타입
export type ErrorType = 'validation' | 'network' | 'server' | 'auth';

// 상태 메시지
export interface StatusMessage {
  timestamp: string;
  type: string;
  message: string;
}

// 세션 진행 단계 추적
export interface SessionProgress {
  step: 'info_confirmation' | 'session_creation' | 'auth_request' | 'token_waiting' | 'token_received' | 'auth_verification' | 'data_collection' | 'completed';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  errorMessage?: string;
  retryCount?: number;
}

// 전체 세션 트래킹
export interface SessionTracking {
  sessionId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  steps: SessionProgress[];
  currentStep: SessionProgress['step'];
  metadata: {
    userAgent: string;
    platform: string;
    retryAttempts: number;
    errors: string[];
  };
}

// 세션 복구 정보
export interface SavedSessionInfo {
  sessionId: string;
  status: AuthStatus;
  data: any;
  sessionData: any;
}

// 타이핑 효과 상태
export interface TypingState {
  text: string;
  isActive: boolean;
}

// 전체 인증 상태 인터페이스
export interface AuthFormState {
  // 기본 상태
  loading: boolean;
  error: string | null;
  errorType: ErrorType | null;
  authRequested: boolean;
  currentStatus: AuthStatus;
  
  // 세션 관련
  sessionId: string | null;
  tokenReceived: boolean;
  statusMessages: StatusMessage[];
  
  // 확인 단계 관련
  currentConfirmationStep: ConfirmationStep;
  showConfirmation: boolean;
  editableName: string;
  editablePhone: string;
  editableBirthday: string;
  
  // 타이핑 효과 관련
  titleTyping: TypingState;
  descTyping: TypingState;
  messageTyping: TypingState;
  
  // 세션 복구 관련
  isRecovering: boolean;
  showSessionModal: boolean;
  savedSessionInfo: SavedSessionInfo | null;
  
  // 기타
  loadingMessage: string;
  pollingInterval: NodeJS.Timeout | null;
}

// 상태 액션 타입
export type AuthFormAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: { message: string | null; type?: ErrorType | null } }
  | { type: 'SET_AUTH_REQUESTED'; payload: boolean }
  | { type: 'SET_CURRENT_STATUS'; payload: AuthStatus }
  | { type: 'SET_SESSION_ID'; payload: string | null }
  | { type: 'SET_TOKEN_RECEIVED'; payload: boolean }
  | { type: 'SET_CONFIRMATION_STEP'; payload: ConfirmationStep }
  | { type: 'SET_SHOW_CONFIRMATION'; payload: boolean }
  | { type: 'SET_EDITABLE_DATA'; payload: { name?: string; phone?: string; birthday?: string } }
  | { type: 'SET_TYPING_STATE'; payload: { type: 'title' | 'desc' | 'message'; text: string; isActive: boolean } }
  | { type: 'SET_RECOVERY_STATE'; payload: { isRecovering?: boolean; showModal?: boolean; sessionInfo?: SavedSessionInfo | null } }
  | { type: 'RESET_STATE' };

// 상태 리듀서
export function authFormReducer(state: AuthFormState, action: AuthFormAction): AuthFormState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
      
    case 'SET_ERROR':
      return { 
        ...state, 
        error: action.payload.message, 
        errorType: action.payload.type || null 
      };
      
    case 'SET_AUTH_REQUESTED':
      return { ...state, authRequested: action.payload };
      
    case 'SET_CURRENT_STATUS':
      return { ...state, currentStatus: action.payload };
      
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
      
    case 'SET_TOKEN_RECEIVED':
      return { ...state, tokenReceived: action.payload };
      
    case 'SET_CONFIRMATION_STEP':
      return { ...state, currentConfirmationStep: action.payload };
      
    case 'SET_SHOW_CONFIRMATION':
      return { ...state, showConfirmation: action.payload };
      
    case 'SET_EDITABLE_DATA':
      return { 
        ...state, 
        editableName: action.payload.name ?? state.editableName,
        editablePhone: action.payload.phone ?? state.editablePhone,
        editableBirthday: action.payload.birthday ?? state.editableBirthday
      };
      
    case 'SET_TYPING_STATE':
      const { type, text, isActive } = action.payload;
      if (type === 'title') {
        return { ...state, titleTyping: { text, isActive } };
      } else if (type === 'desc') {
        return { ...state, descTyping: { text, isActive } };
      } else {
        return { ...state, messageTyping: { text, isActive } };
      }
      
    case 'SET_RECOVERY_STATE':
      return { 
        ...state, 
        isRecovering: action.payload.isRecovering ?? state.isRecovering,
        showSessionModal: action.payload.showModal ?? state.showSessionModal,
        savedSessionInfo: action.payload.sessionInfo ?? state.savedSessionInfo
      };
      
    case 'RESET_STATE':
      return getInitialAuthFormState();
      
    default:
      return state;
  }
}

// 초기 상태 생성자
export function getInitialAuthFormState(): AuthFormState {
  return {
    loading: false,
    error: null,
    errorType: null,
    authRequested: false,
    currentStatus: 'start',
    
    sessionId: null,
    tokenReceived: false,
    statusMessages: [],
    
    currentConfirmationStep: 'name',
    showConfirmation: false,
    editableName: '',
    editablePhone: '',
    editableBirthday: '',
    
    titleTyping: { text: '', isActive: false },
    descTyping: { text: '', isActive: false },
    messageTyping: { text: '', isActive: false },
    
    isRecovering: false,
    showSessionModal: false,
    savedSessionInfo: null,
    
    loadingMessage: '',
    pollingInterval: null
  };
}

// 상태 유효성 검사
export function validateAuthFormState(state: AuthFormState): boolean {
  // 기본 필수 필드 검사
  if (typeof state.loading !== 'boolean') return false;
  if (typeof state.authRequested !== 'boolean') return false;
  if (typeof state.tokenReceived !== 'boolean') return false;
  
  // 상태 값 검사
  const validStatuses: AuthStatus[] = [
    'start', 'auth_requesting', 'auth_pending', 'authenticating', 
    'authenticated', 'fetching_health_data', 'fetching_prescription_data', 
    'completed', 'error'
  ];
  if (!validStatuses.includes(state.currentStatus)) return false;
  
  // 확인 단계 검사
  const validSteps: ConfirmationStep[] = ['name', 'phone', 'birthday', 'completed'];
  if (!validSteps.includes(state.currentConfirmationStep)) return false;
  
  return true;
}

// 상태 디버그 헬퍼
export function debugAuthFormState(state: AuthFormState): void {
  console.group('🔍 [인증상태] 현재 상태 디버깅');
  console.log('기본 상태:', {
    loading: state.loading,
    authRequested: state.authRequested,
    currentStatus: state.currentStatus,
    error: state.error
  });
  console.log('세션 관련:', {
    sessionId: state.sessionId,
    tokenReceived: state.tokenReceived,
    statusMessages: state.statusMessages.length
  });
  console.log('확인 단계:', {
    currentStep: state.currentConfirmationStep,
    showConfirmation: state.showConfirmation,
    editableData: {
      name: state.editableName,
      phone: state.editablePhone,
      birthday: state.editableBirthday
    }
  });
  console.log('타이핑 효과:', {
    title: state.titleTyping,
    desc: state.descTyping,
    message: state.messageTyping
  });
  console.groupEnd();
}
