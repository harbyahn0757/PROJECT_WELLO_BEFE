import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS, StorageManager, LoginInputData } from '../../../constants/storage';

/**
 * 인증 플로우 단계
 */
export type AuthFlowStep =
  | 'initial'           // 초기 상태
  | 'terms'             // 약관 동의
  | 'info_confirming'   // 정보 확인 (이름, 전화번호, 생년월일)
  | 'auth_method'       // 인증 방식 선택
  | 'auth_pending'      // 인증 대기 중
  | 'auth_completed'    // 인증 완료
  | 'collecting'        // 데이터 수집 중
  | 'completed';        // 전체 완료

/**
 * 정보 확인 단계
 */
export type InfoConfirmStep =
  | 'name'
  | 'phone'
  | 'birthday'
  | 'auth_method';

/**
 * 사용자 입력 정보
 */
export interface UserInputInfo {
  name: string;
  phone: string;
  birthday: string;
  authMethod: string;
}

/**
 * 인증 플로우 상태
 */
export interface AuthFlowState {
  currentStep: AuthFlowStep;
  currentConfirmStep: InfoConfirmStep;
  userInfo: UserInputInfo;
  termsAgreed: boolean;
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  isCompleted?: boolean; // 데이터 수집 완료 여부
}

/**
 * 인증 플로우 액션
 */
export interface AuthFlowActions {
  // 약관 동의
  agreeToTerms: (agreements: string[]) => void;
  
  // 정보 입력
  setName: (name: string) => void;
  setPhone: (phone: string) => void;
  setBirthday: (birthday: string) => void;
  setAuthMethod: (method: string) => void;
  
  // 단계 이동
  nextConfirmStep: () => void;
  prevConfirmStep: () => void;
  goToStep: (step: AuthFlowStep) => void;
  
  // 세션 복구
  recoverSession: () => Promise<boolean>;
  
  // 인증 시작
  startAuth: (oid?: string) => Promise<void>;
  
  // 리셋
  reset: () => void;
}

/**
 * useAuthFlow 훅
 * 
 * 공통 인증 플로우를 관리하는 커스텀 훅입니다.
 * 모든 인증 관련 페이지에서 재사용 가능합니다.
 */
export function useAuthFlow() {
  const navigate = useNavigate();
  
  // 상태 관리
  const [state, setState] = useState<AuthFlowState>({
    currentStep: 'initial',
    currentConfirmStep: 'name',
    userInfo: {
      name: '',
      phone: '',
      birthday: '',
      authMethod: '4', // 기본값: 휴대폰 본인인증
    },
    termsAgreed: false,
    sessionId: null,
    isLoading: false,
    error: null,
  });
  
  // 최신 userInfo를 참조하기 위한 ref (클로저 문제 방지)
  const userInfoRef = useRef<UserInputInfo>(state.userInfo);
  
  // state.userInfo가 변경될 때마다 ref 업데이트
  useEffect(() => {
    userInfoRef.current = state.userInfo;
  }, [state.userInfo]);
  
  // Ref for tracking manual edits
  const isManuallyEdited = useRef({
    name: false,
    phone: false,
    birthday: false,
  });
  
  /**
   * localStorage에서 입력 데이터 복구
   */
  const restoreInputData = useCallback((): Partial<UserInputInfo> | null => {
    const saved = StorageManager.getItem(STORAGE_KEYS.LOGIN_INPUT_DATA);
    if (!saved) return null;
    
    try {
      // saved가 이미 객체일 수 있으므로 타입 체크
      let data: LoginInputData;
      if (typeof saved === 'string') {
        data = JSON.parse(saved);
      } else if (typeof saved === 'object') {
        data = saved as LoginInputData;
      } else {
        console.warn('[useAuthFlow] 잘못된 데이터 형식:', typeof saved);
        StorageManager.removeItem(STORAGE_KEYS.LOGIN_INPUT_DATA);
        return null;
      }
      
      // 1시간 이상 지난 데이터는 무시
      const savedTime = data.lastUpdated ? new Date(data.lastUpdated).getTime() : 0;
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      if (now - savedTime > oneHour) {
        console.log('[useAuthFlow] 저장된 입력 데이터가 1시간 이상 경과하여 무시');
        StorageManager.removeItem(STORAGE_KEYS.LOGIN_INPUT_DATA);
        return null;
      }
      
      return {
        name: data.name || '',
        phone: data.phone || '',
        birthday: data.birthday || '',
      };
    } catch (e) {
      console.error('[useAuthFlow] 입력 데이터 복구 실패:', e);
      // 에러 발생 시 잘못된 데이터 삭제
      StorageManager.removeItem(STORAGE_KEYS.LOGIN_INPUT_DATA);
      return null;
    }
  }, []);
  
  /**
   * 입력 데이터 저장
   */
  const saveInputData = useCallback((info: UserInputInfo) => {
    const dataToSave: LoginInputData = {
      name: info.name,
      phone: info.phone,
      birthday: info.birthday,
      gender: info.authMethod === '4' ? 'M' : 'M', // 기본값
      currentStep: 'name',
      lastUpdated: new Date().toISOString(),
    };
    
    StorageManager.setItem(STORAGE_KEYS.LOGIN_INPUT_DATA, JSON.stringify(dataToSave));
  }, []);
  
  /**
   * 약관 동의 처리
   */
  const agreeToTerms = useCallback((agreements: string[]) => {
    console.log('[useAuthFlow] 약관 동의:', agreements);
    
    setState(prev => ({
      ...prev,
      termsAgreed: true,
      currentStep: 'info_confirming',
      currentConfirmStep: 'name',
    }));
    
    // 약관 동의 상태 저장
    StorageManager.setItem(STORAGE_KEYS.TILKO_TERMS_AGREED, 'true');
  }, []);
  
  /**
   * 이름 설정
   */
  const setName = useCallback((name: string) => {
    isManuallyEdited.current.name = true;
    setState(prev => {
      const newInfo = { ...prev.userInfo, name };
      saveInputData(newInfo);
      return { ...prev, userInfo: newInfo };
    });
  }, [saveInputData]);
  
  /**
   * 전화번호 설정
   */
  const setPhone = useCallback((phone: string) => {
    isManuallyEdited.current.phone = true;
    setState(prev => {
      const newInfo = { ...prev.userInfo, phone };
      saveInputData(newInfo);
      return { ...prev, userInfo: newInfo };
    });
  }, [saveInputData]);
  
  /**
   * 생년월일 설정
   */
  const setBirthday = useCallback((birthday: string) => {
    isManuallyEdited.current.birthday = true;
    setState(prev => {
      const newInfo = { ...prev.userInfo, birthday };
      saveInputData(newInfo);
      return { ...prev, userInfo: newInfo };
    });
  }, [saveInputData]);
  
  /**
   * 인증 방식 설정
   */
  const setAuthMethod = useCallback((method: string) => {
    setState(prev => ({
      ...prev,
      userInfo: { ...prev.userInfo, authMethod: method },
    }));
    
    StorageManager.setItem(STORAGE_KEYS.TILKO_SELECTED_AUTH_TYPE, method);
  }, []);
  
  /**
   * 정보 확인 단계 이동
   */
  const getNextConfirmStep = (current: InfoConfirmStep): InfoConfirmStep | null => {
    const steps: InfoConfirmStep[] = ['name', 'phone', 'birthday', 'auth_method'];
    const currentIndex = steps.indexOf(current);
    return currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;
  };
  
  const nextConfirmStep = useCallback(() => {
    setState(prev => {
      const next = getNextConfirmStep(prev.currentConfirmStep);
      if (next) {
        return { ...prev, currentConfirmStep: next };
      }
      // 마지막 단계면 인증 시작
      return { ...prev, currentStep: 'auth_pending' };
    });
  }, []);
  
  const prevConfirmStep = useCallback(() => {
    setState(prev => {
      const steps: InfoConfirmStep[] = ['name', 'phone', 'birthday', 'auth_method'];
      const currentIndex = steps.indexOf(prev.currentConfirmStep);
      if (currentIndex > 0) {
        return { ...prev, currentConfirmStep: steps[currentIndex - 1] };
      }
      return prev;
    });
  }, []);
  
  /**
   * 특정 단계로 이동
   */
  const goToStep = useCallback((step: AuthFlowStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);
  
  /**
   * 세션 복구
   */
  const recoverSession = useCallback(async (): Promise<boolean> => {
    console.log('[useAuthFlow] 세션 복구 시도');
    
    // 1. 세션 ID가 있으면 먼저 검증
    const sessionId = StorageManager.getItem(STORAGE_KEYS.TILKO_SESSION_ID);
    if (sessionId) {
      console.log('[useAuthFlow] 세션 ID 발견:', sessionId);
      
      try {
        // 세션 유효성 검증
        const response = await fetch(`/api/v1/tilko/session/${sessionId}/status`);
        
        if (!response.ok) {
          // 세션이 만료되었거나 없음 - localStorage 정리 (정상적인 동작)
          if (response.status === 404) {
            console.log('ℹ️ [useAuthFlow] 세션 만료됨 (404) - localStorage 정리');
          } else {
            console.log('⚠️ [useAuthFlow] 세션 조회 실패 - localStorage 정리');
          }
          StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_WAITING);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_METHOD_SELECTION);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_REQUESTED);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_MANUAL_COLLECT);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_COLLECTING_STATUS);
          StorageManager.removeItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN);
          window.dispatchEvent(new CustomEvent('tilko-status-change'));
          window.dispatchEvent(new Event('localStorageChange'));
          window.dispatchEvent(new CustomEvent('password-modal-change'));
          return false;
        }
        
        const sessionData = await response.json();
        console.log('[useAuthFlow] 세션 유효 - 상태:', sessionData.status);
        
        // ❌ 에러 상태인 세션은 복구하지 않고 정리
        if (sessionData.status === 'error') {
          const errorMsg = sessionData.message || '';
          const isRetryableAuthError = errorMsg.includes('인증') || errorMsg.includes('4115') || errorMsg.includes('승인');

          if (isRetryableAuthError) {
            console.log('ℹ️ [useAuthFlow] 인증 미완료 상태 세션 - 상태 유지 및 복구');
            setState(prev => ({ 
              ...prev, 
              sessionId, 
              currentStep: 'auth_pending'
            }));
            StorageManager.setItem(STORAGE_KEYS.TILKO_AUTH_WAITING, 'true');
            window.dispatchEvent(new CustomEvent('tilko-status-change'));
            return true;
          }

          console.log('⚠️ [useAuthFlow] 치명적 에러 상태 세션 감지 - 초기화 진행');
          StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_WAITING);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_METHOD_SELECTION);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_REQUESTED);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_MANUAL_COLLECT);
          StorageManager.removeItem(STORAGE_KEYS.TILKO_COLLECTING_STATUS);
          StorageManager.removeItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN);
          window.dispatchEvent(new CustomEvent('tilko-status-change'));
          window.dispatchEvent(new Event('localStorageChange'));
          return false;
        }
        
        // completed 상태면 patient_uuid와 hospital_id 확인
        if (sessionData.status === 'completed') {
          const patientUuid = sessionData.patient_uuid;
          const hospitalId = sessionData.hospital_id;
          
          if (patientUuid && hospitalId) {
            console.log('✅ [useAuthFlow] 데이터 수집 완료된 세션 - 결과 페이지로 리다이렉트 필요');
            // localStorage에 저장하고 completed 플래그 설정
            StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, patientUuid);
            StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, hospitalId);
            
            setState(prev => ({
              ...prev,
              sessionId,
              currentStep: 'completed',
              isCompleted: true
            }));
            return true;
          }
        }
        
        // 세션 상태에 따라 적절한 단계로 복구
        // completed와 auth_completed, fetching_health_data 외에는 기본적으로 대기 상태
        const recoveredStep: AuthFlowStep = 
          sessionData.status === 'auth_completed' ? 'auth_completed' : 
          sessionData.status === 'fetching_health_data' ? 'collecting' :
          'auth_pending';

        setState(prev => ({ 
          ...prev, 
          sessionId, 
          currentStep: recoveredStep
        }));
        return true;
      } catch (error) {
        console.error('[useAuthFlow] 세션 검증 실패:', error);
        // 에러 발생 시에도 localStorage 정리
        StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
        StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_WAITING);
        StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_METHOD_SELECTION);
        StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
        StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_REQUESTED);
        StorageManager.removeItem(STORAGE_KEYS.TILKO_MANUAL_COLLECT);
        StorageManager.removeItem(STORAGE_KEYS.TILKO_COLLECTING_STATUS);
        StorageManager.removeItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN);
        window.dispatchEvent(new CustomEvent('tilko-status-change'));
        window.dispatchEvent(new Event('localStorageChange'));
        window.dispatchEvent(new CustomEvent('password-modal-change'));
        // 세션 검증 실패해도 입력 데이터는 복구 시도
      }
    }
    
    // 2. 세션 ID가 없거나 만료됨 - 입력 데이터 복구 시도
    const restored = restoreInputData();
    if (restored) {
      console.log('[useAuthFlow] 입력 데이터 복구 성공:', restored);
      
      // localStorage 정리 (세션 관련 플래그 제거)
      console.log('[useAuthFlow] 세션 ID 없음 - 인증 플래그 정리');
      StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_WAITING);
      StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_METHOD_SELECTION);
      StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
      StorageManager.removeItem(STORAGE_KEYS.TILKO_MANUAL_COLLECT);
      StorageManager.removeItem(STORAGE_KEYS.TILKO_COLLECTING_STATUS);
      StorageManager.removeItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN);
      window.dispatchEvent(new CustomEvent('tilko-status-change'));
      window.dispatchEvent(new Event('localStorageChange'));
      window.dispatchEvent(new CustomEvent('password-modal-change'));
      
      setState(prev => ({
        ...prev,
        userInfo: { ...prev.userInfo, ...restored },
        currentStep: 'info_confirming',
        currentConfirmStep: 'name',
      }));
      return true;
    }
    
    console.log('[useAuthFlow] 복구할 세션/데이터 없음');
    return false;
  }, [restoreInputData]);
  
  /**
   * 인증 시작
   */
  const startAuth = useCallback(async (oid?: string) => {
    // 최신 상태 가져오기 (ref 사용으로 클로저 문제 방지)
    const currentUserInfo: UserInputInfo = userInfoRef.current;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    console.log('[useAuthFlow] 인증 시작:', { ...currentUserInfo, oid });
    
    try {
      const { name, phone, birthday, authMethod } = currentUserInfo;
      
      // 입력값 검증
      if (!name || !phone || !birthday || !authMethod) {
        throw new Error(`필수 정보가 누락되었습니다: name=${name}, phone=${phone}, birthday=${birthday}, authMethod=${authMethod}`);
      }
      
      // ✅ 진입 경로 및 약관 정보 수집
      const urlParams = new URLSearchParams(window.location.search);
      const redirectPath = urlParams.get('redirect') || urlParams.get('return_to') || null;
      
      // 캠페인 모드: URL 파라미터에서 uuid와 partner를 가져와서 patient_uuid와 hospital_id로 사용
      const campaignUuid = urlParams.get('uuid');
      const partnerId = urlParams.get('partner');
      const isCampaignMode = urlParams.get('mode') === 'campaign' || !!oid;
      
      // patient_uuid와 hospital_id 설정
      // 캠페인 모드: URL의 uuid를 patient_uuid로, partner가 있으면 PEERNINE을 hospital_id로
      let patientUuid: string | null = null;
      let hospitalId: string | null = null;
      
      if (isCampaignMode && campaignUuid) {
        patientUuid = campaignUuid;
        hospitalId = 'PEERNINE'; // 캠페인 기본 병원
        console.log('[useAuthFlow] 캠페인 모드 - patient_uuid와 hospital_id 설정:', { patientUuid, hospitalId });
      } else {
        // 일반 모드: 기존 로직 유지 (없으면 null)
        patientUuid = campaignUuid || null;
        hospitalId = urlParams.get('hospital') || null;
      }
      
      // 약관 동의 여부 확인 (localStorage 또는 상태에서)
      const termsAgreedFromStorage = StorageManager.getItem(STORAGE_KEYS.TILKO_TERMS_AGREED) === 'true';
      const termsAgreed = termsAgreedFromStorage;
      
      // 약관 동의 정보 (localStorage에서 가져오기)
      let termsAgreedAt: string | null = null;
      let termsExpiresAt: string | null = null;
      try {
        const termsDataStr = StorageManager.getItem(STORAGE_KEYS.TILKO_TERMS_AGREED);
        if (termsDataStr) {
          const parsed = JSON.parse(termsDataStr);
          // AuthForm에서 저장한 구조: { agreed_at, expires_at } 또는 단순 boolean
          if (typeof parsed === 'object' && parsed !== null) {
            termsAgreedAt = parsed.agreed_at || parsed.agreedAt || null;
            termsExpiresAt = parsed.expires_at || parsed.expiresAt || null;
          }
        }
      } catch (e) {
        console.warn('[useAuthFlow] 약관 정보 파싱 실패:', e);
      }
      
      console.log('[useAuthFlow] 1단계: 세션 생성 요청 시작', {
        user_name: name,
        phone_no: phone,
        birthdate: birthday,
        private_auth_type: authMethod,
        oid: oid,
        redirect_path: redirectPath,
        terms_agreed: termsAgreed,
        patient_uuid: patientUuid,
        hospital_id: hospitalId,
        is_campaign_mode: isCampaignMode
      });
      
      // 1단계: 세션 생성
      const sessionResponse = await fetch('/api/v1/tilko/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_name: name,
          phone_no: phone,
          birthdate: birthday,
          private_auth_type: authMethod,
          gender: 'M',
          oid: oid, // 주문번호 전달
          redirect_path: redirectPath, // ✅ 진입 경로
          terms_agreed: termsAgreed, // ✅ 약관 동의 여부
          terms_agreed_at: termsAgreedAt, // ✅ 약관 동의 시각
          terms_expires_at: termsExpiresAt, // ✅ 약관 만료 시각
          patient_uuid: patientUuid, // ✅ 캠페인 모드: URL의 uuid를 patient_uuid로 전달
          hospital_id: hospitalId // ✅ 캠페인 모드: PEERNINE을 hospital_id로 전달
        }),
      });
      
      console.log('[useAuthFlow] 세션 생성 응답 상태:', sessionResponse.status, sessionResponse.statusText);
      
      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({ detail: '세션 생성 실패' }));
        throw new Error(errorData.detail || `세션 생성 실패 (${sessionResponse.status})`);
      }
      
      const sessionResult = await sessionResponse.json();
      console.log('[useAuthFlow] 세션 생성 응답 데이터:', sessionResult);
      
      const sessionId = sessionResult.session_id;
      if (!sessionId) {
        throw new Error('세션 ID가 없습니다.');
      }
      
      // 세션 ID 저장
      StorageManager.setItem(STORAGE_KEYS.TILKO_SESSION_ID, sessionId);
      
      // 2단계: 실제 인증 요청 (Tilko API 호출)
      console.log('[useAuthFlow] 2단계: 인증 요청 시작', { sessionId });
      
      const authResponse = await fetch(`/api/v1/tilko/session/simple-auth?session_id=${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[useAuthFlow] 인증 요청 응답 상태:', authResponse.status, authResponse.statusText);
      
      if (!authResponse.ok) {
        const errorData = await authResponse.json().catch(() => ({ detail: '인증 요청 실패' }));
        throw new Error(errorData.detail || `인증 요청 실패 (${authResponse.status})`);
      }
      
      const authResult = await authResponse.json();
      console.log('[useAuthFlow] 인증 요청 응답 데이터:', authResult);
      console.log('[useAuthFlow] 인증 요청 성공:', authResult);
      
      // 플로팅 버튼 상태 업데이트
      StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
      StorageManager.setItem(STORAGE_KEYS.TILKO_AUTH_WAITING, 'true');
      window.dispatchEvent(new CustomEvent('tilko-status-change'));
      
      setState(prev => ({
        ...prev,
        sessionId: sessionId,
        currentStep: 'auth_pending',
        isLoading: false,
      }));
    } catch (error) {
      console.error('[useAuthFlow] 인증 시작 실패:', error);
      console.error('[useAuthFlow] 에러 상세:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userInfo: currentUserInfo,
      });
      
      const errorMessage = error instanceof Error ? error.message : '인증 시작에 실패했습니다.';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);
  
  /**
   * 리셋
   */
  const reset = useCallback(() => {
    console.log('[useAuthFlow] 플로우 리셋');
    
    // localStorage 정리
    StorageManager.removeItem(STORAGE_KEYS.LOGIN_INPUT_DATA);
    StorageManager.removeItem(STORAGE_KEYS.TILKO_TERMS_AGREED);
    StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
    StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_WAITING);
    StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_METHOD_SELECTION);
    StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
    StorageManager.removeItem(STORAGE_KEYS.TILKO_AUTH_REQUESTED);
    StorageManager.removeItem(STORAGE_KEYS.TILKO_MANUAL_COLLECT);
    StorageManager.removeItem(STORAGE_KEYS.TILKO_COLLECTING_STATUS);
    StorageManager.removeItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN);
    window.dispatchEvent(new CustomEvent('tilko-status-change'));
    window.dispatchEvent(new Event('localStorageChange'));
    window.dispatchEvent(new CustomEvent('password-modal-change'));
    
    // 상태 초기화
    setState({
      currentStep: 'initial',
      currentConfirmStep: 'name',
      userInfo: {
        name: '',
        phone: '',
        birthday: '',
        authMethod: '4',
      },
      termsAgreed: false,
      sessionId: null,
      isLoading: false,
      error: null,
    });
    
    // Ref 초기화
    isManuallyEdited.current = {
      name: false,
      phone: false,
      birthday: false,
    };
  }, []);
  
  // 초기 복구 시도
  useEffect(() => {
    recoverSession();
  }, [recoverSession]);
  
  const actions: AuthFlowActions = {
    agreeToTerms,
    setName,
    setPhone,
    setBirthday,
    setAuthMethod,
    nextConfirmStep,
    prevConfirmStep,
    goToStep,
    recoverSession,
    startAuth,
    reset,
  };
  
  return { state, actions };
}
