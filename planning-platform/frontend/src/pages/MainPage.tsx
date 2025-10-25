import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/Card';
import { useWelloData } from '../contexts/WelloDataContext';
import { API_ENDPOINTS } from '../config/api';
import { LayoutType } from '../constants/layoutTypes';
import { TILKO_API } from '../constants/api';
import PasswordModal from '../components/PasswordModal';
import SessionStatusModal from '../components/SessionStatusModal';
import { PasswordModalType } from '../components/PasswordModal/types';
import { PASSWORD_POLICY } from '../constants/passwordMessages';
import { PasswordService } from '../components/PasswordModal/PasswordService';
import { PasswordSessionService } from '../services/PasswordSessionService';
import useGlobalSessionDetection from '../hooks/useGlobalSessionDetection';

const MainPage: React.FC = () => {
  const { state } = useWelloData();
  const { layoutConfig, patient, hospital } = state;
  const navigate = useNavigate();
  const location = useLocation();

  // 비밀번호 관련 state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalType, setPasswordModalType] = useState<PasswordModalType>('confirm');
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  
  // 세션 상태 모달 관련 state
  const [showSessionStatusModal, setShowSessionStatusModal] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);

  // 전역 세션 감지 (비밀번호 모달이 열려있을 때는 비활성화)
  useGlobalSessionDetection({ 
    enabled: !showPasswordModal,
    checkInterval: 30000 
  });

  // 비밀번호 세션 정리 (컴포넌트 마운트 시 한 번만)
  useEffect(() => {
    // 기존 전역 세션 데이터 정리 (한 번만 실행)
    PasswordSessionService.cleanupLegacySessions();
    
    // 비밀번호 모달 상태 정리 (MainPage 로드 시 항상 false로 초기화)
    localStorage.removeItem('password_modal_open');
    window.dispatchEvent(new CustomEvent('password-modal-change'));
    
    console.log('🧹 [메인페이지] 비밀번호 세션 및 모달 상태 정리 완료');
  }, []); // 빈 배열로 한 번만 실행

  // 비밀번호 인증 상태 확인 함수 (세션 상태 모달 포함)
  // PasswordSessionService만 사용 (폴백 제거)
  const isPasswordAuthValid = async (uuid?: string, hospitalId?: string): Promise<boolean> => {
    try {
      // 필수 파라미터 검증
      if (!uuid || !hospitalId) {
        console.warn('⚠️ [메인] UUID 또는 hospitalId 누락 - 인증 실패');
        return false;
      }
      
      // 세션 상태 모달 표시
      setShowSessionStatusModal(true);
      
      const sessionResult = await PasswordSessionService.isSessionValid(uuid, hospitalId);
      if (sessionResult.success) {
        // 세션 만료 시간 설정
        if (sessionResult.expiresAt) {
          setSessionExpiresAt(sessionResult.expiresAt);
        }
        
        console.log('✅ [메인] 세션 유효 - 세션 상태 모달 표시');
        return true;
      }
      
      // 세션 무효 시 모달 즉시 닫기
      setShowSessionStatusModal(false);
      console.log('❌ [메인] 세션 무효 - 재인증 필요');
      return false;
      
    } catch (error) {
      // 에러 시 모달 즉시 닫기
      setShowSessionStatusModal(false);
      console.error('❌ [메인] 세션 확인 오류:', error);
      return false;
    }
  };

  // 비밀번호 인증 성공 후 세션 생성
  const setPasswordAuthTime = async (): Promise<void> => {
    // URL 파라미터에서 환자 정보 추출
    const urlParams = new URLSearchParams(location.search);
    const uuid = urlParams.get('uuid');
    const hospitalId = urlParams.get('hospital');
    
    if (!uuid || !hospitalId) {
      console.error('❌ [메인] UUID 또는 hospitalId 누락 - 세션 생성 불가');
      return;
    }
    
    try {
      const success = await PasswordSessionService.createSession(uuid, hospitalId);
      if (success) {
        console.log('✅ [메인] 세션 생성 완료');
      } else {
        console.error('❌ [메인] 세션 생성 실패');
      }
    } catch (error) {
      console.error('❌ [메인] 세션 생성 오류:', error);
    }
  };

  // 데이터 존재 여부 확인
  const checkHasData = async (uuid: string, hospitalId: string): Promise<boolean> => {
    try {
      const response = await fetch(API_ENDPOINTS.CHECK_EXISTING_DATA(uuid, hospitalId));
      if (response.ok) {
        const result = await response.json();
        return result.data && result.data.exists && (result.data.health_data_count > 0 || result.data.prescription_data_count > 0);
      }
    } catch (error) {
      console.warn('⚠️ [데이터확인] 실패:', error);
    }
    return false;
  };

  // 비밀번호 확인 후 네비게이션 처리
  const handlePasswordSuccess = async (type: PasswordModalType) => {
    console.log('✅ [비밀번호] 인증 성공:', type);
    
    // 비밀번호 설정/확인 완료 시
    await setPasswordAuthTime();
    setShowPasswordModal(false);
    
    if (pendingNavigation) {
      console.log('🚀 [네비게이션] 대기 중인 페이지로 이동:', pendingNavigation);
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  // 비밀번호 모달 취소 처리
  const handlePasswordCancel = () => {
    console.log('❌ [비밀번호] 인증 취소');
    
    // 설정 모달에서 "나중에 하기" 선택 시 → 바로 페이지 이동
    if (passwordModalType === 'setup' && pendingNavigation) {
      console.log('🚪 [비밀번호] 설정 거부 - 바로 페이지 이동:', pendingNavigation);
      navigate(pendingNavigation);
    }
    
    setShowPasswordModal(false);
    setPendingNavigation(null);
  };

  // 비밀번호 모달 단순 닫기 (페이지 이동 없음)
  const handlePasswordClose = () => {
    console.log('🚪 [비밀번호] 모달 닫기 - 메인 페이지 유지');
    setShowPasswordModal(false);
    setPendingNavigation(null);
  };

  // 세션 상태 모달 완료 핸들러
  const handleSessionStatusComplete = () => {
    console.log('✅ [세션상태] 모달 완료 - 페이지 이동 진행');
    setShowSessionStatusModal(false);
    
    // 대기 중인 네비게이션이 있으면 실행
    if (pendingNavigation) {
      console.log('🚀 [네비게이션] 세션 확인 완료 후 이동:', pendingNavigation);
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

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
    // URL 파라미터에서 환자 정보 추출
    const urlParams = new URLSearchParams(location.search);
    const uuid = urlParams.get('uuid');
    const hospitalId = urlParams.get('hospital');

    switch (cardType) {
      case 'chart':
        if (uuid && hospitalId) {
          try {
            console.log('🔍 [메인페이지] 기존 데이터 확인 중...', { uuid, hospitalId });
            
            // 기존 데이터 확인
            const hasData = await checkHasData(uuid, hospitalId);
            
            if (hasData) {
              console.log('📊 [메인페이지] 기존 데이터 발견!');
              
              // 먼저 비밀번호 설정 여부 확인
              try {
                const passwordStatus = await PasswordService.checkPasswordStatus(uuid, hospitalId);
                
                if (!passwordStatus.has_password) {
                  // 비밀번호가 없으면 설정 권유 여부 확인
                  console.log('❓ [비밀번호] 설정되지 않음 - 권유 여부 확인');
                  const promptResponse = await PasswordService.checkPromptPasswordSetup(uuid, hospitalId);
                  
                  if (promptResponse.should_prompt) {
                    // 권유해야 하는 경우 - 바로 설정 모드로 진입
                    console.log('💡 [비밀번호] 설정 권유 필요 - 바로 설정 모드');
                    setPendingNavigation(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                    setPasswordModalType('setup');
                    setShowPasswordModal(true);
                    return;
                  } else {
                    // 권유하지 않는 경우 (이미 거부했거나 최근에 물어봄)
                    console.log('⏭️ [비밀번호] 권유 생략 - 바로 이동');
                    navigate(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                    return;
                  }
                }
                
                // 비밀번호가 있으면 세션 기반 인증 상태 확인
                const isValid = await isPasswordAuthValid(uuid, hospitalId);
                if (isValid) {
                  console.log('✅ [비밀번호] 인증 유효 - 바로 이동');
                  navigate(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                  return;
                }
                
                // 비밀번호 확인 필요
                console.log('🔐 [비밀번호] 인증 필요');
                setPendingNavigation(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                setPasswordModalType('confirm');
                setShowPasswordModal(true);
                return;
                
              } catch (error) {
                console.warn('⚠️ [비밀번호확인] 실패:', error);
                // 🔒 보안 강화: API 오류 시에도 비밀번호 모달 표시
                console.log('🔐 [비밀번호] API 오류로 인한 비밀번호 확인 필요');
                setPendingNavigation(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                setPasswordModalType('confirm');
                setShowPasswordModal(true);
                return;
              }
            }
          } catch (error) {
            console.warn('⚠️ [메인페이지] 기존 데이터 확인 실패:', error);
          }
        }
        
        // 기존 데이터가 없거나 확인 실패 시 인증페이지로 이동
        const queryString = location.search;
        const fromPath = location.pathname + location.search + location.hash;
        const loginPath = `/login${queryString}`;
        console.log('🚀 [메인페이지] 인증페이지로 이동:', loginPath);
        navigate(loginPath, { state: { from: fromPath } });
        break;
        
      case 'design':
      case 'habit':
      case 'prediction':
        // 데이터가 있는 사용자는 모든 버튼에서 비밀번호 확인
        if (uuid && hospitalId) {
          try {
            const hasData = await checkHasData(uuid, hospitalId);
            
            if (hasData) {
              // 먼저 비밀번호 설정 여부 확인
              try {
                const passwordStatus = await PasswordService.checkPasswordStatus(uuid, hospitalId);
                
                if (!passwordStatus.has_password) {
                  // 비밀번호가 없으면 설정 권유
                  console.log('❓ [비밀번호] 설정되지 않음 - 설정 권유');
                  const targetPath = cardType === 'design' ? '/survey/checkup-design' :
                                   cardType === 'habit' ? '/survey/health-habits' :
                                   '/survey/disease-prediction';
                  setPendingNavigation(targetPath);
                  setPasswordModalType('prompt');
                  setShowPasswordModal(true);
                  return;
                }
                
                // 비밀번호가 있으면 세션 기반 인증 상태 확인
                const isValid = await isPasswordAuthValid(uuid, hospitalId);
                if (isValid) {
                  console.log('✅ [비밀번호] 인증 유효 - 바로 이동');
                  const targetPath = cardType === 'design' ? '/survey/checkup-design' :
                                   cardType === 'habit' ? '/survey/health-habits' :
                                   '/survey/disease-prediction';
                  navigate(targetPath);
                  return;
                }
                
                // 비밀번호 확인 필요
                console.log('🔐 [비밀번호] 인증 필요');
                const targetPath = cardType === 'design' ? '/survey/checkup-design' :
                                 cardType === 'habit' ? '/survey/health-habits' :
                                 '/survey/disease-prediction';
                setPendingNavigation(targetPath);
                setPasswordModalType('confirm');
                setShowPasswordModal(true);
                return;
                
              } catch (error) {
                console.warn('⚠️ [비밀번호확인] 실패:', error);
                // 에러 시에는 기존 로직대로 진행
                const targetPath = cardType === 'design' ? '/survey/checkup-design' :
                                 cardType === 'habit' ? '/survey/health-habits' :
                                 '/survey/disease-prediction';
                setPendingNavigation(targetPath);
                setPasswordModalType('confirm');
                setShowPasswordModal(true);
                return;
              }
            }
          } catch (error) {
            console.warn('⚠️ [데이터확인] 실패:', error);
          }
        }
        
        // 데이터가 없으면 바로 이동
        const targetPath = cardType === 'design' ? '/survey/checkup-design' :
                          cardType === 'habit' ? '/survey/health-habits' :
                          '/survey/disease-prediction';
        navigate(targetPath);
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

  return (
    <>
      {layoutConfig.layoutType === LayoutType.HORIZONTAL 
        ? renderHorizontalContent()
        : renderVerticalContent()}
      
      {/* 비밀번호 모달 */}
      {showPasswordModal && (() => {
        const urlParams = new URLSearchParams(location.search);
        return (
          <PasswordModal
            isOpen={showPasswordModal}
            onClose={handlePasswordClose}
            onSuccess={handlePasswordSuccess}
            onCancel={handlePasswordCancel}
            type={passwordModalType}
            uuid={urlParams.get('uuid') || ''}
            hospitalId={urlParams.get('hospital') || ''}
            initialMessage="데이터 접근을 위해 비밀번호를 입력해주세요."
          />
        );
      })()}

      {/* 세션 상태 모달 */}
      <SessionStatusModal
        isOpen={showSessionStatusModal}
        sessionExpiresAt={sessionExpiresAt || undefined}
        onComplete={handleSessionStatusComplete}
      />
    </>
  );
};

export default MainPage;