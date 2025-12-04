import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Button from './components/Button';
import MainPage from './pages/MainPage';
import CheckupDesignPage from './pages/CheckupDesignPage';
import CheckupRecommendationsPage from './pages/CheckupRecommendationsPage';
import HealthHabitsPage from './pages/HealthHabitsPage';
import HealthQuestionnaireComplete from './pages/HealthQuestionnaireComplete';
import HealthQuestionnairePage from './pages/HealthQuestionnairePage';
import SurveyPage from './pages/SurveyPage';
import AuthPage from './pages/AuthPage';
import CollectingDataPage from './pages/CollectingDataPage';
import { HealthDataViewer } from './components/health/HealthDataViewer';
import HealthDashboard from './pages/HealthDashboard';
import HealthTrends from './pages/HealthTrends';
import PrescriptionHistory from './pages/PrescriptionHistory';
import HealthComparison from './pages/HealthComparison';
// import ComprehensiveAnalysisPage from './pages/ComprehensiveAnalysisPage'; // 제거됨
import AppointmentPage from './pages/AppointmentPage';
import AppointmentModal from './components/appointment/AppointmentModal';
import { LayoutType } from './constants/layoutTypes';
import { WelloDataProvider, useWelloData } from './contexts/WelloDataContext';
import { STORAGE_KEYS, StorageManager } from './constants/storage';
import NotificationContainer from './components/common/NotificationContainer';
import PageTransitionLoader from './components/PageTransitionLoader';
import './App.scss';

// 전역 함수 타입 선언
declare global {
  interface Window {
    handleKakaoLoginFromFloating?: () => void;
    openResultsTrend?: () => void;
  }
}

// FloatingButton 컴포넌트 (페이지별 다른 텍스트와 기능)
const FloatingButton: React.FC<{ onOpenAppointmentModal?: () => void }> = ({ onOpenAppointmentModal }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useWelloData();
  const { patient } = state;
  
  // localStorage 변경 시 custom event 발생 헬퍼
  const removeLocalStorageWithEvent = React.useCallback((key: string) => {
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent('tilko-status-change'));
  }, []);
  
  // 정보 확인 중이거나 인증 진행 중에는 플로팅 버튼 숨기기
  const [hideFloatingButton, setHideFloatingButton] = React.useState(false);
  const [isAuthWaiting, setIsAuthWaiting] = React.useState(false);
  const [isAuthMethodSelection, setIsAuthMethodSelection] = React.useState(false);
  const [isInfoConfirming, setIsInfoConfirming] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [buttonUpdateTrigger, setButtonUpdateTrigger] = React.useState(0);
  
  React.useEffect(() => {
    const checkHideStatus = () => {
      // 🔧 단순화: 핵심 상태만 체크
      const isDataCollecting = localStorage.getItem('tilko_manual_collect') === 'true';
      const passwordModalOpen = localStorage.getItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN) === 'true';
      const authWaiting = localStorage.getItem('tilko_auth_waiting') === 'true';
      const authMethodSelection = localStorage.getItem('tilko_auth_method_selection') === 'true';
      const infoConfirming = localStorage.getItem(STORAGE_KEYS.TILKO_INFO_CONFIRMING) === 'true';
      
      // 데이터 수집 중이거나 비밀번호 모달이 열려있으면 숨김
      const shouldHide = isDataCollecting || passwordModalOpen;
      setHideFloatingButton(shouldHide);
      setIsAuthWaiting(authWaiting);
      setIsAuthMethodSelection(authMethodSelection);
      setIsInfoConfirming(infoConfirming);
      setIsPasswordModalOpen(passwordModalOpen);
      
      console.log('🔄 [플로팅버튼] 상태 확인:', { isDataCollecting, passwordModalOpen, infoConfirming, shouldHide });
    };
    
    // 초기 상태 확인
    checkHideStatus();
    
    // storage 이벤트 리스너 (다른 탭에서의 변경사항 감지)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tilko_manual_collect' || e.key === STORAGE_KEYS.PASSWORD_MODAL_OPEN ||
          e.key === 'tilko_auth_waiting' || e.key === 'tilko_auth_method_selection' ||
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
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tilko-status-change', handleCustomEvent);
    window.addEventListener('localStorageChange', handleCustomEvent);
    window.addEventListener('password-modal-change', handleCustomEvent);
    window.addEventListener('wello-view-mode-change', handleCustomEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tilko-status-change', handleCustomEvent);
      window.removeEventListener('localStorageChange', handleCustomEvent);
      window.removeEventListener('password-modal-change', handleCustomEvent);
      window.removeEventListener('wello-view-mode-change', handleCustomEvent);
    };
  }, []);
  
  // 인증 페이지에서 환자 데이터가 로드되면 플로팅 버튼 표시 보장
  React.useEffect(() => {
    if (location.pathname === '/login' && patient) {
      // console.log('👤 [인증페이지] 환자 데이터 로드됨 - 플로팅 버튼 표시 보장');
      removeLocalStorageWithEvent('tilko_info_confirming');
    }
  }, [location.pathname, patient, removeLocalStorageWithEvent]);

  const handleAuthClick = async () => {
    console.log('🔐 [인증페이지] 정보 확인 단계 시작');
    
    if (!patient) {
      console.error('환자 데이터가 없습니다.');
      return;
    }
    
    // AuthForm 함수 직접 호출 (localStorage + 이벤트 방식 제거)
    if ((window as any).welloAuthForm?.startInfoConfirmation) {
      (window as any).welloAuthForm.startInfoConfirmation();
    } else {
      console.warn('⚠️ [플로팅버튼] AuthForm 함수를 찾을 수 없음 - localStorage 방식으로 폴백');
      StorageManager.setItem(STORAGE_KEYS.START_INFO_CONFIRMATION, 'true');
      window.dispatchEvent(new Event('localStorageChange'));
    }
  };

  const handleAuthCompleteClick = async () => {
    console.log('✅ [인증완료] 사용자가 인증 완료 버튼 클릭');
    
    // AuthForm 함수 직접 호출 (localStorage + 이벤트 방식 제거)
    if ((window as any).welloAuthForm?.startManualDataCollection) {
      (window as any).welloAuthForm.startManualDataCollection();
    } else {
      console.warn('⚠️ [플로팅버튼] AuthForm 함수를 찾을 수 없음 - localStorage 방식으로 폴백');
      StorageManager.setItem('tilko_manual_collect', 'true');
      window.dispatchEvent(new Event('localStorageChange'));
    }
  };

  const handleAuthMethodSelectionClick = async () => {
    console.log('🔘 [인증방식] 사용자가 인증 시작 버튼 클릭');
    
    // AuthForm 함수 직접 호출 (localStorage + 이벤트 방식 제거)
    if ((window as any).welloAuthForm?.completeAuthMethodSelection) {
      (window as any).welloAuthForm.completeAuthMethodSelection();
    } else {
      console.warn('⚠️ [플로팅버튼] AuthForm 함수를 찾을 수 없음 - localStorage 방식으로 폴백');
      StorageManager.setItem('tilko_auth_method_complete', 'true');
      window.dispatchEvent(new Event('localStorageChange'));
    }
  };

  const handleInfoConfirmationNext = async () => {
    console.log('➡️ [플로팅버튼] 정보 확인 다음 단계 진행');
    
    // AuthForm 함수 직접 호출
    if ((window as any).welloAuthForm?.handleNextStep) {
      (window as any).welloAuthForm.handleNextStep();
    } else {
      console.warn('⚠️ [플로팅버튼] AuthForm 함수를 찾을 수 없음');
    }
  };
  
  const getButtonConfig = () => {
    const path = location.pathname;
    
    if (path === '/login') {
      // 틸코 인증 대기 상태 확인 (React state 사용)
      // console.log('🔍 [플로팅버튼] 상태:', { isAuthWaiting, isAuthMethodSelection, isInfoConfirming });
      
      if (isInfoConfirming) {
        // 현재 단계 확인
        const currentStep = (window as any).welloAuthForm?.getCurrentConfirmationStep?.() || 'name';
        const buttonText = currentStep === 'name' ? '네, 맞습니다' : '다음';
        
        return {
          text: buttonText,
          onClick: handleInfoConfirmationNext
        };
      } else if (isAuthWaiting) {
        return {
          text: '인증을 완료했어요',
          onClick: handleAuthCompleteClick
        };
      } else if (isAuthMethodSelection) {
        return {
          text: '인증 시작하기',
          onClick: handleAuthMethodSelectionClick
        };
      } else {
        return {
          text: '인증하고 내 검진 추이 확인하기',
          onClick: handleAuthClick
        };
      }
    }
    
    // results-trend 페이지에서는 trends 모드일 때만 AI 분석 버튼 표시
    if (path === '/results-trend' || path.includes('/results-trend')) {
      // 🔧 viewMode 확인 (trends 모드에서만 플로팅 버튼 표시)
      const currentViewMode = localStorage.getItem('wello_view_mode') || 'trends';
      
      if (currentViewMode === 'trends') {
        return {
          text: (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src="/wello/wello-icon.png" 
                alt="Wello" 
                style={{ 
                  width: '20px', 
                  height: '20px'
                }} 
              />
              AI 종합 분석보기
            </span>
          ),
          onClick: () => {
            console.log('🧠 [플로팅버튼] AI 종합 분석 섹션 표시');
            // 🔧 페이지 이동 대신 같은 페이지에서 AI 분석 섹션 표시
            window.dispatchEvent(new CustomEvent('show-ai-analysis-section'));
          }
        };
      } else {
        // timeline 모드에서는 플로팅 버튼 숨김
        return null;
      }
    }
    
    // comprehensive-analysis 페이지 제거됨
    
    // 예약 페이지에서는 플로팅 버튼 숨김
    if (path === '/appointment' || path.includes('/appointment')) {
      return null;
    }
    
    // 설문 페이지에서는 플로팅 버튼 숨김 (문진 페이지)
    if (path === '/survey/checkup-design' || 
        path === '/survey/health-habits' || 
        path === '/survey/disease-prediction' ||
        path.includes('/survey/')) {
      return null;
    }
    
    // 검진 항목 추천 페이지에서는 플로팅 버튼 표시 (예약 기능)
    if (path === '/checkup-recommendations' || path.includes('/checkup-recommendations')) {
      return {
        text: '검진 예약 하기',
        onClick: () => {
          console.log('🎯 [플로팅버튼] 검진 예약 모달 열기');
          onOpenAppointmentModal?.();
        }
      };
    }
    
    // 문진 완료 페이지에서는 검진 설계 페이지로 이동
    if (path === '/questionnaire-complete' || path.includes('/questionnaire-complete')) {
      return {
        text: '검진 설계하기',
        onClick: () => {
          console.log('🎯 [플로팅버튼] 검진 설계 페이지로 이동');
          navigate('/survey/checkup-design');
        }
      };
    }
    
    // 기본 (메인페이지 등) - 브라운 스킨 디자인 반영
    return {
      text: '검진 예약 하기',
      onClick: () => {
        console.log('🎯 [플로팅버튼] 검진 예약 모달 열기');
        onOpenAppointmentModal?.();
      }
    };
  };

  const buttonConfig = React.useMemo(() => getButtonConfig(), [location.pathname, isAuthWaiting, isAuthMethodSelection, isInfoConfirming, buttonUpdateTrigger, onOpenAppointmentModal]);

  // buttonConfig가 null이거나 비밀번호 모달이 열려있으면 플로팅 버튼 숨기기
  if (!buttonConfig || isPasswordModalOpen) {
    return null;
  }

  // 인증 대기 상태일 때 깜빡임 효과 추가
  const buttonClassName = isAuthWaiting 
    ? "floating-button auth-waiting-button" 
    : "floating-button";

  return (
    <Button
      className={buttonClassName}
      onClick={buttonConfig.onClick}
      disabled={false}
    >
      {buttonConfig.text}
    </Button>
  );
};

// 결과 트렌드 버튼 컴포넌트
const ResultsTrendButton: React.FC = () => {
  const handleClick = () => {
    console.log('📊 [결과트렌드버튼] 결과 트렌드 페이지 열기');
    if (window.openResultsTrend) {
      window.openResultsTrend();
    } else {
      console.warn('결과 트렌드 함수가 등록되지 않았습니다');
    }
  };

  return (
    <Button
      className="results-trend-button"
      onClick={handleClick}
      variant="secondary"
    >
      📈 결과 트렌드 보기
    </Button>
  );
};

// ComprehensiveAnalysisButton 제거됨 - AI 분석은 results-trend 페이지에서만 제공

// URL 감지 및 자동 로딩을 위한 내부 컴포넌트
const AppContent: React.FC = () => {
  const { state, actions } = useWelloData();
  const location = useLocation();
  const navigate = useNavigate();
  const [isReturningToMain, setIsReturningToMain] = useState(false);
  const [prevPathname, setPrevPathname] = useState<string>('');
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const loadedUuidRef = useRef<string | null>(null); // 이미 로드한 UUID 추적
  const loadingUuidRef = useRef<string | null>(null); // 현재 로딩 중인 UUID 추적
  const lastSearchRef = useRef<string>(''); // 마지막 처리한 location.search 추적

  // 초기 로드 시 쿼리 파라미터 보존 (프로덕션 환경에서 쿼리 파라미터가 사라지는 문제 해결)
  useEffect(() => {
    // sockjs-node 경로는 개발 서버의 HMR WebSocket이므로 무시
    if (location.pathname.startsWith('/sockjs-node')) {
      return;
    }
    // 즉시 실행 (동기적으로) - React Router가 렌더링되기 전에 처리
    const restoreQueryParams = () => {
      // 1. sessionStorage에서 저장된 쿼리 파라미터 확인 (index.html의 인라인 스크립트에서 저장됨)
      const savedSearch = sessionStorage.getItem('wello_query_params');
      
      // 2. sockjs-node 경로는 무시
      if (location.pathname.startsWith('/sockjs-node')) {
        return false;
      }
      
      // 3. window.location.href에서 직접 쿼리 파라미터 추출
      const currentUrl = window.location.href;
      const urlObj = new URL(currentUrl);
      const windowSearch = urlObj.search;
      const locationSearch = location.search;
      
      // 4. 쿼리 파라미터 우선순위: windowSearch > savedSearch
      const queryParams = windowSearch || savedSearch || '';
      
      console.log('🔍 [App] 쿼리 파라미터 체크:', {
        windowHref: currentUrl,
        windowSearch,
        savedSearch,
        locationSearch,
        queryParams,
        pathname: location.pathname
      });
      
      // 5. 쿼리 파라미터가 있지만 location.search에는 없는 경우 복원
      if (queryParams && !locationSearch) {
        console.log('🔧 [App] 쿼리 파라미터 복원 시작:', queryParams);
        
        // sessionStorage에서 제거 (한 번만 사용)
        if (savedSearch) {
          sessionStorage.removeItem('wello_query_params');
        }
        
        // window.history.replaceState로 먼저 복원 (동기적으로)
        if (window.history && window.history.replaceState) {
          const newUrl = `${window.location.pathname}${queryParams}${window.location.hash}`;
          window.history.replaceState({ ...window.history.state }, '', newUrl);
          console.log('✅ [App] history.replaceState 완료:', newUrl);
        }
        
        // React Router의 navigate를 사용하여 쿼리 파라미터 복원
        const currentPath = location.pathname;
        const newPath = `${currentPath}${queryParams}`;
        
        // 즉시 navigate (setTimeout 없이)
        navigate(newPath, { replace: true });
        console.log('✅ [App] navigate 완료:', newPath);
        
        return true; // 복원 성공
      }
      
      return false; // 복원 불필요
    };
    
    // 즉시 실행
    const restored = restoreQueryParams();
    
    // 복원이 성공했으면 추가 확인 불필요
    if (!restored) {
      // 추가 보험: 약간의 지연 후 다시 확인 (리다이렉트 후일 수 있음)
      const timeoutId = setTimeout(() => {
        restoreQueryParams();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [location.pathname, location.search, navigate]); // 의존성 추가

  // 메인페이지로 돌아올 때 로딩 표시
  useEffect(() => {
    const currentPath = location.pathname;
    const isMainPage = currentPath === '/' || currentPath === '/results';
    
    // 다른 페이지에서 메인페이지로 돌아올 때
    if (isMainPage && prevPathname && prevPathname !== '/' && prevPathname !== '/results') {
      console.log('🔄 [App] 메인페이지로 복귀 - 로딩 표시');
      setIsReturningToMain(true);
      
      // 더 긴 시간 후 로딩 숨김 (페이지 로드 완료 시뮬레이션)
      const timer = setTimeout(() => {
        setIsReturningToMain(false);
      }, 1200);
      
      return () => clearTimeout(timer);
    }
    
    // 이전 경로 업데이트
    setPrevPathname(currentPath);
  }, [location.pathname, prevPathname]);

  // URL 파라미터 감지하여 자동 데이터 로딩 (한 번만 실행)
  useEffect(() => {
    // sockjs-node 경로는 무시
    if (location.pathname.startsWith('/sockjs-node')) {
      return;
    }
    
    // window.location.search 확인 (실제 URL의 쿼리 파라미터)
    const windowSearch = window.location.search;
    
    // location.search가 비어있지만 window.location.search에는 있는 경우 복원
    if (!location.search && windowSearch) {
      console.log('🔧 [App] 쿼리 파라미터 복원 (데이터 로딩 전):', windowSearch);
      navigate(`${location.pathname}${windowSearch}`, { replace: true });
      return; // 복원 후 다음 렌더링에서 처리
    }
    
    // location.search가 변경되지 않았으면 무시 (중복 실행 방지)
    if (lastSearchRef.current === location.search) {
      console.log(`⏸️ [App] location.search 변경 없음 - 중복 실행 방지: ${location.search}`);
      return;
    }

    const urlParams = new URLSearchParams(location.search);
    const uuid = urlParams.get('uuid');
    const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');

    // location.search 기록 (처리 전에 기록하여 중복 방지)
    lastSearchRef.current = location.search;

    if (uuid && hospital) {
      // 이미 같은 UUID를 로드했거나 로딩 중이면 무시 (중복 호출 방지)
      if (loadedUuidRef.current === uuid || loadingUuidRef.current === uuid) {
        console.log(`⏸️ [App] 이미 로드/로딩 중인 환자 데이터: ${uuid} - 중복 호출 방지`, {
          loaded: loadedUuidRef.current,
          loading: loadingUuidRef.current
        });
        return;
      }

      // 현재 환자 데이터가 없거나 다른 환자인 경우에만 로딩
      if (!state.patient || state.patient.uuid !== uuid) {
        console.log(`🔄 [App] 환자 데이터 로딩: ${uuid} @ ${hospital}`, {
          currentPatient: state.patient?.uuid,
          targetUuid: uuid,
          loadedRef: loadedUuidRef.current,
          loadingRef: loadingUuidRef.current
        });
        loadingUuidRef.current = uuid; // 로딩 시작 전에 UUID 기록
        loadedUuidRef.current = null; // 로딩 시작 시 loaded 리셋
        
        actions.loadPatientData(uuid, hospital).then(() => {
          // 로딩 완료 후 ref 업데이트
          loadingUuidRef.current = null;
          loadedUuidRef.current = uuid;
        }).catch(() => {
          // 에러 발생 시에도 리셋
          loadingUuidRef.current = null;
        });
      } else {
        console.log(`✅ [App] 환자 데이터 이미 로드됨: ${state.patient.name} (${uuid})`);
        loadedUuidRef.current = uuid; // 이미 로드된 경우에도 기록
        loadingUuidRef.current = null; // 로딩 중이 아님
        // 기존 데이터가 있는 경우 레이아웃만 확인하고 토스트 표시하지 않음
      }
    } else {
      // UUID가 없으면 리셋
      loadedUuidRef.current = null;
      loadingUuidRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]); // state.patient?.uuid 제거 - 무한 루프 방지

  // 개발 환경에서 디버그 정보 출력 (필요시에만 활성화)
  // useEffect(() => {
  //   if (process.env.NODE_ENV === 'development' && state.layoutConfig) {
  //     debugLayoutMapping();
  //   }
  // }, [state.layoutConfig]);

  // 레이아웃 설정이 없는 경우 기본 레이아웃 사용
  const layoutConfig = state.layoutConfig || {
    layoutType: 'vertical' as LayoutType,
    showAIButton: false,
    showFloatingButton: true,
    title: 'WELLO 건강검진 플랫폼',
    subtitle: '건강한 내일을 위한 첫걸음을 시작하세요.',
    headerMainTitle: '',
    headerImage: "/wello/doctor-image.png",
    headerImageAlt: "의사가 정면으로 청진기를 들고 있는 전문적인 의료 배경 이미지",
    headerSlogan: "행복한 건강생활의 평생 동반자",
    headerLogoTitle: "건강검진센터",
    headerLogoSubtitle: "",
    hospitalName: '건강검진센터',
    brandColor: '#4b5563',
    logoPosition: 'center',
  };

  // 플로팅 버튼 표시 조건: 기본적으로 항상 표시 (layoutConfig 로딩 전에도)
  const shouldShowFloatingButton = layoutConfig.showFloatingButton !== false;

  if (state.isLoading) {
    return (
      <div className="app">
        <div className="main-container">
          <div className="loading-container">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>데이터를 불러오는 중...</p>
            </div>
          </div>
          
          {/* 로딩 중에도 플로팅 버튼 표시 */}
          {shouldShowFloatingButton && <FloatingButton />}
        </div>
      </div>
    );
  }

  if (state.error && !state.patient) {
    return (
      <div className="app">
        <div className="error-container">
          <div className="error-message">
            <h2>오류가 발생했습니다</h2>
            <p>{state.error}</p>
            <button onClick={() => window.location.reload()}>
              새로고침
            </button>
            <button onClick={actions.recoverSession}>
              세션 복구 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 통합 레이아웃 사용 (세로형/가로형/인트로 제거)
  // sockjs-node 경로는 개발 서버의 HMR WebSocket이므로 무시
  if (location.pathname.startsWith('/sockjs-node')) {
    return null;
  }

  return (
    <div className="app">
      <div className="main-container" key={location.pathname}>
        <Routes>
          <Route 
            path="/" 
            element={<MainPage />} 
          />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/collecting" element={<CollectingDataPage />} />
          <Route path="/survey/:surveyId" element={<SurveyPage />} />
          <Route path="/survey/checkup-design" element={<CheckupDesignPage />} />
          <Route path="/checkup-recommendations" element={<CheckupRecommendationsPage />} />
          <Route path="/survey/health-habits" element={<HealthHabitsPage />} />
          <Route path="/health-questionnaire" element={<HealthQuestionnairePage />} />
          <Route path="/questionnaire-complete" element={<HealthQuestionnaireComplete />} />
          <Route path="/dashboard" element={<HealthDashboard />} />
          <Route path="/trends" element={<HealthTrends />} />
          <Route path="/prescriptions" element={<PrescriptionHistory />} />
          <Route path="/comparison" element={<HealthComparison />} />
          {/* <Route path="/comprehensive-analysis" element={<ComprehensiveAnalysisPage />} /> 제거됨 */}
          <Route path="/results-trend" element={<HealthDataViewer />} />
          <Route path="/appointment" element={<AppointmentPage />} />
          <Route 
            path="/results" 
            element={<MainPage />} 
          />
        </Routes>
        
        {/* 플로팅 버튼 조건부 렌더링 */}
        {shouldShowFloatingButton && (
          <FloatingButton onOpenAppointmentModal={() => setIsAppointmentModalOpen(true)} />
        )}
        
        {/* AI 버튼 조건부 렌더링 */}
        {layoutConfig.showAIButton && <ResultsTrendButton />}
        
        {/* 종합 분석 버튼 제거됨 - AI 분석은 results-trend 페이지에서만 제공 */}
      </div>
      
      {/* 알림 컨테이너 */}
      <NotificationContainer />
      
      {/* 페이지 전환 로딩 스피너 (메인페이지로 복귀 시) */}
      <PageTransitionLoader isVisible={isReturningToMain} />
      
      {/* 예약 모달 */}
      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        onConfirm={(selectedDates) => {
          console.log('예약 신청 완료', selectedDates);
          // TODO: 예약 신청 API 호출
        }}
      />
    </div>
  );
};

// 메인 App 컴포넌트 (Provider 래핑)
function App() {
  return (
    <Router basename="/wello">
      <WelloDataProvider>
        <AppContent />
      </WelloDataProvider>
    </Router>
  );
}

export default App;