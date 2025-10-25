import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import VerticalLayout from './layouts/VerticalLayout';
import HorizontalLayout from './layouts/HorizontalLayout';
import IntroLayout from './layouts/IntroLayout';
import Button from './components/Button';
import MainPage from './pages/MainPage';
import CheckupDesignPage from './pages/CheckupDesignPage';
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
import ComprehensiveAnalysisPage from './pages/ComprehensiveAnalysisPage';
import { LayoutType } from './constants/layoutTypes';
import { debugLayoutMapping } from './utils/layoutMapper';
import { WelloDataProvider, useWelloData } from './contexts/WelloDataContext';
import { STORAGE_KEYS, StorageManager } from './constants/storage';
import NotificationContainer from './components/common/NotificationContainer';
import './App.scss';

// 전역 함수 타입 선언
declare global {
  interface Window {
    handleKakaoLoginFromFloating?: () => void;
    openResultsTrend?: () => void;
  }
}

// FloatingButton 컴포넌트 (페이지별 다른 텍스트와 기능)
const FloatingButton: React.FC = () => {
  const location = useLocation();
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
  const [buttonUpdateTrigger, setButtonUpdateTrigger] = React.useState(0);
  
  React.useEffect(() => {
    const checkHideStatus = () => {
      const isConfirming = localStorage.getItem('tilko_info_confirming') === 'true';
      const authWaiting = localStorage.getItem('tilko_auth_waiting') === 'true';
      const authMethodSelection = localStorage.getItem('tilko_auth_method_selection') === 'true';
      const isDataCollecting = localStorage.getItem('tilko_manual_collect') === 'true';
      
      // 정보 확인 중이거나 데이터 수집 중에는 무조건 숨김
      const shouldHide = isConfirming || isDataCollecting;
      setHideFloatingButton(shouldHide);
      setIsAuthWaiting(authWaiting);
      setIsAuthMethodSelection(authMethodSelection);
      
      // console.log('🔄 [플로팅버튼] 상태 확인:', { isConfirming, authWaiting, authMethodSelection, isDataCollecting, shouldHide });
    };
    
    // 초기 상태 확인
    checkHideStatus();
    
    // storage 이벤트 리스너 (다른 탭에서의 변경사항 감지)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'tilko_info_confirming' || e.key === 'tilko_auth_waiting' || 
          e.key === 'tilko_auth_method_selection' || e.key === 'tilko_manual_collect') {
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
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tilko-status-change', handleCustomEvent);
      window.removeEventListener('localStorageChange', handleCustomEvent);
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
    
    // AuthForm에게 정보 확인 시작 신호 전송
    StorageManager.setItem(STORAGE_KEYS.START_INFO_CONFIRMATION, 'true');
    console.log('📡 [플로팅버튼] 정보 확인 시작 신호 전송');
    
    // 같은 페이지 내에서 localStorage 변경을 감지할 수 있도록 커스텀 이벤트 발생
    window.dispatchEvent(new Event('localStorageChange'));
  };

  const handleAuthCompleteClick = async () => {
    console.log('✅ [인증완료] 사용자가 인증 완료 버튼 클릭');
    
    // AuthForm에게 수동 데이터 수집 신호 전송
    StorageManager.setItem('tilko_manual_collect', 'true');
    console.log('📡 [플로팅버튼] 수동 데이터 수집 신호 전송');
    
    // 같은 페이지 내에서 localStorage 변경을 감지할 수 있도록 커스텀 이벤트 발생
    window.dispatchEvent(new Event('localStorageChange'));
  };

  const handleAuthMethodSelectionClick = async () => {
    console.log('🔘 [인증방식] 사용자가 인증 시작 버튼 클릭');
    
    // AuthForm에게 인증 방식 선택 완료 신호 전송
    StorageManager.setItem('tilko_auth_method_complete', 'true');
    console.log('📡 [플로팅버튼] 인증 방식 선택 완료 신호 전송');
    
    // 같은 페이지 내에서 localStorage 변경을 감지할 수 있도록 커스텀 이벤트 발생
    window.dispatchEvent(new Event('localStorageChange'));
  };
  
  const getButtonConfig = () => {
    const path = location.pathname;
    
    if (path === '/login') {
      // 틸코 인증 대기 상태 확인 (React state 사용)
      // console.log('🔍 [플로팅버튼] 상태:', { isAuthWaiting, isAuthMethodSelection });
      
      if (isAuthWaiting) {
        return {
          text: '데이터 수집하기',
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
    
    // results-trend 페이지에서 데이터가 있으면 분석보기 버튼으로 변경
    if (path === '/results-trend' || path.includes('/results-trend')) {
      const collectedDataStr = localStorage.getItem('tilko_collected_data');
      if (collectedDataStr) {
        try {
          const collectedData = JSON.parse(collectedDataStr);
          const hasHealthData = collectedData.health_data?.ResultList?.length > 0;
          const hasPrescriptionData = collectedData.prescription_data?.ResultList?.length > 0;
          
          if (hasHealthData || hasPrescriptionData) {
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
                console.log('🧠 [플로팅버튼] 종합 분석 페이지로 이동');
                const urlParams = new URLSearchParams(window.location.search);
                const uuid = urlParams.get('uuid');
                const hospital = urlParams.get('hospital');
                const queryString = uuid && hospital ? `?uuid=${uuid}&hospital=${hospital}` : '';
                window.location.href = `/wello/comprehensive-analysis${queryString}`;
              }
            };
          }
        } catch (error) {
          console.error('데이터 파싱 오류:', error);
        }
      }
    }
    
    // comprehensive-analysis 페이지에서는 AI 분석 시작/재분석 버튼
    if (path === '/comprehensive-analysis' || path.includes('/comprehensive-analysis')) {
      // AI 분석 완료 상태 확인 (localStorage에서)
      const gptAnalysisResult = localStorage.getItem('gpt_analysis_result');
      
      // AI 분석 완료 여부에 따라 버튼 텍스트 변경
      const buttonText = gptAnalysisResult ? 'AI 재분석' : 'AI 종합 분석';
      
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
            {buttonText}
          </span>
        ),
        onClick: () => {
          console.log(`🧠 [플로팅버튼] ${buttonText} 시작`);
          
          // 재분석인 경우 기존 결과 삭제
          if (gptAnalysisResult) {
            localStorage.removeItem('gpt_analysis_result');
            console.log('🗑️ [플로팅버튼] 기존 AI 분석 결과 삭제 - 재분석 시작');
          }
          
          // ComprehensiveAnalysisPage의 analyzeHealthData 함수 호출
          const event = new CustomEvent('start-ai-analysis');
          window.dispatchEvent(event);
        }
      };
    }
    
    // 기본 (메인페이지 등) - 모든 화면에서 동일한 역할
    return {
      text: '건강검진 예약하기',
      onClick: () => {
        console.log('🎯 [플로팅버튼] 건강검진 예약 시작');
        if (window.handleKakaoLoginFromFloating) {
          window.handleKakaoLoginFromFloating();
        } else {
          console.warn('카카오 로그인 함수가 등록되지 않았습니다');
        }
      }
    };
  };

  const buttonConfig = React.useMemo(() => getButtonConfig(), [location.pathname, isAuthWaiting, isAuthMethodSelection, buttonUpdateTrigger]);

  // buttonConfig가 null이면 플로팅 버튼 숨기기
  if (!buttonConfig) {
    return null;
  }

  return (
    <div className="floating-button-container">
      <Button
        className="floating-button"
        onClick={buttonConfig.onClick}
        disabled={false}
      >
        {buttonConfig.text}
      </Button>
    </div>
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

// 종합 분석 버튼 컴포넌트
const ComprehensiveAnalysisButton: React.FC = () => {
  const navigate = useNavigate();
  const [hasData, setHasData] = React.useState(false);
  
  // localStorage에서 데이터 존재 여부 확인
  React.useEffect(() => {
    const checkDataAvailability = () => {
      const collectedDataStr = localStorage.getItem('tilko_collected_data');
      if (collectedDataStr) {
        try {
          const collectedData = JSON.parse(collectedDataStr);
          const hasHealthData = collectedData.health_data?.ResultList?.length > 0;
          const hasPrescriptionData = collectedData.prescription_data?.ResultList?.length > 0;
          setHasData(hasHealthData || hasPrescriptionData);
        } catch (error) {
          console.error('데이터 확인 실패:', error);
          setHasData(false);
        }
      } else {
        setHasData(false);
      }
    };
    
    checkDataAvailability();
    
    // localStorage 변경 감지
    const handleStorageChange = () => {
      checkDataAvailability();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageChange', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleStorageChange);
    };
  }, []);
  
  // 데이터가 없으면 버튼 숨김
  if (!hasData) {
    return null;
  }

  const handleClick = () => {
    console.log('🧠 [종합분석버튼] 종합 분석 페이지 열기');
    navigate('/comprehensive-analysis');
  };

  return (
    <Button
      className="comprehensive-analysis-button"
      onClick={handleClick}
      variant="primary"
    >
      🧠 분석보기
    </Button>
  );
};

// URL 감지 및 자동 로딩을 위한 내부 컴포넌트
const AppContent: React.FC = () => {
  const { state, actions } = useWelloData();
  const location = useLocation();

  // URL 파라미터 감지하여 자동 데이터 로딩 (한 번만 실행)
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const uuid = urlParams.get('uuid');
    const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');

    if (uuid && hospital) {
      // 현재 환자 데이터가 없거나 다른 환자인 경우에만 로딩
      if (!state.patient || state.patient.uuid !== uuid) {
        // console.log(`🔄 [App] 환자 데이터 로딩: ${uuid} @ ${hospital}`);
        actions.loadPatientData(uuid, hospital); // 처음 로딩 시에는 토스트 없이
      } else {
        // console.log(`✅ [App] 환자 데이터 이미 로드됨: ${state.patient.name} (${uuid})`);
        // 기존 데이터가 있는 경우 레이아웃만 확인하고 토스트 표시하지 않음
        // actions.loadPatientData(uuid, hospital, { force: true }); // 제거
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, state.patient?.uuid]); // actions는 의도적으로 제외 (무한 루프 방지)

  // 개발 환경에서 디버그 정보 출력 (필요시에만 활성화)
  // useEffect(() => {
  //   if (process.env.NODE_ENV === 'development' && state.layoutConfig) {
  //     debugLayoutMapping();
  //   }
  // }, [state.layoutConfig]);

  if (state.isLoading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>데이터를 불러오는 중...</p>
          </div>
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

  // 레이아웃 컴포넌트 선택
  const LayoutComponent = 
    layoutConfig.layoutType === LayoutType.HORIZONTAL ? HorizontalLayout :
    layoutConfig.layoutType === LayoutType.INTRO ? IntroLayout :
    VerticalLayout;

  return (
    <div className="app">
      <div className="main-container">
        <Routes>
          <Route 
            path="/" 
            element={
              <LayoutComponent
                headerImage={layoutConfig.headerImage}
                headerImageAlt={layoutConfig.headerImageAlt}
                headerSlogan={layoutConfig.headerSlogan}
                headerLogoTitle={layoutConfig.headerLogoTitle}
                headerLogoSubtitle={layoutConfig.headerLogoSubtitle}
                headerMainTitle={layoutConfig.headerMainTitle}
              >
                <MainPage />
              </LayoutComponent>
            } 
          />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/collecting" element={<CollectingDataPage />} />
          <Route path="/survey/:surveyId" element={<SurveyPage />} />
          <Route path="/survey/checkup-design" element={<CheckupDesignPage />} />
          <Route path="/survey/health-habits" element={<HealthHabitsPage />} />
          <Route path="/health-questionnaire" element={<HealthQuestionnairePage />} />
          <Route path="/questionnaire-complete" element={<HealthQuestionnaireComplete />} />
          <Route path="/dashboard" element={<HealthDashboard />} />
          <Route path="/trends" element={<HealthTrends />} />
          <Route path="/prescriptions" element={<PrescriptionHistory />} />
          <Route path="/comparison" element={<HealthComparison />} />
          <Route path="/comprehensive-analysis" element={<ComprehensiveAnalysisPage />} />
          <Route path="/results-trend" element={<HealthDataViewer onBack={() => window.history.back()} />} />
          <Route 
            path="/results" 
            element={
              <LayoutComponent
                headerImage={layoutConfig.headerImage}
                headerImageAlt={layoutConfig.headerImageAlt}
                headerSlogan={layoutConfig.headerSlogan}
                headerLogoTitle={layoutConfig.headerLogoTitle}
                headerLogoSubtitle={layoutConfig.headerLogoSubtitle}
                headerMainTitle={layoutConfig.headerMainTitle}
              >
                <MainPage />
              </LayoutComponent>
            } 
          />
        </Routes>
        
        {/* 플로팅 버튼 조건부 렌더링 */}
        {layoutConfig.showFloatingButton && <FloatingButton />}
        
        {/* AI 버튼 조건부 렌더링 */}
        {layoutConfig.showAIButton && <ResultsTrendButton />}
        
        {/* 종합 분석 버튼 조건부 렌더링 */}
        {layoutConfig.showAIButton && <ComprehensiveAnalysisButton />}
      </div>
      
      {/* 알림 컨테이너 */}
      <NotificationContainer />
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