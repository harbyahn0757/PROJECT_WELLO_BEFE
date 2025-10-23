import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWelloData } from '../contexts/WelloDataContext';
import { PatientDataConverter, PatientDataValidator, GenderConverter } from '../types/patient';
import { TILKO_API, HTTP_METHODS, API_HEADERS } from '../constants/api';
import { NavigationHelper, STANDARD_NAVIGATION } from '../constants/navigation';
import { STORAGE_KEYS, StorageManager, TilkoSessionStorage } from '../constants/storage';
import { useWebSocketAuth } from '../hooks/useWebSocketAuth';
import splashIcon from '../assets/splash.png';

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
  const { state } = useWelloData();
  const { patient, layoutConfig } = state;
  
  // 인증 방식 선택 (기본값: 카카오톡)
  const [selectedAuthType, setSelectedAuthType] = useState('0'); // 0: 카카오톡
  
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
  
  // 로딩 중 순환 메시지
  const loadingMessages = [
    '국민건강보험공단으로부터 최근 10년간 건강검진 정보와 병원/약국 이용 이력을 연동해요.',
    '상황에 따라 최대 1분 정도 소요 될 수 있어요. 잠시만 기다려주세요.',
    '수집된 건강정보를 기반으로 올 해 받으실 검진에 대해서 설계해드려요',
    '소중한 건강정보를 안전하게 처리하고 있어요.',
    '건강정보 기반으로 맞춤형 추천 콘텐츠를 받으실 수 있어요.',
    '기다려 주셔서 감사해요. 얼마남지 않았어요.',
    '철저한 보안으로 소중한 건강정보를 지켜드릴게요.'
  ];
  
  // 상태 폴링 관련
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // 상태 폴링 정리
  const cleanupPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  }, [pollingInterval]);

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
      
      // 기존 폴링 정리
      if (tokenTimeout) {
        clearTimeout(tokenTimeout);
        setTokenTimeout(null);
      }
    },
    onDataCollectionProgress: (progressType, message) => {
      console.log('📈 [WebSocket] 데이터 수집 진행:', progressType, message);
      setCurrentStatus('data_collecting');
      setLoading(true); // 로딩 스피너 표시
      setTypingText(message);
      
      // 플로팅 버튼 숨기기 위한 플래그 설정
      StorageManager.setItem('tilko_manual_collect', 'true');
      window.dispatchEvent(new Event('localStorageChange'));
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
  
  // 설명 텍스트 타이핑 효과
  const [descTypingText, setDescTypingText] = useState<string>('');
  const [isDescTyping, setIsDescTyping] = useState<boolean>(false);
  
  // 토큰 발급 상태 추적
  const [tokenReceived, setTokenReceived] = useState<boolean>(false);
  const [tokenRetryCount, setTokenRetryCount] = useState<number>(0);
  const [tokenTimeout, setTokenTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // 타이핑 효과 타이머 관리
  const titleTypingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const descTypingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageTypingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 컴포넌트 마운트 시 플로팅 버튼 관련 플래그 초기화
  useEffect(() => {
    const componentId = Math.random().toString(36).substr(2, 9);
    console.log(`🔄 [인증페이지-${componentId}] AuthForm 마운트 - 플로팅 버튼 플래그 초기화`);
    console.log(`🔄 [인증페이지-${componentId}] AuthForm 완전 마운트됨 - 모든 useEffect 활성화`);
    
    // 이전 세션의 신호들 정리 (세션 복구 후에 실행)
    // 세션 복구가 필요할 수 있으므로 즉시 정리하지 않음
    console.log(`🔄 [인증페이지-${componentId}] 세션 복구 체크 후 신호 정리 예정`);
    // tilko_auth_completed와 tilko_session_id는 유지 (세션 복구용)
    
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
    
        // localStorage 이벤트 리스너를 사용한 신호 감지
        const handleStartSignal = () => {
          const startSignal = StorageManager.getItem(STORAGE_KEYS.START_INFO_CONFIRMATION);
          const manualCollectSignal = StorageManager.getItem('tilko_manual_collect');
          const authMethodCompleteSignal = StorageManager.getItem('tilko_auth_method_complete');
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
            console.log(`✅ [신호감지-${componentId}] 수동 데이터 수집 시작`);
            StorageManager.removeItem('tilko_manual_collect'); // 신호 제거
            StorageManager.removeItem('tilko_auth_waiting'); // 인증 대기 상태 제거
            window.dispatchEvent(new Event('localStorageChange')); // 플로팅 버튼 업데이트
            
            // 수동 데이터 수집 실행
            handleManualDataCollection();
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
              console.log('📝 [타이틀타이핑] 시작:', `${safeName}님 존함이 맞나요?`);
              typeTitleMessage(`${safeName}님\n존함이 맞나요?`, 120, true);
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
  }, [currentConfirmationStep, showConfirmation]);

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
        console.log('📝 [타이틀타이핑] 업데이트된 이름으로 재시작:', `${name}님 존함이 맞나요?`);
        // 기존 타이핑 중지하고 새로운 이름으로 시작
        setIsTitleTyping(false);
        setTimeout(() => {
          typeTitleMessage(`${name}님\n존함이 맞나요?`, 120, true);
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
    // 유효성 검사
    if (!PatientDataValidator.isValidPatient(patient) || !PatientDataValidator.hasRequiredFields(patient)) {
      return;
    }
    
    // 안전한 데이터 변환
    const authData = PatientDataConverter.toAuthData(patient);
    setAuthInput(authData);
    
    // 편집 가능한 필드들 설정
    setEditableName(PatientDataConverter.getSafeName(patient));
    setEditablePhone(patient.phone); // 포맷 유지
    setEditableBirthday(PatientDataConverter.getSafeBirthday(patient));
  }, [patient]);

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
      cleanMessage = '사용자님\n존함이 맞나요?';
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
            typeTitleMessage(`${name}님\n존함이 맞나요?`, 120, true);
          } else if (step === 'phone') {
            const phone = (editablePhone && PatientDataConverter.cleanUndefined(editablePhone).trim()) || 
                         PatientDataConverter.getSafePhone(patient);
            typeTitleMessage(`전화번호가\n${phone} 맞나요?`, 120, true);
          } else if (step === 'birthday') {
            const birthday = (editableBirthday && PatientDataConverter.cleanUndefined(editableBirthday).trim()) || 
                            PatientDataConverter.getSafeBirthday(patient);
            typeTitleMessage(`주민번호가\n${birthday}** 맞나요?`, 120, true);
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

  const handleManualDataCollection = useCallback(async () => {
      console.log('🔘 [수동수집] 사용자가 인증 완료 버튼 클릭');
      
      // sessionId 유효성 검사 (localStorage에서 직접 가져오기)
      const currentSessionId = sessionId || StorageManager.getItem(STORAGE_KEYS.TILKO_SESSION_ID);
      if (!currentSessionId) {
        console.error('❌ [수동수집] sessionId가 없습니다. state:', sessionId, 'localStorage:', StorageManager.getItem(STORAGE_KEYS.TILKO_SESSION_ID));
        setCurrentStatus('error');
        setTypingText('세션 정보가 없습니다.\n다시 시도해주세요.');
        return;
      }
      
      console.log('🔍 [수동수집] sessionId 확인 - state:', sessionId, 'localStorage:', StorageManager.getItem(STORAGE_KEYS.TILKO_SESSION_ID), 'using:', currentSessionId);
      setCurrentStatus('manual_collecting');
      setTypingText('데이터를 수집하고 있습니다...\n잠시만 기다려주세요.');
      
      // 플로팅 버튼 숨기기 위한 플래그 설정
      StorageManager.setItem('tilko_manual_collect', 'true');
      window.dispatchEvent(new Event('localStorageChange'));
      
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
          window.dispatchEvent(new Event('localStorageChange'));
          
          setCurrentStatus('collecting');
          setTypingText('데이터 수집이 시작되었습니다.\n완료까지 잠시만 기다려주세요.');
          
          // 플로팅 버튼 숨기기 위한 플래그 설정
          StorageManager.setItem('tilko_manual_collect', 'true');
          window.dispatchEvent(new Event('localStorageChange'));
          
          // 수집 완료 확인을 위한 폴링 시작 (WebSocket 대체)
          let pollCount = 0;
          const maxPolls = 30; // 최대 30회 (약 30초)
          
          const pollCollectionStatus = async () => {
            try {
              pollCount++;
              console.log(`🔄 [수집상태확인] 폴링 ${pollCount}/${maxPolls}`);
              
              const statusResponse = await fetch(TILKO_API.SESSION_STATUS(currentSessionId));
              if (statusResponse.ok) {
                const statusResult = await statusResponse.json();
                console.log('📊 [수집상태확인] 상태:', statusResult);
                
                // 에러 메시지 확인 및 모달 표시
                if (statusResult.messages && Array.isArray(statusResult.messages)) {
                  const errorMessages = statusResult.messages.filter((msg: any) => 
                    typeof msg === 'object' && msg.type && msg.type.includes('error')
                  );
                  
                  if (errorMessages.length > 0) {
                    const latestError = errorMessages[errorMessages.length - 1];
                    console.log('🚨 [에러감지] 구조화된 에러 메시지:', latestError);
                    
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
                
                // 수집 완료 확인
                if (statusResult.progress?.completed || statusResult.status === 'completed' || 
                    statusResult.health_data || statusResult.prescription_data) {
                  console.log('🎉 [수집완료] 데이터 수집 완료! 결과 페이지로 이동');
                  
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
                  
                  setCurrentStatus('completed');
                  setTypingText('데이터 수집이 완료되었습니다!\n결과 페이지로 이동합니다...');
                  
                  // 데이터 저장 확인 후 즉시 이동 (지연 제거)
                  console.log('🚀 [수집완료] 결과 페이지로 즉시 이동');
                  
                  // URL 파라미터 포함해서 이동
                  const urlParams = new URLSearchParams(window.location.search);
                  const uuid = urlParams.get('uuid');
                  const hospital = urlParams.get('hospital');
                  
                  if (uuid && hospital) {
                    navigate(`/results-trend?uuid=${uuid}&hospital=${hospital}`);
                    console.log('📍 [수집완료] URL 파라미터와 함께 이동:', { uuid, hospital });
                  } else {
                    navigate('/results-trend');
                    console.log('⚠️ [수집완료] URL 파라미터 없이 이동');
                  }
                  
                  return; // 폴링 종료
                }
                
                // 아직 진행 중인 경우 계속 폴링
                if (pollCount < maxPolls) {
                  setTimeout(pollCollectionStatus, 1000); // 1초 후 재시도
                } else {
                  console.warn('⚠️ [수집상태확인] 최대 폴링 횟수 초과');
                  setCurrentStatus('error');
                  setTypingText('데이터 수집 확인 시간이 초과되었습니다.\n다시 시도해주세요.');
                }
              } else {
                console.error('❌ [수집상태확인] 상태 확인 실패:', statusResponse.status);
                if (pollCount < maxPolls) {
                  setTimeout(pollCollectionStatus, 1000); // 1초 후 재시도
                }
              }
            } catch (error) {
              console.error('❌ [수집상태확인] 오류:', error);
              if (pollCount < maxPolls) {
                setTimeout(pollCollectionStatus, 1000); // 1초 후 재시도
              }
            }
          };
          
          // 2초 후 첫 번째 상태 확인 시작
          setTimeout(pollCollectionStatus, 2000);
        } else {
          console.error('❌ [수동수집] 데이터 수집 실패:', response.status);
          setCurrentStatus('error');
          setTypingText('데이터 수집에 실패했습니다.\n다시 시도해주세요.');
        }
      } catch (error) {
        console.error('❌ [수동수집] 오류:', error);
        setCurrentStatus('error');
        setTypingText('오류가 발생했습니다.\n다시 시도해주세요.');
      }
  }, [sessionId]);

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
            setTypingText('건강검진 데이터를 수집하고 있습니다...\n잠시만 기다려주세요.');
            
            // 플로팅 버튼 숨기기 위한 플래그 설정
            StorageManager.setItem('tilko_manual_collect', 'true');
            window.dispatchEvent(new Event('localStorageChange'));
          } else if (result.status === 'fetching_prescription_data') {
            console.log('💊 [데이터수집] 처방전 데이터 수집 중...');
            setCurrentStatus('data_collecting');
            setTypingText('처방전 데이터를 수집하고 있습니다...\n잠시만 기다려주세요.');
            
            // 플로팅 버튼 숨기기 위한 플래그 설정
            StorageManager.setItem('tilko_manual_collect', 'true');
            window.dispatchEvent(new Event('localStorageChange'));
          } else if (result.status === 'completed') {
            console.log('✅ [데이터수집] 모든 데이터 수집 완료!');
            setCurrentStatus('data_completed');
            setTypingText('건강검진 및 처방전 데이터 수집이\n완료되었습니다!');
            
            // 데이터 수집 완료 - 플로팅 버튼 플래그 제거
            StorageManager.removeItem('tilko_manual_collect');
            window.dispatchEvent(new Event('localStorageChange'));
            
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
    
    // 5분 후 타임아웃 (재시도 없이 안내 메시지만)
    const timeoutId = setTimeout(() => {
      clearInterval(interval);
      
      if (!tokenReceived) {
        console.log('⏰ [인증대기] 5분 경과 - 사용자 안내');
        setCurrentStatus('auth_timeout');
        setTypingText('카카오톡 인증이 완료되지 않았습니다.\n카카오톡에서 인증을 완료해주세요.\n\n인증 후 이 페이지가 자동으로 업데이트됩니다.');
      }
    }, 300000); // 5분
    
    setTokenTimeout(timeoutId);
    
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

  // 모든 정보 확인 완료 후 인증 시작 (중복 방지)
  const handleAllConfirmed = useCallback(async () => {
    // 🚨 중복 방지: 이미 인증이 진행 중인지 확인
    if (currentStatus === 'auth_requesting' || currentStatus === 'auth_pending' || authRequested) {
      console.log('⚠️ [중복방지] 이미 인증이 진행 중입니다. 상태:', currentStatus);
      return;
    }

    // 수정된 정보로 authInput 업데이트
    const updatedAuthInput = {
      ...authInput,
      name: editableName,
      phoneNo: editablePhone.replace(/-/g, ''),
      birthday: editableBirthday
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
      name: editableName,
      phone: editablePhone,
      birthday: editableBirthday
    });

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
      
      // 1단계: 세션 시작
      const sessionResponse = await fetch(TILKO_API.SESSION_START(), {
        method: HTTP_METHODS.POST,
        headers: API_HEADERS.JSON,
        body: JSON.stringify({
          private_auth_type: selectedAuthType,
          user_name: editableName, // 수정된 이름 사용
          birthdate: editableBirthday, // 수정된 생년월일 사용
          phone_no: editablePhone.replace(/-/g, ''), // 수정된 전화번호 사용
          gender: updatedAuthInput.gender,
          patient_uuid: patient?.uuid, // 환자 UUID 추가
          hospital_id: patient?.hospital_id // 병원 ID 추가
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

        if (!authResponse.ok) {
          throw new Error('인증 요청 실패');
        }

        const authResult = await authResponse.json();
        
        if (authResult.success) {
          setCurrentStatus('auth_pending');
          setTokenReceived(false); // 토큰 상태 초기화
          console.log('🔄 [인증요청] 카카오톡 인증 대기 중');
          
          // WebSocket 연결 실패 대비 폴링 시작 (3초 후)
          console.log('📡 [WebSocket전용] 백엔드 스트리밍 시작, WebSocket 실패 시 폴링으로 대체');
          setTimeout(() => {
            console.log('🔄 [폴링시작] WebSocket 연결 실패 대비, 폴링으로 상태 확인');
            startTokenMonitoring(newSessionId);
          }, 3000);
        } else {
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
        typeTitleMessage(`전화번호가\n${phone} 맞나요?`, 120, true);
      }, 100);
    } else if (currentConfirmationStep === 'auth_method') {
      setCurrentConfirmationStep('birthday');
      setTimeout(() => {
        const birthday = (editableBirthday && PatientDataConverter.cleanUndefined(editableBirthday).trim()) || 
                        PatientDataConverter.getSafeBirthday(patient);
        typeTitleMessage(`주민번호가\n${birthday}** 맞나요?`, 120, true);
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
    console.log('🔄 [handleNextStep] 현재 단계:', currentConfirmationStep);
    
    if (currentConfirmationStep === 'name') {
      setCurrentConfirmationStep('phone');
      // 히스토리에 새 상태 추가
      NavigationHelper.pushState(
        { step: 'phone', confirmationData: { name: editableName } }
      );
      setTimeout(() => {
        const phone = (editablePhone && PatientDataConverter.cleanUndefined(editablePhone).trim()) || 
                     PatientDataConverter.getSafePhone(patient);
        typeTitleMessage(`전화번호가\n${phone} 맞나요?`, 120, true);
      }, 300);
    } else if (currentConfirmationStep === 'phone') {
      setCurrentConfirmationStep('birthday');
      // 히스토리에 새 상태 추가
      NavigationHelper.pushState(
        { step: 'birthday', confirmationData: { name: editableName, phone: editablePhone } }
      );
      setTimeout(() => {
        const birthday = (editableBirthday && PatientDataConverter.cleanUndefined(editableBirthday).trim()) || 
                        PatientDataConverter.getSafeBirthday(patient);
        typeTitleMessage(`주민번호가\n${birthday}** 맞나요?`, 120, true);
      }, 300);
    } else if (currentConfirmationStep === 'birthday') {
      setCurrentConfirmationStep('auth_method');
      // 히스토리에 새 상태 추가
      NavigationHelper.pushState(
        { step: 'auth_method', confirmationData: { name: editableName, phone: editablePhone, birthday: editableBirthday } }
      );
      
      // 플로팅 버튼을 위한 상태 설정 (인증 방식 선택)
      StorageManager.setItem('tilko_auth_method_selection', 'true');
      StorageManager.removeItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING);
      window.dispatchEvent(new Event('localStorageChange'));
      
      setTimeout(() => {
        typeTitleMessage(`인증 방식을\n선택해주세요`, 120, true);
      }, 300);
    } else if (currentConfirmationStep === 'auth_method') {
      setCurrentConfirmationStep('completed');
      
      // 인증 방식 선택 완료 - 플로팅 버튼 상태 제거
      StorageManager.removeItem('tilko_auth_method_selection');
      window.dispatchEvent(new Event('localStorageChange'));
      
      handleAllConfirmed();
    }
  }, [currentConfirmationStep, handleAllConfirmed, typeTitleMessage, editableName, editablePhone]);

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

          if (!authResponse.ok) {
            throw new Error('인증 요청 실패');
          }

          const authResult = await authResponse.json();
          
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
          
          if (result.status === 'authenticated') {
            console.log('✅ [인증완료] 실제 인증 완료 확인됨 - 데이터 수집 시작');
            
            // 데이터 수집 시작
            const collectResponse = await fetch(TILKO_API.COLLECT_HEALTH_DATA(sessionId), {
              method: HTTP_METHODS.POST,
              headers: API_HEADERS.JSON
            });

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
        clearInterval(pollInterval);
        if (pollCount >= maxPolls) {
          handleError('인증 대기 시간이 초과되었습니다. 다시 시도해주세요.', 'auth');
        }
      setLoading(false);
    }
    }, 3000);
    
    // 첫 번째 즉시 확인
    const shouldStop = await checkAuthStatus();
    if (shouldStop) {
      clearInterval(pollInterval);
      setLoading(false);
    }
  }, [sessionId, tokenReceived, isTyping]);

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
      case 'auth_requesting':
        return '카카오 간편인증을 요청하고 있습니다...';
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
        return '📋 이미 연동된 건강정보가 있습니다.\n\n기존 데이터를 사용하시겠습니까?\n아니면 새로 인증하시겠습니까?';
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
      <div className="auth__content">
        <div className="auth__content-input-area" style={{ padding: '40px 20px', textAlign: 'center' }}>
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
        
        <div className="auth__content" style={{ position: 'relative', minHeight: '100vh' }}>
          {/* 메인 타이틀 영역 */}
          <div className="auth__main-title" style={{ 
            marginTop: '80px', 
            marginBottom: '16px',
            paddingLeft: '24px',
            minHeight: '320px'
          }}>
            {/* 아이콘 */}
            <div style={{ 
              marginBottom: '8px', 
              marginLeft: '-16px'
            }}>
              <img 
                src={splashIcon} 
                alt="아이콘" 
                style={{ 
                  width: '32px', 
                  height: '32px', 
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
                fontFamily: 'Pretendard, sans-serif',
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
                justifyContent: 'flex-start'
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
                    <button
                      onClick={handleNextStep}
                      disabled={!editableName.trim()}
                      style={{
                        backgroundColor: editableName.trim() ? '#7c746a' : '#ccc', // 브랜드 브라운
                        color: editableName.trim() ? '#fff' : '#999',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 20px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: editableName.trim() ? 'pointer' : 'not-allowed',
                        transition: 'all 0.3s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      다음
                    </button>
                  </div>
                  
                    <div style={{ fontSize: '16px', color: '#666', marginLeft: '-16px', marginBottom: '20px' }}>
                      이름이 정확하신가요? 틀린 경우 위에서 수정해주세요
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
                    <button
                      onClick={handleNextStep}
                      disabled={editablePhone.replace(/-/g, '').length !== 11}
                      style={{
                        backgroundColor: editablePhone.replace(/-/g, '').length === 11 ? '#7c746a' : '#ccc',
                        color: editablePhone.replace(/-/g, '').length === 11 ? '#fff' : '#999',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 20px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: editablePhone.replace(/-/g, '').length === 11 ? 'pointer' : 'not-allowed',
                        transition: 'all 0.3s ease',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      다음
                    </button>
                  </div>
                  
                  <div style={{ fontSize: '16px', color: '#666', marginLeft: '-16px', marginBottom: '20px' }}>
                    전화번호가 정확하신가요? 틀린 경우 위에서 수정해주세요
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
                    <button
                      onClick={handleNextStep}
                      disabled={editableBirthday.length !== 8}
                      style={{
                        backgroundColor: editableBirthday.length === 8 ? '#7c746a' : '#ccc',
                        color: editableBirthday.length === 8 ? '#fff' : '#999',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        cursor: editableBirthday.length === 8 ? 'pointer' : 'not-allowed',
                        transition: 'all 0.3s ease',
                        whiteSpace: 'nowrap',
                        marginBottom: '26px' // 입력 필드 하단 텍스트와 맞추기 위해
                      }}
                    >
                      인증 시작
                    </button>
                  </div>
                  
                  <div style={{ fontSize: '16px', color: '#666', marginLeft: '-16px', marginBottom: '20px' }}>
                    생년월일이 정확하신가요? 틀린 경우 위에서 수정해주세요
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
                        onClick={() => setSelectedAuthType(authType.value)}
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
            {/* 아이콘 */}
            <div style={{ 
              marginBottom: '8px', 
              marginLeft: '-16px'
            }}>
              <img 
                src={splashIcon} 
                alt="아이콘" 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  objectFit: 'contain' 
                }} 
              />
            </div>

            {/* 사용자 이름 */}
            <div style={{
              marginBottom: '50px'
            }}>
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#1d1e1f', marginLeft: '-16px' }}>{editableName || '사용자'}</span>
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
              기존 데이터를 사용하시겠습니까?
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
      <div className="auth__content">
        <div className="auth__content-input-area" style={{ padding: '40px 20px', textAlign: 'center' }}>
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
                src="/wello/wello-icon.png" 
                alt="로딩 중" 
                style={{
                  width: '48px',
                  height: '48px',
                  animation: 'faviconBlink 1.5s ease-in-out infinite'
                }}
              />
            </div>
          </div>
          
          {/* 진행률 표시 */}
          <p style={{ fontSize: '14px', color: '#999', textAlign: 'center' }}>
            {currentStatus === 'manual_collecting' ? '데이터 수집을 시작합니다...' :
             currentStatus === 'collecting' ? '건강정보를 수집하고 있습니다...' :
             currentStatus === 'data_collecting' ? '건강정보를 수집하고 있습니다...' :
             currentStatus === 'fetching_health_data' ? '🏥 건강검진 데이터 수집 중...' :
             currentStatus === 'fetching_prescription_data' ? '💊 처방전 데이터 수집 중...' :
             '데이터를 수집하고 있습니다...'}
          </p>
        </div>
      </div>
    );
  }

  // 완료 화면
  if (currentStatus === 'completed') {
    return (
      <div className="auth__content">
        <div className="auth__content-input-area" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <p>✅ 건강정보 동기화가 완료되었습니다!</p>
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
              이전 단계에서 계속 진행하시겠습니까?<br/>
              아니면 처음부터 새로 시작하시겠습니까?
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
              src={splashIcon} 
              alt="아이콘" 
              style={{ 
                width: '32px', 
                height: '32px', 
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
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#1d1e1f', marginLeft: '-16px' }}>{editableName || authInput.name}</span>
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
    </>
  );
};

export default AuthForm;
