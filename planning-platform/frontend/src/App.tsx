import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
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
import { HealthDataViewer } from './components/health/HealthDataViewer';
import { LayoutType } from './constants/layoutTypes';
import { debugLayoutMapping } from './utils/layoutMapper';
import { WelloDataProvider, useWelloData } from './contexts/WelloDataContext';
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
  
  const handleAuthClick = async () => {
    console.log('🔐 [인증페이지] 틸코 API 인증 시작');
    
    if (!patient) {
      console.error('환자 데이터가 없습니다.');
      alert('환자 정보를 먼저 불러주세요.');
      return;
    }
    
    try {
      // 1단계: 세션 생성
      console.log('📡 [API] 틸코 세션 생성 요청');
      const sessionResponse = await fetch('https://xogxog.com/api/v1/wello/tilko/session/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          private_auth_type: '0', // 카카오톡 인증
          user_name: patient.name,
          birthdate: patient.birthday,
          phone_no: patient.phone.replace(/-/g, ''),
          gender: patient.gender.toLowerCase() === 'male' ? 'M' : 'F'
        })
      });

      if (!sessionResponse.ok) {
        throw new Error('세션 생성 실패');
      }

      const sessionResult = await sessionResponse.json();
      console.log('✅ [API] 세션 생성 성공:', sessionResult);

      if (sessionResult.success) {
        const sessionId = sessionResult.session_id;
        
        // 2단계: 간편인증 요청
        console.log('📡 [API] 카카오 간편인증 요청');
        const authResponse = await fetch(`https://xogxog.com/api/v1/wello/tilko/session/simple-auth?session_id=${sessionId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!authResponse.ok) {
          throw new Error('인증 요청 실패');
        }

        const authResult = await authResponse.json();
        console.log('✅ [API] 카카오 인증 요청 성공:', authResult);
        
        if (authResult.success) {
          alert('카카오톡에서 인증을 진행해주세요.');
          // 여기서 상태 폴링 시작하거나 인증페이지로 이동
        } else {
          throw new Error(authResult.message || '인증 요청 실패');
        }
      } else {
        throw new Error(sessionResult.message || '세션 생성 실패');
      }
    } catch (error) {
      console.error('❌ [API] 틸코 인증 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      alert(`인증 실패: ${errorMessage}`);
    }
  };
  
  const getButtonConfig = () => {
    const path = location.pathname;
    
    if (path === '/login') {
      return {
        text: '인증하고 내 검진 추이 확인하기',
        onClick: handleAuthClick
      };
    }
    
    // 기본 (메인페이지 등)
    return {
      text: '건강검진 예약하기',
      onClick: () => {
        console.log('🎯 [메인페이지] 건강검진 예약 시작');
        if (window.handleKakaoLoginFromFloating) {
          window.handleKakaoLoginFromFloating();
        } else {
          console.warn('카카오 로그인 함수가 등록되지 않았습니다');
        }
      }
    };
  };

  const buttonConfig = getButtonConfig();

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

// URL 감지 및 자동 로딩을 위한 내부 컴포넌트
const AppContent: React.FC = () => {
  const { state, actions } = useWelloData();
  const location = useLocation();

  // URL 파라미터 감지하여 자동 데이터 로딩
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const uuid = urlParams.get('uuid');
    const hospital = urlParams.get('hospital');

    if (uuid && hospital) {
      // 현재 환자 데이터가 없거나 다른 환자인 경우에만 로딩
      if (!state.patient || state.patient.uuid !== uuid) {
        actions.loadPatientData(uuid, hospital);
      }
    }
  }, [location.search, state.patient?.uuid]); // actions 의존성 제거

  // 개발 환경에서 디버그 정보 출력
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && state.layoutConfig) {
      debugLayoutMapping();
    }
  }, [state.layoutConfig]);

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
    headerImage: window.location.hostname === 'localhost' ? "/doctor-image.png" : "/wello/doctor-image.png",
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
          <Route path="/survey/:surveyId" element={<SurveyPage />} />
          <Route path="/survey/checkup-design" element={<CheckupDesignPage />} />
          <Route path="/survey/health-habits" element={<HealthHabitsPage />} />
          <Route path="/health-questionnaire" element={<HealthQuestionnairePage />} />
          <Route path="/questionnaire-complete" element={<HealthQuestionnaireComplete />} />
          <Route path="/results-trend" element={<HealthDataViewer onBack={() => window.history.back()} />} />
        </Routes>
        
        {/* 플로팅 버튼 조건부 렌더링 */}
        {layoutConfig.showFloatingButton && <FloatingButton />}
        
        {/* AI 버튼 조건부 렌더링 */}
        {layoutConfig.showAIButton && <ResultsTrendButton />}
      </div>
      
      {/* 알림 컨테이너 */}
      <NotificationContainer />
    </div>
  );
};

// 메인 App 컴포넌트 (Provider 래핑)
function App() {
  return (
    <Router basename={window.location.hostname === 'localhost' ? '/' : '/wello'}>
      <WelloDataProvider>
        <AppContent />
      </WelloDataProvider>
    </Router>
  );
}

export default App;