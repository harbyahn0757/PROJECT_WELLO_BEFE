import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import Button from './components/Button';
import MainPage from './features/main/MainPage';
import CheckupDesignPage from './features/checkup/CheckupDesignPage';
import CheckupRecommendationsPage from './features/checkup/CheckupRecommendationsPage';
import HealthHabitsPage from './features/survey/HealthHabitsPage';
import HealthQuestionnaireComplete from './features/survey/HealthQuestionnaireComplete';
import HealthQuestionnairePage from './features/survey/HealthQuestionnairePage';
import SurveyPage from './features/survey/SurveyPage';
import AuthPage from './features/auth/AuthPage';
import CollectingDataPage from './features/checkup/CollectingDataPage';
import { HealthDataViewer } from './components/health/HealthDataViewer';
import HealthDashboard from './features/health/HealthDashboard';
import HealthTrends from './features/health/HealthTrends';
import PrescriptionHistory from './features/health/PrescriptionHistory';
import HealthComparison from './features/health/HealthComparison';
import AppointmentPage from './features/appointment/AppointmentPage';
import ResultsTrendPage from './features/results/ResultsTrendPage';
import DiseaseReportPage from './features/disease-report/pages/DiseaseReportPage';
import DiseasePredictionCampaign from './campaigns/disease-prediction';
import CheckupDesignCampaign from './campaigns/checkup-design';
import AgentSurveyPage from './features/agent-survey/AgentSurveyPage';
import PartnerManagementPage from './features/admin/PartnerManagementPage';
import AdminEmbeddingPage from "./features/admin/AdminEmbeddingPage";
// import RagTestPage from './pages/RagTestPage';
import AppointmentModal from './components/appointment/AppointmentModal';
import { LayoutType } from './constants/layoutTypes';
import { WelnoDataProvider, useWelnoData } from './contexts/WelnoDataContext';
import { STORAGE_KEYS, StorageManager } from './constants/storage';
import { WelnoRagChatButton } from './components/welno-rag-chat';
import NotificationContainer from './components/common/NotificationContainer';
import DebugPanel from './components/debug/DebugPanel';
import { sendFrontendStateToServer, sendStateOnPageLoad } from './utils/debugLogger';
import './App.scss';

const EmbedCharacterPage = React.lazy(() => import('./features/embed-character/EmbedCharacterPage'));

// 전역 함수 타입 선언
declare global {
  interface Window {
    handleKakaoLoginFromFloating?: () => void;
    openResultsTrend?: () => void;
    welnoAuthForm?: {
      startInfoConfirmation: () => void;
    };
  }
}

// basename 동적 설정 함수
const getBasename = () => {
  const hostname = window.location.hostname;
  
  // localhost, 127.0.0.1 → 루트(/) 사용 (운영 환경과 동일하게)
  if (hostname === 'localhost' || 
      hostname === '127.0.0.1') {
    return '/';
  }
  
  // 전용 도메인(welno.kindhabit.com, report.kindhabit.com) → 루트(/) 사용
  return '/';
};

const BASENAME = getBasename();

// FloatingButton 컴포넌트 (페이지별 다른 텍스트와 기능)
const FloatingButton: React.FC<{ onOpenAppointmentModal?: () => void }> = ({ onOpenAppointmentModal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useWelnoData();
  const { patient } = state;
  
  // localStorage 변경 시 custom event 발생 헬퍼
  const removeLocalStorageWithEvent = useCallback((key: string) => {
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent('tilko-status-change'));
  }, []);
  
  // 정보 확인 중이거나 인증 진행 중에는 플로팅 버튼 숨기기
  const [hideFloatingButton, setHideFloatingButton] = useState(false);
  const [isAuthWaiting, setIsAuthWaiting] = useState(false);
  const [isAuthMethodSelection, setIsAuthMethodSelection] = useState(false);
  const [isInfoConfirming, setIsInfoConfirming] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [buttonUpdateTrigger, setButtonUpdateTrigger] = useState(0);
  const [campaignButtonText, setCampaignButtonText] = useState<string | null>(null);
  
  // 세션 및 상태 초기화 함수 (직접 조치)
  const cleanupAllStorage = useCallback(() => {
    console.log('🧹 [전체초기화] 모든 로컬/세션 스토리지 초기화 실행');
    
    // Tilko 세션 키들 삭제 (영구 키 tilko_terms_agreed, welno_intro_teaser_shown 제외)
    const keysToRemove = [
      STORAGE_KEYS.TILKO_SESSION_ID, STORAGE_KEYS.TILKO_SESSION_DATA,
      STORAGE_KEYS.LOGIN_INPUT_DATA, STORAGE_KEYS.LOGIN_INPUT_LAST_UPDATED,
      STORAGE_KEYS.TILKO_INFO_CONFIRMING,
      STORAGE_KEYS.TILKO_AUTH_REQUESTED, STORAGE_KEYS.TILKO_AUTH_WAITING, STORAGE_KEYS.TILKO_AUTH_METHOD_SELECTION,
      STORAGE_KEYS.TILKO_MANUAL_COLLECT, STORAGE_KEYS.TILKO_COLLECTING_STATUS,
      STORAGE_KEYS.PASSWORD_MODAL_OPEN,
      'last_forced_cleanup'
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));

    // P0 #2: welno_data_cache_<uuid> 패턴 키 정리 (localStorage)
    Object.keys(localStorage)
      .filter(k => k.startsWith('welno_data_cache_'))
      .forEach(k => localStorage.removeItem(k));

    // 세션 스토리지 (welno_data_cache_* sessionStorage 포함)
    sessionStorage.clear();

    // 메인으로 리다이렉트 후 새로고침
    window.location.href = BASENAME === '/' ? '/' : `${BASENAME}/`;
  }, []);

  // ⭐⭐⭐ 매트릭스 통합: 플로팅 버튼 설정 상태
  const [matrixButtonConfig, setMatrixButtonConfig] = useState<{
    visible: boolean;
    text: string;
    action: (() => void) | null;
  } | null>(null);

  useEffect(() => {
    // URL에 파라미터가 전혀 없고, 현재 메인이라면 강제 초기화 여부 판단
    const search = window.location.search;
    const path = window.location.pathname;
    
    // basename을 제외한 실제 경로가 / 인지 확인
    const isBasePath = BASENAME === '/' 
      ? (path === '/' || path === '')
      : (path === BASENAME || path === `${BASENAME}/`);

    if (!search && isBasePath) {
      const savedInput = localStorage.getItem(STORAGE_KEYS.LOGIN_INPUT_DATA);
      const hasSession = localStorage.getItem('tilko_session_id');
      
      // 입력 데이터만 있고 세션이 없으면 찌꺼기이므로 자동 정리
      if (savedInput && !hasSession) {
        cleanupAllStorage();
      }
    }
  }, [cleanupAllStorage]);

  useEffect(() => {
    const checkHideStatus = () => {
      // 단순화: 핵심 상태만 체크
      const manualCollect = localStorage.getItem(STORAGE_KEYS.TILKO_MANUAL_COLLECT) === 'true';
      const collectingStatus = localStorage.getItem(STORAGE_KEYS.TILKO_COLLECTING_STATUS) === 'true';
      const isManualCollecting = manualCollect || collectingStatus;
      
      // 현재 URL이나 전역 상태에서 수집 여부 추가 확인
      const isCollectingPath = location.pathname === '/collecting' || location.pathname.includes('/collect');
      const passwordModalOpen = localStorage.getItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN) === 'true';
      const authWaiting = localStorage.getItem(STORAGE_KEYS.TILKO_AUTH_WAITING) === 'true';
      const authMethodSelection = localStorage.getItem(STORAGE_KEYS.TILKO_AUTH_METHOD_SELECTION) === 'true';
      const infoConfirming = localStorage.getItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING) === 'true';
      
      // 메인 페이지에서는 플로팅 버튼 숨김 (basename이 /welno이므로 실제 pathname은 /)
      const isMainPage = location.pathname === '/' || location.pathname === '';
      
      // 검진 설계 및 문진 페이지에서도 숨김
      const isSpecialPage = location.pathname === '/checkup-design' ||
                           location.pathname === '/questionnaire' ||
                           location.pathname === '/survey' ||
                           location.pathname === '/habits' ||
                           location.pathname.includes('/campaigns/checkup-design');
      
      // 캠페인 페이지는 항상 플로팅 버튼 표시 (파트너 플로우)
      const isCampaignPage = location.pathname.includes('/campaigns/disease-prediction');
      
      // 데이터 수집 중이거나 비밀번호 모달이 열려있거나 메인 페이지 또는 특수 페이지이면 숨김
      // 단, 캠페인 페이지는 예외 (항상 표시)
      const shouldHide = !isCampaignPage && (isManualCollecting || isCollectingPath || passwordModalOpen || isMainPage || isSpecialPage);
      
      console.warn('[플로팅_진단] checkHideStatus:', { 
        isCampaignPage, 
        isManualCollecting, 
        isCollectingPath, 
        passwordModalOpen, 
        isMainPage, 
        isAuthWaiting: authWaiting,
        shouldHide 
      });

      setHideFloatingButton(shouldHide);
      setIsAuthWaiting(authWaiting);
      setIsAuthMethodSelection(authMethodSelection);
      setIsInfoConfirming(infoConfirming);
      setIsPasswordModalOpen(passwordModalOpen);
      
      console.log('[플로팅버튼] 상태 확인:', { 
        isManualCollecting, 
        isCollectingPath, 
        passwordModalOpen, 
        isMainPage, 
        isAuthWaiting: authWaiting,
        isAuthMethodSelection: authMethodSelection,
        isInfoConfirming: infoConfirming,
        shouldHide 
      });
      
      // 🔧 디버깅: 플로팅 버튼 상태를 서버로 전송
      if (isCampaignPage || shouldHide) {
        sendFrontendStateToServer({
          page_path: `${location.pathname} (플로팅 버튼 판단: ${shouldHide ? '숨김' : '표시'})`
        });
      }
    };
    
    // 초기 상태 확인
    checkHideStatus();
    
    // storage 이벤트 리스너 (다른 탭에서의 변경사항 감지)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.TILKO_MANUAL_COLLECT || e.key === STORAGE_KEYS.PASSWORD_MODAL_OPEN ||
          e.key === STORAGE_KEYS.TILKO_AUTH_WAITING || e.key === STORAGE_KEYS.TILKO_AUTH_METHOD_SELECTION ||
          e.key === STORAGE_KEYS.TILKO_INFO_CONFIRMING) {
        checkHideStatus();
      }
    };
    
    // custom event 리스너 (같은 탭에서의 변경사항 감지)
    const handleCustomEvent = () => {
      checkHideStatus();
      // 버튼 텍스트 업데이트를 위한 트리거
      setButtonUpdateTrigger(prev => prev + 1);
    };
    
    // 캠페인 버튼 텍스트 업데이트 리스너
    const handleCampaignButtonText = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string }>;
      if (customEvent.detail?.text) {
        setCampaignButtonText(customEvent.detail.text);
      }
    };
    
    // ⭐⭐⭐ 매트릭스 통합: 플로팅 버튼 설정 이벤트 리스너
    const handleFloatingButtonConfig = (e: Event) => {
      const customEvent = e as CustomEvent<{
        visible: boolean;
        text: string;
        action: () => void;
      }>;
      
      if (customEvent.detail) {
        console.warn('[플로팅_진단] 매트릭스 설정 수신:', customEvent.detail);
        setMatrixButtonConfig(customEvent.detail);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tilko-status-change', handleCustomEvent);
    window.addEventListener('localStorageChange', handleCustomEvent);
    window.addEventListener('password-modal-change', handleCustomEvent);
    window.addEventListener('welno-view-mode-change', handleCustomEvent);
    window.addEventListener('welno-campaign-button-text', handleCampaignButtonText as EventListener);
    window.addEventListener('floating-button-config', handleFloatingButtonConfig as EventListener); // 매트릭스 이벤트
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tilko-status-change', handleCustomEvent);
      window.removeEventListener('localStorageChange', handleCustomEvent);
      window.removeEventListener('password-modal-change', handleCustomEvent);
      window.removeEventListener('welno-view-mode-change', handleCustomEvent);
      window.removeEventListener('welno-campaign-button-text', handleCampaignButtonText as EventListener);
      window.removeEventListener('floating-button-config', handleFloatingButtonConfig as EventListener); // 매트릭스 이벤트
    };
  }, [location.pathname, buttonUpdateTrigger]);

  // 🔧 디버깅: 페이지 변경 시 상태 전송
  useEffect(() => {
    // 페이지 변경 후 1초 뒤에 상태 전송 (컴포넌트 초기화 완료 대기)
    const timer = setTimeout(() => {
      sendFrontendStateToServer({
        page_path: `${location.pathname} (페이지 변경)`
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [location.pathname]);
  
  // 캠페인 페이지가 아닐 때 campaignButtonText 초기화
  useEffect(() => {
    if (!location.pathname.includes('/campaigns/disease-prediction')) {
      setCampaignButtonText(null);
    }
  }, [location.pathname]);
  
  // 인증 페이지에서 환자 데이터가 로드되면 플로팅 버튼 표시 보장
  useEffect(() => {
    if (location.pathname === '/login') {
      if (patient) {
        removeLocalStorageWithEvent('tilko_info_confirming');
      } else {
        // 환자 정보가 없고 로그인 페이지라면, UI를 가리는 플래그들 정리 (찌꺼기 제거)
        const manualCollect = localStorage.getItem(STORAGE_KEYS.TILKO_MANUAL_COLLECT) === 'true';
        const passwordModalOpen = localStorage.getItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN) === 'true';
        if (manualCollect || passwordModalOpen) {
          console.log('🧹 [App] 로그인 페이지 진입 - 찌꺼기 플래그 정리');
          localStorage.removeItem(STORAGE_KEYS.TILKO_MANUAL_COLLECT);
          localStorage.removeItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN);
          window.dispatchEvent(new CustomEvent('tilko-status-change'));
          window.dispatchEvent(new CustomEvent('password-modal-change'));
        }
      }
    }
  }, [location.pathname, patient, removeLocalStorageWithEvent]);

  const handleAuthClick = async () => {
    console.log('[플로팅버튼] 클릭 - 인증 시작');
    
    if (location.pathname === '/login') {
      // AuthForm에 이벤트 전달
      console.log('🚀 [플로팅버튼] welno-start-auth 이벤트 발생');
      window.dispatchEvent(new CustomEvent('welno-start-auth'));
      return;
    }
    
    if (!patient) {
      console.log('[인증페이지] 환자 데이터 없음 - 인증 페이지로 이동');
      navigate('/login');
      return;
    }
    
    // 다른 페이지에서는 로그인 페이지로 이동
    navigate('/login');
  };

  const handleResultsTrend = useCallback(() => {
    console.log('🔄 [플로팅버튼] 결과 추이 함수 호출');
    if (window.openResultsTrend) {
      window.openResultsTrend();
    } else {
      console.log('⚠️ [플로팅버튼] openResultsTrend 전역 함수를 찾을 수 없음');
      const params = new URLSearchParams(window.location.search);
      const uuid = params.get('uuid');
      const hospitalId = params.get('hospitalId') || params.get('hospital');
      if (uuid && hospitalId) {
        navigate(`/results-trend?uuid=${uuid}&hospitalId=${hospitalId}`);
      } else {
        navigate('/login');
      }
    }
  }, [navigate]);

  if (hideFloatingButton) {
    console.warn('[플로팅_진단] 최종 렌더링 중단: hideFloatingButton이 true입니다.');
    return null;
  }
  
  // ⭐⭐⭐ 매트릭스 통합: DiseaseReportPage에서 버튼 숨김 요청 시
  if (matrixButtonConfig && location.pathname === '/disease-report' && !matrixButtonConfig.visible) {
    console.warn('[플로팅_진단] 최종 렌더링 중단: 매트릭스에서 visible: false 요청');
    return null;
  }

  const getButtonContent = () => {
    const searchParams = new URLSearchParams(location.search);
    const isCampaignModeFromUrl = searchParams.get('mode') === 'campaign';
    const isCampaignPath = location.pathname.includes('/campaigns/disease-prediction');
    const isCampaignMode = isCampaignPath || isCampaignModeFromUrl;

    console.warn('[플로팅_진단] getButtonContent 시작:', {
      pathname: location.pathname,
      isCampaignPath,
      isCampaignModeFromUrl,
      isCampaignMode,
      matrixConfig: matrixButtonConfig ? { visible: matrixButtonConfig.visible, text: matrixButtonConfig.text } : 'none'
    });

    // ⭐⭐⭐ 매트릭스 통합: DiseaseReportPage에서 설정한 매트릭스 버튼이 있으면 우선 사용
    if (matrixButtonConfig && location.pathname === '/disease-report') {
      console.warn('[플로팅_진단] 매트릭스 버튼 적용:', matrixButtonConfig.text);
      return matrixButtonConfig.text;
    }

    // 1. 캠페인 모드 우선 처리
    if (isCampaignMode) {
      const page = searchParams.get('page');
      const isLoginPage = location.pathname.includes('/login');
      
      // 결과 페이지 (로딩/성공/실패) -> 버튼 숨김
      if (page === 'result' || location.pathname.includes('results-trend')) {
        return null;
      }
      
      // 비밀번호 설정 모달이 열려있으면 숨김
      if (isPasswordModalOpen) return null;

      // [로그인/인증 페이지인 경우] 단계별 문구 강제 적용
      if (isLoginPage) {
        // 모바일 인증 대기 단계
        if (isAuthWaiting) return '인증 완료하고 리포트 보기';
        // 정보 확인 / 인증 수단 선택 단계 — UX 개선: 사용자 의도 명확화
        return '나만의 검진 설계하기';
      }

      // [결제/소개 페이지인 경우]
      if (page === 'payment') {
        return campaignButtonText || '7,900원 결제하고 리포트 보기';
      }
      
      return campaignButtonText || '7,900원 결제하고 리포트 보기';
    }

    // 2. 일반 WELNO 플로우 (캠페인이 아닐 때만 진입)
    if (isPasswordModalOpen) return null;
    if (isAuthWaiting) return '인증 완료했어요';
    if (isAuthMethodSelection) return '인증 요청하기';
    if (isInfoConfirming) return '확인 완료';
    
    const isSpecialPage = location.pathname === '/recommendations' ||
                         location.pathname === '/health-comparison' || 
                         location.pathname === '/results-trend' || 
                         location.pathname === '/prescription-history';

    if (isSpecialPage) return '상담예약 신청';
    
    // ⭐⭐⭐ 매트릭스 통합: /disease-report는 매트릭스 버튼 우선 사용 (위에서 처리됨)
    // 매트릭스 버튼이 없으면 기본값
    if (location.pathname === '/disease-report') {
      return '더 자세히 알아보기';
    }
    
    return '인증하고 내 검진추이 확인하기';
  };

  const buttonText = getButtonContent();
  if (!buttonText) {
    console.warn('[플로팅_진단] 최종 렌더링 중단: buttonText가 null입니다.');
    return null;
  }

  console.warn('[플로팅_진단] 최종 렌더링 실행:', { buttonText });

  const handleClick = () => {
    // ⭐⭐⭐ 매트릭스 통합: DiseaseReportPage의 매트릭스 액션이 있으면 우선 실행
    if (matrixButtonConfig && location.pathname === '/disease-report' && matrixButtonConfig.action) {
      console.log('[플로팅 버튼] 매트릭스 액션 실행');
      matrixButtonConfig.action();
      return;
    }
    
    // 캠페인 페이지인 경우 별도 이벤트 발생 (다른 상태 체크보다 우선)
    if (location.pathname.includes('/campaigns/disease-prediction')) {
      console.log('🚀 캠페인 리포트 받아보기 클릭');
      window.dispatchEvent(new CustomEvent('welno-campaign-click'));
      return;
    }
    
    if (isAuthWaiting) {
      console.log('✅ 인증 완료 확인 클릭');
      window.dispatchEvent(new CustomEvent('tilko-auth-complete-clicked'));
      return;
    }
    if (isAuthMethodSelection) {
      console.log('🚀 인증 요청하기 클릭');
      window.dispatchEvent(new CustomEvent('tilko-auth-request-clicked'));
      return;
    }
    if (isInfoConfirming) {
      console.log('✅ 정보 확인 완료 클릭');
      window.dispatchEvent(new CustomEvent('tilko-info-confirm-clicked'));
      return;
    }
    
    // 질병예측 리포트 결과 페이지인 경우 다운로드/공유 이벤트 발생
    if (location.pathname === '/disease-report') {
      console.log('📄 질병예측 리포트 - 다운로드/공유');
      window.dispatchEvent(new CustomEvent('welno-open-pdf-viewer'));
      return;
    }
    
    if (location.pathname === '/login') {
      handleAuthClick();
    } else if (location.pathname === '/recommendations' ||
               location.pathname === '/health-comparison' || 
               location.pathname === '/results-trend' || 
               location.pathname === '/prescription-history') {
      if (onOpenAppointmentModal) {
        onOpenAppointmentModal();
      }
    } else {
      handleAuthClick();
    }
  };

  return (
    <div className="floating-button-container">
      <button 
        className={`floating-button ${isAuthWaiting ? 'auth-waiting' : ''}`}
        onClick={handleClick}
      >
        {buttonText}
      </button>
    </div>
  );
};

const AppContent: React.FC = () => {
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { state, actions } = useWelnoData();
  
  // iframe 여부 감지
  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }
  }, []);

  // 캠페인 경로는 iframe이어도 플로팅 버튼 표시
  const isCampaignIframe = isIframe && location.pathname.includes('/campaigns/');
  const { patient } = state;

  const handleOpenAppointmentModal = () => setIsAppointmentModalOpen(true);
  const handleCloseAppointmentModal = () => setIsAppointmentModalOpen(false);

  // 앱 초기 로드 시 세션 복구 (한 번만 실행)
  useEffect(() => {
    actions.recoverSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 쿼리 파라미터 보존 및 처리
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const cParam = searchParams.get('c');
    const hospitalParam = searchParams.get('hospital') || searchParams.get('hospital_id');
    
    if (cParam) {
      StorageManager.setItem('welno_query_params', location.search);
      // 파트너 및 병원 동적 설정 로드
      actions.loadFrontendConfig(cParam, hospitalParam || undefined);
    } else {
      const savedParams = StorageManager.getItem<string>('welno_query_params');
      if (savedParams) {
        const savedSearchParams = new URLSearchParams(savedParams);
        const savedCParam = savedSearchParams.get('c');
        const savedHospitalParam = savedSearchParams.get('hospital') || savedSearchParams.get('hospital_id');
        if (savedCParam) {
          actions.loadFrontendConfig(savedCParam, savedHospitalParam || undefined);
        }
      }
      // basename이 /welno이므로 실제 pathname은 / 또는 /welno
      if (savedParams && location.pathname === '/') {
        navigate({
          pathname: location.pathname,
          search: savedParams
        }, { replace: true });
      }
    }
  }, [location, navigate, actions]);

  // 도메인별 브라우저 타이틀 및 파비콘 동적 변경
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname.includes('kindhabit.com')) {
      // 카인드해빗 도메인 전용 설정
      document.title = "착한습관 | 오늘도온- 착한습관 만들기 프로젝트";
      
      const favicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      favicons.forEach(el => {
        el.setAttribute('href', '/kindhabit_logo.png');
      });
      
      // Apple touch icon도 변경
      const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (appleIcon) {
        appleIcon.setAttribute('href', '/kindhabit_logo.png');
      }
    } else {
      // 기본 WELNO 설정
      document.title = "WELNO | 건강검진 플랫폼";
      
      const favicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
      favicons.forEach(el => {
        el.setAttribute('href', '/welno_logo.png');
      });
    }
  }, []);

  return (
    <div className="app-container">
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/collecting" element={<CollectingDataPage />} />
        <Route path="/checkup-design" element={<CheckupDesignPage />} />
        <Route path="/recommendations" element={<CheckupRecommendationsPage />} />
        <Route path="/habits" element={<HealthHabitsPage />} />
        <Route path="/habits/complete" element={<HealthQuestionnaireComplete />} />
        <Route path="/questionnaire" element={<HealthQuestionnairePage />} />
        <Route path="/survey" element={<SurveyPage />} />
        <Route path="/dashboard" element={<HealthDashboard />} />
        <Route path="/results-trend" element={<ResultsTrendPage />} />
        {/* 이전 호환성: /results → /results-trend 리다이렉트 */}
        <Route path="/results" element={<Navigate to="/results-trend" replace />} />
        {/* ⭐ 질병예측 리포트 페이지 */}
        <Route path="/disease-report" element={<DiseaseReportPage />} />
        {/* ⭐ 에이전트 고객 설문 페이지 */}
        <Route path="/agent-survey" element={<AgentSurveyPage />} />
        {/* ⭐ 외부 파트너 연동 캠페인 페이지 (결제 포함) */}
        <Route path="/campaigns/disease-prediction" element={<DiseasePredictionCampaign />} />
        {/* ⭐ 검진설계 캠페인 */}
        <Route path="/campaigns/checkup-design" element={<CheckupDesignCampaign />} />
        <Route path="/welno/campaigns/checkup-design" element={<CheckupDesignCampaign />} />
        <Route path="/welno/campaigns/disease-prediction" element={<DiseasePredictionCampaign />} />
        {/* ⭐ 파트너 관리 페이지 */}
        <Route path="/partner-management" element={<PartnerManagementPage />} />
        <Route path="/prescription-history" element={<PrescriptionHistory />} />
        <Route path="/admin-embedding" element={<AdminEmbeddingPage />} />
        <Route path="/comparison" element={<HealthComparison />} />
        <Route path="/appointment" element={<AppointmentPage />} />
        {/* 백오피스는 독립 앱으로 /backoffice 경로에서 서빙됨 */}
        {/* <Route path="/kindhait" element={<RagTestPage />} /> */}
        <Route path="/health-comparison" element={<HealthComparison />} />
        <Route path="/embed/character" element={
          <React.Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>}>
            <EmbedCharacterPage />
          </React.Suspense>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {(!isIframe || isCampaignIframe) && !location.pathname.startsWith('/embed/') && <FloatingButton onOpenAppointmentModal={handleOpenAppointmentModal} />}
      
      <AppointmentModal 
        isOpen={isAppointmentModalOpen} 
        onClose={handleCloseAppointmentModal}
      />
      
      {!isIframe && <NotificationContainer />}
      {!isIframe && !location.pathname.includes('/campaigns/checkup-design') && <WelnoRagChatButton />}
      <DebugPanel />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <WelnoDataProvider>
      <Router basename={BASENAME}>
        <AppContent />
      </Router>
    </WelnoDataProvider>
  );
};

export default App;
