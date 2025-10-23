import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/Card';
import { useWelloData } from '../contexts/WelloDataContext';
import { API_ENDPOINTS } from '../config/api';
import { LayoutType } from '../constants/layoutTypes';
import { TILKO_API } from '../constants/api';

const MainPage: React.FC = () => {
  const { state } = useWelloData();
  const { layoutConfig, patient, hospital } = state;
  const navigate = useNavigate();
  const location = useLocation();

  // 세션 복구 체크 (컴포넌트 마운트 시)
  useEffect(() => {
    const checkAndRecoverSession = async () => {
      try {
        console.log('🔍 [메인페이지] 세션 복구 체크 시작');
        
        // 로컬 스토리지에서 세션 ID 확인
        const savedSessionId = localStorage.getItem('tilko_session_id');
        const savedSessionData = localStorage.getItem('tilko_session_data');
        
        console.log('📋 [메인페이지] localStorage 확인:', {
          sessionId: savedSessionId,
          sessionData: savedSessionData ? 'exists' : 'null'
        });
        
        if (savedSessionId && savedSessionData) {
          const sessionData = JSON.parse(savedSessionData);
          
          // 세션이 5분 이내에 생성된 경우만 복구 (기존 1분에서 5분으로 확장)
          const sessionAge = Date.now() - new Date(sessionData.created_at).getTime();
          const fiveMinutes = 5 * 60 * 1000;
          
          console.log('⏰ [메인페이지] 세션 시간 확인:', {
            sessionAge: Math.floor(sessionAge / 1000) + '초',
            limit: '300초',
            valid: sessionAge < fiveMinutes
          });
          
          if (sessionAge < fiveMinutes) {
            console.log('🔄 [메인페이지] 기존 세션 발견, 상태 확인 중:', savedSessionId);
            
            // 서버에서 세션 상태 확인
            const response = await fetch(TILKO_API.SESSION_STATUS(savedSessionId));
            
            if (response.ok) {
              const result = await response.json();
              
              console.log('📊 [메인페이지] 서버 세션 상태:', result);
              
              if (result.success && result.status && result.status !== 'error') {
                console.log('✅ [메인페이지] 진행 중인 세션 발견:', result.status);
                
                // 인증 관련 상태면 로그인 페이지로 리다이렉트
                if (['auth_pending', 'auth_completed', 'authenticated', 'auth_waiting'].includes(result.status)) {
                  const urlParams = new URLSearchParams(location.search);
                  const uuid = urlParams.get('uuid');
                  const hospital = urlParams.get('hospital');
                  
                  console.log('🎯 [메인페이지] URL 파라미터 확인:', { uuid, hospital });
                  
                  if (uuid && hospital) {
                    console.log('🔄 [메인페이지] 인증 진행 중인 세션 → 로그인 페이지로 리다이렉트');
                    navigate(`/login?uuid=${uuid}&hospital=${hospital}`);
                    return;
                  } else {
                    console.warn('⚠️ [메인페이지] UUID 또는 Hospital 파라미터 누락');
                  }
                } else {
                  console.log('ℹ️ [메인페이지] 인증 관련 상태가 아님:', result.status);
                }
              } else {
                console.log('⚠️ [메인페이지] 세션 상태 응답 오류:', result);
              }
            } else {
              console.error('❌ [메인페이지] 세션 상태 API 호출 실패:', response.status);
            }
          } else {
            console.log('⏰ [메인페이지] 세션이 만료됨 (5분 초과)');
          }
        } else {
          console.log('📭 [메인페이지] 저장된 세션 없음');
        }
      } catch (error) {
        console.error('❌ [메인페이지] 세션 복구 확인 실패:', error);
      }
    };
    
    checkAndRecoverSession();
  }, [navigate, location.search]);

  // 데이터가 없는 경우 로딩 표시
  if (!layoutConfig || !patient || !hospital) {
    return (
      <div className="main-page-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>페이지를 준비하는 중...</p>
        </div>
      </div>
    );
  }

  const handleCardClick = async (cardType: string) => {
    switch (cardType) {
      case 'chart':
        // URL 파라미터에서 환자 정보 추출
        const urlParams = new URLSearchParams(location.search);
        const uuid = urlParams.get('uuid');
        const hospitalId = urlParams.get('hospital');
        
        if (uuid && hospitalId) {
          try {
            console.log('🔍 [메인페이지] 기존 데이터 확인 중...', { uuid, hospitalId });
            
            // 기존 데이터 확인
            const response = await fetch(API_ENDPOINTS.CHECK_EXISTING_DATA(uuid, hospitalId));
            if (response.ok) {
              const result = await response.json();
              console.log('✅ [메인페이지] 기존 데이터 확인 결과:', result);
              
              // 기존 데이터가 있으면 바로 결과 페이지로 이동
              if (result.data && result.data.exists && (result.data.health_data_count > 0 || result.data.prescription_data_count > 0)) {
                console.log('📊 [메인페이지] 기존 데이터 발견! 결과 페이지로 이동');
                navigate(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                return;
              }
            }
          } catch (error) {
            console.warn('⚠️ [메인페이지] 기존 데이터 확인 실패:', error);
          }
        }
        
        // 기존 데이터가 없거나 확인 실패 시 인증페이지로 이동
        const queryString = location.search; // ?uuid=...&hospital=... 형태
        const fromPath = location.pathname + location.search + location.hash;
        const loginPath = `/login${queryString}`;
        console.log('🚀 [메인페이지] 인증페이지로 이동:', loginPath);
        navigate(loginPath, { state: { from: fromPath } });
        break;
      case 'design':
        navigate('/survey/checkup-design');  // 백엔드 연동 설문조사
        break;
      case 'habit':
        navigate('/survey/health-habits');  // 백엔드 연동 설문조사
        break;
      case 'prediction':
        navigate('/survey/disease-prediction');  // 백엔드 연동 설문조사
        break;
      default:
        break;
    }
  };

  // 가로형 레이아웃 컨텐츠
  const renderHorizontalContent = () => (
    <>
      <div className="horizontal-cards">
        <h1 className="horizontal-cards__title">
          {layoutConfig.title.split('\n').map((line, index) => (
            <React.Fragment key={index}>
              {line.includes('님,') ? (
                <>
                  안녕하세요 <span className="patient-name">{line.replace('안녕하세요 ', '').replace('님,', '님')}</span>,
                </>
              ) : (
                line
              )}
              {index < layoutConfig.title.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </h1>
        <div className="horizontal-cards__subtitle">
          {layoutConfig.subtitle.split('\n').map((line, index) => (
            <React.Fragment key={index}>
              {line.includes('에서') ? (
                <>
                  <span className="hospital-name">{line.replace('에서', '')}</span>에서
                </>
              ) : (
                line
              )}
              {index < layoutConfig.subtitle.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
        <div className="swipe-area">
          <div className="cards-horizontal">
            <Card
              type="horizontal"
              icon="chart"
              title="내 검진 결과 추이 보기"
              description="공단검진결과를 이용해서 내 건강 추이를 확인하세요"
              shortcutText="검진결과추이보러 가기"
              onClick={() => handleCardClick('chart')}
            />
            <Card
              type="horizontal"
              icon="design"
              title="올해 검진 항목 설계"
              description="내 검진결과를 이용해서 올해 검진 받으실 항목을 설계해봐요"
              shortcutText="검진 플래닝 서비스 보기"
              onClick={() => handleCardClick('design')}
            />
            <Card
              type="horizontal"
              icon="habit"
              title="검진전 건강습관만들기"
              description="검진데이터로 만드는 나만의 착한 습관을 만들어 보세요"
              shortcutText="14일 플랜 짜기"
              onClick={() => handleCardClick('habit')}
            />
            <Card
              type="horizontal"
              icon="prediction"
              title="질병 예측 리포트 보기"
              description="검진 전 작년 검진결과로 확인하는 질병 예측 리포트"
              shortcutText="질병 예측 리포트 보기"
              onClick={() => handleCardClick('prediction')}
            />
          </div>
          <div className="swipe-area__hint">
            ← {layoutConfig.headerLogoTitle}이 준비한 서비스를 확인해보세요 →
          </div>
        </div>
        
        {/* 가로형 전용 메시지 영역 */}
        <div className="horizontal-message-section">
          <p className="horizontal-message-section__text">
            더 이상 미루지 마세요.<br />
            {layoutConfig.headerLogoTitle} 전문의와 함께 당신의 건강을 체계적으로 관리할 시간입니다.
          </p>
        </div>
      </div>
      <div className="footer-section footer-section--horizontal footer-section--compact">
        <div className="footer-section__info">
          <p>{layoutConfig.hospitalAddress || "서울특별시 강남구 테헤란로 123"}</p>
          <p>문의: {layoutConfig.hospitalPhone || "02-1234-5678"}</p>
        </div>
      </div>
    </>
  );

  // 세로형 레이아웃 컨텐츠
  const renderVerticalContent = () => (
    <>
      <div className="title-section">
        <h1 className="title-section__title">{layoutConfig.title}</h1>
        <div className="title-section__subtitle">
          {layoutConfig.subtitle.split('\n').map((line, index) => (
            <React.Fragment key={index}>
              {line}
              {index < layoutConfig.subtitle.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="cards-section">
        <div className="cards-vertical">
          <Card
            type="vertical"
            icon="chart"
            title="내 검진 결과 추이 보기"
            description="공단검진결과를 이용해서 내 건강 추이를 확인하세요"
            onClick={() => handleCardClick('chart')}
          />
          <Card
            type="vertical"
            icon="design"
            title="올해 검진 항목 설계"
            description="내 검진결과를 이용해서 올해 검진 받으실 항목을 설계해봐요"
            onClick={() => handleCardClick('design')}
          />
          <Card
            type="vertical"
            icon="habit"
            title="검진전 건강습관만들기"
            description="검진데이터로 만드는 나만의 착한 습관을 만들어 보세요"
            onClick={() => handleCardClick('habit')}
          />
          <Card
            type="vertical"
            icon="prediction"
            title="질병 예측 리포트 보기"
            description="검진 전 작년 검진결과로 확인하는 질병 예측 리포트"
            onClick={() => handleCardClick('prediction')}
          />
        </div>
      </div>

      <div className="footer-section">
        <p className="footer-section__text">
          더 이상 미루지 마세요.<br />{layoutConfig.headerLogoTitle} 전문의와 함께 당신의 건강을 체계적으로 관리할 시간입니다.
        </p>
      </div>
    </>
  );

  return layoutConfig.layoutType === LayoutType.HORIZONTAL 
    ? renderHorizontalContent()
    : renderVerticalContent();
};

export default MainPage;