import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelloData } from '../contexts/WelloDataContext';
import { PatientDataConverter, PatientDataValidator, GenderConverter } from '../types/patient';
import { TILKO_API, HTTP_METHODS, API_HEADERS } from '../constants/api';
import { API_ENDPOINTS } from '../config/api';
import PasswordModal from './PasswordModal';
import { PasswordModalType } from './PasswordModal/types';
import WelloModal from './common/WelloModal';
import { NavigationHelper, STANDARD_NAVIGATION } from '../constants/navigation';
import { STORAGE_KEYS, StorageManager, TilkoSessionStorage } from '../constants/storage';
import { useWebSocketAuth } from '../hooks/useWebSocketAuth';
import useApiCallPrevention from '../hooks/useApiCallPrevention';
import { WELLO_LOGO_IMAGE } from '../constants/images';
import splashIcon from '../assets/splash.png';
import TermsAgreementModal from './terms/TermsAgreementModal';

// 인증 아이콘 이미지 import
import kakaoIcon from '../assets/images/kakao.png';
import naverIcon from '../assets/images/naver.png';
import passIcon from '../assets/images/pass.png';

interface AuthFormProps {
  onBack: () => void;
}

// 입력 데이터 인터페이스
interface AuthInput {
  name: string;
  gender: string;
  phoneNo: string;
  birthday: string;
}

// 요청 파라미터 인터페이스
interface ReqParams {
  cxId: string;
  privateAuthType: string;
  reqTxId: string;
  token: string;
  txId: string;
  userName: string;
  birthday: string;
  phoneNo: string;
}

const AuthForm: React.FC<AuthFormProps> = ({ onBack }) => {
  const navigate = useNavigate();
  const { state, actions } = useWelloData();
  const { patient, hospital, layoutConfig } = state;

  // API 호출 중복 방지
  const apiCallPrevention = useApiCallPrevention({
    debounceMs: 500,
    throttleMs: 2000,
    preventDuplicates: true,
    maxRetries: 2
  });
  
  // 인증 방식 선택 (기본값: 카카오톡)
  // 메모리 fallback 지원 - localStorage 실패 시 메모리에서만 동작
  const [selectedAuthType, setSelectedAuthType] = useState(() => {
    // 인증 페이지 진입 시 리셋하므로 항상 기본값 '0'으로 시작
    return '0';
  });
  
  // 메모리 fallback을 위한 인증 방식 저장 (localStorage 실패 시 사용)
  const authTypeMemoryRef = useRef<string>('0');
  
  // 지원되는 인증 방식 (선별된 3가지)
  const AUTH_TYPES = [
    { value: '0', label: '카카오톡', icon: kakaoIcon, description: '카카오톡 앱으로 인증' },
    { value: '4', label: '통신사Pass', icon: passIcon, description: 'SKT/KT/LG U+ 통신사 인증' },
    { value: '6', label: '네이버', icon: naverIcon, description: '네이버 계정으로 인증' }
  ];
  
  // 공통 타이핑 메시지 스타일 상수
  const TYPING_STYLES = {
    // 기본 컨테이너 스타일 (검진정보 메시지 기준)
    container: {
      fontSize: '18px',
      color: '#8B7355',
      marginLeft: '-16px',
      marginBottom: '12px',
      lineHeight: '1.4',
      minHeight: '50px',
      fontFamily: 'inherit',
      whiteSpace: 'pre-line' as const,
      display: 'inline-block' as const
    },
    // 일반 텍스트 스타일
    normalText: {
      fontSize: '18px',
      color: '#8B7355',
      fontWeight: '400'
    },
    // 중요한 단어 스타일 (볼드)
    boldText: {
      fontSize: '19px',
      color: '#8B7355',
      fontWeight: 'bold' as const
    },
    // 커서 스타일
    cursor: {
      fontWeight: 'normal' as const,
      marginLeft: '2px'
    }
  };
  
  // 공통 타이핑 속도 상수
  const TYPING_SPEED = 80; // 검진정보 메시지 기준 속도
  
  // localStorage 변경 시 custom event 발생 헬퍼 (통합 스토리지 매니저 사용)
  const setLocalStorageWithEvent = (key: string, value: string) => {
    StorageManager.setItemWithEvent(key, value, 'tilko-status-change');
  };
  
  const removeLocalStorageWithEvent = (key: string) => {
    StorageManager.removeItemWithEvent(key, 'tilko-status-change');
  };
  
  // 로딩 중 순환 메시지 - 더 구체적이고 단계별로 개선 (이모티콘 제거)
  const loadingMessages = [
    '국민건강보험공단에서 건강검진 데이터를 가져오고 있어요...',
    '병원 및 약국 처방전 정보를 수집하고 있어요...',
    '수집된 건강정보를 안전하게 분석하고 있어요...',
    '개인정보를 암호화하여 안전하게 저장하고 있어요...',
    '맞춤형 건강 트렌드 분석을 준비하고 있어요...',
    '잠시만 기다려주세요. 곧 완료됩니다...',
    '최종 검토 중입니다. 거의 다 끝났어요!'
  ];
  
  // 상태 폴링 관련
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // 모든 폴링 interval/timeout을 추적하기 위한 ref
  const tokenMonitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const collectionPollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authStatusPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const collectionPollingStoppedRef = useRef<boolean>(false);
  const tokenTimeoutRef = useRef<NodeJS.Timeout | null>(null);
 
  // 모든 폴링 및 모니터링 정리
  const cleanupAllPolling = useCallback(() => {
    console.log('🛑 [폴링정리] 모든 세션 상태 조회 중단');
    
    // 상태 폴링 정리
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
      console.log('🛑 [폴링정리] pollingInterval 정리됨');
    }
    
    // 토큰 모니터링 정리
    if (tokenMonitoringIntervalRef.current) {
      clearInterval(tokenMonitoringIntervalRef.current);
      tokenMonitoringIntervalRef.current = null;
      console.log('🛑 [폴링정리] tokenMonitoringInterval 정리됨');
    }
    
    // 수집 상태 폴링 정리
    collectionPollingStoppedRef.current = true;
    if (collectionPollingTimeoutRef.current) {
      clearTimeout(collectionPollingTimeoutRef.current);
      collectionPollingTimeoutRef.current = null;
      console.log('🛑 [폴링정리] collectionPollingTimeout 정리됨');
    }
    
    // 인증 상태 폴링 정리
    if (authStatusPollIntervalRef.current) {
      clearInterval(authStatusPollIntervalRef.current);
      authStatusPollIntervalRef.current = null;
      console.log('🛑 [폴링정리] authStatusPollInterval 정리됨');
    }
    
    // 타임아웃 정리 (ref로 관리)
    const currentTokenTimeout = tokenTimeoutRef.current;
    if (currentTokenTimeout) {
      clearTimeout(currentTokenTimeout);
      tokenTimeoutRef.current = null;
      console.log('🛑 [폴링정리] tokenTimeout 정리됨');
    }
  }, [pollingInterval]);
  
  // 상태 폴링 정리 (기존 호환성 유지)
  const cleanupPolling = useCallback(() => {
    cleanupAllPolling();
  }, [cleanupAllPolling]);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      cleanupPolling();
    };
  }, [cleanupPolling]);

  // 블링킹 스피너 CSS 애니메이션 추가
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes blinkSpin {
        0%, 100% { 
          opacity: 1; 
          transform: rotate(0deg) scale(1);
        }
        25% { 
          opacity: 0.3; 
          transform: rotate(90deg) scale(0.8);
        }
        50% { 
          opacity: 0.6; 
          transform: rotate(180deg) scale(1.1);
        }
        75% { 
          opacity: 0.3; 
          transform: rotate(270deg) scale(0.8);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  // 약관동의 모달 상태
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'validation' | 'network' | 'server' | 'auth' | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalData, setErrorModalData] = useState<{
    title: string;
    message: string;
    technicalDetail?: string;
    retryAvailable?: boolean;
  } | null>(null);
  const [authRequested, setAuthRequested] = useState(false);
  // progress 상태 제거됨 - currentStatus로 통합
  // layoutConfig는 Context에서 가져옴
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<Array<{timestamp: string, type: string, message: string}>>([]);
  
  // CxId 수신 상태 추가
  const [cxIdReceived, setCxIdReceived] = useState<boolean>(false);
  const [receivedCxId, setReceivedCxId] = useState<string>('');
  const [autoPollingActive, setAutoPollingActive] = useState<boolean>(false);

  // WebSocket 실시간 통신
  const { isConnected: wsConnected, connectionError: wsError } = useWebSocketAuth({
    sessionId,
    onTilkoKeyReceived: (cxId) => {
      console.log('🔑 [AuthForm] 틸코 키 수신!', cxId);
      setCxIdReceived(true);
      setReceivedCxId(cxId);
      setCurrentStatus('auth_waiting');
      setTypingText(`틸코 인증 키를 받았습니다!\n인증 ID: ${cxId.substring(0, 8)}...\n\n카카오톡에서 인증을 완료해주세요.\n인증 완료 후 하단의 버튼을 눌러주세요.`);
      
      // localStorage에 인증 대기 상태 저장 (플로팅 버튼 변경용)
      StorageManager.setItem('tilko_auth_waiting', 'true');
      StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING); // 정보 확인 완료, 플로팅 버튼 다시 표시
      window.dispatchEvent(new Event('localStorageChange'));
    },
    onAuthCompleted: (authData) => {
      console.log('🎊 [WebSocket] 인증 완료 알림 수신!', authData);
      
      // 데이터 수집 완료된 경우 (streaming_status: completed)
      if (authData && (authData.health_data || authData.prescription_data)) {
        console.log('🎉 [WebSocket] 데이터 수집 완료! 결과 페이지로 이동');
        
        // 수집된 데이터를 localStorage에 저장
        StorageManager.setItem('tilko_collected_data', {
          health_data: authData.health_data,
          prescription_data: authData.prescription_data,
          collected_at: new Date().toISOString()
        });
        
        // 세션 정리
        StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
        StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_DATA);
        StorageManager.removeItem('tilko_auth_waiting'); // 인증 대기 상태 제거
        StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING); // 정보 확인 상태 제거
        
        // 결과 페이지로 이동
        setCurrentStatus('completed');
        setTimeout(() => {
          navigate('/results');
        }, 1000);
        
        return;
      }
      
      // 일반 인증 완료
      setTokenReceived(true);
      setCurrentStatus('auth_completed');
      setTypingText('인증이 완료되었습니다!\n건강검진 데이터를 수집하겠습니다.');
      
      // 세션 ID가 없으면 localStorage에서 복구 시도
      if (!sessionId) {
        const savedSessionId = localStorage.getItem('tilko_session_id') || StorageManager.getItem(STORAGE_KEYS.TILKO_SESSION_ID);
        if (savedSessionId) {
          console.log('🔄 [인증완료] 세션 ID 복구:', savedSessionId);
          setSessionId(savedSessionId);
        }
      }
      
      // 기존 폴링 정리
      if (tokenTimeout) {
        clearTimeout(tokenTimeout);
        setTokenTimeout(null);
      }
    },
    onDataCollectionProgress: (progressType, message, data?: any) => {
      console.log('📈 [WebSocket] 데이터 수집 진행:', progressType, message, data);
      
      // 완료 상태 확인
      if (progressType === 'completed' || message?.includes('모든 데이터 수집이 완료')) {
        console.log('🎉 [WebSocket] 데이터 수집 완료 알림 수신!', data);
        wsCompletionRef.current = { completed: true, data: data };
        setCurrentStatus('data_completed');
        setLoading(false);
        
        // 데이터 수집 완료 - 플로팅 버튼 플래그 제거
        StorageManager.removeItem('tilko_manual_collect');
        window.dispatchEvent(new Event('localStorageChange'));
        
        // 수집 완료 모달 표시
        setShowCollectionCompleteModal(true);
        
        // 폴링이 완료를 감지하도록 함 (폴링이 실행 중이면)
        return;
      }
      
      setCurrentStatus('data_collecting');
      setLoading(true); // 로딩 스피너 표시
      setTypingText(message);
      
      // 플로팅 버튼 숨기기 위한 플래그 설정 (이벤트 발생하지 않음 - 무한 루프 방지)
      StorageManager.setItem('tilko_manual_collect', 'true');
      // window.dispatchEvent(new Event('localStorageChange')); // 제거 - 무한 루프 방지
    },
    onError: (error) => {
      console.error('❌ [WebSocket] 에러:', error);
      handleError(error, 'server');
    },
    onAuthTimeout: (message) => {
      console.log('⏰ [WebSocket] 인증 타임아웃:', message);
      setCurrentStatus('timeout');
      setTypingText(message + '\n3초 후 처음 페이지로 돌아갑니다.');
      setLoading(false);
      
      // 3초 후 메인 페이지로 이동
      setTimeout(() => {
        console.log('🔄 [타임아웃] 메인 페이지로 이동');
        navigate('/');
      }, 3000);
    },
    onStatusUpdate: (status, authCompleted) => {
      console.log('📊 [WebSocket] 상태 업데이트:', status, 'auth_completed:', authCompleted);
      if (authCompleted && !tokenReceived) {
        setTokenReceived(true);
        setCurrentStatus('auth_completed');
        setTypingText('인증이 완료되었습니다!\n건강검진 데이터를 수집하겠습니다.');
      }
    }
  });
  
  // 단계별 확인 상태
  const [currentConfirmationStep, setCurrentConfirmationStep] = useState<'name' | 'phone' | 'birthday' | 'auth_method' | 'completed'>('name');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [editableName, setEditableName] = useState('');
  const [editablePhone, setEditablePhone] = useState('');
  const [editableBirthday, setEditableBirthday] = useState('');
  
  // 상단 타이틀 타이핑 효과
  const [titleTypingText, setTitleTypingText] = useState('');
  const [isTitleTyping, setIsTitleTyping] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('start');
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [typingText, setTypingText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  
  // 임시 이름 저장용 ref (상태 업데이트 타이밍 문제 해결)
  const tempExtractedNameRef = useRef<string>('');
  
  // 세션 복구 모달 상태
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [savedSessionInfo, setSavedSessionInfo] = useState<any>(null);
  
  // 수집 완료 모달 상태
  const [showCollectionCompleteModal, setShowCollectionCompleteModal] = useState<boolean>(false);
  
  // 설명 텍스트 타이핑 효과
  const [descTypingText, setDescTypingText] = useState<string>('');
  const [isDescTyping, setIsDescTyping] = useState<boolean>(false);
  
  // 토큰 발급 상태 추적
  const [tokenReceived, setTokenReceived] = useState<boolean>(false);
  const [tokenRetryCount, setTokenRetryCount] = useState<number>(0);
  const [tokenTimeout, setTokenTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // 비밀번호 설정 모달 상태
  const [showPasswordSetupModal, setShowPasswordSetupModal] = useState(false);
  const [passwordSetupData, setPasswordSetupData] = useState<{uuid: string, hospital: string} | null>(null);

  // 비밀번호 설정 모달 핸들러
  const handlePasswordSetupSuccess = (type: PasswordModalType) => {
    console.log('✅ [비밀번호] 설정 완료 - 결과 페이지로 이동');
    setShowPasswordSetupModal(false);
    
    if (passwordSetupData?.uuid && passwordSetupData?.hospital) {
      const targetUrl = `/results-trend?uuid=${passwordSetupData.uuid}&hospital=${passwordSetupData.hospital}`;
      console.log('🚀 [비밀번호설정완료] 결과 페이지로 이동:', targetUrl);
      navigate(targetUrl);
    } else {
      console.warn('⚠️ [비밀번호설정완료] UUID/병원 정보 부족');
      navigate('/results-trend');
    }
  };

  const handlePasswordSetupCancel = () => {
    console.log('⏭️ [비밀번호] 설정 건너뛰기 - 결과 페이지로 이동');
    setShowPasswordSetupModal(false);
    
    if (passwordSetupData?.uuid && passwordSetupData?.hospital) {
      const targetUrl = `/results-trend?uuid=${passwordSetupData.uuid}&hospital=${passwordSetupData.hospital}`;
      console.log('🚀 [비밀번호건너뛰기] 결과 페이지로 이동:', targetUrl);
      navigate(targetUrl);
    } else {
      console.warn('⚠️ [비밀번호건너뛰기] UUID/병원 정보 부족');
      navigate('/results-trend');
    }
  };
  
  // 타이핑 효과 타이머 관리
  const titleTypingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const descTypingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageTypingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 컴포넌트 마운트 시 환자 데이터 로드 및 플로팅 버튼 관련 플래그 초기화
  useEffect(() => {
    const componentId = Math.random().toString(36).substr(2, 9);
    console.log(`🔄 [인증페이지-${componentId}] AuthForm 마운트 - 플로팅 버튼 플래그 초기화`);
    console.log(`🔄 [인증페이지-${componentId}] AuthForm 완전 마운트됨 - 모든 useEffect 활성화`);
    console.log(`🔍 [인증페이지-${componentId}] 현재 patient 상태:`, patient ? { name: patient.name, uuid: patient.uuid } : 'null');
    
    // 인증 페이지 진입 시 로컬 스토리지 리셋 (인증 방식 선택 초기화)
    StorageManager.resetAuthPage();
    authTypeMemoryRef.current = '0';
    setSelectedAuthType('0');
    console.log(`🔄 [인증페이지-${componentId}] 인증 방식 선택 리셋 완료 - 기본값 '0' (카카오톡)으로 시작`);
    
    // 스토리지 사용 가능 여부 확인
    if (StorageManager.isMemoryMode()) {
      console.warn(`⚠️ [인증페이지-${componentId}] localStorage 사용 불가 - 메모리 모드로 동작`);
    }
    
    // URL 파라미터에서 환자 정보 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const uuid = urlParams.get('uuid');
    const hospitalId = urlParams.get('hospital');
    const infoRequired = urlParams.get('info_required') === 'true';
    
    // info_required 파라미터가 있으면 정보 확인 단계 시작
    if (infoRequired) {
      console.log(`⚠️ [인증페이지-${componentId}] 정보 재확인 필요 - 정보 확인 단계 시작`);
      setShowConfirmation(true);
      setCurrentConfirmationStep('name');
      setError('입력하신 정보를 확인해주세요. 이름, 생년월일, 전화번호가 정확한지 확인 후 다시 시도해주세요.');
      // URL에서 파라미터 제거 (중복 실행 방지)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('info_required');
      window.history.replaceState({}, '', newUrl.toString());
    }
    
    // 랜딩 페이지에서 로드한 환자 데이터가 있으면 즉시 이름 설정
    if (patient && patient.name) {
      const patientName = PatientDataConverter.getSafeName(patient);
      if (!editableName || editableName === '사용자') {
        setEditableName(patientName);
        console.log(`📝 [인증페이지-${componentId}] 랜딩 페이지에서 로드한 환자 이름 설정:`, patientName);
      }
    } else if (uuid && hospitalId) {
      // 환자 데이터가 없고 URL 파라미터가 있으면 데이터 로드
      console.log(`📋 [인증페이지-${componentId}] 환자 데이터 없음 - 로드 시작: ${uuid} @ ${hospitalId}`);
      actions.loadPatientData(uuid, hospitalId, { force: false })
        .catch((error) => {
          console.error(`❌ [인증페이지-${componentId}] 환자 정보 로드 실패:`, error);
          setError('환자 정보를 불러올 수 없습니다. URL을 확인해주세요.');
          setErrorType('server');
          setShowErrorModal(true);
        });
    } else if (!uuid || !hospitalId) {
      // UUID나 병원 ID가 없으면 에러
      console.error(`❌ [인증페이지-${componentId}] 필수 파라미터 누락 - uuid: ${uuid}, hospitalId: ${hospitalId}`);
      setError('환자 정보가 없습니다. 올바른 URL로 접속해주세요.');
      setErrorType('validation');
      setShowErrorModal(true);
    }
    
    // 이전 세션의 신호들 정리 (세션 복구 후에 실행)
    // 세션 복구가 필요할 수 있으므로 즉시 정리하지 않음
    console.log(`🔄 [인증페이지-${componentId}] 세션 복구 체크 후 신호 정리 예정`);
    // tilko_auth_completed와 tilko_session_id는 유지 (세션 복구용)
  }, [patient, editableName, actions]);

  // 함수 참조를 위한 ref
  const handleManualDataCollectionRef = useRef<(() => Promise<void>) | null>(null);
  const handleNextStepRef = useRef<(() => void) | null>(null);
  const typeTitleMessageRef = useRef<((message: string, speed?: number, repeat?: boolean) => void) | null>(null);

  // 신호 감지 useEffect (별도로 분리)
  useEffect(() => {
    const componentId = Math.random().toString(36).substr(2, 9);
    
    // 이름 추출 함수 (데이터 로드 상태에 관계없이 최신 데이터 사용)
    const extractName = (forceName?: string) => {
          let name = '';
          
          // 0) 강제로 전달된 이름이 있으면 우선 사용
          if (forceName && forceName.trim() && forceName !== '사용자') {
            name = forceName.trim();
            console.log('📝 [이름추출] 강제 전달된 이름 사용:', name);
          }
          
          // 0-1) 임시로 저장된 이름이 있으면 사용
          if (!name && tempExtractedNameRef.current) {
            name = tempExtractedNameRef.current;
            console.log('📝 [이름추출] 임시 저장된 이름 사용:', name);
          }
          
          // 1) editableName에서 먼저 추출 (가장 우선순위 높음)
          if (!name && editableName && editableName.trim() && editableName !== '사용자') {
            name = PatientDataConverter.cleanUndefined(editableName).trim();
            console.log('📝 [이름추출] editableName에서 추출:', name);
          }
          
          // 2) layoutConfig.title에서 추출
          if (!name && layoutConfig?.title) {
            const titleMatch = layoutConfig.title.match(/안녕하세요\s+(.+?)님/);
            if (titleMatch && titleMatch[1]) {
              const extractedName = PatientDataConverter.cleanUndefined(titleMatch[1]).trim();
              if (extractedName && extractedName !== '사용자') {
                name = extractedName;
                console.log('📝 [이름추출] layoutConfig.title에서 추출:', name);
              }
            }
          }
          
          // 3) patient 데이터에서 추출
          if (!name && patient) {
            const patientName = PatientDataConverter.getSafeName(patient);
            if (patientName && patientName !== '사용자') {
              name = patientName;
              console.log('📝 [이름추출] patient에서 추출:', name);
            }
          }
          
          const safeName = name || '사용자';
          console.log('📝 [이름추출] editableName:', editableName, 'layoutConfig.title:', layoutConfig?.title, 'patient:', patient?.name, 'final name:', safeName);
          return safeName;
        };
    
        // localStorage 이벤트 리스너를 사용한 신호 감지 (폴백용 - 직접 호출 실패 시에만 사용)
        const handleStartSignal = () => {
      const startSignal = StorageManager.getItem(STORAGE_KEYS.START_INFO_CONFIRMATION);
      const manualCollectSignal = StorageManager.getItem('tilko_manual_collect');
      const authMethodCompleteSignal = StorageManager.getItem('tilko_auth_method_complete');
      
      // 신호가 없으면 로그 찍지 않고 리턴 (불필요한 로그 방지)
      const hasAnySignal = startSignal || manualCollectSignal || authMethodCompleteSignal;
      if (!hasAnySignal) {
        return; // 신호가 없으면 아무것도 하지 않음
      }
      
      console.log(`🔍 [신호감지-${componentId}] 신호 감지됨. startSignal:`, startSignal, 'manualCollectSignal:', manualCollectSignal, 'authMethodCompleteSignal:', authMethodCompleteSignal);
      
      // 인증 방식 선택 완료 신호 처리
      const isAuthMethodCompleteSignal = authMethodCompleteSignal === 'true' || (typeof authMethodCompleteSignal === 'boolean' && authMethodCompleteSignal === true);
      if (isAuthMethodCompleteSignal) {
        console.log(`✅ [신호감지-${componentId}] 인증 방식 선택 완료 - 바로 인증 시작`);
        console.log(`🔍 [신호감지-${componentId}] 현재 상태: currentConfirmationStep=${currentConfirmationStep}, showConfirmation=${showConfirmation}`);
        StorageManager.removeItem('tilko_auth_method_complete'); // 신호 제거
        
        // 인증 방식 선택이 완료되었으므로 기존 handleNextStep 방식 사용
        console.log(`✅ [신호감지-${componentId}] 인증 방식 선택 완료 - handleNextStep 호출`);
        
        // currentConfirmationStep을 'auth_method'로 설정하고 handleNextStep 호출
        setCurrentConfirmationStep('auth_method');
        
        // 다음 이벤트 루프에서 handleNextStep 호출 (기존 방식 복구)
        setTimeout(() => {
          handleNextStep();
        }, 0);
        return;
      }
      
      // 수동 데이터 수집 신호 처리 (문자열 'true' 또는 boolean true 처리)
      const isManualCollectSignal = manualCollectSignal === 'true' || (typeof manualCollectSignal === 'boolean' && manualCollectSignal === true);
      if (isManualCollectSignal) {
        // 이미 실행 중이면 무시
        if (isManualCollectingRef.current) {
          console.log(`⏸️ [신호감지-${componentId}] 이미 수집 중 - 신호 무시`);
          StorageManager.removeItem('tilko_manual_collect'); // 신호만 제거
          return;
        }
        
        console.log(`✅ [신호감지-${componentId}] 수동 데이터 수집 시작`);
        StorageManager.removeItem('tilko_manual_collect'); // 신호 제거
        StorageManager.removeItem('tilko_auth_waiting'); // 인증 대기 상태 제거
        // localStorageChange 이벤트 발생하지 않음 (무한 루프 방지)
        
        // 수동 데이터 수집 실행
        if (handleManualDataCollectionRef.current) {
          handleManualDataCollectionRef.current();
        }
        return;
      }
      
      // 문자열 'true' 또는 boolean true 또는 truthy 값 체크
      const isSignalActive = startSignal === 'true' || (startSignal as any) === true || !!startSignal;
      
      if (isSignalActive) {
        console.log(`✅ [신호감지-${componentId}] 정보 확인 시작`);
        
        StorageManager.removeItem(STORAGE_KEYS.START_INFO_CONFIRMATION); // 신호 제거
        console.log('🗑️ [신호감지] 신호 제거 완료');
        
        // 정보 확인 단계 시작
        setShowConfirmation(true);
        setCurrentConfirmationStep('name');
        
        // 플로팅 버튼 숨기기 위한 플래그 설정
        setLocalStorageWithEvent(STORAGE_KEYS.TILKO_INFO_CONFIRMING, 'true');
        
        // 히스토리에 첫 번째 단계 상태 추가
        NavigationHelper.pushState(
          { step: 'name', confirmationStarted: true }
        );
        
        // 첫 번째 타이틀 타이핑 효과 시작 (데이터 로드 대기)
        const startTypingWithDelay = (attempt = 0) => {
          const safeName = extractName();
          
          // 데이터가 아직 로드되지 않았고 재시도 가능한 경우
          if (safeName === '사용자' && attempt < 3) {
            console.log(`📝 [타이틀타이핑] 데이터 로드 대기 중... (시도 ${attempt + 1}/3)`);
            setTimeout(() => startTypingWithDelay(attempt + 1), 300);
            return;
          }
          
          console.log('🎯 [정보확인] 신호 감지, 확인 단계 시작');
          console.log('📝 [타이틀타이핑] 시작: 존함이 맞나요?');
          if (typeTitleMessageRef.current) {
            typeTitleMessageRef.current('존함이 맞나요?', 120, true);
          }
        };
        
        setTimeout(() => startTypingWithDelay(), 500);
      }
    };
        
    // 즉시 한번 확인
    handleStartSignal();
    
    // storage 이벤트 리스너 등록
    window.addEventListener('storage', handleStartSignal);
    
    // 커스텀 이벤트 리스너 등록 (같은 페이지 내 변경사항 감지)
    window.addEventListener('localStorageChange', handleStartSignal);

    return () => {
      console.log(`🛑 [신호감지-${componentId}] AuthForm unmount - 이벤트 리스너 해제`);
      window.removeEventListener('storage', handleStartSignal);
      window.removeEventListener('localStorageChange', handleStartSignal);
    };
  }, [currentConfirmationStep, showConfirmation, editableName, layoutConfig, patient]);

  // 컴포넌트 언마운트 시 모든 타이머 정리
  useEffect(() => {
    return () => {
      console.log('🧹 [AuthForm] 컴포넌트 언마운트 - 모든 타이머 정리');
      
      // 모든 타이핑 타이머 정리
      if (titleTypingTimerRef.current) {
        clearInterval(titleTypingTimerRef.current);
        clearTimeout(titleTypingTimerRef.current);
        titleTypingTimerRef.current = null;
      }
      
      if (descTypingTimerRef.current) {
        clearInterval(descTypingTimerRef.current);
        clearTimeout(descTypingTimerRef.current);
        descTypingTimerRef.current = null;
      }
      
      if (messageTypingTimerRef.current) {
        clearInterval(messageTypingTimerRef.current);
        clearTimeout(messageTypingTimerRef.current);
        messageTypingTimerRef.current = null;
      }
      
      // 토큰 타이머 정리
      if (tokenTimeout) {
        clearTimeout(tokenTimeout);
      }
    };
  }, []);

  // layoutConfig 또는 patient 데이터 변경 시 이름 업데이트
  useEffect(() => {
    if (showConfirmation && currentConfirmationStep === 'name' && (layoutConfig?.title || patient)) {
      // 이름 추출 재시도
      let name = '';
      
      if (editableName && editableName.trim()) {
        name = PatientDataConverter.cleanUndefined(editableName).trim();
      }
      
      if (!name && layoutConfig?.title) {
        const titleMatch = layoutConfig.title.match(/안녕하세요\s+(.+?)님/);
        if (titleMatch && titleMatch[1]) {
          const extractedName = PatientDataConverter.cleanUndefined(titleMatch[1]).trim();
          if (extractedName && extractedName !== '사용자') {
            name = extractedName;
            setEditableName(extractedName); // 이름 상태 업데이트
          }
        }
      }
      
      if (!name && patient) {
        name = PatientDataConverter.getSafeName(patient);
        if (name && name !== '사용자') {
          setEditableName(name); // 이름 상태 업데이트
        }
      }
      
      if (name && name !== '사용자') {
        console.log('📝 [이름업데이트] 새로운 이름 감지:', name);
        console.log('📝 [타이틀타이핑] 업데이트된 이름으로 재시작: 존함이 맞나요?');
        // 기존 타이핑 중지하고 새로운 이름으로 시작
        setIsTitleTyping(false);
        setTimeout(() => {
          typeTitleMessage('존함이 맞나요?', 120, true);
        }, 100);
        
        // 즉시 이름 추출에서도 이 이름을 사용하도록 강제 설정
        tempExtractedNameRef.current = name;
      }
    }
  }, [layoutConfig?.title, patient, showConfirmation, currentConfirmationStep]);
  
  // 인증 입력 상태 (안전한 초기값으로 설정)
  const [authInput, setAuthInput] = useState<AuthInput>({
    name: '',
    gender: 'M',
    phoneNo: '',
    birthday: ''
  });

  // 요청 파라미터 상태 제거됨 - 사용되지 않음

  // Context에서 환자 데이터가 변경되면 authInput 업데이트 (통합 유틸리티 사용)
  useEffect(() => {
    // patient가 있으면 항상 이름 설정 (랜딩 페이지에서 로드한 데이터 활용)
    if (patient && patient.name) {
      const patientName = PatientDataConverter.getSafeName(patient);
      // editableName이 없거나 기본값이면 patient.name으로 설정
      if (!editableName || editableName === '사용자') {
        setEditableName(patientName);
        console.log('📝 [AuthForm] 랜딩 페이지에서 로드한 환자 이름 설정:', patientName);
      }
      
      // 유효성 검사 통과 시에만 authInput 업데이트
      if (PatientDataValidator.isValidPatient(patient) && PatientDataValidator.hasRequiredFields(patient)) {
        // 안전한 데이터 변환
        const authData = PatientDataConverter.toAuthData(patient);
        setAuthInput(authData);
        
        // 편집 가능한 필드들 설정 (값이 없을 때만)
        // 전화번호 설정
        if (patient && patient.phone) {
          const phoneValue = patient.phone.trim();
          if (phoneValue && (!editablePhone || editablePhone === '전화번호' || editablePhone === '')) {
            console.log('📞 [전화번호설정] patient.phone에서 설정:', phoneValue);
            setEditablePhone(phoneValue); // 포맷 유지
          }
        } else if (!editablePhone || editablePhone === '전화번호') {
          const phoneValue = PatientDataConverter.getSafePhone(patient);
          if (phoneValue && phoneValue !== '전화번호') {
            console.log('📞 [전화번호설정] getSafePhone에서 설정:', phoneValue);
            setEditablePhone(phoneValue);
          }
        }
        
        // 생년월일 설정
        if (patient && patient.birthday) {
          const birthdayValue = patient.birthday.trim();
          if (birthdayValue && (!editableBirthday || editableBirthday === '생년월일' || editableBirthday === '')) {
            console.log('📅 [생년월일설정] patient.birthday에서 설정:', birthdayValue);
            setEditableBirthday(birthdayValue);
          }
        } else if (!editableBirthday || editableBirthday === '생년월일') {
          const birthdayValue = PatientDataConverter.getSafeBirthday(patient);
          if (birthdayValue && birthdayValue !== '생년월일') {
            console.log('📅 [생년월일설정] getSafeBirthday에서 설정:', birthdayValue);
            setEditableBirthday(birthdayValue);
          }
        }
      }
    }
  }, [patient, editableName, editablePhone, editableBirthday]);

  useEffect(() => {
    checkExistingSession();
  }, []);

  // 타이틀 타이핑 효과 함수 (완전한 타이머 관리 포함)
  const typeTitleMessage = useCallback((message: string, speed: number = 80, repeat: boolean = true) => {
    // 기존 타이머 완전 정리
    if (titleTypingTimerRef.current) {
      clearInterval(titleTypingTimerRef.current);
      clearTimeout(titleTypingTimerRef.current);
      titleTypingTimerRef.current = null;
    }
    
    // 안전한 메시지 처리
    const safeMessage = typeof message === 'string' ? message : '';
    const safeSpeed = typeof speed === 'number' && speed > 0 ? speed : 80;
    
    // undefined 문자열 제거 및 완전한 정리
    let cleanMessage = safeMessage
      .replace(/undefined/g, '')
      .replace(/null/g, '')
      .trim();
    
    // 빈 문자열이거나 비정상적인 경우 기본값 사용
    if (!cleanMessage || cleanMessage.length < 3) {
      cleanMessage = '존함이 맞나요?';
    }
    
    const startTitleTyping = () => {
    setIsTitleTyping(true);
    setTitleTypingText('');
    
    let index = 0;
      
      // 첫 글자 즉시 표시
      setTitleTypingText(cleanMessage.charAt(0));
      index = 1;
      
      titleTypingTimerRef.current = setInterval(() => {
      if (index < cleanMessage.length) {
          setTitleTypingText(cleanMessage.substring(0, index + 1));
        index++;
      } else {
          if (titleTypingTimerRef.current) {
            clearInterval(titleTypingTimerRef.current);
            titleTypingTimerRef.current = null;
          }
          
          // 타이핑 완료 후 대기
          titleTypingTimerRef.current = setTimeout(() => {
            if (repeat && showConfirmation && currentConfirmationStep === 'name') {
              // 반복 시작 전에 텍스트 초기화
              setTitleTypingText('');
              titleTypingTimerRef.current = setTimeout(() => {
                startTitleTyping();
              }, 500);
            } else {
              setIsTitleTyping(false);
            }
          }, 2000);
        }
      }, safeSpeed);
    };

    startTitleTyping();
  }, [showConfirmation, currentConfirmationStep]);

  // typeTitleMessage ref 업데이트
  useEffect(() => {
    typeTitleMessageRef.current = typeTitleMessage;
  }, [typeTitleMessage]);

  // 설명 텍스트 타이핑 효과 함수 (완전한 타이머 관리 포함)
  const typeDescriptionMessage = useCallback((message: string, speed: number = 100) => {
    if (isDescTyping) return;

    // 기존 타이머 완전 정리
    if (descTypingTimerRef.current) {
      clearInterval(descTypingTimerRef.current);
      clearTimeout(descTypingTimerRef.current);
      descTypingTimerRef.current = null;
    }

    const startDescTyping = () => {
      setIsDescTyping(true);
      setDescTypingText('');

      let index = 0;
      descTypingTimerRef.current = setInterval(() => {
        if (index < message.length) {
          setDescTypingText(message.substring(0, index + 1));
          index++;
        } else {
          if (descTypingTimerRef.current) {
            clearInterval(descTypingTimerRef.current);
            descTypingTimerRef.current = null;
          }
          
          // 타이핑 완료 후 대기
          descTypingTimerRef.current = setTimeout(() => {
            if (!authRequested) {
              // 반복 시작 전에 텍스트 초기화
              setDescTypingText('');
              descTypingTimerRef.current = setTimeout(() => {
                startDescTyping();
              }, 1000);
            } else {
              setIsDescTyping(false);
            }
          }, 3000);
        }
      }, speed);
    };

    startDescTyping();
  }, [authRequested]);

  // 컴포넌트 마운트 시 설명 텍스트 타이핑 시작
  useEffect(() => {
    if (!authRequested && !showConfirmation && !showSessionModal && !isRecovering) {
      const timer = setTimeout(() => {
        typeDescriptionMessage('검진정보를\n의료보험공단에서 안전하게 불러와\n검진 정보 추이를 안내하겠습니다.', TYPING_SPEED);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [authRequested, showConfirmation, showSessionModal, isRecovering, typeDescriptionMessage]);

  // 중복된 신호 감지 로직 제거됨 - 마운트 useEffect에 통합됨

  // 브라우저 뒤로가기 이벤트 처리
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (showConfirmation && event.state?.step) {
        console.log('🔙 [브라우저뒤로가기] 단계 변경:', event.state.step);
        
        // 상태 복원
        const step = event.state.step as 'name' | 'phone' | 'birthday';
        setCurrentConfirmationStep(step);
        
        // 데이터 복원
        if (event.state.confirmationData) {
          const data = event.state.confirmationData;
          if (data.name) setEditableName(data.name);
          if (data.phone) setEditablePhone(data.phone);
        }
        
        // 타이틀 업데이트
        setTimeout(() => {
          if (step === 'name') {
            const name = (editableName && PatientDataConverter.cleanUndefined(editableName).trim()) || 
                        PatientDataConverter.getSafeName(patient) || '사용자';
            typeTitleMessage('존함이 맞나요?', 120, true);
          } else if (step === 'phone') {
            const phone = (editablePhone && PatientDataConverter.cleanUndefined(editablePhone).trim()) || 
                         PatientDataConverter.getSafePhone(patient);
            typeTitleMessage('아래 전화번호가 맞나요?', 120, true);
          } else if (step === 'birthday') {
            const birthday = (editableBirthday && PatientDataConverter.cleanUndefined(editableBirthday).trim()) || 
                            PatientDataConverter.getSafeBirthday(patient);
            typeTitleMessage('아래 생년월일이 맞나요?', 120, true);
          }
        }, 100);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showConfirmation, typeTitleMessage]);

  // App.tsx에서 인증 요청 성공 시 타이핑 효과 시작
  useEffect(() => {
    const checkAuthRequested = () => {
      const authRequested = localStorage.getItem('tilko_auth_requested');
      if (authRequested && !currentStatus.includes('auth')) {
        console.log('🎯 [타이핑효과] App.tsx에서 인증 요청 성공 감지');
        localStorage.removeItem('tilko_auth_requested');
        
        // 인증 상태 설정
        setAuthRequested(true);
        setCurrentStatus('auth_pending');
        
        // 입력 필드 비활성화
        setTimeout(() => {
          const inputs = document.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
          inputs.forEach(input => {
            input.disabled = true;
          });
        }, 100);
      }
    };
    
    // 1초마다 확인
    const interval = setInterval(checkAuthRequested, 1000);
    
    return () => clearInterval(interval);
  }, [currentStatus]);

  // 수동 데이터 수집 함수 (자동 폴링 제거됨)
  // 기존 데이터 확인 함수
  const checkExistingData = useCallback(async (uuid: string, hospitalId: string) => {
    try {
      console.log('🔍 [기존데이터확인] 시작:', { uuid, hospitalId });
      
      const response = await fetch(`/wello-api/v1/wello/check-existing-data?uuid=${uuid}&hospital_id=${hospitalId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [기존데이터확인] 결과:', result);
      
      return {
        patientExists: result.patient_exists,
        hasHealthData: result.has_health_data,
        hasPrescriptionData: result.has_prescription_data
      };
    } catch (error) {
      console.error('❌ [기존데이터확인] 실패:', error);
      return {
        patientExists: false,
        hasHealthData: false,
        hasPrescriptionData: false
      };
    }
  }, []);

  // WebSocket 완료 알림을 받았는지 추적하는 ref
  const wsCompletionRef = useRef<{ completed: boolean; data?: any }>({ completed: false });
  // 수동 데이터 수집 실행 중 플래그 (중복 호출 방지)
  const isManualCollectingRef = useRef<boolean>(false);

  const handleManualDataCollection = useCallback(async () => {
      // 중복 호출 방지
      if (isManualCollectingRef.current) {
        console.log('⏸️ [수동수집] 이미 실행 중 - 중복 호출 방지');
        return;
      }
      
      console.log('🔘 [수동수집] 사용자가 인증 완료 버튼 클릭');
      
      // 실행 중 플래그 설정
      isManualCollectingRef.current = true;
      
      // WebSocket 완료 알림 리셋
      wsCompletionRef.current = { completed: false };
      
      // sessionId 유효성 검사 (localStorage에서 직접 가져오기)
      // state, localStorage, 그리고 직접 localStorage.getItem 모두 확인
      let currentSessionId = sessionId || StorageManager.getItem(STORAGE_KEYS.TILKO_SESSION_ID) || localStorage.getItem('tilko_session_id');
      
      if (!currentSessionId) {
        console.error('❌ [수동수집] sessionId가 없습니다. state:', sessionId, 'localStorage:', StorageManager.getItem(STORAGE_KEYS.TILKO_SESSION_ID), 'direct:', localStorage.getItem('tilko_session_id'));
        
        // 세션 복구 시도
        const savedSessionId = localStorage.getItem('tilko_session_id');
        if (savedSessionId) {
          console.log('🔄 [수동수집] localStorage에서 세션 복구:', savedSessionId);
          setSessionId(savedSessionId);
          currentSessionId = savedSessionId;
        } else {
          setCurrentStatus('error');
          setTypingText('세션 정보가 없습니다.\n다시 인증을 시작해주세요.');
          return;
        }
      }
      
      // 🛡️ 중복 호출 방지: 이미 수집 중이거나 완료된 경우 체크
      try {
        const statusCheck = await fetch(TILKO_API.SESSION_STATUS(currentSessionId));
        if (statusCheck.ok) {
          const statusData = await statusCheck.json();
          console.log('🔍 [수동수집] 현재 세션 상태 확인:', statusData.status);
          
          // 이미 완료된 경우 바로 완료 처리
          if (statusData.status === 'completed' || statusData.progress?.completed === true ||
              (statusData.health_data && statusData.prescription_data)) {
            console.log('✅ [수동수집] 이미 데이터 수집 완료됨 - 바로 완료 처리');
            
            // 수집된 데이터를 localStorage에 저장
            if (statusData.health_data || statusData.prescription_data) {
              const collectedData = {
                health_data: statusData.health_data,
                prescription_data: statusData.prescription_data,
                collected_at: new Date().toISOString()
              };
              StorageManager.setItem('tilko_collected_data', collectedData);
            }
            
            // 세션 정리 및 완료 처리
            StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
            StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_DATA);
            StorageManager.removeItem('tilko_auth_waiting');
            StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
            
            setCurrentStatus('data_completed');
            
            // 데이터 수집 완료 - 플로팅 버튼 플래그 제거
            StorageManager.removeItem('tilko_manual_collect');
            window.dispatchEvent(new Event('localStorageChange'));
            
            // 로딩 스피너 종료
            setLoading(false);
            
            // 수집 완료 모달 표시 (비밀번호 설정 건너뛰기)
            console.log('🎉 [수집완료] 수집 완료 모달 표시');
            setShowCollectionCompleteModal(true);
            
            return; // 이미 완료되었으므로 collect-data 호출하지 않음
          }
          
          // 이미 수집 중인 경우
          if (statusData.status === 'fetching_health_data' || statusData.status === 'fetching_prescription_data') {
            console.log('⏳ [수동수집] 이미 데이터 수집 중 - 폴링만 시작');
            setCurrentStatus('collecting');
            setTypingText('데이터 수집이 이미 진행 중입니다.\n완료까지 잠시만 기다려주세요.');
            
            // 폴링만 시작 (collect-data 호출하지 않음)
            // ... (폴링 로직은 아래와 동일)
            // collect-data 호출 부분을 건너뛰고 폴링만 시작하도록 수정 필요
          }
        }
      } catch (error) {
        console.warn('⚠️ [수동수집] 상태 확인 실패, 계속 진행:', error);
      }
      
      console.log('🔍 [수동수집] sessionId 확인 - state:', sessionId, 'localStorage:', StorageManager.getItem(STORAGE_KEYS.TILKO_SESSION_ID), 'using:', currentSessionId);
      
      // 로딩 스피너 시작
      setLoading(true);
      setCurrentStatus('manual_collecting');
      setTypingText('데이터를 수집하고 있습니다...\n잠시만 기다려주세요.');
      
      // 플로팅 버튼 숨기기 위한 플래그 설정 (이벤트 발생하지 않음 - 무한 루프 방지)
      StorageManager.setItem('tilko_manual_collect', 'true');
      // window.dispatchEvent(new Event('localStorageChange')); // 제거 - 무한 루프 방지
      
      try {
        const response = await fetch(TILKO_API.COLLECT_DATA(currentSessionId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ [수동수집] 데이터 수집 성공!', result);
          
          // 인증 대기 상태 제거 (데이터 수집 시작됨)
          StorageManager.removeItem('tilko_auth_waiting');
          // window.dispatchEvent(new Event('localStorageChange')); // 제거 - 무한 루프 방지
          
          // 로딩 상태 유지 (데이터 수집 진행 중)
          setCurrentStatus('collecting');
          setTypingText('데이터 수집이 시작되었습니다.\n완료까지 잠시만 기다려주세요.');
          
          // 플로팅 버튼 숨기기 위한 플래그 설정 (이벤트 발생하지 않음)
          StorageManager.setItem('tilko_manual_collect', 'true');
          // window.dispatchEvent(new Event('localStorageChange')); // 제거 - 무한 루프 방지
          
          // 수집 완료 확인을 위한 폴링 시작 (WebSocket 대체)
          let pollCount = 0;
          const maxPolls = 30; // 최대 30회 (약 30초)
          
          // 폴링 중단 플래그 (완료 감지 시 즉시 중단)
          let isPollingStopped = false;
          
          const pollCollectionStatus = async () => {
            // 이미 중단된 경우 또는 cleanupAllPolling으로 중단된 경우 즉시 리턴
            if (isPollingStopped || collectionPollingStoppedRef.current) {
              console.log('⏹️ [수집상태확인] 폴링 이미 중단됨');
              return;
            }
            
            // WebSocket 완료 알림을 받았는지 확인
            if (wsCompletionRef.current.completed) {
              console.log('✅ [수집상태확인] WebSocket 완료 알림 수신 - 폴링 중단');
              isPollingStopped = true;
              
              // WebSocket에서 받은 데이터로 완료 처리
              const collectedData = wsCompletionRef.current.data;
              if (collectedData) {
                StorageManager.setItem('tilko_collected_data', {
                  health_data: collectedData.health_data,
                  prescription_data: collectedData.prescription_data,
                  collected_at: new Date().toISOString()
                });
              }
              
              // 세션 정리 및 완료 처리
              StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
              StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_DATA);
              StorageManager.removeItem('tilko_auth_waiting');
              StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
              
              // 로딩 스피너 종료
              setLoading(false);
              setCurrentStatus('data_completed');
              
              // 데이터 수집 완료 - 플로팅 버튼 플래그 제거
              StorageManager.removeItem('tilko_manual_collect');
              window.dispatchEvent(new Event('localStorageChange'));
              
              // 수집 완료 모달 표시 (비밀번호 설정 건너뛰기)
              console.log('🎉 [수집완료] 수집 완료 모달 표시');
              setShowCollectionCompleteModal(true);
              
              return;
            }
            
            try {
              pollCount++;
              console.log(`🔄 [수집상태확인] 폴링 ${pollCount}/${maxPolls}`);
              
              if (!currentSessionId) {
                console.error('❌ [수집상태확인] sessionId가 없습니다.');
                return;
              }
              const statusResponse = await fetch(TILKO_API.SESSION_STATUS(currentSessionId));
              if (statusResponse.ok) {
                const statusResult = await statusResponse.json();
                console.log('📊 [수집상태확인] 상태:', {
                  status: statusResult.status,
                  progress: statusResult.progress,
                  hasHealthData: !!statusResult.health_data,
                  hasPrescriptionData: !!statusResult.prescription_data
                });
                
                // 에러 메시지 확인 및 모달 표시
                if (statusResult.messages && Array.isArray(statusResult.messages)) {
                  const errorMessages = statusResult.messages.filter((msg: any) => 
                    typeof msg === 'object' && msg.type && msg.type.includes('error')
                  );
                  
                  if (errorMessages.length > 0) {
                    const latestError = errorMessages[errorMessages.length - 1];
                    console.log('🚨 [에러감지] 구조화된 에러 메시지:', latestError);
                    
                    isPollingStopped = true; // 폴링 중단
                    
                    displayErrorModal({
                      title: latestError.title || '데이터 수집 오류',
                      message: latestError.message || '데이터 수집 중 문제가 발생했습니다.',
                      technicalDetail: latestError.technical_detail,
                      retryAvailable: latestError.retry_available !== false
                    });
                    
                    setCurrentStatus('error');
                    return; // 폴링 종료
                  }
                }
                
                // 수집 완료 확인 (명확한 조건 체크)
                const isCompleted = statusResult.status === 'completed' || 
                                    statusResult.progress?.completed === true ||
                                    (statusResult.health_data && statusResult.prescription_data);
                
                if (isCompleted) {
                  console.log('🎉 [수집완료] 데이터 수집 완료 감지!', {
                    status: statusResult.status,
                    progressCompleted: statusResult.progress?.completed,
                    hasHealthData: !!statusResult.health_data,
                    hasPrescriptionData: !!statusResult.prescription_data
                  });
                  
                  isPollingStopped = true; // 폴링 즉시 중단
                  
                  // 수집된 데이터를 localStorage에 저장
                  if (statusResult.health_data || statusResult.prescription_data) {
                    const collectedData = {
                      health_data: statusResult.health_data,
                      prescription_data: statusResult.prescription_data,
                      collected_at: new Date().toISOString()
                    };
                    StorageManager.setItem('tilko_collected_data', collectedData);
                    console.log('💾 [수집완료] localStorage에 데이터 저장 완료:', collectedData);
                  }
                  
                  // 세션 정리
                  StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
                  StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_DATA);
                  StorageManager.removeItem('tilko_auth_waiting');
                  StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
                  
                  setCurrentStatus('data_completed');
                  
                  // 데이터 수집 완료 - 플로팅 버튼 플래그 제거
                  StorageManager.removeItem('tilko_manual_collect');
                  window.dispatchEvent(new Event('localStorageChange'));
                  
                  // 로딩 스피너 종료
                  setLoading(false);
                  
                  // 수집 완료 모달 표시 (비밀번호 설정 건너뛰기)
                  console.log('🎉 [수집완료] 수집 완료 모달 표시');
                  setShowCollectionCompleteModal(true);
                  
                  return; // 폴링 종료
                }
                
                // 아직 진행 중인 경우 계속 폴링 (중단 플래그 확인)
                if (!isPollingStopped && !collectionPollingStoppedRef.current && pollCount < maxPolls) {
                  collectionPollingTimeoutRef.current = setTimeout(pollCollectionStatus, 1000); // 1초 후 재시도
                } else if (pollCount >= maxPolls) {
                  console.warn('⚠️ [수집상태확인] 최대 폴링 횟수 초과');
                  isPollingStopped = true; // 폴링 중단
                  setLoading(false); // 로딩 스피너 종료
                  setCurrentStatus('error');
                  setTypingText('데이터 수집 확인 시간이 초과되었습니다.\n다시 시도해주세요.');
                }
              } else {
                console.error('❌ [수집상태확인] 상태 확인 실패:', statusResponse.status);
                if (!isPollingStopped && !collectionPollingStoppedRef.current && pollCount < maxPolls) {
                  collectionPollingTimeoutRef.current = setTimeout(pollCollectionStatus, 1000); // 1초 후 재시도
                }
              }
            } catch (error) {
              console.error('❌ [수집상태확인] 오류:', error);
              if (!isPollingStopped && !collectionPollingStoppedRef.current && pollCount < maxPolls) {
                collectionPollingTimeoutRef.current = setTimeout(pollCollectionStatus, 1000); // 1초 후 재시도
              }
            }
          };
          
          // 2초 후 첫 번째 상태 확인 시작
          collectionPollingTimeoutRef.current = setTimeout(pollCollectionStatus, 2000);
        } else {
          console.error('❌ [수동수집] 데이터 수집 실패:', response.status);
          setLoading(false); // 로딩 스피너 종료
          setCurrentStatus('error');
          setTypingText('데이터 수집에 실패했습니다.\n다시 시도해주세요.');
        }
      } catch (error) {
        console.error('❌ [수동수집] 오류:', error);
        setLoading(false); // 로딩 스피너 종료
        setCurrentStatus('error');
        setTypingText('오류가 발생했습니다.\n다시 시도해주세요.');
      }
  }, [sessionId]);

  // handleManualDataCollection ref 업데이트
  useEffect(() => {
    handleManualDataCollectionRef.current = handleManualDataCollection;
  }, [handleManualDataCollection]);

  // WebSocket 전용 모니터링 (폴링 제거)
  const startTokenMonitoring = useCallback((sessionId: string) => {
    console.log('📡 [WebSocket전용] 폴링 제거됨, WebSocket으로만 상태 수신:', sessionId);
    
    // 기존 타임아웃 정리
    if (tokenTimeout) {
      clearTimeout(tokenTimeout);
    }
    
    const checkToken = async () => {
      try {
        const response = await fetch(TILKO_API.SESSION_STATUS(sessionId));
        if (response.ok) {
          const result = await response.json();
          
          // 인증 완료 확인 (progress.auth_completed 또는 status가 auth_completed/authenticated)
          if ((result.progress?.auth_completed || result.status === 'auth_completed' || result.status === 'authenticated') && !tokenReceived) {
            console.log('✅ [인증완료] 사용자 인증 완료 감지!');
            setTokenReceived(true);
            setTokenRetryCount(0);
            
            // localStorage에도 토큰 상태 저장
            const sessionData = StorageManager.getItem(STORAGE_KEYS.TILKO_SESSION_DATA) || {} as any;
            sessionData.token_received = true;
            sessionData.token_received_at = new Date().toISOString();
            StorageManager.setItem(STORAGE_KEYS.TILKO_SESSION_DATA, sessionData);
            
            // 성공 시 타임아웃 정리
            if (tokenTimeout) {
              clearTimeout(tokenTimeout);
              setTokenTimeout(null);
            }
            
            // 인증 완료 - 사용자 버튼 클릭 대기
            console.log('✅ [인증완료] 인증 요청 완료 - 사용자 버튼 클릭 대기');
            setCurrentStatus('auth_completed');
            
            // 선택된 인증 방법에 따른 동적 메시지 생성
            const getAuthMethodName = (authType: string) => {
              switch (authType) {
                case '0': return '카카오톡';
                case '4': return '통신사Pass';
                case '6': return '네이버';
                default: return '카카오톡';
              }
            };
            
            // 타이핑은 useEffect에서 자동으로 처리됨
            
            // 플로팅 버튼 활성화 (자동 수집 제거)
            StorageManager.setItem('tilko_auth_waiting', 'true');
            window.dispatchEvent(new Event('localStorageChange'));
          }
          
          // 데이터 수집 상태 확인 및 업데이트
          if (result.status === 'fetching_health_data') {
            console.log('🏥 [데이터수집] 건강검진 데이터 수집 중...');
            setCurrentStatus('data_collecting');
            setTypingText('건강검진 데이터를 수집하고 있습니다.\n잠시만 기다려주세요.');
            
            // 플로팅 버튼 숨기기 위한 플래그 설정 (이벤트 발생하지 않음 - 무한 루프 방지)
            StorageManager.setItem('tilko_manual_collect', 'true');
            // window.dispatchEvent(new Event('localStorageChange')); // 제거 - 무한 루프 방지
          } else if (result.status === 'fetching_prescription_data') {
            console.log('💊 [데이터수집] 처방전 데이터 수집 중...');
            setCurrentStatus('data_collecting');
            setTypingText('처방전 데이터를 수집하고 있습니다.\n잠시만 기다려주세요.');
            
            // 플로팅 버튼 숨기기 위한 플래그 설정 (이벤트 발생하지 않음 - 무한 루프 방지)
            StorageManager.setItem('tilko_manual_collect', 'true');
            // window.dispatchEvent(new Event('localStorageChange')); // 제거 - 무한 루프 방지
          } else if (result.status === 'completed') {
            console.log('✅ [데이터수집] 모든 데이터 수집 완료!');
            setCurrentStatus('data_completed');
            setTypingText('건강검진 및 처방전 데이터 수집이\n완료되었습니다.');
            
            // 데이터 수집 완료 - 플로팅 버튼 플래그 제거
            StorageManager.removeItem('tilko_manual_collect');
            window.dispatchEvent(new Event('localStorageChange'));
            
            // 수집 완료 모달 표시
            setShowCollectionCompleteModal(true);
            
            // 수집 완료 시 모니터링 중단
            if (tokenTimeout) {
              clearTimeout(tokenTimeout);
              setTokenTimeout(null);
            }
          }
        }
      } catch (error) {
        console.error('❌ [토큰확인] 실패:', error);
      }
    };
    
    // 10초마다 상태 확인 (백엔드 자동 체크 비활성화됨)
    const interval = setInterval(checkToken, 10000);
    tokenMonitoringIntervalRef.current = interval;
    
    // 5분 후 타임아웃 (재시도 없이 안내 메시지만)
    const timeoutId = setTimeout(() => {
      if (tokenMonitoringIntervalRef.current) {
        clearInterval(tokenMonitoringIntervalRef.current);
        tokenMonitoringIntervalRef.current = null;
      }
      
      if (!tokenReceived) {
        console.log('⏰ [인증대기] 5분 경과 - 사용자 안내');
        setCurrentStatus('auth_timeout');
        setTypingText('카카오톡 인증이 완료되지 않았습니다.\n카카오톡에서 인증을 완료해주세요.\n\n인증 후 이 페이지가 자동으로 업데이트됩니다.');
      }
    }, 300000); // 5분
    
    setTokenTimeout(timeoutId);
    tokenTimeoutRef.current = timeoutId;
    
    // 즉시 한 번 확인
    checkToken();
  }, [tokenReceived, tokenRetryCount, tokenTimeout]);

  // 수동 새로고침 안내 (자동 재시도 제거)
  const handleAuthTimeout = useCallback(() => {
    console.log('⏰ [인증타임아웃] 사용자 수동 새로고침 안내');
    
    setCurrentStatus('auth_manual_refresh');
    setTypingText('인증이 지연되고 있습니다.\n\n다음을 확인해주세요:\n• 카카오톡 앱이 설치되어 있는지\n• 카카오톡 알림을 확인했는지\n• 전화번호가 정확한지\n\n문제가 계속되면 페이지를 새로고침해주세요.');
  }, []);

  // 토큰 수신했지만 사용자가 버튼을 누르지 않은 경우 처리
  const handleTokenReceivedButNotClicked = useCallback(() => {
    console.log('⏰ [토큰대기] 사용자가 2분간 버튼을 누르지 않음');
    
    // 부드러운 알림 (에러가 아닌 안내)
    const reminderMessage = "카카오톡 인증이 완료되었습니다!\n아래 '카카오톡 인증 완료했어요!' 버튼을 눌러주세요.";
    
    // 버튼 깜빡임 효과 (CSS 애니메이션)
    const buttonElement = document.querySelector('.auth-complete-button');
    if (buttonElement) {
      buttonElement.classList.add('button-reminder-pulse');
              setTimeout(() => {
        buttonElement.classList.remove('button-reminder-pulse');
      }, 3000);
    }
    
    // 3분 더 대기 후 세션 만료 경고
                setTimeout(() => {
      if (tokenReceived && currentStatus === 'auth_pending') {
        console.log('⚠️ [토큰만료경고] 5분 경과, 세션 만료 임박');
        handleError('세션이 곧 만료됩니다. 지금 인증을 완료해주세요.', 'auth');
      }
    }, 180000); // 3분 더 (총 5분)
  }, [tokenReceived, currentStatus]);

  // 컴포넌트 언마운트 시 타임아웃 정리
  useEffect(() => {
    return () => {
      if (tokenTimeout) {
        clearTimeout(tokenTimeout);
      }
    };
  }, [tokenTimeout]);

  // 심플한 세션 복구 핸들러
  const handleSimpleSessionRecovery = async (sessionId: string, status: string, sessionData: any) => {
    console.log('🔄 [심플복구] 상태:', status);
    
    // 복구 시작 플래그 설정
    setIsRecovering(true);
    
    switch (status) {
      case 'auth_pending':
        // 토큰 대기 중 - 바로 해당 화면으로
        setSessionId(sessionId);
        setCurrentStatus('auth_waiting'); // auth_pending -> auth_waiting으로 변경
        setAuthRequested(true);
        setShowConfirmation(false);
        setCxIdReceived(true); // 틸코 키 수신 상태 설정
        
        // 플로팅 버튼을 위한 상태 설정
        StorageManager.setItem('tilko_auth_waiting', 'true');
        StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
        window.dispatchEvent(new Event('localStorageChange'));
        
        console.log('📱 [복구] 카카오 인증 대기 화면으로 이동 - 플로팅 버튼 활성화');
        
        // WebSocket으로만 상태 수신 (폴링 제거됨)
        console.log('📡 [WebSocket전용] 백엔드 스트리밍으로 상태 수신 대기 중');
        break;
        
      case 'authenticated':
      case 'auth_completed':
        // 인증 완료 - 데이터 수집으로
        setSessionId(sessionId);
        setCurrentStatus('auth_completed'); // auth_completed로 통일
        setAuthRequested(true);
        setShowConfirmation(false);
        
        // 플로팅 버튼을 위한 상태 설정 (데이터 수집하기 버튼 표시)
        StorageManager.setItem('tilko_auth_waiting', 'true');
        StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
        window.dispatchEvent(new Event('localStorageChange'));
        
        console.log('✅ [복구] 인증 완료 상태에서 데이터 수집 진행 - 플로팅 버튼 활성화');
        break;
        
      case 'fetching_health_data':
      case 'fetching_prescription_data':
        // 데이터 수집 중 - 로딩 화면으로
        setSessionId(sessionId);
        setCurrentStatus(status);
        setLoading(true);
        setAuthRequested(true);
        setShowConfirmation(false);
        console.log('⏳ [복구] 데이터 수집 화면으로 이동');
        break;
        
      default:
        // 기타 상태 - 새로 시작
        console.log('🆕 [복구] 알 수 없는 상태, 새로 시작');
        StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_ID);
        StorageManager.removeItem(STORAGE_KEYS.TILKO_SESSION_DATA);
    }
    
    // 복구 완료 후 플래그 해제 (500ms 후)
    setTimeout(() => {
      setIsRecovering(false);
      console.log('🔄 [심플복구] 복구 완료, 타이핑 효과 활성화');
    }, 500);
  };

  // 기존 진행 중인 세션 확인
  const checkExistingSession = async () => {
    setIsRecovering(true);
    try {
      console.log('🔍 [AuthForm] 세션 복구 체크 시작');
      
      // 로컬 스토리지에서 세션 ID 확인
      const savedSessionId = localStorage.getItem('tilko_session_id');
      const savedSessionData = localStorage.getItem('tilko_session_data');
      
      console.log('📋 [AuthForm] localStorage 확인:', {
        sessionId: savedSessionId,
        sessionData: savedSessionData ? 'exists' : 'null'
      });
      
      if (savedSessionId && savedSessionData) {
        const sessionData = JSON.parse(savedSessionData);
        
        // 세션이 5분 이내에 생성된 경우만 복구 (MainPage와 동일하게 설정)
        const sessionAge = Date.now() - new Date(sessionData.created_at).getTime();
        const fiveMinutes = 5 * 60 * 1000;
        
        console.log('⏰ [인증복구] 세션 시간 확인:', {
          sessionAge: Math.floor(sessionAge / 1000) + '초',
          limit: '300초',
          valid: sessionAge < fiveMinutes
        });
        
        if (sessionAge < fiveMinutes) {
          console.log('🔄 [인증복구] 기존 세션 발견:', savedSessionId);
          
          // 서버에서 세션 상태 확인 (레디스 기반)
          console.log('📡 [AuthForm] 서버 세션 상태 확인 중:', savedSessionId);
          const response = await fetch(TILKO_API.SESSION_STATUS(savedSessionId));
          
          console.log('📊 [AuthForm] 서버 응답 상태:', response.status);
          
          if (response.ok) {
            const result = await response.json();
            
            console.log('📊 [AuthForm] 서버 세션 상태:', result);
            
            if (result.success && result.status && result.status !== 'error') {
              console.log('✅ [AuthForm] 기존 세션 발견:', result.status);
              
              // 심플한 상태별 복구
              console.log('🔄 [AuthForm] handleSimpleSessionRecovery 호출 시작');
              await handleSimpleSessionRecovery(savedSessionId, result.status, sessionData);
              console.log('✅ [AuthForm] handleSimpleSessionRecovery 완료');
              return;
            } else {
              console.log('⚠️ [AuthForm] 세션 상태 응답 오류:', result);
            }
          } else {
            console.error('❌ [AuthForm] 세션 상태 API 호출 실패:', response.status);
          }
        }
      }
      
      // 세션 복구 실패 또는 만료된 경우 정리
      localStorage.removeItem('tilko_session_id');
      localStorage.removeItem('tilko_session_data');
      
      // 세션 복구 실패 시에만 신호 정리
      console.log('🧹 [세션복구] 복구 실패 - 이전 신호들 정리');
      StorageManager.removeItem('tilko_manual_collect');
      StorageManager.removeItem('tilko_auth_waiting');
      StorageManager.removeItem('tilko_auth_method_selection');
      StorageManager.removeItem('tilko_auth_method_complete');
      StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
      
      // 플로팅 버튼 상태 업데이트
      window.dispatchEvent(new Event('localStorageChange'));
      
    } catch (error) {
      console.error('❌ [인증복구] 세션 복구 실패:', error);
      localStorage.removeItem('tilko_session_id');
      localStorage.removeItem('tilko_session_data');
      
      // 세션 복구 실패 시에만 신호 정리
      console.log('🧹 [세션복구] 복구 오류 - 이전 신호들 정리');
      StorageManager.removeItem('tilko_manual_collect');
      StorageManager.removeItem('tilko_auth_waiting');
      StorageManager.removeItem('tilko_auth_method_selection');
      StorageManager.removeItem('tilko_auth_method_complete');
      StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
      
      // 플로팅 버튼 상태 업데이트
      window.dispatchEvent(new Event('localStorageChange'));
      
    } finally {
      setIsRecovering(false);
    }
  };

  // 입력 검증 (레퍼런스와 동일)
  const checkRequired = useCallback(async (): Promise<boolean> => {
    if (authInput.name === '') {
      handleError('이름을 입력하여 주세요', 'validation');
      return false;
    }

    if (authInput.gender === '') {
      handleError('성별을 선택하여 주세요', 'validation');
      return false;
    }

    if (authInput.phoneNo === '') {
      handleError('전화번호를 입력하여 주세요', 'validation');
      return false;
    }

    const phoneRegex = /^01[0-9]-?[0-9]{4}-?[0-9]{4}$/;
    if (!phoneRegex.test(authInput.phoneNo)) {
      handleError('올바른 전화번호를 입력하여 주세요', 'validation');
      return false;
    }

    if (authInput.birthday === '' || authInput.birthday.length !== 8) {
      handleError('생년월일 8자리(예. 19801231)를 입력하여 주세요', 'validation');
      return false;
    }

    return true;
  }, [authInput]);

  // handleInputEvent 제거됨 - 사용되지 않음

  // 에러 처리 헬퍼
  const handleError = useCallback((message: string, type: 'validation' | 'network' | 'server' | 'auth' = 'server') => {
    setError(message);
    setErrorType(type);
    
    // 에러 발생 시 로그 출력
    console.error(`[${type.toUpperCase()}] ${message}`);
  }, []);

  // 구조화된 에러 모달 표시
  const displayErrorModal = useCallback((errorData: {
    title: string;
    message: string;
    technicalDetail?: string;
    retryAvailable?: boolean;
  }) => {
    setErrorModalData(errorData);
    setShowErrorModal(true);
  }, []);

  // 에러 클리어
  const clearError = useCallback(() => {
    setError(null);
    setErrorType(null);
    setShowErrorModal(false);
    setErrorModalData(null);
  }, []);

  // messageReplace 제거됨 - 사용되지 않음

  // 세션 상태 폴링
  // 폴링 로직 제거됨 - 동기적 처리로 변경

  // 약관동의 완료 핸들러
  const handleTermsAgreed = useCallback(async (agreedTerms: string[], termsAgreement?: any) => {
    console.log('✅ [약관동의] 약관 동의 완료:', agreedTerms, termsAgreement);
    
    // 서버에 약관 동의 저장
    if (patient?.uuid && hospital?.hospital_id && termsAgreement) {
      try {
        const response = await fetch(
          API_ENDPOINTS.SAVE_TERMS_AGREEMENT(patient.uuid, hospital.hospital_id),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(termsAgreement)
          }
        );

        if (!response.ok) {
          throw new Error('약관 동의 저장 실패');
        }

        const result = await response.json();
        console.log('✅ [약관동의] 서버 저장 완료:', result);
      } catch (error) {
        console.error('❌ [약관동의] 서버 저장 실패:', error);
        // 저장 실패해도 진행 (로컬에는 저장됨)
      }
    }

    // 로컬 스토리지에도 저장 (UUID별로 구분)
    if (patient?.uuid) {
      const termsKey = `wello_terms_agreed_${patient.uuid}`;
      const termsAtKey = `wello_terms_agreed_at_${patient.uuid}`;
      const termsListKey = `wello_terms_agreed_list_${patient.uuid}`;
      const termsAgreementKey = `wello_terms_agreement_${patient.uuid}`;
      
      localStorage.setItem(termsKey, 'true');
      localStorage.setItem(termsAtKey, new Date().toISOString());
      localStorage.setItem(termsListKey, JSON.stringify(agreedTerms));
      if (termsAgreement) {
        localStorage.setItem(termsAgreementKey, JSON.stringify(termsAgreement));
      }
    }

    setTermsAgreed(true);
    setShowTermsModal(false);
    
    // 약관동의 완료 후 정보 확인 시작 (약관 동의 체크 없이 바로 시작)
    // 약관 동의는 이미 완료되었으므로 체크하지 않고 바로 정보 확인 단계로 이동
    setTimeout(() => {
      setShowConfirmation(true);
      setCurrentConfirmationStep('name');
      // 플로팅 버튼 숨기기
      StorageManager.setItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING, 'true');
      window.dispatchEvent(new CustomEvent('tilko-status-change'));
    }, 0);
  }, [patient, hospital]);

  // 약관동의 모달 표시 (컴포넌트 마운트 시)
  useEffect(() => {
    // 약관동의가 아직 완료되지 않았으면 모달 표시
    if (!termsAgreed && !showTermsModal && patient?.uuid) {
      // UUID별로 약관 동의 여부 확인
      const termsKey = `wello_terms_agreed_${patient.uuid}`;
      const hasAgreedBefore = localStorage.getItem(termsKey);
      
      if (!hasAgreedBefore) {
        console.log('📋 [약관동의] 약관 동의 필요 - 모달 표시');
        setShowTermsModal(true);
      } else {
        console.log('✅ [약관동의] 이미 동의함 - 모달 표시 안 함');
        setTermsAgreed(true);
      }
    }
  }, [termsAgreed, showTermsModal, patient?.uuid]);

  // 모든 정보 확인 완료 후 인증 시작 (중복 방지)
  const handleAllConfirmed = useCallback(async () => {
    // 약관동의 확인
    if (!termsAgreed) {
      console.log('⚠️ [약관동의] 약관동의가 필요합니다.');
      setShowTermsModal(true);
      return;
    }

    // 🚨 중복 방지: 이미 인증이 진행 중인지 확인
    if (currentStatus === 'auth_requesting' || currentStatus === 'auth_pending' || authRequested) {
      console.log('⚠️ [중복방지] 이미 인증이 진행 중입니다. 상태:', currentStatus);
      return;
    }

    // 히스토리 상태에서 저장된 값 확인
    const historyState = window.history.state;
    const confirmationData = historyState?.confirmationData || {};
    
    // 입력 필드에서 최종 값 직접 읽기 (정보 확인 단계가 끝나면 입력 필드가 없을 수 있음)
    const nameInput = document.querySelector('input[type="text"]:not([type="tel"])') as HTMLInputElement;
    const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
    const birthdayInputs = document.querySelectorAll('input[type="text"]:not([type="tel"])');
    let birthdayInput: HTMLInputElement | null = null;
    for (let i = 0; i < birthdayInputs.length; i++) {
      const input = birthdayInputs[i] as HTMLInputElement;
      if (input.type === 'text' && !input.placeholder?.includes('전화번호') && !input.placeholder?.includes('이름')) {
        birthdayInput = input;
        break;
      }
    }
    
    // 인증 방법 선택 확인 (state 우선 > 메모리 > localStorage > confirmationData > DOM > 기본값)
    // State가 가장 신뢰할 수 있는 소스
    const savedAuthTypeFromState = selectedAuthType;
    const savedAuthTypeFromMemory = authTypeMemoryRef.current;
    const savedAuthTypeFromStorage = StorageManager.getItem<string>(STORAGE_KEYS.TILKO_SELECTED_AUTH_TYPE);
    const savedAuthTypeFromConfirmation = (confirmationData as any)?.selectedAuthType;
    
    // DOM에서 선택된 항목 찾기
    const selectedAuthElement = document.querySelector('[style*="border: 2px solid #7c746a"]') as HTMLElement;
    let selectedAuthFromDOM = null;
    if (selectedAuthElement) {
      // 부모 요소에서 data-value나 다른 속성 찾기
      const authTypeDiv = selectedAuthElement.closest('[onclick]') || selectedAuthElement.parentElement;
      // AUTH_TYPES 배열과 매칭하여 찾기
      AUTH_TYPES.forEach(authType => {
        if (selectedAuthElement.textContent?.includes(authType.label)) {
          selectedAuthFromDOM = authType.value;
        }
      });
    }
    
    // 최종 값 결정 (입력 필드 > 히스토리 > state > 기본값)
    const finalName = (
      nameInput?.value?.trim() || 
      confirmationData.name?.trim() || 
      editableName?.trim() || 
      ''
    ).trim();
    
    const finalPhone = (
      phoneInput?.value?.trim() || 
      confirmationData.phone?.trim() || 
      editablePhone?.trim() || 
      ''
    ).trim();
    
    const finalBirthday = (
      birthdayInput?.value?.trim() || 
      confirmationData.birthday?.trim() || 
      editableBirthday?.trim() || 
      patient?.birthday?.trim() || 
      ''
    ).trim();
    
    // 인증 방법 우선순위: state > 메모리 > localStorage > confirmationData > DOM > 기본값
    const finalAuthType = (
      (savedAuthTypeFromState && savedAuthTypeFromState.trim()) || 
      (savedAuthTypeFromMemory && savedAuthTypeFromMemory.trim()) || 
      (savedAuthTypeFromStorage && savedAuthTypeFromStorage.trim()) || 
      (savedAuthTypeFromConfirmation && String(savedAuthTypeFromConfirmation || '').trim()) || 
      (selectedAuthFromDOM && String(selectedAuthFromDOM).trim()) || 
      '0'
    ).trim();
    
    console.log('🔍 [handleAllConfirmed] 인증 방법 확인:', {
      state: savedAuthTypeFromState,
      메모리: savedAuthTypeFromMemory,
      localStorage: savedAuthTypeFromStorage,
      confirmationData: savedAuthTypeFromConfirmation,
      DOM: selectedAuthFromDOM,
      최종결정: finalAuthType,
      스토리지모드: StorageManager.isMemoryMode() ? '메모리' : 'localStorage'
    });
    
    console.log('🔍 [handleAllConfirmed] 최종 값 확인 (버튼 클릭 시점):', {
      입력필드: {
        nameInput값: nameInput?.value,
        phoneInput값: phoneInput?.value,
        birthdayInput값: birthdayInput?.value,
        nameInput존재: !!nameInput,
        phoneInput존재: !!phoneInput,
        birthdayInput존재: !!birthdayInput
      },
      히스토리상태: confirmationData,
      현재State: {
        editableName: editableName,
        editablePhone: editablePhone,
        editableBirthday: editableBirthday,
        selectedAuthType: selectedAuthType
      },
      최종결정값: {
        finalName: finalName,
        finalPhone: finalPhone,
        finalBirthday: finalBirthday,
        finalAuthType: finalAuthType,
        finalAuthTypeName: AUTH_TYPES.find(t => t.value === finalAuthType)?.label || '알 수 없음'
      }
    });
    
    // state 업데이트 (나중에 사용할 수 있도록)
    if (finalName && finalName !== editableName) {
      setEditableName(finalName);
    }
    if (finalPhone && finalPhone !== editablePhone) {
      setEditablePhone(finalPhone);
    }
    if (finalBirthday && finalBirthday !== editableBirthday) {
      setEditableBirthday(finalBirthday);
    }
    if (finalAuthType !== selectedAuthType) {
      setSelectedAuthType(finalAuthType);
    }
    
    // 수정된 정보로 authInput 업데이트
    const updatedAuthInput = {
      ...authInput,
      name: finalName,
      phoneNo: finalPhone.replace(/-/g, ''),
      birthday: finalBirthday
    };
    setAuthInput(updatedAuthInput);
    setShowConfirmation(false);
    setIsRecovering(false); // 정상 인증 시작 시 복구 플래그 해제
    setAuthRequested(true);
    setCurrentStatus('auth_requesting');
    console.log('🎯 [AuthForm] authRequested 설정됨, 타이핑 시작해야 함');
    
    // 정보 확인 완료 - 플래그 제거
    removeLocalStorageWithEvent('tilko_info_confirming');
    
    console.log('🎯 [인증페이지] 모든 정보 확인 완료, 인증 시작:', {
      name: finalName,
      phone: finalPhone,
      birthday: finalBirthday,
      selectedAuthType: finalAuthType,
      authTypeName: AUTH_TYPES.find(t => t.value === finalAuthType)?.label || '알 수 없음'
    });
    
    // 인증 방식별 안내 메시지 표시
    setTimeout(() => {
      const authMethodMessage = getCurrentStatusMessage();
      if (authMethodMessage) {
        typeMessage(authMethodMessage, TYPING_SPEED, false, false);
      }
    }, 100);

    // 기존 데이터 확인
    if (patient) {
      const existingData = await checkExistingData(patient.uuid, patient.hospital_id);
      
      if (existingData.patientExists && (existingData.hasHealthData || existingData.hasPrescriptionData)) {
        console.log('📋 [기존데이터] 발견됨 - 자동으로 결과 페이지로 이동');
        setCurrentStatus('completed');
        setTypingText('기존 건강정보를 불러오는 중입니다...');
        
        // 결과 페이지로 자동 이동
        setTimeout(() => {
          navigate('/results-trend');
        }, 1500);
        
        setLoading(false);
        return;
      }
    }
    
    try {
      setLoading(true);
      clearError();
      
      // 기존 사용자 세션 정리
      console.log('🧹 [세션정리] 기존 세션 정리 시작');
      try {
        await fetch(TILKO_API.SESSION_CLEANUP_USER(editableName), {
          method: HTTP_METHODS.POST
        });
      } catch (cleanupError) {
        console.warn('⚠️ [세션정리] 실패 (계속 진행):', cleanupError);
      }
      
      // 인증 타입 확인 및 로그
      const authTypeName = AUTH_TYPES.find(t => t.value === selectedAuthType)?.label || '알 수 없음';
      console.log('🔐 [인증타입] 선택된 인증 방법:', {
        value: selectedAuthType,
        name: authTypeName,
        allTypes: AUTH_TYPES.map(t => ({ value: t.value, label: t.label }))
      });
      
      // 최종 값 사용 (입력 필드에서 읽은 값 또는 state 값)
      const finalNameForRequest = finalName || editableName?.trim() || '';
      const finalPhoneForRequest = finalPhone || editablePhone?.trim() || '';
      const finalBirthdayForRequest = finalBirthday || editableBirthday?.trim() || '';
      const finalAuthTypeForRequest = finalAuthType || selectedAuthType?.trim() || '0';
      
      // 생년월일 및 인증 타입 검증
      if (!finalBirthdayForRequest || finalBirthdayForRequest.length === 0) {
        const errorMsg = '생년월일을 입력해주세요.';
        console.error('❌ [세션시작] 생년월일 누락:', {
          finalBirthdayForRequest,
          editableBirthday,
          authInput: updatedAuthInput.birthday,
          patient: patient?.birthday
        });
        setError(errorMsg);
        setLoading(false);
        return;
      }
      
      // 인증 방식 최종 검증
      const VALID_AUTH_TYPES = ['0', '4', '6'];
      
      if (!finalAuthTypeForRequest || finalAuthTypeForRequest.length === 0) {
        const errorMsg = '인증 방법을 선택해주세요.';
        console.error('❌ [세션시작] 인증 타입 누락:', {
          finalAuthTypeForRequest,
          selectedAuthType,
          allTypes: AUTH_TYPES
        });
        setError(errorMsg);
        setLoading(false);
        return;
      }
      
      // 유효한 인증 방식인지 검증
      if (!VALID_AUTH_TYPES.includes(finalAuthTypeForRequest)) {
        const errorMsg = `유효하지 않은 인증 방식입니다: ${finalAuthTypeForRequest}. 다시 선택해주세요.`;
        console.error('❌ [세션시작] 유효하지 않은 인증 타입:', {
          finalAuthTypeForRequest,
          selectedAuthType,
          validTypes: VALID_AUTH_TYPES
        });
        setError(errorMsg);
        setLoading(false);
        return;
      }
      
      // state와 전달값 불일치 시 경고 (에러는 아니지만 로그)
      if (finalAuthTypeForRequest !== selectedAuthType) {
        console.warn('⚠️ [세션시작] 인증 타입 불일치 감지:', {
          state: selectedAuthType,
          전달값: finalAuthTypeForRequest,
          원인: 'fallback 로직으로 인한 변경 가능'
        });
        // state 업데이트하여 일치시키기
        setSelectedAuthType(finalAuthTypeForRequest);
        authTypeMemoryRef.current = finalAuthTypeForRequest;
      }
      
      // 1단계: 세션 시작
      const sessionStartPayload = {
        private_auth_type: finalAuthTypeForRequest,
        user_name: finalNameForRequest, // 최종 이름 사용
        birthdate: finalBirthdayForRequest, // 최종 생년월일 사용
        phone_no: finalPhoneForRequest.replace(/-/g, ''), // 최종 전화번호 사용 (하이픈 제거)
        gender: updatedAuthInput.gender,
        patient_uuid: patient?.uuid, // 환자 UUID 추가
        hospital_id: patient?.hospital_id // 병원 ID 추가
      };
      
      // 인증 타입 매핑 확인
      const authTypeMapping = {
        '0': '카카오톡',
        '4': '통신사Pass',
        '6': '네이버'
      };
      
      console.log('📤 [세션시작] 요청 데이터:', {
        private_auth_type: sessionStartPayload.private_auth_type,
        private_auth_type_name: authTypeMapping[finalAuthTypeForRequest as keyof typeof authTypeMapping] || '알 수 없음',
        selectedAuthType_원본값: selectedAuthType,
        selectedAuthType_타입: typeof selectedAuthType,
        finalAuthTypeForRequest: finalAuthTypeForRequest,
        user_name: sessionStartPayload.user_name,
        birthdate: sessionStartPayload.birthdate + ` (길이: ${sessionStartPayload.birthdate.length})`,
        phone_no: '***', // 개인정보 마스킹
        gender: sessionStartPayload.gender,
        patient_uuid: sessionStartPayload.patient_uuid,
        hospital_id: sessionStartPayload.hospital_id
      });
      
      // 인증 타입이 예상과 다른 경우 경고
      if (finalAuthTypeForRequest !== selectedAuthType) {
        console.warn('⚠️ [세션시작] 인증 타입 변경됨:', {
          원본: selectedAuthType,
          처리후: finalAuthTypeForRequest
        });
      }
      
      const sessionResponse = await fetch(TILKO_API.SESSION_START(), {
        method: HTTP_METHODS.POST,
        headers: API_HEADERS.JSON,
        body: JSON.stringify(sessionStartPayload)
      });

      if (!sessionResponse.ok) {
        throw new Error('세션 시작 실패');
      }

      const sessionResult = await sessionResponse.json();
      
      if (sessionResult.success) {
        const newSessionId = sessionResult.session_id;
        setSessionId(newSessionId);
        
        // 세션 정보를 로컬 스토리지에 저장
        const sessionDataToSave = {
          session_id: newSessionId,
          user_info: {
            name: editableName,
            gender: updatedAuthInput.gender,
            phone_no: updatedAuthInput.phoneNo,
            birthdate: updatedAuthInput.birthday
          },
          created_at: new Date().toISOString()
        };
        localStorage.setItem('tilko_session_id', newSessionId);
        localStorage.setItem('tilko_session_data', JSON.stringify(sessionDataToSave));
        
        console.log('💾 [인증세션] 세션 정보 저장:', newSessionId);
        
        // 2단계: 간편인증 요청
        const authResponse = await fetch(TILKO_API.SIMPLE_AUTH(newSessionId), {
          method: HTTP_METHODS.POST,
          headers: API_HEADERS.JSON
        });

        const authResult = await authResponse.json();
        
        if (!authResponse.ok) {
          // 백엔드에서 보내는 구체적인 에러 메시지 사용
          const errorMessage = authResult.detail || '인증 요청 실패';
          throw new Error(errorMessage);
        }
        
        if (authResult.success) {
          setCurrentStatus('auth_pending');
          setTokenReceived(false); // 토큰 상태 초기화
          
          // 인증 요청 성공 확인 로그
          console.log('✅ [인증요청] 인증 요청 전송 성공!', {
            session_id: newSessionId,
            auth_type: authTypeName,
            status: authResult.status,
            message: authResult.message,
            next_step: authResult.next_step
          });
          
          // localStorage에 인증 요청 성공 플래그 설정 (타이핑 효과용)
          localStorage.setItem('tilko_auth_requested', 'true');
          
          console.log('🔄 [인증요청] 인증 대기 중 - 사용자가 앱에서 인증 완료 대기');
          
          // WebSocket 연결 실패 대비 폴링 시작 (3초 후)
          console.log('📡 [WebSocket전용] 백엔드 스트리밍 시작, WebSocket 실패 시 폴링으로 대체');
          setTimeout(() => {
            console.log('🔄 [폴링시작] WebSocket 연결 실패 대비, 폴링으로 상태 확인');
            startTokenMonitoring(newSessionId);
          }, 3000);
        } else {
          console.error('❌ [인증요청] 인증 요청 실패:', {
            success: authResult.success,
            message: authResult.message,
            detail: authResult.detail
          });
          handleError(authResult.message || '인증 요청 실패', 'auth');
        }
      } else {
        handleError(sessionResult.message || '세션 시작 실패', 'server');
      }
    } catch (error) {
      console.error('❌ [인증페이지] 인증 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      handleError(errorMessage, 'auth');
    } finally {
      setLoading(false);
    }
  }, [authInput, editableName, editablePhone, editableBirthday, selectedAuthType]);

  // 단계별 뒤로가기 처리
  const handleStepBack = useCallback(() => {
    if (currentConfirmationStep === 'phone') {
      setCurrentConfirmationStep('name');
      setTimeout(() => {
        const name = (editableName && PatientDataConverter.cleanUndefined(editableName).trim()) || 
                    PatientDataConverter.getSafeName(patient) || '사용자';
        typeTitleMessage(`${name}님\n존함이 맞나요?`, 120, true);
      }, 100);
    } else if (currentConfirmationStep === 'birthday') {
      setCurrentConfirmationStep('phone');
      setTimeout(() => {
        const phone = (editablePhone && PatientDataConverter.cleanUndefined(editablePhone).trim()) || 
                     PatientDataConverter.getSafePhone(patient);
        typeTitleMessage('아래 전화번호가 맞나요?', 120, true);
      }, 100);
    } else if (currentConfirmationStep === 'auth_method') {
      setCurrentConfirmationStep('birthday');
      setTimeout(() => {
        const birthday = (editableBirthday && PatientDataConverter.cleanUndefined(editableBirthday).trim()) || 
                        PatientDataConverter.getSafeBirthday(patient);
        typeTitleMessage('아래 생년월일이 맞나요?', 120, true);
      }, 100);
    } else {
      // 첫 번째 단계에서는 정보 확인을 종료하고 원래 페이지로
      setShowConfirmation(false);
      removeLocalStorageWithEvent('tilko_info_confirming');
      onBack && onBack();
    }
  }, [currentConfirmationStep, typeTitleMessage, onBack]);

  // 단계별 확인 진행
  const handleNextStep = useCallback(() => {
    // ref에 함수 할당
    handleNextStepRef.current = handleNextStep;
    
    console.log('🔄 [handleNextStep] 현재 단계:', currentConfirmationStep);
    
    if (currentConfirmationStep === 'name') {
      // 이름 입력 필드에서 현재 값을 직접 확인 (버튼 클릭 시점에 읽기)
      const nameInputs = document.querySelectorAll('input[type="text"]:not([type="tel"])');
      let nameInput: HTMLInputElement | null = null;
      for (let i = 0; i < nameInputs.length; i++) {
        const input = nameInputs[i] as HTMLInputElement;
        if (input.placeholder?.includes('이름') || (!input.placeholder?.includes('전화번호') && !input.placeholder?.includes('생년월일'))) {
          nameInput = input;
          break;
        }
      }
      const currentName = nameInput?.value?.trim() || editableName?.trim() || '';
      const finalName = currentName || editableName?.trim() || PatientDataConverter.getSafeName(patient) || '';
      
      console.log('📝 [handleNextStep] 이름 확인 (버튼 클릭 시점):', {
        nameInput값: nameInput?.value,
        editableName: editableName,
        finalName: finalName,
        모든입력필드: Array.from(nameInputs).map((inp: any) => ({ value: inp.value, placeholder: inp.placeholder }))
      });
      
      // 이름 검증 강화
      const trimmedName = finalName.trim();
      if (!trimmedName || trimmedName.length === 0) {
        console.warn('⚠️ [handleNextStep] 이름이 입력되지 않았습니다.');
        setError('이름을 입력해주세요.');
        return;
      }
      
      // 이름 형식 검증 (한글 2-10자, 특수문자 제한)
      const nameRegex = /^[가-힣a-zA-Z\s]{2,10}$/;
      if (!nameRegex.test(trimmedName)) {
        console.warn('⚠️ [handleNextStep] 이름 형식이 올바르지 않습니다:', trimmedName);
        setError('이름은 2-10자의 한글 또는 영문으로 입력해주세요.');
        return;
      }
      
      // 이름이 있으면 editableName 업데이트 (즉시 반영)
      if (finalName) {
        setEditableName(finalName);
      }
      
      // 부드러운 전환을 위한 약간의 딜레이
      setTimeout(() => {
        setCurrentConfirmationStep('phone');
        // 히스토리에 새 상태 추가 (업데이트된 이름 사용)
        const nameToSave = finalName || editableName || '';
        NavigationHelper.pushState(
          { step: 'phone', confirmationData: { name: nameToSave } }
        );
        console.log('💾 [handleNextStep] 저장된 confirmationData:', {
          name: nameToSave
        });
        setTimeout(() => {
          const phone = (editablePhone && PatientDataConverter.cleanUndefined(editablePhone).trim()) || 
                       PatientDataConverter.getSafePhone(patient);
          typeTitleMessage('아래 전화번호가 맞나요?', 120, true);
        }, 100);
      }, 200);
    } else if (currentConfirmationStep === 'phone') {
      // 전화번호 입력 필드에서 현재 값을 직접 확인 (버튼 클릭 시점에 읽기)
      const phoneInput = document.querySelector('input[type="tel"]') as HTMLInputElement;
      
      // 입력 필드에서 직접 읽기 (플레인 텍스트가 아닌 실제 input value)
      const inputValue = phoneInput?.value?.trim() || '';
      
      // input value가 비어있거나 '전화번호' 같은 플레인 텍스트인 경우 state 우선 사용
      const currentPhone = (
        (inputValue && 
         inputValue !== '전화번호' && 
         !/^전화번호/.test(inputValue) &&
         !/^아래 전화번호/.test(inputValue) &&
         /[0-9]/.test(inputValue)) // 숫자가 포함되어 있는지 확인
          ? inputValue 
          : editablePhone?.trim() || ''
      ) || PatientDataConverter.getSafePhone(patient) || '';
      
      // '전화번호' 같은 플레인 텍스트 제거 및 숫자만 추출
      const cleanedPhone = currentPhone.replace(/[^0-9]/g, ''); // 숫자만 추출
      const finalPhone = (
        cleanedPhone && 
        cleanedPhone !== '전화번호' && 
        !/^전화번호/.test(cleanedPhone) &&
        /^01[0-9]/.test(cleanedPhone) // 010으로 시작하는지 확인
      ) ? cleanedPhone : (editablePhone?.trim().replace(/[^0-9]/g, '') || PatientDataConverter.getSafePhone(patient)?.replace(/[^0-9]/g, '') || '');
      
      // 전화번호 검증 강화
      const trimmedPhone = finalPhone.replace(/-/g, '').trim();
      if (!trimmedPhone || trimmedPhone.length === 0) {
        console.warn('⚠️ [handleNextStep] 전화번호가 입력되지 않았습니다.');
        setError('전화번호를 입력해주세요.');
        return;
      }
      
      // 전화번호 형식 검증 (010으로 시작하는 10-11자리 숫자)
      const phoneRegex = /^01[0-9][0-9]{7,8}$/;
      if (!phoneRegex.test(trimmedPhone)) {
        console.warn('⚠️ [handleNextStep] 전화번호 형식이 올바르지 않습니다:', trimmedPhone);
        setError('올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678)');
        return;
      }
      
      // 전화번호가 있으면 editablePhone 업데이트 (즉시 반영)
      if (trimmedPhone) {
        setEditablePhone(trimmedPhone);
      }
      
      console.log('📞 [handleNextStep] 전화번호 확인 (버튼 클릭 시점):', {
        phoneInput값: phoneInput?.value,
        phoneInput존재: !!phoneInput,
        inputValue: inputValue,
        currentPhone: currentPhone,
        cleanedPhone: cleanedPhone,
        editablePhone: editablePhone,
        finalPhone: finalPhone,
        trimmedPhone: trimmedPhone,
        patientPhone: PatientDataConverter.getSafePhone(patient)
      });
      
      setTimeout(() => {
        setCurrentConfirmationStep('birthday');
        // 히스토리에 새 상태 추가 (업데이트된 전화번호 사용)
        const phoneToSave = trimmedPhone || editablePhone || '';
        NavigationHelper.pushState(
          { step: 'birthday', confirmationData: { name: editableName, phone: phoneToSave } }
        );
        console.log('💾 [handleNextStep] 저장된 confirmationData:', {
          name: editableName,
          phone: phoneToSave
        });
        setTimeout(() => {
          const birthday = (editableBirthday && PatientDataConverter.cleanUndefined(editableBirthday).trim()) || 
                          PatientDataConverter.getSafeBirthday(patient);
          typeTitleMessage('아래 생년월일이 맞나요?', 120, true);
        }, 100);
      }, 200);
    } else if (currentConfirmationStep === 'birthday') {
      // 생년월일 입력 필드에서 현재 값을 직접 확인 (버튼 클릭 시점에 읽기)
      // 생년월일 입력 필드 찾기 - placeholder가 '19810927'인 input 찾기
      const birthdayInput = document.querySelector('input[placeholder="19810927"]') as HTMLInputElement;
      
      // 대안: 모든 text input 중에서 생년월일 필드 찾기 (이름, 전화번호 제외)
      let foundBirthdayInput: HTMLInputElement | null = birthdayInput;
      if (!foundBirthdayInput) {
        const allTextInputs = document.querySelectorAll('input[type="text"]:not([type="tel"])');
        for (let i = 0; i < allTextInputs.length; i++) {
          const input = allTextInputs[i] as HTMLInputElement;
          const placeholder = input.placeholder || '';
          const value = input.value || '';
          // 생년월일 필드 특징: placeholder가 숫자 8자리이거나, value가 숫자 8자리
          if (input.type === 'text' && 
              !placeholder.includes('전화번호') && 
              !placeholder.includes('이름') &&
              (placeholder === '19810927' || /^\d{8}$/.test(value) || /^\d{8}$/.test(placeholder))) {
            foundBirthdayInput = input;
            break;
          }
        }
      }
      
      // 입력 필드에서 직접 읽기 - 간단하게: value가 있으면 value, 없으면 placeholder
      const inputValue = foundBirthdayInput?.value?.trim() || '';
      const placeholderValue = foundBirthdayInput?.placeholder?.trim() || '';
      
      // 입력창에 있는 값을 그냥 사용 (value가 있으면 value, 없으면 placeholder)
      const currentBirthday = inputValue || (placeholderValue && placeholderValue !== '19810927' ? placeholderValue : '');
      
      // '생년월일' 같은 플레인 텍스트 제거 및 숫자만 추출
      const cleanedBirthday = currentBirthday ? currentBirthday.replace(/[^0-9]/g, '') : '';
      
      // 숫자 8자리인지 확인하고, '생년월일' 같은 텍스트가 아닌지 확인
      const finalBirthday = (
        cleanedBirthday && 
        cleanedBirthday !== '생년월일' && 
        !/^생년월일/.test(cleanedBirthday) &&
        /^\d{8}$/.test(cleanedBirthday)
      ) ? cleanedBirthday : '';
      
      // finalBirthday가 없으면 editableBirthday나 patient 데이터에서 가져오기
      const fallbackBirthday = finalBirthday || (
        (editableBirthday?.trim() && editableBirthday !== '생년월일' && !/^생년월일/.test(editableBirthday) && /[0-9]/.test(editableBirthday))
          ? editableBirthday.trim().replace(/[^0-9]/g, '')
          : (() => {
              const patientBirthdayRaw = PatientDataConverter.getSafeBirthday(patient) || patient?.birthday || '';
              if (patientBirthdayRaw && patientBirthdayRaw !== '생년월일' && !/^생년월일/.test(patientBirthdayRaw)) {
                const cleaned = patientBirthdayRaw.replace(/[^0-9]/g, '');
                return /^\d{8}$/.test(cleaned) ? cleaned : '';
              }
              return '';
            })()
      );
      
      console.log('📅 [handleNextStep] 생년월일 확인 (버튼 클릭 시점):', {
        birthdayInput값: foundBirthdayInput?.value,
        birthdayInput존재: !!foundBirthdayInput,
        inputValue: inputValue,
        placeholderValue: placeholderValue,
        currentBirthday: currentBirthday,
        cleanedBirthday: cleanedBirthday,
        finalBirthday: finalBirthday,
        fallbackBirthday: fallbackBirthday,
        editableBirthday: editableBirthday,
        patientBirthday: PatientDataConverter.getSafeBirthday(patient) || patient?.birthday,
        모든입력필드: Array.from(document.querySelectorAll('input[type="text"]')).map((inp: any) => ({ 
          value: inp.value, 
          placeholder: inp.placeholder,
          type: inp.type
        }))
      });
      
      // 생년월일 검증 강화
      const trimmedBirthday = finalBirthday.trim();
      if (!trimmedBirthday || trimmedBirthday.length === 0) {
        console.warn('⚠️ [handleNextStep] 생년월일이 입력되지 않았습니다.');
        setError('생년월일을 입력해주세요.');
        return;
      }
      
      // 생년월일 형식 검증 (8자리 숫자)
      if (trimmedBirthday.length !== 8 || !/^\d{8}$/.test(trimmedBirthday)) {
        console.warn('⚠️ [handleNextStep] 생년월일 형식이 올바르지 않습니다:', trimmedBirthday);
        setError('생년월일을 8자리 숫자로 입력해주세요. (예: 19810927)');
        return;
      }
      
      // 날짜 유효성 검증
      const year = parseInt(trimmedBirthday.substring(0, 4));
      const month = parseInt(trimmedBirthday.substring(4, 6));
      const day = parseInt(trimmedBirthday.substring(6, 8));
      
      // 년도 범위 검증 (1900-현재년도)
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear) {
        console.warn('⚠️ [handleNextStep] 생년월일 년도가 유효하지 않습니다:', year);
        setError(`생년월일의 년도는 1900년부터 ${currentYear}년까지 입력 가능합니다.`);
        return;
      }
      
      // 월/일 유효성 검증
      if (month < 1 || month > 12) {
        console.warn('⚠️ [handleNextStep] 생년월일 월이 유효하지 않습니다:', month);
        setError('생년월일의 월은 1월부터 12월까지 입력 가능합니다.');
        return;
      }
      
      // 날짜 유효성 검증 (실제 존재하는 날짜인지 확인)
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        console.warn('⚠️ [handleNextStep] 생년월일 날짜가 유효하지 않습니다:', { year, month, day });
        setError('올바른 날짜를 입력해주세요. (예: 1981년 9월 27일 → 19810927)');
        return;
      }
      
      // 검증 통과 - 생년월일이 있으면 editableBirthday 업데이트 (즉시 반영)
      if (trimmedBirthday && trimmedBirthday !== editableBirthday) {
        setEditableBirthday(trimmedBirthday);
      }
      
      setTimeout(() => {
        // showConfirmation이 true인지 확인하고 유지
        if (!showConfirmation) {
          console.log('⚠️ [인증방법선택] showConfirmation이 false입니다. true로 설정합니다.');
          setShowConfirmation(true);
        }
        setCurrentConfirmationStep('auth_method');
        // 히스토리에 새 상태 추가 (업데이트된 모든 값 사용)
        const nameToSave = editableName.trim() || '';
        const phoneToSave = editablePhone.trim() || '';
        const birthdayToSave = trimmedBirthday || editableBirthday.trim() || '';
        NavigationHelper.pushState(
          { step: 'auth_method', confirmationData: { name: nameToSave, phone: phoneToSave, birthday: birthdayToSave, selectedAuthType: selectedAuthType } }
        );
        console.log('💾 [handleNextStep] 저장된 confirmationData:', {
          name: nameToSave,
          phone: phoneToSave,
          birthday: birthdayToSave
        });
        
        // 플로팅 버튼을 위한 상태 설정 (인증 방식 선택)
        StorageManager.setItem('tilko_auth_method_selection', 'true');
        StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
        window.dispatchEvent(new Event('localStorageChange'));
        
        setTimeout(() => {
          typeTitleMessage(`인증 방식을\n선택해주세요`, 120, true);
        }, 100);
      }, 200);
    } else if (currentConfirmationStep === 'auth_method') {
      // 인증 방법 선택 확인 (버튼 클릭 시점에 읽기)
      const selectedAuthElement = document.querySelector('[style*="border: 2px solid #7c746a"]') as HTMLElement;
      let selectedAuthFromDOM = selectedAuthType;
      
      if (selectedAuthElement) {
        // 선택된 인증 방법 찾기
        const authTypeDiv = selectedAuthElement.closest('[onclick]') as HTMLElement;
        AUTH_TYPES.forEach(authType => {
          const elementText = selectedAuthElement.textContent || '';
          const divText = authTypeDiv?.textContent || '';
          if (elementText.includes(authType.label) || divText.includes(authType.label)) {
            selectedAuthFromDOM = authType.value;
            console.log('🔍 [handleNextStep] DOM에서 인증 방법 발견:', {
              label: authType.label,
              value: authType.value,
              elementText: elementText.substring(0, 50)
            });
          }
        });
      }
      
      // StorageManager를 통해 확인 (메모리 fallback 지원)
      const savedAuthType = StorageManager.getItem<string>(STORAGE_KEYS.TILKO_SELECTED_AUTH_TYPE) || authTypeMemoryRef.current;
      if (savedAuthType && (!selectedAuthFromDOM || selectedAuthFromDOM === '0')) {
        selectedAuthFromDOM = savedAuthType;
        console.log('🔍 [handleNextStep] 스토리지에서 인증 방법 발견:', savedAuthType, StorageManager.isMemoryMode() ? '(메모리)' : '(localStorage)');
      }
      
      const finalAuthType = selectedAuthFromDOM?.trim() || selectedAuthType?.trim() || '0';
      
      console.log('🔐 [handleNextStep] 인증 방법 확인 (버튼 클릭 시점):', {
        selectedAuthElement존재: !!selectedAuthElement,
        selectedAuthFromDOM: selectedAuthFromDOM,
        selectedAuthType: selectedAuthType,
        finalAuthType: finalAuthType,
        finalAuthTypeName: AUTH_TYPES.find(t => t.value === finalAuthType)?.label || '알 수 없음'
      });
      
      // 인증 방법이 기본값(0)이면 선택되지 않은 것으로 간주
      if (finalAuthType === '0' && !selectedAuthElement) {
        console.warn('⚠️ [handleNextStep] 인증 방법이 선택되지 않았습니다. 다음 단계로 넘어갈 수 없습니다.');
        setError('인증 방법을 선택해주세요.');
        return;
      }
      
      // 인증 방법이 있으면 selectedAuthType 업데이트 (즉시 반영)
      if (finalAuthType && finalAuthType !== selectedAuthType) {
        setSelectedAuthType(finalAuthType);
        // 메모리에도 저장
        authTypeMemoryRef.current = finalAuthType;
        // localStorage에 저장 시도
        const saved = StorageManager.setItem(STORAGE_KEYS.TILKO_SELECTED_AUTH_TYPE, finalAuthType);
        if (saved) {
          console.log('💾 [handleNextStep] 인증 방법 저장:', finalAuthType, StorageManager.isMemoryMode() ? '(메모리)' : '(localStorage)');
        } else {
          console.warn('⚠️ [handleNextStep] 저장 실패 - 메모리만 사용:', finalAuthType);
        }
      }
      
      setTimeout(() => {
        setCurrentConfirmationStep('completed');
        
        // 인증 방식 선택 완료 - 플로팅 버튼 상태 제거
        StorageManager.removeItem('tilko_auth_method_selection');
        window.dispatchEvent(new Event('localStorageChange'));
        
        handleAllConfirmed();
      }, 200);
    }
  }, [currentConfirmationStep, handleAllConfirmed, typeTitleMessage, editableName, editablePhone]);

  // handleNextStep ref 업데이트
  useEffect(() => {
    handleNextStepRef.current = handleNextStep;
  }, [handleNextStep]);

  // 새로운 카카오 간편인증 (세션 기반)
  const handleKakaoAuth = useCallback(async () => {
    if (await checkRequired()) {
      setLoading(true);
      clearError();
      
      try {
        // 기존 사용자 세션 정리
        console.log('🧹 [세션정리] 기존 세션 정리 시작');
        try {
          await fetch(TILKO_API.SESSION_CLEANUP_USER(authInput.name), {
            method: HTTP_METHODS.POST
          });
        } catch (cleanupError) {
          console.warn('⚠️ [세션정리] 실패 (계속 진행):', cleanupError);
        }
        // 1단계: 세션 시작
        const sessionResponse = await fetch(TILKO_API.SESSION_START(), {
          method: HTTP_METHODS.POST,
          headers: API_HEADERS.JSON,
          body: JSON.stringify({
            private_auth_type: selectedAuthType,
            user_name: authInput.name,
            birthdate: authInput.birthday,
            phone_no: authInput.phoneNo,
            gender: authInput.gender
          })
        });

        if (!sessionResponse.ok) {
          throw new Error('세션 시작 실패');
        }

        const sessionResult = await sessionResponse.json();
        
        if (sessionResult.success) {
          const newSessionId = sessionResult.session_id;
          setSessionId(newSessionId);
          
          // 세션 정보를 로컬 스토리지에 저장
          const sessionDataToSave = {
            session_id: newSessionId,
            user_info: {
              name: authInput.name,
              gender: authInput.gender,
              phone_no: authInput.phoneNo,
              birthdate: authInput.birthday
            },
            created_at: new Date().toISOString()
          };
          localStorage.setItem('tilko_session_id', newSessionId);
          localStorage.setItem('tilko_session_data', JSON.stringify(sessionDataToSave));
          
          console.log('💾 [인증세션] 세션 정보 저장:', newSessionId);
          
          // 2단계: 간편인증 요청
          const authResponse = await fetch(TILKO_API.SIMPLE_AUTH(newSessionId), {
            method: HTTP_METHODS.POST,
            headers: API_HEADERS.JSON
          });

          const authResult = await authResponse.json();
          
          if (!authResponse.ok) {
            // 백엔드에서 보내는 구체적인 에러 메시지 사용
            const errorMessage = authResult.detail || '인증 요청 실패';
            throw new Error(errorMessage);
          }
          
          if (authResult.success) {
            setAuthRequested(true);
            clearError();
            setCurrentStatus('auth_pending');
            
            // 카카오 토큰 요청 성공 - 이제 플로팅 버튼은 isConfirming만으로 제어됨
            
            // 입력 필드 비활성화
            const inputs = document.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
            inputs.forEach(input => {
              input.disabled = true;
            });

            // 인증 요청 후에는 폴링하지 않음 - 사용자가 직접 확인 버튼을 눌러야 함
            console.log('🔄 [인증요청] 카카오톡 인증 대기 중 - 폴링 중단');
            
          } else {
            handleError(authResult.message || '인증 요청 실패', 'auth');
          }
        } else {
          handleError(sessionResult.message || '세션 시작 실패', 'server');
        }
      } catch (error) {
        console.error('카카오 간편인증 실패:', error);
        handleError('카카오 간편인증 요청 중 오류가 발생했습니다.', 'network');
      } finally {
        setLoading(false);
      }
    }
  }, [checkRequired, authInput, selectedAuthType]);

  // 폴링 정리 로직 제거됨 
  
  // 실제 인증 상태 폴링 및 데이터 수집
  const handleAuthCompleted = useCallback(async () => {
    if (!sessionId) return;
    
    // 타이핑 중일 때는 클릭 무시
    if (isTyping) {
      console.log('⏸️ [인증버튼] 타이핑 중이므로 클릭 무시');
      return;
    }
    
    // 틸코 키 미수신 시 클릭 무시 (tokenReceived 체크 제거)
    if (!cxIdReceived) {
      console.log('⏸️ [인증버튼] 틸코 키 미수신으로 클릭 무시');
      return;
    }
    
    setLoading(true);
    setCurrentStatus('authenticating');
    
    console.log('🔍 [인증상태확인] 실제 인증 상태 폴링 시작');
    
    // 실제 인증 상태를 폴링으로 확인
    const checkAuthStatus = async () => {
      try {
        const response = await fetch(TILKO_API.SESSION_STATUS(sessionId));
        if (response.ok) {
          const result = await response.json();
          console.log(`📊 [폴링] 현재 상태: ${result.status}`);
          
          // 사용자 정보 재확인 필요 상태
          if (result.status === 'info_required') {
            console.log('⚠️ [인증완료] 사용자 정보 재확인 필요 - 정보 확인 단계로 복귀');
            setCurrentStatus('error');
            setShowConfirmation(true);
            setCurrentConfirmationStep('name');
            // 에러 메시지 표시
            const errorMessages = result.messages || [];
            const lastError = errorMessages[errorMessages.length - 1];
            if (lastError && lastError.message) {
              const errorMsg = typeof lastError.message === 'object' 
                ? lastError.message.message || lastError.message.title || '입력하신 정보를 확인해주세요.'
                : lastError.message;
              setError(errorMsg);
            } else {
              setError('입력하신 정보를 확인해주세요. 이름, 생년월일, 전화번호가 정확한지 확인 후 다시 시도해주세요.');
            }
            return true; // 폴링 중단
          }
          
          if (result.status === 'authenticated') {
            console.log('✅ [인증완료] 실제 인증 완료 확인됨 - 데이터 수집 시작');
            
            // 🛡️ 데이터 수집 시작 (중복 방지 적용)
            const collectResponse = await apiCallPrevention.safeApiCall(
              async (signal) => fetch(TILKO_API.COLLECT_HEALTH_DATA(sessionId), {
                method: HTTP_METHODS.POST,
                headers: API_HEADERS.JSON,
                signal
              }),
              `collect_data_${sessionId}`
            );

            if (collectResponse.ok) {
              const collectResult = await collectResponse.json();
              if (collectResult.success) {
          setCurrentStatus('completed');
          console.log('🎉 [완료] 모든 데이터 수집 완료');
          
          localStorage.setItem('tilko_auth_completed', 'true');
          localStorage.removeItem('tilko_session_id');
          localStorage.removeItem('tilko_session_data');
          
                STANDARD_NAVIGATION.AUTH_TO_RESULTS(navigate);
                return true; // 성공
              }
            }
            handleError('데이터 수집 실패', 'server');
            return true; // 폴링 중단
          } else if (result.status === 'auth_pending') {
            return false; // 계속 폴링
        } else if (result.status === 'error') {
            // 에러 상태 확인
            const errorMessages = result.messages || [];
            const lastError = errorMessages[errorMessages.length - 1];
            if (lastError && lastError.message) {
              const errorMsg = typeof lastError.message === 'object' 
                ? lastError.message.message || lastError.message.title || '오류가 발생했습니다.'
                : lastError.message;
              
              // 사용자 정보 오류인 경우 정보 확인 단계로 복귀
              if (typeof lastError.message === 'object' && lastError.message.requires_info_recheck) {
                console.log('⚠️ [인증완료] 사용자 정보 오류 감지 - 정보 확인 단계로 복귀');
                setCurrentStatus('error');
                setShowConfirmation(true);
                setCurrentConfirmationStep('name');
                setError(errorMsg);
              } else {
                handleError(errorMsg, 'server');
              }
            } else {
              handleError('오류가 발생했습니다.', 'server');
            }
            return true; // 폴링 중단
        } else {
            handleError(`예상치 못한 상태: ${result.status}`, 'server');
            return true; // 폴링 중단
        }
      } else {
          handleError('인증 상태 확인 실패', 'network');
          return true; // 폴링 중단
      }
    } catch (error) {
        console.error('인증 상태 확인 오류:', error);
        handleError('인증 상태 확인 중 오류가 발생했습니다.', 'network');
        return true; // 폴링 중단
      }
    };
    
    // 폴링 시작 (3초마다, 최대 60초)
    let pollCount = 0;
    const maxPolls = 20; // 60초
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      const shouldStop = await checkAuthStatus();
      
      if (shouldStop || pollCount >= maxPolls) {
        if (authStatusPollIntervalRef.current) {
          clearInterval(authStatusPollIntervalRef.current);
          authStatusPollIntervalRef.current = null;
        }
        if (pollCount >= maxPolls) {
          handleError('인증 대기 시간이 초과되었습니다. 다시 시도해주세요.', 'auth');
        }
      setLoading(false);
    }
    }, 3000);
    authStatusPollIntervalRef.current = pollInterval;
    
    // 첫 번째 즉시 확인
    const shouldStop = await checkAuthStatus();
    if (shouldStop) {
      if (authStatusPollIntervalRef.current) {
        clearInterval(authStatusPollIntervalRef.current);
        authStatusPollIntervalRef.current = null;
      }
      setLoading(false);
    }
  }, [sessionId, tokenReceived, isTyping]);

  // 플로팅 버튼에서 직접 호출할 수 있도록 window에 함수 등록
  useEffect(() => {
    (window as any).welloAuthForm = {
      startInfoConfirmation: () => {
        console.log('🔐 [AuthForm] 정보 확인 시작 (직접 호출)');
        // 약관동의 확인
        if (!termsAgreed) {
          console.log('⚠️ [약관동의] 약관동의가 필요합니다. 모달 표시');
          setShowTermsModal(true);
          return;
        }
        setShowConfirmation(true);
        setCurrentConfirmationStep('name');
        // 플로팅 버튼 숨기기
        StorageManager.setItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING, 'true');
        window.dispatchEvent(new CustomEvent('tilko-status-change'));
      },
      startManualDataCollection: () => {
        console.log('✅ [AuthForm] 수동 데이터 수집 시작 (직접 호출)');
        handleManualDataCollection();
      },
      completeAuthMethodSelection: () => {
        console.log('🔘 [AuthForm] 인증 방식 선택 완료 (직접 호출)');
        // auth_method 단계에서 handleNextStep을 호출하면 handleAllConfirmed가 실행됨
        setCurrentConfirmationStep('auth_method');
        // 다음 이벤트 루프에서 handleNextStep 호출
        setTimeout(() => {
          handleNextStep();
        }, 0);
      },
      handleNextStep: () => {
        console.log('➡️ [AuthForm] 다음 단계 진행 (직접 호출)');
        handleNextStep();
      },
      getCurrentConfirmationStep: () => {
        return currentConfirmationStep;
      }
    };
    
    return () => {
      delete (window as any).welloAuthForm;
    };
  }, [termsAgreed, currentConfirmationStep]);

  // 세션 복구 선택
  const handleResumeSession = useCallback(async () => {
    if (!savedSessionInfo) return;
    
    const { sessionId: savedSessionId, data: result, sessionData } = savedSessionInfo;
    
    console.log('✅ [세션복구] 기존 세션 복구 선택:', result.status);
    
    // 상태 복구
    setSessionId(savedSessionId);
    setCurrentStatus(result.status);
    setAuthRequested(true);
    
    // 상태 메시지 가져오기
    try {
      const messageResponse = await fetch(TILKO_API.SESSION_MESSAGES(savedSessionId));
      if (messageResponse.ok) {
        const messageResult = await messageResponse.json();
        if (messageResult.success) {
          setStatusMessages(messageResult.messages || []);
        }
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error);
    }
    
    // 사용자 정보 복구
    const userInfo = result.user_info || sessionData.user_info;
    if (userInfo) {
      setAuthInput({
        name: userInfo.name,
        gender: userInfo.gender || 'M',
        phoneNo: userInfo.phone_no,
        birthday: userInfo.birthdate
      });
    }
    
    // 입력 필드 비활성화
    setTimeout(() => {
      const inputs = document.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
      inputs.forEach(input => {
        input.disabled = true;
      });
    }, 100);
    
    // 모달 닫기
    setShowSessionModal(false);
    setSavedSessionInfo(null);
  }, [savedSessionInfo]);

  // 새로 시작 선택
  const handleStartNew = useCallback(async () => {
    console.log('🔄 [세션복구] 새로 시작 선택');
    
    // 백엔드에서 세션 삭제
    if (savedSessionInfo && savedSessionInfo.sessionId) {
      try {
        const response = await fetch(TILKO_API.SESSION_DELETE(savedSessionInfo.sessionId), {
          method: HTTP_METHODS.DELETE
        });
        
        if (response.ok) {
          console.log('✅ [세션삭제] 백엔드 세션 삭제 성공');
        } else {
          console.warn('⚠️ [세션삭제] 백엔드 세션 삭제 실패, 로컬만 정리');
        }
      } catch (error) {
        console.error('❌ [세션삭제] 백엔드 세션 삭제 중 오류:', error);
      }
      
      // 로컬스토리지에서도 제거
      localStorage.removeItem('tilko_session_id');
      localStorage.removeItem(`tilko_session_${savedSessionInfo.sessionId}`);
    }
    
    // 초기 상태로 설정
    setSessionId('');
    setCurrentStatus('start');
    setAuthRequested(false);
    setStatusMessages([]);
    
    // 모달 닫기
    setShowSessionModal(false);
    setSavedSessionInfo(null);
  }, [savedSessionInfo]);

  // 상태에 따른 설명 메시지 생성
  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'auth_pending':
        return '카카오톡 인증 요청이 진행 중입니다';
      case 'authenticating':
        return '인증 확인 및 건강정보 수집이 진행 중입니다';
      case 'authenticated':
        return '인증이 완료되어 건강정보를 수집 중입니다';
      case 'fetching_health_data':
        return '건강검진 데이터를 가져오고 있습니다';
      case 'fetching_prescription_data':
        return '처방전 데이터를 가져오고 있습니다';
      case 'completed':
        return '모든 건강정보 동기화가 완료되었습니다';
      default:
        return '인증 과정이 진행 중입니다';
    }
  };

  // 현재 상태에 따른 메시지 표시
  const getCurrentStatusMessage = useCallback(() => {
    if (statusMessages.length > 0) {
      const latestMessage = statusMessages[statusMessages.length - 1];
      if (latestMessage && latestMessage.message) {
        const message = latestMessage.message;
        // undefined 문자열 제거 및 안전 처리
        const cleanMessage = typeof message === 'string' ? 
          message.replace(/undefined/g, '').replace(/null/g, '').trim() : '';
        if (cleanMessage) {
          return cleanMessage;
        }
      }
    }
    
    switch (currentStatus) {
      case 'start':
        return authRequested ? '인증을 시작합니다...' : '';
      case 'auth_requesting': {
        const getAuthMethodName = (authType: string) => {
          switch (authType) {
            case '0': return '카카오톡';
            case '4': return '통신사Pass';
            case '6': return '네이버';
            default: return '카카오톡';
          }
        };
        const getAuthMethodDescription = (authType: string) => {
          switch (authType) {
            case '0': return '카카오톡 앱에서 인증을 완료해주세요.';
            case '4': return 'SKT/KT/LG U+ 앱에서 인증을 완료해주세요.';
            case '6': return '네이버 앱에서 인증을 완료해주세요.';
            default: return '카카오톡 앱에서 인증을 완료해주세요.';
          }
        };
        const authMethodName = getAuthMethodName(selectedAuthType);
        const authMethodDescription = getAuthMethodDescription(selectedAuthType);
        return `**${authMethodName}** 인증을 시작합니다.\n${authMethodDescription}`;
      }
      case 'auth_pending':
        return '이제 카카오 인증을 확인해주세요.\n카카오톡에 인증 메시지를 확인하세요.';
      case 'auth_key_received':
        return '인증 요청이 전송되었습니다.\n카카오톡에서 인증을 완료해주세요.';
      case 'auth_waiting':
        return '카카오톡 인증 대기 중...\n카카오톡 앱에서 인증을 완료해주세요.';
      case 'auth_completed': {
        const getAuthMethodName = (authType: string) => {
          switch (authType) {
            case '0': return '카카오톡';
            case '4': return '통신사Pass';
            case '6': return '네이버';
            default: return '카카오톡';
          }
        };
        const authMethodName = getAuthMethodName(selectedAuthType);
        return `인증이 요청되었습니다.\n**${authMethodName}** 인증을 완료해주세요\n인증후 아래 **데이터 수집하기**를 눌러주시면\n**건강추이확인** 하실 수 있습니다.`;
      }
      case 'authenticating':
        return '인증을 확인하고 건강정보를 가져오고 있습니다...';
      case 'authenticated':
        return '인증이 완료되었습니다. 건강정보를 가져오는 중입니다...';
      case 'data_collecting':
        return '📊 건강검진 및 처방전 데이터를\n수집하고 있습니다...\n\n잠시만 기다려주세요.';
      case 'fetching_health_data':
        return '건강검진 데이터를 가져오고 있습니다...';
      case 'fetching_prescription_data':
        return '처방전 데이터를 가져오고 있습니다...';
      case 'completed':
        return '🎉 모든 건강정보 수집이 완료되었습니다!\n결과 페이지로 이동합니다...';
      case 'existing_data_found':
        return '📋 이미 연동된 건강정보가 있습니다.\n\n기존 데이터를 사용하시겠어요?\n아니면 새로 인증하시겠어요?';
      case 'timeout':
        return '⏰ 인증 시간이 초과되었습니다 (10초).\n다시 시도해주세요.\n\n3초 후 처음 페이지로 돌아갑니다.';
      default:
        return authRequested ? '카카오톡에서 인증을 진행해주세요.' : '';
    }
  }, [statusMessages, currentStatus, authRequested, selectedAuthType]);

  // 타이핑 효과 함수 (완전한 타이머 관리 포함)
  const typeMessage = useCallback((message: string, speed: number = 100, wordByWord: boolean = false, repeat: boolean = true) => {
    // 이미 타이핑 중이면 중단
    if (isTyping) {
      return;
    }
    
    // 기존 타이머 완전 정리
    if (messageTypingTimerRef.current) {
      clearInterval(messageTypingTimerRef.current);
      clearTimeout(messageTypingTimerRef.current);
      messageTypingTimerRef.current = null;
    }
    
    const startTyping = () => {
    setIsTyping(true);
    setTypingText('');
    
    if (wordByWord) {
      // 단어 단위 타이핑
      const words = message.split(' ');
      let wordIndex = 0;
        messageTypingTimerRef.current = setInterval(() => {
        if (wordIndex < words.length) {
          const currentText = words.slice(0, wordIndex + 1).join(' ');
          setTypingText(currentText);
          wordIndex++;
        } else {
            if (messageTypingTimerRef.current) {
              clearInterval(messageTypingTimerRef.current);
              messageTypingTimerRef.current = null;
            }
            
            // 타이핑 완료 후 대기
            messageTypingTimerRef.current = setTimeout(() => {
              if (repeat && (currentStatus === 'auth_pending' || currentStatus === 'auth_completed')) {
                // 반복 시작 전에 텍스트 초기화
                setTypingText('');
                messageTypingTimerRef.current = setTimeout(() => {
                  startTyping();
                }, 500);
              } else {
          setIsTyping(false);
              }
            }, 2000);
        }
      }, speed * 3); // 단어 단위는 더 느리게
    } else {
        // 글자 단위 타이핑 (수정된 로직)
        let index = 1;
        
        // 첫 글자부터 시작
        setTypingText(message.charAt(0));
        
        messageTypingTimerRef.current = setInterval(() => {
        if (index < message.length) {
          setTypingText(message.substring(0, index + 1));
          index++;
        } else {
            if (messageTypingTimerRef.current) {
              clearInterval(messageTypingTimerRef.current);
              messageTypingTimerRef.current = null;
            }
            
            // 타이핑 완료 후 대기
            messageTypingTimerRef.current = setTimeout(() => {
              if (repeat && (currentStatus === 'auth_pending' || currentStatus === 'auth_completed')) {
                // 반복 시작 전에 텍스트 초기화
                setTypingText('');
                messageTypingTimerRef.current = setTimeout(() => {
                  startTyping();
                }, 500);
              } else {
          setIsTyping(false);
              }
            }, 2000);
        }
      }, speed);
    }
    };

    startTyping();
  }, [isTyping, currentStatus]);

  // 상태 변경 시 타이핑 효과 적용
  useEffect(() => {
    // 세션 복구 중에는 타이핑 시작하지 않음
    if (authRequested && !isTyping && !isRecovering) {
      const message = getCurrentStatusMessage();
      console.log(`🔍 [타이핑디버그] currentStatus: ${currentStatus}, authRequested: ${authRequested}, isRecovering: ${isRecovering}, message: "${message}"`);
      if (message && message !== typingText) {
        // 메시지 길이와 상황에 따라 속도 조절
        let speed = TYPING_SPEED; // 기본 속도
        let wordByWord = false; // 기본은 글자 단위
        
        // 반복 여부 결정
        let shouldRepeat = false;
        
        if (message.length > 30) {
          speed = 60; // 긴 메시지는 더 빠르게
          wordByWord = true; // 긴 메시지는 단어 단위로
        } else if (currentStatus === 'auth_pending') {
          speed = 150; // 인증 대기 상태는 더 천천히
          shouldRepeat = true; // auth_pending 상태에서만 반복
        } else if (currentStatus === 'auth_completed') {
          speed = 100; // 인증 완료 메시지는 적당한 속도로
          wordByWord = false; // 글자 단위로 타이핑
          shouldRepeat = true; // auth_completed 상태에서도 반복
        } else if (currentStatus === 'completed') {
          speed = 200; // 완료 메시지는 매우 천천히
          wordByWord = true; // 완료 메시지는 단어 단위로
        }
        
        typeMessage(message, speed, wordByWord, shouldRepeat);
      }
    }
  }, [currentStatus, authRequested, isRecovering, getCurrentStatusMessage, selectedAuthType]); // 타이핑 관련 의존성 추가

  // 로딩 메시지 순환 효과
  useEffect(() => {
    let messageInterval: NodeJS.Timeout;
    
    if (loading && authRequested) {
      // 초기 메시지 설정
      setLoadingMessage(loadingMessages[0]);
      
      // 5초마다 메시지 변경
      let messageIndex = 0;
      messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
      }, 5000);
    }
    
    return () => {
      if (messageInterval) {
        clearInterval(messageInterval);
      }
    };
  }, [loading, authRequested, loadingMessages]);

  // loadLayoutConfig 함수 제거됨 - Context에서 레이아웃 정보 사용

  if (isRecovering) {
    return (
      <div className="auth__content" style={{ 
        transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
        animation: 'fadeIn 0.4s ease-in-out'
      }}>
        <div className="auth__content-input-area" style={{ 
          padding: '40px 20px', 
          textAlign: 'center',
          transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
          animation: 'slideInUp 0.4s ease-out'
        }}>
          <p>{isRecovering ? '이전 인증 진행 상황을 확인하고 있습니다...' : '로딩 중...'}</p>
          <div style={{ marginTop: '20px' }}>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  const hospitalName = layoutConfig?.headerLogoTitle || '병원';

  // 단계별 정보 확인 UI
  if (showConfirmation && !authRequested) {
    return (
      <>
        {/* 뒤로가기 버튼 */}
        <div className="back-button-container">
          <button className="back-button" onClick={() => {
            console.log('🔙 [인증페이지] 단계별 뒤로가기 버튼 클릭');
            handleStepBack();
          }}>
            ←
          </button>
        </div>
        
        <div className="auth__content" style={{ 
          position: 'relative', 
          minHeight: '100vh',
          transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
          animation: 'fadeIn 0.4s ease-in-out'
        }}>
          {/* 메인 타이틀 영역 */}
          <div className="auth__main-title" style={{ 
            marginTop: '80px', 
            marginBottom: '16px',
            paddingLeft: '24px',
            minHeight: '320px',
            transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
            animation: 'slideInUp 0.4s ease-out'
          }}>
            {/* 아이콘 */}
            <div style={{ 
              marginBottom: '8px', 
              marginLeft: '-16px'
            }}>
              <img 
                src={WELLO_LOGO_IMAGE} 
                alt="윌노 아이콘" 
                style={{ 
                  width: '64px', 
                  height: '64px', 
                  objectFit: 'contain' 
                }} 
              />
            </div>
            
            <div className="auth__main-title-text" style={{
              fontFamily: 'inherit',
              fontSize: '26px',
              lineHeight: '1.4',
              fontWeight: 'normal',
              color: '#535353',
              textAlign: 'left'
            }}>
              {/* 타이핑 효과가 있는 단계별 타이틀 */}
              <div style={{ 
                fontSize: '24px', // 크기 더 증가
                color: '#5d4037', // 진한 갈색
                fontWeight: '800', // 더 굵게
                marginLeft: '-16px', 
                marginBottom: '30px', 
                lineHeight: '1.4',
                height: '80px',
                minHeight: '80px',
                maxHeight: '80px',
                fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                overflow: 'hidden'
              }}>
                {titleTypingText.split('\n').map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
              
              {/* 입력창 영역 - 고정 높이 컨테이너 */}
              <div style={{
                height: '120px',
                minHeight: '120px',
                maxHeight: '120px',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
                animation: 'slideInUp 0.4s ease-out'
              }}>
                {/* 이름 확인 단계 */}
                {currentConfirmationStep === 'name' && (
                  <>
                    <div style={{ 
                      marginLeft: '-16px', 
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                    <input
                      type="text"
                      value={editableName}
                      onChange={(e) => setEditableName(e.target.value)}
                      style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        color: '#1d1e1f',
                        border: 'none',
                        borderBottom: '2px solid #f7e8d3',
                        background: 'transparent',
                        outline: 'none',
                        padding: '12px 12px 12px 0',
                        flex: '1',
                        maxWidth: '240px',
                        height: '56px',
                        boxSizing: 'border-box'
                      }}
                      placeholder="이름을 입력하세요"
                    />
                  </div>
                  
                    <div style={{ fontSize: '16px', color: '#666', marginLeft: '-16px', marginBottom: '20px', whiteSpace: 'pre-line' }}>
                      이름이 정확하신가요?{'\n'}틀린 경우 위에서 수정해주세요
                    </div>
                  </>
                )}

                {/* 전화번호 확인 단계 */}
                {currentConfirmationStep === 'phone' && (
                <>
                  <div style={{ 
                    marginLeft: '-16px', 
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <input
                      type="tel"
                      value={editablePhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        const formatted = value.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
                        setEditablePhone(formatted);
                      }}
                      style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        color: '#1d1e1f',
                        border: 'none',
                        borderBottom: '2px solid #f7e8d3',
                        background: 'transparent',
                        outline: 'none',
                        padding: '12px 12px 12px 0',
                        flex: '1',
                        maxWidth: '240px',
                        height: '56px',
                        boxSizing: 'border-box'
                      }}
                      placeholder="010-0000-0000"
                    />
                  </div>
                  
                  <div style={{ fontSize: '16px', color: '#666', marginLeft: '-16px', marginBottom: '20px', whiteSpace: 'pre-line' }}>
                    전화번호가 정확하신가요?{'\n'}틀린 경우 위에서 수정해주세요
                  </div>
                </>
                )}

                {/* 생년월일 확인 단계 */}
                {currentConfirmationStep === 'birthday' && (
                <>
                  <div style={{ 
                    marginLeft: '-16px', 
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '16px'
                  }}>
                    <div style={{ flex: '1', maxWidth: '240px' }}>
                      <input
                        type="text"
                        value={editableBirthday}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9]/g, '');
                          if (value.length <= 8) {
                            setEditableBirthday(value);
                          }
                        }}
                        style={{
                          fontSize: '28px',
                          fontWeight: 'bold',
                          color: '#1d1e1f',
                          border: 'none',
                          borderBottom: '2px solid #f7e8d3',
                          background: 'transparent',
                          outline: 'none',
                          padding: '12px 12px 12px 0',
                          width: '100%',
                          height: '56px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="19810927"
                        maxLength={8}
                      />
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#999', 
                        marginTop: '4px',
                        height: '20px',
                        lineHeight: '20px'
                      }}>
                        생년월일 8자리 (YYYYMMDD)
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '16px', color: '#666', marginLeft: '-16px', marginBottom: '20px', whiteSpace: 'pre-line' }}>
                    생년월일이 정확하신가요?{'\n'}틀린 경우 위에서 수정해주세요
                  </div>
                </>
                )}

                {/* 인증 방식 선택 단계 */}
                {currentConfirmationStep === 'auth_method' && (
                <>
                  <div style={{ 
                    marginLeft: '-16px', 
                    marginBottom: '30px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    {AUTH_TYPES.map((authType) => (
                      <div
                        key={authType.value}
                        onClick={() => {
                          console.log('🔘 [인증방법선택] 사용자가 선택:', {
                            value: authType.value,
                            label: authType.label,
                            previousValue: selectedAuthType
                          });
                          
                          // State 업데이트
                          setSelectedAuthType(authType.value);
                          
                          // 메모리에도 저장 (localStorage 실패 시 사용)
                          authTypeMemoryRef.current = authType.value;
                          
                          // localStorage에 저장 시도 (실패해도 메모리에 저장되어 있음)
                          const saved = StorageManager.setItem(STORAGE_KEYS.TILKO_SELECTED_AUTH_TYPE, authType.value);
                          if (saved) {
                            if (StorageManager.isMemoryMode()) {
                              console.log('💾 [인증방법선택] 메모리에 저장 (localStorage 사용 불가):', authType.value);
                            } else {
                              console.log('💾 [인증방법선택] localStorage에 저장:', authType.value);
                            }
                          } else {
                            console.warn('⚠️ [인증방법선택] 저장 실패 - 메모리만 사용:', authType.value);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '16px',
                          border: selectedAuthType === authType.value ? '2px solid #7c746a' : '2px solid #e5e5e5',
                          borderRadius: '12px',
                          backgroundColor: selectedAuthType === authType.value ? '#f9f7f4' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          gap: '12px'
                        }}
                      >
                        <div style={{ 
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <img 
                            src={authType.icon} 
                            alt={`${authType.label} 아이콘`}
                            style={{
                              width: '28px',
                              height: '28px',
                              objectFit: 'contain'
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: '#1d1e1f',
                            marginBottom: '4px'
                          }}>
                            {authType.label}
                          </div>
                          <div style={{
                            fontSize: '14px',
                            color: '#666',
                            lineHeight: '1.4'
                          }}>
                            {authType.description}
                          </div>
                        </div>
                        {selectedAuthType === authType.value && (
                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#7c746a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#ffffff'
                            }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* 선택 완료 버튼 제거 - 플로팅 버튼 사용 (안내 메시지도 제거) */}
                </>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // auth_pending 상태일 때 카카오 인증 대기 화면
  if (currentStatus === 'auth_pending' && authRequested) {
    return (
      <>
        <div className="auth__content" style={{ 
          position: 'relative', 
          minHeight: '100vh',
          transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
          animation: 'fadeIn 0.4s ease-in-out'
        }}>
          {/* 메인 타이틀 영역 */}
          <div className="auth__main-title" style={{ 
            marginTop: '80px', 
            marginBottom: '16px',
            paddingLeft: '24px',
            height: '400px',
            minHeight: '400px',
            maxHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
            animation: 'slideInUp 0.4s ease-out'
          }}>
            {/* 아이콘 */}
            <div style={{ 
              marginBottom: '8px', 
              marginLeft: '-16px'
            }}>
              <img 
                src={WELLO_LOGO_IMAGE} 
                alt="윌노 아이콘" 
                style={{ 
                  width: '64px', 
                  height: '64px', 
                  objectFit: 'contain' 
                }} 
              />
            </div>

            {/* 사용자 이름 */}
            <div style={{
              marginBottom: '50px'
            }}>
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#1d1e1f', marginLeft: '-16px' }}>
                {editableName || PatientDataConverter.getSafeName(patient) || '사용자'}
              </span>
              <span style={{ fontSize: '18px', color: '#535353', marginLeft: '4px' }}>님!</span>
            </div>
            
            {/* 타이포그래피 영역 - 카카오 인증 메시지 */}
            <div style={TYPING_STYLES.container}>
              <span dangerouslySetInnerHTML={{
                __html: typingText.replace(
                  /\*\*(.*?)\*\*/g,
                  '<span style="font-size: 19px; font-weight: bold;">$1</span>'
                )
              }} />
              {isTyping && (
                <span style={TYPING_STYLES.cursor}>|</span>
              )}
            </div>
            
            {/* 인증 대기 상태에서는 플로팅 버튼만 사용 */}
          </div>
        </div>

        {/* 애니메이션 스타일 */}
        <style>{`
          @keyframes typing-cursor {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
          @keyframes buttonReminderPulse {
            0% {
              transform: scale(1);
              box-shadow: 0 2px 8px rgba(254, 229, 0, 0.3);
            }
            25% {
              transform: scale(1.02);
              box-shadow: 0 4px 16px rgba(254, 229, 0, 0.5);
            }
            50% {
              transform: scale(1.04);
              box-shadow: 0 6px 20px rgba(254, 229, 0, 0.7);
            }
            75% {
              transform: scale(1.02);
              box-shadow: 0 4px 16px rgba(254, 229, 0, 0.5);
            }
            100% {
              transform: scale(1);
              box-shadow: 0 2px 8px rgba(254, 229, 0, 0.3);
            }
          }
          .button-reminder-pulse {
            animation: buttonReminderPulse 1s ease-in-out 3;
          }
        `}</style>
      </>
    );
  }

  // 데이터 수집 중 로딩 화면 (XOG 스타일)
  // 기존 데이터 발견 시 선택 UI
  if (currentStatus === 'existing_data_found') {
    return (
      <div className="auth__content">
        <div className="auth__content-input-area" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>
            기존 건강정보 발견
          </h3>
          
          <div style={{ 
            minHeight: '80px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '30px'
          }}>
            <p style={{ 
              fontSize: '16px', 
              lineHeight: '1.5', 
              color: '#666',
              textAlign: 'center',
              margin: 0
            }}>
              이미 연동된 건강정보가 있습니다.<br/>
              기존 데이터를 사용하시겠어요?
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => {
                console.log('📋 [기존데이터] 사용자가 기존 데이터 사용 선택');
                navigate('/wello/dashboard');
              }}
              style={{
                backgroundColor: '#7c746a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              기존 데이터 사용
            </button>
            
            <button
              onClick={() => {
                console.log('🔄 [기존데이터] 사용자가 새로 인증 선택');
                // 인증 로직 재시작
                setCurrentStatus('auth_requesting');
                setLoading(true);
                // 인증 프로세스 재시작
                window.location.reload();
              }}
              style={{
                backgroundColor: '#fff',
                color: '#7c746a',
                border: '2px solid #7c746a',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              새로 인증하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentStatus === 'manual_collecting' || currentStatus === 'data_collecting' || currentStatus === 'collecting') {
    return (
      <div className="auth__content" style={{ 
        position: 'relative', 
        minHeight: '100vh',
        backgroundColor: '#FEF9EE', // 베이지색 배경 (상단과 동일)
        transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
        animation: 'fadeIn 0.4s ease-in-out'
      }}>
        <div className="auth__content-input-area" style={{ 
          padding: '40px 20px', 
          textAlign: 'center',
          backgroundColor: '#FEF9EE', // 베이지색 배경 (상단과 동일)
          transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
          animation: 'slideInUp 0.4s ease-out'
        }}>
          {/* 주요 상태 메시지 */}
          <h3 style={{ marginBottom: '20px', color: '#333' }}>
            건강정보를 연동하고 있습니다
          </h3>
          
          {/* 순환 메시지 */}
          <div style={{ 
            minHeight: '60px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: '30px'
          }}>
            <p style={{ 
              fontSize: '16px', 
              lineHeight: '1.5', 
              color: '#666',
              textAlign: 'center',
              margin: 0
            }}>
              {loadingMessage}
            </p>
          </div>
          
          {/* 파비콘 블링크 스피너 */}
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
            <div className="favicon-blink-spinner">
              <img 
                src={WELLO_LOGO_IMAGE}
                alt="로딩 중" 
                className="wello-icon-blink"
                style={{
                  width: '48px',
                  height: '48px'
                }}
              />
            </div>
          </div>
          
          {/* 진행률 표시 - 더 구체적인 단계별 안내 */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
              {currentStatus === 'manual_collecting' ? '데이터 수집을 시작합니다...' :
               currentStatus === 'collecting' ? '국민건강보험공단과 연결 중...' :
               currentStatus === 'data_collecting' ? '건강정보를 수집하고 있습니다...' :
               currentStatus === 'fetching_health_data' ? '건강검진 데이터 수집 중...' :
               currentStatus === 'fetching_prescription_data' ? '처방전 데이터 수집 중...' :
               '데이터를 분석하고 있습니다...'}
            </p>
            
            {/* 예상 소요 시간 안내 */}
            <p style={{ fontSize: '12px', color: '#999' }}>
              예상 소요 시간: 30초 ~ 1분
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 완료 화면
  if (currentStatus === 'completed') {
    return (
      <div className="auth__content" style={{ 
        position: 'relative',
        minHeight: '100vh',
        backgroundColor: '#FEF9EE', // 베이지색 배경 (상단과 동일)
        transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
        animation: 'fadeIn 0.4s ease-in-out'
      }}>
        <div className="auth__content-input-area" style={{ 
          padding: '40px 20px', 
          textAlign: 'center',
          backgroundColor: '#FEF9EE', // 베이지색 배경 (상단과 동일)
          transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
          animation: 'slideInUp 0.4s ease-out'
        }}>
          <p>건강정보 동기화가 완료되었습니다!</p>
          <p>결과 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 세션 복구 모달 */}
      {showSessionModal && savedSessionInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            textAlign: 'center'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              이전 인증 진행상황이 있습니다
            </h3>
            
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#666' }}>
                현재 상태:
              </p>
              <p style={{ margin: '0', fontSize: '16px', fontWeight: '500', color: '#333' }}>
                {getStatusDescription(savedSessionInfo.status)}
              </p>
            </div>
            
            <p style={{
              margin: '0 0 25px 0',
              fontSize: '14px',
              color: '#666',
              lineHeight: '1.5'
            }}>
              이전 단계에서 계속 진행하시겠어요?<br/>
              아니면 처음부터 새로 시작하시겠어요?
            </p>
            
            <div style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleResumeSession}
                style={{
                  flex: 1,
                  backgroundColor: '#fee500',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fdd835';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#fee500';
                }}
              >
                이어서 진행
              </button>
              
              <button
                onClick={handleStartNew}
                style={{
                  flex: 1,
                  backgroundColor: 'white',
                  color: '#333',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                새로 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 뒤로가기 버튼 */}
      <div className="back-button-container">
        <button className="back-button" onClick={() => {
          console.log('🔙 [인증페이지] 뒤로가기 버튼 클릭');
          // 모든 폴링 및 모니터링 중단
          cleanupAllPolling();
          onBack && onBack();
        }}>
          ←
        </button>
      </div>
      
      <div className="auth__content" style={{ position: 'relative', minHeight: '100vh' }}>
        {/* 메인 타이틀 영역 */}
        <div className="auth__main-title" style={{ 
          marginTop: '80px', 
          marginBottom: '16px',
          paddingLeft: '24px',
          height: '400px',
          minHeight: '400px',
          maxHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start'
        }}>
          {/* 아이콘 - 타이핑 중일 때 위치 조정 */}
          <div style={{ 
            marginBottom: '8px', 
            marginLeft: '-16px',
            transform: isTyping ? 'translateY(10px)' : 'translateY(0)',
            transition: 'transform 0.3s ease'
          }}>
            <img 
              src={WELLO_LOGO_IMAGE} 
              alt="웰로 아이콘" 
              style={{ 
                width: '64px', 
                height: '64px', 
                objectFit: 'contain' 
              }} 
            />
          </div>
          
          <div className="auth__main-title-text" style={{
            fontFamily: 'inherit',
            fontSize: '26px',
            lineHeight: '1.4',
            fontWeight: 'normal',
            color: '#535353',
            textAlign: 'left',
            animation: (authRequested && currentStatus !== 'auth_completed') ? 'authPulse 2s ease-in-out infinite' : 'none'
          }}>
            <div style={{ marginBottom: '50px' }}>
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#1d1e1f', marginLeft: '-16px' }}>
                {editableName || PatientDataConverter.getSafeName(patient) || authInput.name || '사용자'}
              </span>
              <span style={{ fontSize: '18px', color: '#535353', marginLeft: '4px' }}>{authRequested ? '님!' : '님'}</span>
            </div>
            {!authRequested && (
              <div style={{ fontSize: '18px', color: '#8B7355', marginLeft: '-16px', marginBottom: '12px', lineHeight: '1.4', minHeight: '50px' }}>
                <span style={{ 
                  fontFamily: 'inherit',
                  whiteSpace: 'pre-line',
                  display: 'inline-block'
                }}>
                  <span dangerouslySetInnerHTML={{
                    __html: descTypingText.replace(
                      '의료보험공단',
                      '<span style="font-size: 19px; font-weight: bold;">의료보험공단</span>'
                    )
                  }} />
                  {isDescTyping && (
                    <span style={TYPING_STYLES.cursor}>|</span>
                  )}
                </span>
              </div>
            )}
            {authRequested && (
              <>
                  <span style={TYPING_STYLES.container}>
{(() => {
                    const displayText = isTyping ? typingText : getCurrentStatusMessage();
                    const safeText = typeof displayText === 'string' ? 
                      displayText.replace(/undefined/g, '').replace(/null/g, '').trim() : '';
                    
                    return (
                      <>
                        <span dangerouslySetInnerHTML={{
                          __html: safeText.replace(
                            /\*\*(.*?)\*\*/g,
                            '<span style="font-size: 19px; font-weight: bold;">$1</span>'
                          )
                        }} />
                        {!isTyping && currentStatus !== 'auth_completed' && (
                          <span style={TYPING_STYLES.cursor}>|</span>
                        )}
                      </>
                    );
                  })()}
                  </span>
                <br />
                {(currentStatus === 'auth_requesting' || currentStatus === 'auth_key_received' || currentStatus === 'auth_waiting' || currentStatus === 'auto_polling') && (
                  <span style={{ 
                    display: 'inline-block',
                    marginLeft: '4px',
                    animation: 'blink 1s infinite',
                    fontSize: '20px',
                    color: '#fee500'
                  }}>●</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* 수동 인증 완료 버튼 제거 - 플로팅 버튼 사용 */}
        {currentStatus === 'auth_waiting' && (
          <div style={{
            marginTop: '20px',
            textAlign: 'center',
            padding: '16px',
            backgroundColor: 'rgba(254, 229, 0, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(254, 229, 0, 0.3)'
          }}>
            <div style={{
              fontSize: '14px',
              color: '#8B7355',
              marginBottom: '8px'
            }}>
              💡 인증 완료 후 하단의 <strong>"데이터 수집하기"</strong> 버튼을 눌러주세요
            </div>
          </div>
        )}

        {/* 애니메이션 스타일 */}
        {authRequested && (
          <style>{`
            @keyframes authPulse {
              0%, 100% {
                opacity: 0.6;
              }
              50% {
                opacity: 1;
              }
            }
            @keyframes blink {
              0%, 50% {
                opacity: 1;
              }
              51%, 100% {
                opacity: 0;
              }
            }
            @keyframes buttonReminderPulse {
              0% {
                transform: scale(1);
                box-shadow: 0 2px 8px rgba(254, 229, 0, 0.3);
              }
              25% {
                transform: scale(1.02);
                box-shadow: 0 4px 16px rgba(254, 229, 0, 0.5);
              }
              50% {
                transform: scale(1.04);
                box-shadow: 0 6px 20px rgba(254, 229, 0, 0.7);
              }
              75% {
                transform: scale(1.02);
                box-shadow: 0 4px 16px rgba(254, 229, 0, 0.5);
              }
              100% {
                transform: scale(1);
                box-shadow: 0 2px 8px rgba(254, 229, 0, 0.3);
              }
            }
            .button-reminder-pulse {
              animation: buttonReminderPulse 1s ease-in-out 3;
            }
          `}</style>
        )}

        {/* 개선된 에러 메시지 */}
        {error && (
          <div style={{ 
            color: errorType === 'validation' ? '#d97706' : '#e74c3c',
            marginBottom: '20px', 
            padding: '12px', 
            background: errorType === 'validation' ? '#fef3cd' : '#fdf2f2',
            borderRadius: '8px',
            border: `1px solid ${errorType === 'validation' ? '#d97706' : '#e74c3c'}`,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ marginRight: '8px' }}>
              {errorType === 'validation' ? '⚠️' : 
               errorType === 'network' ? '🌐' : 
               errorType === 'auth' ? '🔐' : '❌'}
            </span>
            {error}
            {errorType === 'validation' && (
              <button 
                onClick={clearError}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#d97706',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}

          {/* 인증 정보 표시 (초기 상태에서만) */}
          <div className="auth__content-input-area">
            {/* 카카오페이 인증 버튼 - 플로팅 버튼으로 이동됨 */}
            <div
              data-testid="kakao-auth-button"
              style={{ display: 'none' }}
              onClick={handleKakaoAuth}
            />
          </div>

        {/* 서브 안내 텍스트 영역 - 고정 위치 */}
        <div className="auth__sub-info" style={{
          position: 'absolute',
          bottom: '120px',
          left: '16px',
          right: '16px'
        }}>
          <div className="auth__sub-info-title" style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#666',
            marginBottom: '16px',
            textAlign: 'left'
          }}>
            * 건강정보 연동 후에도 내역이 보이지 않는 경우
          </div>
          
          <div className="auth__sub-info-content" style={{
            fontSize: '10px',
            color: '#888',
            lineHeight: '1.7',
            textAlign: 'left'
          }}>
            <div style={{ marginBottom: '10px', paddingLeft: '4px' }}>
              - 건강검진내역은 검진기관에서 청구가 완료되어야 제공이 가능하며, 청구완료까지 통상 30일이 소요되요.
            </div>
            <div style={{ paddingLeft: '4px' }}>
              - 병원/약국 이용 이력은 병·의원약국에서 청구한 진료비/약제비 정보를 바탕으로 제공되므로 청구 되지 않은 최근의 진료내역은 조회되지 않을 수 있어요.
            </div>
          </div>
        </div>
      </div>

      {/* 에러 모달 */}
      {showErrorModal && errorModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            position: 'relative'
          }}>
            {/* 모달 헤더 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f0f0f0'
            }}>
              <span style={{ fontSize: '20px', marginRight: '8px' }}>⚠️</span>
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                {errorModalData.title}
              </h3>
            </div>

            {/* 모달 내용 */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{
                margin: 0,
                fontSize: '16px',
                lineHeight: '1.5',
                color: '#555',
                marginBottom: errorModalData.technicalDetail ? '12px' : '0'
              }}>
                {errorModalData.message}
              </p>
              
              {errorModalData.technicalDetail && (
                <details style={{ marginTop: '12px' }}>
                  <summary style={{
                    fontSize: '14px',
                    color: '#888',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}>
                    기술적 상세 정보
                  </summary>
                  <p style={{
                    fontSize: '12px',
                    color: '#666',
                    backgroundColor: '#f8f9fa',
                    padding: '8px',
                    borderRadius: '4px',
                    marginTop: '8px',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all'
                  }}>
                    {errorModalData.technicalDetail}
                  </p>
                </details>
              )}
            </div>

            {/* 모달 버튼 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={clearError}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                닫기
              </button>
              {errorModalData.retryAvailable && (
                <button
                  onClick={() => {
                    clearError();
                    // 재시도 로직 (필요시 추가)
                    window.location.reload();
                  }}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  다시 시도
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 설정 모달 */}
      {showPasswordSetupModal && passwordSetupData && (
        <PasswordModal
          isOpen={showPasswordSetupModal}
          onClose={handlePasswordSetupCancel}
          onSuccess={handlePasswordSetupSuccess}
          onCancel={handlePasswordSetupCancel}
          type="setup"
          uuid={passwordSetupData.uuid}
          hospitalId={passwordSetupData.hospital}
          initialMessage="안전한 이용을 위해 비밀번호를 설정해주세요"
        />
      )}

      {/* 약관동의 모달 */}
      <TermsAgreementModal
        isOpen={showTermsModal}
        onClose={() => {
          // 약관 동의 여부와 관계없이 모달 닫기 (배경 화면으로 돌아감)
          setShowTermsModal(false);
        }}
        onConfirm={(agreedTerms, termsAgreement) => {
          // 약관동의 완료 처리 (서버 저장은 handleTermsAgreed에서 처리)
          handleTermsAgreed(agreedTerms, termsAgreement);
        }}
      />

      {/* 수집 완료 모달 */}
      <WelloModal
        isOpen={showCollectionCompleteModal}
        onClose={() => {
          setShowCollectionCompleteModal(false);
          // 결과 페이지로 이동
          const urlParams = new URLSearchParams(window.location.search);
          const uuid = urlParams.get('uuid');
          const hospital = urlParams.get('hospital');
          if (uuid && hospital) {
            navigate(`/results-trend?uuid=${uuid}&hospital=${hospital}`);
          } else {
            navigate('/results-trend');
          }
        }}
        showCloseButton={false}
        showWelloIcon={false}
        size="medium"
        className="wello-modal--white"
      >
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h2 style={{ 
            fontSize: '18px', 
            fontWeight: 600, 
            color: '#2d3748', 
            margin: '0 0 12px 0',
            fontFamily: 'inherit'
          }}>
            수집이 완료되었습니다
          </h2>
          <p style={{ 
            fontSize: '14px', 
            color: '#718096', 
            margin: '0 0 24px 0',
            lineHeight: '1.5',
            fontFamily: 'inherit'
          }}>
            추이보기로 이동합니다
          </p>
          <button
            onClick={() => {
              setShowCollectionCompleteModal(false);
              const urlParams = new URLSearchParams(window.location.search);
              const uuid = urlParams.get('uuid');
              const hospital = urlParams.get('hospital');
              if (uuid && hospital) {
                navigate(`/results-trend?uuid=${uuid}&hospital=${hospital}`);
              } else {
                navigate('/results-trend');
              }
            }}
            style={{
              width: '100%',
              padding: '12px 24px',
              backgroundColor: '#7c746a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.3s ease'
            }}
          >
            확인
          </button>
        </div>
      </WelloModal>
    </>
  );
};

export default AuthForm;
