import React, { useState, useEffect } from 'react';
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
import { getCurrentLayoutConfig, debugLayoutMapping, type LayoutConfig } from './utils/layoutMapper';
import './App.scss';

// 전역 함수 타입 선언
declare global {
  interface Window {
    handleKakaoLoginFromFloating?: () => void;
  }
}

// 플로팅 버튼 조건부 렌더링을 위한 컴포넌트
const FloatingButtonWrapper: React.FC<{ 
  layoutConfig: LayoutConfig; 
}> = ({ layoutConfig }) => {
  const location = useLocation();
  
  // 로그인 페이지에서는 카카오 인증 버튼 표시
  if (location.pathname === '/login') {
    const handleKakaoAuth = () => {
      // TilkoAuth 컴포넌트의 카카오 인증 함수 호출
      const authButton = document.querySelector('[data-testid="kakao-auth-button"]') as HTMLButtonElement;
      if (authButton) {
        authButton.click();
      }
    };

    return (
      <div className="floating-button">
        <Button onClick={handleKakaoAuth} width="90%">
          건강정보 공단에서 불러오기
        </Button>
      </div>
    );
  }
  
  // 설문조사 페이지에서는 플로팅 버튼 숨김 (Health Connect는 제외)
  const hiddenPaths = ['/checkup-design', '/health-habits', '/health-questionnaire', '/health-questionnaire-complete', '/survey'];
  const shouldHideButton = hiddenPaths.some(path => location.pathname.startsWith(path));
  

  if (!layoutConfig.showFloatingButton || shouldHideButton) {
    return null;
  }
  
  return (
    <div className="floating-button">
      <Button>건강검진 신청하기</Button>
    </div>
  );
};

function App() {
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isMounted = true;
    
    const initializeLayout = async () => {
      try {
        if (!isMounted) return;
        setIsLoading(true);
        
        const config = await getCurrentLayoutConfig();
        
        if (!isMounted) return;
        setLayoutConfig(config);
        
        // 개발 환경에서만 디버그 정보 출력
        if (process.env.NODE_ENV === 'development') {
          await debugLayoutMapping();
        }
      } catch (err) {
        console.error('레이아웃 초기화 오류:', err);
        if (isMounted) {
          setError('레이아웃 설정을 불러오는 중 오류가 발생했습니다. 기본 설정으로 표시됩니다.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeLayout();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // 로딩 중 표시
  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  // 에러 표시
  if (error) {
    return <div className="error">{error}</div>;
  }

  // 레이아웃 설정이 없는 경우
  if (!layoutConfig) {
    return <div className="error">레이아웃 설정을 불러올 수 없습니다.</div>;
  }

  // 레이아웃 컴포넌트 선택
  const LayoutComponent = 
    layoutConfig.layoutType === LayoutType.HORIZONTAL ? HorizontalLayout :
    layoutConfig.layoutType === LayoutType.INTRO ? IntroLayout :
    VerticalLayout;

  return (
    <Router>
      <div className="app">
        <div className="main-container">
          <Routes>
          <Route 
            path="/" 
            element={
              <LayoutComponent
                headerSlogan={layoutConfig.headerSlogan}
                headerLogoTitle={layoutConfig.headerLogoTitle}
                headerLogoSubtitle={layoutConfig.headerLogoSubtitle}
                headerMainTitle={layoutConfig.headerMainTitle}
                headerImage={layoutConfig.headerImage}
                headerImageAlt={layoutConfig.headerImageAlt}
                hideHeader={false}
              >
                       <MainPage 
                         layoutConfig={layoutConfig} 
                       />
              </LayoutComponent>
            } 
          />
                 
                 {/* 백엔드 연동 설문조사 */}
                 <Route path="/survey/:surveyId" element={<SurveyPage />} />
                 
                 {/* 인증 페이지 */}
                 <Route path="/login" element={<AuthPage />} />
                 
                 {/* 기존 페이지들 (하위 호환성) */}
                 <Route path="/checkup-design" element={<CheckupDesignPage />} />
                 <Route path="/health-habits" element={<HealthHabitsPage />} />
                 <Route path="/health-questionnaire" element={<HealthQuestionnairePage />} />
                 <Route path="/health-questionnaire-complete" element={<HealthQuestionnaireComplete />} />
          <Route 
            path="/results-trend" 
            element={
              <LayoutComponent
                headerSlogan={layoutConfig.headerSlogan}
                headerLogoTitle={layoutConfig.headerLogoTitle}
                headerLogoSubtitle={layoutConfig.headerLogoSubtitle}
                headerMainTitle="검진 결과 추이"
                headerImage={layoutConfig.headerImage}
                headerImageAlt={layoutConfig.headerImageAlt}
                hideHeader={false}
              >
                <HealthDataViewer onBack={() => window.history.back()} />
              </LayoutComponent>
            } 
          />
          <Route 
            path="/disease-prediction" 
            element={
              <div className="simple-page">
                <h1>질병 예측 리포트</h1>
                <p>AI 질병 예측 분석 결과가 여기에 표시됩니다.</p>
              </div>
            } 
          />
          </Routes>

          <FloatingButtonWrapper 
            layoutConfig={layoutConfig} 
          />
        </div>
      </div>
    </Router>
  );
}

export default App;