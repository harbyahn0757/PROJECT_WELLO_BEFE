import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/Card';
import { useWelloData } from '../contexts/WelloDataContext';
import { API_ENDPOINTS } from '../config/api';
import PasswordModal from '../components/PasswordModal';
import SessionStatusModal from '../components/SessionStatusModal';
import { PasswordModalType } from '../components/PasswordModal/types';
import { PASSWORD_POLICY } from '../constants/passwordMessages';
import { PasswordService } from '../components/PasswordModal/PasswordService';
import { PasswordSessionService } from '../services/PasswordSessionService';
import useGlobalSessionDetection from '../hooks/useGlobalSessionDetection';
import { getHospitalLogoUrl } from '../utils/hospitalLogoUtils';
// 카드 이미지 import
import trendsChartImage from '../assets/images/main/chart.png';
import healthHabitImage from '../assets/images/main/check_1 1.png';
import checkupDesignImage from '../assets/images/main/check_2 1.png';
import './MainPage.scss';

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

  // 페이지 처음 로드 시 상단으로 스크롤
  useEffect(() => {
    // 컴포넌트 마운트 시 상단으로 스크롤
    window.scrollTo(0, 0);
    
    // 약간의 지연 후 다시 확인 (레이아웃 렌더링 완료 후)
    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [location.search]); // URL 파라미터 변경 시에도 실행

  // 스크롤 이벤트 처리: 하단 스크롤 시 버튼과 카드 겹침 방지
  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollBottom = scrollTop + windowHeight;
      
      // 하단 근처에서 스크롤 시 (버튼 높이 + 여백 고려)
      const buttonHeight = 56; // 플로팅 버튼 높이
      const buttonBottomMargin = 12; // 버튼 하단 여백 (0.75rem)
      const safeMargin = 20; // 추가 안전 여백
      const threshold = buttonHeight + buttonBottomMargin + safeMargin;
      
      // 스크롤이 거의 끝에 도달했을 때
      if (scrollBottom >= documentHeight - threshold) {
        // 마지막 카드와 버튼 사이 여백 확보를 위해 약간 위로 스크롤
        const targetScroll = documentHeight - windowHeight - threshold;
        if (targetScroll > 0 && Math.abs(scrollTop - targetScroll) > 5) {
          window.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
          });
        }
      }
    };

    // 스크롤 이벤트 리스너 추가 (throttle 적용)
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
    };
  }, []);

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
        
        // 기존 데이터가 없거나 확인 실패 시 문진 페이지로 이동
        const queryString = location.search;
        const questionnairePath = `/health-questionnaire${queryString}`;
        console.log('📋 [메인페이지] 데이터 없음 - 문진 페이지로 이동:', questionnairePath);
        navigate(questionnairePath);
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
                const targetPath = cardType === 'design' ? '/checkup-recommendations' :
                                 cardType === 'habit' ? '/survey/health-habits' :
                                 '/survey/disease-prediction';
                setPendingNavigation(targetPath);
                setPasswordModalType('confirm');
                setShowPasswordModal(true);
                return;
                
              } catch (error) {
                console.warn('⚠️ [비밀번호확인] 실패:', error);
                // 에러 시에는 기존 로직대로 진행
                const targetPath = cardType === 'design' ? '/checkup-recommendations' :
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

  // 최신 검진 일자 가져오기
  const getLatestCheckupDate = (): string => {
    try {
      const storedData = localStorage.getItem('wello_health_data');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        const healthCheckups = parsedData.health_data?.ResultList || [];
        if (healthCheckups.length > 0) {
          const latest = healthCheckups[0];
          const year = (latest.Year || latest.year || '').toString().replace('년', '').slice(-2);
          const date = latest.CheckUpDate || latest.checkup_date || '';
          if (date && year) {
            // "09/28" -> "24.09.28" 형태로 변환
            const [month, day] = date.split('/');
            return `${year}.${month}.${day}`;
          }
        }
      }
    } catch (error) {
      console.warn('검진 일자 가져오기 실패:', error);
    }
    return '';
  };

  const latestCheckupDate = getLatestCheckupDate();

  // 통합 레이아웃 컨텐츠 (이미지 디자인 반영)
  const renderUnifiedContent = () => (
    <>
      {/* 헤더 + 인사말 섹션 (하나의 영역) */}
      <div className="main-page__header-greeting-section">
        {/* 헤더 (로고만 표시) */}
        <div className="main-page__header">
          <div className="main-page__header-logo">
            <img 
              src={getHospitalLogoUrl(hospital)} 
              alt={`${hospital.name} 로고`}
              className="main-page__header-logo-image"
              onError={(e) => {
                // 이미지 로드 실패 시 기본 W 아이콘으로 대체
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const iconElement = target.nextElementSibling as HTMLElement;
                if (iconElement) {
                  iconElement.style.display = 'flex';
                }
              }}
            />
            <div className="main-page__header-logo-icon" style={{ display: 'none' }}>W</div>
          </div>
        </div>

        {/* 환자 인사말 (왼쪽 정렬, 정확한 줄바꿈) */}
        <div className="main-page__greeting">
          <h1 className="main-page__greeting-title">
            <span className="greeting-text">안녕하세요</span> <span className="patient-name">{patient.name}</span><span className="greeting-text">님,</span>
          </h1>
          <p className="main-page__greeting-subtitle">
            <span className="hospital-name">{hospital.name}</span> <span className="hospital-suffix">입니다.</span>
          </p>
          <p className="main-page__greeting-message">
            <span className="hospital-name">{hospital.name}</span><span className="greeting-text">에서</span><br />
            <span className="greeting-text-thin">더 의미있는 내원이 되시길 바라며</span><br />
            <span className="greeting-text-thin">준비한 건강관리 서비스를 확인해보세요!</span>
          </p>
        </div>

        {/* 첫 번째 카드 (인사말 섹션 안에 포함) */}
        <div className="main-page__primary-card-wrapper">
          <div 
            className="main-page__card main-page__card--primary"
            onClick={() => handleCardClick('chart')}
          >
            <div className="main-page__card-main-row">
              <div className="main-page__card-icon main-page__card-icon--brown">
                <svg className="main-page__card-icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
              <div className="main-page__card-content">
                <h3 className="main-page__card-title main-page__card-title--brown">건강검진 결과지 다시보기</h3>
                <p className="main-page__card-description">
                  {latestCheckupDate ? `건강 검진 일자 : ${latestCheckupDate}` : '건강 검진 일자 확인'}
                </p>
              </div>
              <div className="main-page__card-arrow-bottom">
                <svg className="main-page__card-arrow-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 나머지 카드 섹션 (별도 영역 - 흰색 배경) */}
      <div className="main-page__secondary-cards-section">
        <div className="main-page__cards">
          <Card
            type="vertical"
            icon="chart"
            title="검진 결과 추이"
            description="공단검진결과를 이용해서
내 건강 추이를 확인하세요"
            onClick={() => handleCardClick('chart')}
            imageUrl={trendsChartImage}
            imageAlt="검진 결과 추이 그래프"
          />
          <Card
            type="vertical"
            icon="habit"
            title="건강습관 만들기"
            description="건강검진결과로 만드는
나만의 착한 습관을 만들어보세요"
            onClick={() => handleCardClick('habit')}
            imageUrl={healthHabitImage}
            imageAlt="건강습관 만들기"
          />
          <Card
            type="vertical"
            icon="design"
            title="검진항목 설계하기"
            description="내 검진결과를 이용해서
올해 건강검진 항목을 설계해보세요"
            onClick={() => handleCardClick('design')}
            imageUrl={checkupDesignImage}
            imageAlt="검진항목 설계하기"
          />
          <Card
            type="vertical"
            icon="prediction"
            title="질병예측 리포트 보기"
            description="AI 기반 건강 데이터 분석으로\n질병 예측 리포트를 확인하세요"
            onClick={() => handleCardClick('prediction')}
            imageUrl={trendsChartImage}
            imageAlt="질병예측 리포트"
          />
        </div>
      </div>

    </>
  );

  return (
    <div className="main-page">
      {renderUnifiedContent()}
      
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
    </div>
  );
};

export default MainPage;