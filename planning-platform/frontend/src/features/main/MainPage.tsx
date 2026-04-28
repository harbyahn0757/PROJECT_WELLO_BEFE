import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../../components/Card';
import { useWelnoData } from '../../contexts/WelnoDataContext';
import { API_ENDPOINTS } from '../../config/api';
import apiConfig from '../../config/api';
import PasswordModal from '../../components/PasswordModal';
import SessionStatusModal from '../../components/SessionStatusModal';
import MdxDataSearchModal from '../../components/MdxDataSearchModal';
import PartnerAuthConfirmModal from '../../components/PartnerAuthConfirmModal';
import IndexedDBClearModal from '../../components/common/IndexedDBClearModal';
// import ComingSoonModal from '../../components/common/ComingSoonModal';
import PageTransitionLoader from '../../components/PageTransitionLoader';
import { PasswordModalType } from '../../components/PasswordModal/types';
import { PASSWORD_POLICY } from '../../constants/passwordMessages';
import { PasswordService } from '../../components/PasswordModal/PasswordService';
import { PasswordSessionService } from '../../services/PasswordSessionService';
import useGlobalSessionDetection from '../../hooks/useGlobalSessionDetection';
import { getHospitalLogoUrl } from '../../utils/hospitalLogoUtils';
import { WelnoIndexedDB } from '../../services/WelnoIndexedDB';
import IntroTeaser from '../../components/intro/IntroTeaser';
import { STORAGE_KEYS, StorageManager } from '../../constants/storage';
import { WELNO_LOGO_IMAGE } from '../../constants/images';
import { WelnoRagChatButton } from '../../components/welno-rag-chat';
import checkupDesignService from '../../services/checkupDesignService';
// 카드 이미지 import
import trendsChartImage from '../../assets/images/main/chart.png';
import healthHabitImage from '../../assets/images/main/check_1 1.png';
import checkupDesignImage from '../../assets/images/main/check_2 1.png';
import reportImage from '../../assets/images/main/rpt.png';
import './MainPage.scss';

const MainPage: React.FC = () => {
  const { state, actions } = useWelnoData();
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
  
  // MDX 데이터 검색 모달 관련 state
  const [showMdxSearchModal, setShowMdxSearchModal] = useState(false);
  
  // 파트너 인증 확인 모달 관련 state
  const [showPartnerAuthModal, setShowPartnerAuthModal] = useState(false);
  const [pendingPartnerAuthPayload, setPendingPartnerAuthPayload] = useState<{
    api_key: string;
    mkt_uuid?: string;
    name?: string;
    birthday?: string;
    redirect_url: string;
  } | null>(null);
  const [pendingPartnerAuthEndpoint, setPendingPartnerAuthEndpoint] = useState<string>('');
  
  // 페이지 전환 로딩 state
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState<string | undefined>(undefined);
  
  // 인트로 티저 state
  const [showIntroTeaser, setShowIntroTeaser] = useState(false);
  
  // 준비중 모달 state
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  
  // IndexedDB 삭제 모달 state
  const [showIndexedDBClearModal, setShowIndexedDBClearModal] = useState(false);
  
  // 카드 순차 깜빡임 효과 state (아래 4개 카드만)
  const [cardFlashStates, setCardFlashStates] = useState({
    chart: false,   // 검진 결과 추이
    habit: false,   // 착한습관 만들기
    design: false,  // 검진항목 설계하기
    prediction: false // 질병예측 리포트
  });
  const cardFlashExecutedRef = useRef(false); // 한번만 실행되도록 플래그
  
  // 오른쪽 상단 3번 클릭 기능
  const topRightClickCount = useRef(0);
  const topRightClickTimer = useRef<NodeJS.Timeout | null>(null);
  
  // 로고 5번 클릭 기능
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<NodeJS.Timeout | null>(null);
  
  // MDX 데이터 검색 핸들러
  const handleMdxSearchConfirm = async () => {
    const urlParams = new URLSearchParams(location.search);
    const uuid = urlParams.get('uuid');
    const hospitalId = urlParams.get('hospital');
    
    if (!patient || !uuid || !hospitalId) {
      console.warn('[MDX 검색] 환자 정보 부족');
      setShowMdxSearchModal(false);
      navigate(`/health-questionnaire${location.search}`);
      return;
    }
    
    try {
      console.log('[MDX 검색] 시작:', {
        phoneno: patient.phone,
        birthday: patient.birthday,
        name: patient.name
      });
      
      // MDX 데이터 검색 API 호출
      const birthdayStr = patient.birthday ? patient.birthday.replace(/-/g, '') : '';
      const response = await fetch(
        API_ENDPOINTS.MDX_SYNC.GET_MDX_PATIENTS(
          patient.phone || '',
          birthdayStr,
          patient.name || ''
        )
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('[MDX 검색] 결과:', result);
        
        if (result.data && result.data.length > 0) {
          // MDX 데이터 발견 → 동기화 처리 (추후 구현)
          console.log('[MDX 검색] 데이터 발견:', result.data.length, '건');
          // TODO: MDX 데이터를 welno로 동기화하는 로직 추가
          alert(`MDX 데이터 ${result.data.length}건을 찾았습니다. 동기화 기능은 추후 구현 예정입니다.`);
        } else {
          console.log('[MDX 검색] 데이터 없음');
          alert('MDX 데이터베이스에서도 검진 정보를 찾을 수 없습니다.');
        }
      } else {
        console.warn('[MDX 검색] API 오류:', response.status);
        alert('MDX 데이터 검색 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('[MDX 검색] 실패:', error);
      alert('MDX 데이터 검색 중 오류가 발생했습니다.');
    } finally {
      setShowMdxSearchModal(false);
      // MDX 데이터가 없으면 Tilko 인증으로 이동
      navigate(`/health-questionnaire${location.search}`);
    }
  };
  
  const handleMdxSearchCancel = () => {
    console.log('[MDX 검색] 취소');
    setShowMdxSearchModal(false);
    // Tilko 인증으로 이동
    navigate(`/welno/health-questionnaire${location.search}`);
  };
  
  // 파트너 인증 확인 모달 핸들러
  // 파트너 인증 API 호출 함수 (공통 로직)
  const callPartnerAuthAPI = async (payload: {
    api_key: string;
    mkt_uuid?: string;
    name?: string;
    birthday?: string;
    redirect_url: string;
    return_url?: string;
  }, endpoint: string) => {
    try {
      // 파트너 인증 API 호출
      console.log('[질병예측리포트] 파트너 인증 API 호출 시작:', { endpoint, payload: { ...payload, api_key: '***' } });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        redirect: 'follow' // 리다이렉트 자동 따라가기
      });
      
      console.log('[질병예측리포트] API 응답 상태:', response.status, response.statusText);
      console.log('[질병예측리포트] 응답 헤더:', Object.fromEntries(response.headers.entries()));
      
      // JSON 응답 처리 (서버가 JSON으로 변경됨)
      if (response.ok) {
        let result;
        try {
          result = await response.json();
          console.log('[질병예측리포트] 서버 응답 (JSON):', result);
        } catch (jsonError) {
          const textResponse = await response.text();
          console.error('[질병예측리포트] JSON 파싱 실패, 텍스트 응답:', textResponse.substring(0, 500));
          alert('서버 응답 형식 오류가 발생했습니다. 관리자에게 문의해주세요.');
          return;
        }
        
        if (result.redirect_url) {
          console.log('[질병예측리포트] 파트너 인증 성공');
          console.log('[질병예측리포트] 리다이렉트 URL:', result.redirect_url);
          console.log('[질병예측리포트] 리다이렉트 실행 중...');
          
          // 페이지 이동
          try {
            window.location.href = result.redirect_url;
          } catch (redirectError) {
            console.error('[질병예측리포트] 리다이렉트 실행 오류:', redirectError);
            // 폴백: 새 창으로 열기
            window.open(result.redirect_url, '_blank');
          }
        } else {
          console.warn('[질병예측리포트] 리다이렉트 URL 없음, 전체 응답:', result);
          alert('질병예측 리포트 접속에 실패했습니다. 리다이렉트 URL을 받지 못했습니다.\n응답: ' + JSON.stringify(result).substring(0, 200));
        }
      } else {
        // 에러 응답 처리
        let errorMessage = '질병예측 리포트 접속에 실패했습니다.';
        let errorDetails = '';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
          errorDetails = JSON.stringify(errorData);
          console.error('[질병예측리포트] 서버 에러 응답:', errorData);
        } catch (e) {
          // JSON 파싱 실패 시 텍스트로 읽기
          try {
            const errorText = await response.text();
            errorDetails = errorText.substring(0, 500);
            console.error('[질병예측리포트] 서버 에러 텍스트:', errorText);
          } catch (textError) {
            console.error('[질병예측리포트] 에러 응답 읽기 실패:', textError);
          }
          
          // 상태 코드에 따른 메시지
          if (response.status === 400) {
            errorMessage = '필수 파라미터가 누락되었습니다. (api_key 필수)';
          } else if (response.status === 401) {
            errorMessage = '유효하지 않은 API Key입니다.';
          } else if (response.status === 404) {
            errorMessage = '파트너 계정을 찾을 수 없습니다. 시스템 관리자에게 문의하세요.';
          } else if (response.status === 500) {
            errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
          }
        }
        
        console.error(`[질병예측리포트] 파트너 인증 실패 (${response.status}):`, errorMessage, errorDetails);
        alert(`${errorMessage}\n\n상세: ${errorDetails || '없음'}`);
      }
    } catch (error) {
      console.error('[질병예측리포트] 파트너 인증 오류:', error);
      console.error('[질병예측리포트] 에러 상세:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      alert(`질병예측 리포트 접속 중 오류가 발생했습니다.\n\n에러: ${error instanceof Error ? error.message : String(error)}\n\n네트워크 연결을 확인해주세요.`);
    }
  };

  const handlePartnerAuthConfirm = async () => {
    if (!pendingPartnerAuthPayload || !pendingPartnerAuthEndpoint) {
      console.warn('[파트너인증] 페이로드 또는 엔드포인트 없음');
      setShowPartnerAuthModal(false);
      return;
    }
    
    const payload = pendingPartnerAuthPayload;
    const endpoint = pendingPartnerAuthEndpoint;
    
    setShowPartnerAuthModal(false);
    
    await callPartnerAuthAPI(payload, endpoint);
    
    // 페이로드 정리
    setPendingPartnerAuthPayload(null);
    setPendingPartnerAuthEndpoint('');
  };
  
  const handlePartnerAuthCancel = () => {
    console.log('[파트너인증] 취소');
    setShowPartnerAuthModal(false);
    setPendingPartnerAuthPayload(null);
    setPendingPartnerAuthEndpoint('');
  };

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
    
    console.log('[메인페이지] 비밀번호 세션 및 모달 상태 정리 완료');
  }, []); // 빈 배열로 한 번만 실행

  // 인트로 티저 표시 여부 확인 (처음 접근 유저만)
  useEffect(() => {
    // 로컬스토리지에 인트로 티저 표시 여부 확인
    const introTeaserShown = StorageManager.getItem<string>(STORAGE_KEYS.INTRO_TEASER_SHOWN);
    
    // 로컬스토리지가 전혀 없는 유저인지 확인
    // (tilko_session_id, welno_terms_agreed 등 핵심 키가 모두 없는 경우)
    const hasAnyStorage = 
      localStorage.getItem(STORAGE_KEYS.TILKO_SESSION_ID) ||
      localStorage.getItem('welno_terms_agreed') ||
      localStorage.getItem('welno_health_data');
    
    // 인트로 티저를 본 적이 없고, 로컬스토리지도 없는 경우에만 표시
    if (!introTeaserShown && !hasAnyStorage) {
      console.log('[인트로티저] 처음 접근 유저 - 티저 표시');
      setShowIntroTeaser(true);
    } else {
      console.log('[인트로티저] 이미 본 유저 또는 기존 유저 - 티저 표시 안 함');
    }
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // 인트로 티저 닫기 핸들러
  const handleIntroTeaserClose = () => {
    setShowIntroTeaser(false);
  };

  // 인트로 티저 다시보지 않기 핸들러
  const handleIntroTeaserDontShowAgain = () => {
    StorageManager.setItem(STORAGE_KEYS.INTRO_TEASER_SHOWN, 'true');
    console.log('[인트로티저] 다시보지 않기 설정 완료');
  };

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

  // URL 파라미터 기반 초기 데이터 로드 (이름과 병원명 표시를 위해)
  useEffect(() => {
    const loadInitialData = async () => {
      const urlParams = new URLSearchParams(location.search);
      const uuid = urlParams.get('uuid');
      const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');
      
      // URL 파라미터가 있고, 현재 Context에 데이터가 없으면 로드
      if (uuid && hospital && (!patient || !patient.uuid || patient.uuid !== uuid)) {
        console.log('[메인페이지] URL 파라미터 기반 초기 데이터 로드:', { uuid, hospital });
        // P0 #1: URL uuid 진입 시 localStorage 저장 (재진입을 위해 영속화)
        StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, uuid);
        StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, hospital);
        try {
          await actions.loadPatientData(uuid, hospital);
        } catch (error) {
          console.warn('[메인페이지] 초기 데이터 로드 실패:', error);
        }
      } else if (!uuid && !hospital) {
        // URL 파라미터가 없으면 localStorage에서 확인 (하위 호환: 레거시 키도 확인)
        const savedUuid = StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID) || localStorage.getItem('tilko_patient_uuid');
        const savedHospitalId = StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID) || localStorage.getItem('tilko_hospital_id');
        
        // 레거시 키에서 읽었으면 새 키로 마이그레이션
        if (savedUuid && !StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID)) {
          StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, savedUuid);
        }
        if (savedHospitalId && !StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID)) {
          StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, savedHospitalId);
        }
        
        if (savedUuid && savedHospitalId && (!patient || !patient.uuid || patient.uuid !== savedUuid)) {
          console.log('[메인페이지] localStorage 기반 초기 데이터 로드:', { uuid: savedUuid, hospital: savedHospitalId });
          try {
            await actions.loadPatientData(savedUuid, savedHospitalId);
          } catch (error) {
            console.warn('[메인페이지] localStorage 기반 초기 데이터 로드 실패:', error);
          }
        }
      }
    };
    
    loadInitialData();
  }, [location.search, patient?.uuid, actions]); // URL 파라미터와 patient 상태 변경 시 실행

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

    window.addEventListener('scroll', throttledHandleScroll, { passive: true, capture: false });
    
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
        console.warn('[메인] UUID 또는 hospitalId 누락 - 인증 실패');
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
        
        console.log('[메인] 세션 유효 - 세션 상태 모달 표시');
        return true;
      }
      
      // 세션 무효 시 모달 즉시 닫기
      setShowSessionStatusModal(false);
      console.log('[메인] 세션 무효 - 재인증 필요');
      return false;
      
    } catch (error) {
      // 에러 시 모달 즉시 닫기
      setShowSessionStatusModal(false);
      console.error('[메인] 세션 확인 오류:', error);
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
      console.error('[메인] UUID 또는 hospitalId 누락 - 세션 생성 불가');
      return;
    }
    
    try {
      const success = await PasswordSessionService.createSession(uuid, hospitalId);
      if (success) {
        console.log('[메인] 세션 생성 완료');
      } else {
        console.error('[메인] 세션 생성 실패');
      }
    } catch (error) {
      console.error('[메인] 세션 생성 오류:', error);
    }
  };

  // 데이터 존재 여부 확인 (건강검진 데이터만 체크 - 검진결과추이용)
  const checkHasData = async (uuid: string, hospitalId: string): Promise<boolean> => {
    try {
      // 1순위: IndexedDB 확인 (로컬 데이터 우선)
      try {
        const { WelnoIndexedDB } = await import('../../services/WelnoIndexedDB');
        const indexedData = await WelnoIndexedDB.getHealthData(uuid);
        if (indexedData && indexedData.healthData && indexedData.healthData.length > 0) {
          console.log('[데이터확인] IndexedDB에서 데이터 발견:', {
            healthDataCount: indexedData.healthData.length,
            prescriptionDataCount: indexedData.prescriptionData?.length || 0
          });
          return true;
        }
      } catch (indexedError) {
        console.warn('[데이터확인] IndexedDB 확인 실패:', indexedError);
      }
      
      // 2순위: 서버 DB 확인
      const response = await fetch(API_ENDPOINTS.CHECK_EXISTING_DATA(uuid, hospitalId));
      if (response.ok) {
        const result = await response.json();
        // 검진결과추이는 건강검진 데이터만 체크 (처방전 데이터는 제외)
        const hasServerData = result.data && result.data.exists && result.data.health_data_count > 0;
        if (hasServerData) {
          console.log('[데이터확인] 서버 DB에서 데이터 발견:', {
            healthDataCount: result.data.health_data_count,
            prescriptionDataCount: result.data.prescription_data_count || 0
          });
        }
        return hasServerData;
      }
    } catch (error) {
      console.warn('[데이터확인] 실패:', error);
    }
    return false;
  };

  // 비밀번호 확인 후 네비게이션 처리
  const handlePasswordSuccess = async (type: PasswordModalType) => {
    console.log('[비밀번호] 인증 성공:', type);
    
    // 비밀번호 설정/확인 완료 시
    await setPasswordAuthTime();
    setShowPasswordModal(false);
    
    if (pendingNavigation) {
      console.log('[네비게이션] 대기 중인 페이지로 이동:', pendingNavigation);
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  // 비밀번호 모달 취소 처리
  const handlePasswordCancel = () => {
    console.log('[비밀번호] 인증 취소');
    
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
    console.log('[세션상태] 모달 완료 - 페이지 이동 진행');
    setShowSessionStatusModal(false);
    
    // 대기 중인 네비게이션이 있으면 실행
    if (pendingNavigation) {
      console.log('[네비게이션] 세션 확인 완료 후 이동:', pendingNavigation);
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  // 기본 레이아웃 및 병원 정보 설정 (파라미터 없을 때도 기본 페이지 표시)
  const defaultLayoutConfig = layoutConfig || {
    layoutType: 'vertical' as const,
    showAIButton: false,
    showFloatingButton: true,
    title: 'WELNO 건강검진 플랫폼',
    subtitle: '건강한 내일을 위한 첫걸음을 시작하세요.',
    headerMainTitle: '',
    headerImage: "/welno/doctor-image.png",
    headerImageAlt: "의사가 정면으로 청진기를 들고 있는 전문적인 의료 배경 이미지",
    headerSlogan: "행복한 건강생활의 평생 동반자",
    headerLogoTitle: "WELNO",
    headerLogoSubtitle: "",
    hospitalName: 'WELNO',
    brandColor: '#4b5563',
    logoPosition: 'center',
  };

  const defaultHospital: typeof hospital = hospital || {
    hospital_id: '',
    name: '건강검진센터',
    phone: '',
    address: '',
    supported_checkup_types: [],
    layout_type: 'vertical',
    brand_color: '#4b5563',
    logo_position: 'center',
    is_active: true,
  };

  const defaultPatient: typeof patient = patient || {
    uuid: '',
    name: '고객',
    age: 0,
    phone: '',
    birthday: '',
    hospital_id: '',
    last_checkup_count: 0,
    created_at: '',
    gender: 'male' as const,
  };

  // 파라미터가 없을 때는 기본 정보로 페이지 표시 (로딩 화면 대신)
  const displayLayoutConfig = layoutConfig || defaultLayoutConfig;
  const displayHospital = hospital || defaultHospital;
  const displayPatient = patient || defaultPatient;

  // 도메인별 인사말 구분
  const hostname = window.location.hostname;
  const isKindHabitDomain = hostname.includes('kindhabit.com');
  const isWelnoDomain = hostname === 'welno.kindhabit.com' || hostname === 'localhost' || hostname === '127.0.0.1';

  // 카드 순차 깜빡임 효과 (한번만 실행, 아래 4개 카드의 이미지만)
  useEffect(() => {
    if (displayPatient && displayPatient.name && !cardFlashExecutedRef.current) {
      cardFlashExecutedRef.current = true; // 실행 플래그 설정
      
      // 첫 번째 카드 (검진 결과 추이) - 2초 후
      setTimeout(() => {
        setCardFlashStates(prev => ({ ...prev, chart: true }));
        setTimeout(() => {
          setCardFlashStates(prev => ({ ...prev, chart: false }));
        }, 400);
      }, 2000);

      // 두 번째 카드 (착한습관 만들기) - 2.5초 후
      setTimeout(() => {
        setCardFlashStates(prev => ({ ...prev, habit: true }));
        setTimeout(() => {
          setCardFlashStates(prev => ({ ...prev, habit: false }));
        }, 400);
      }, 2500);

      // 세 번째 카드 (검진항목 설계하기) - 3초 후
      setTimeout(() => {
        setCardFlashStates(prev => ({ ...prev, design: true }));
        setTimeout(() => {
          setCardFlashStates(prev => ({ ...prev, design: false }));
        }, 400);
      }, 3000);

      // 네 번째 카드 (질병예측 리포트) - 3.5초 후
      setTimeout(() => {
        setCardFlashStates(prev => ({ ...prev, prediction: true }));
        setTimeout(() => {
          setCardFlashStates(prev => ({ ...prev, prediction: false }));
        }, 400);
      }, 3500);
    }
  }, [displayPatient]);


  const handleCardClick = async (cardType: string) => {
    // URL 파라미터에서 환자 정보 추출
    const urlParams = new URLSearchParams(location.search);
    let uuid = urlParams.get('uuid');
    let hospitalId = urlParams.get('hospital');
    const queryString = location.search; // 함수 전체에서 사용할 queryString

    // 페이지 전환 로딩 시작
    setIsPageTransitioning(true);
    console.log('[페이지전환] 로딩 시작');
    
    // 로딩이 화면에 확실히 표시되도록 충분한 시간 대기 (더 길게)
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      switch (cardType) {
      case 'chart': {
        // Context에서 환자 데이터 확인 (Context가 IndexedDB를 자동으로 조회)
        if (patient && patient.uuid && patient.hospital_id) {
          uuid = patient.uuid;
          hospitalId = patient.hospital_id;
          console.log('[검진결과추이] Context에서 데이터 발견:', { uuid, hospitalId });
        } else if (uuid && hospitalId) {
          // URL 파라미터가 있으면 Context 로드 시도
          console.log('[검진결과추이] URL 파라미터로 데이터 로드 시도:', { uuid, hospitalId });
          try {
            await actions.loadPatientData(uuid, hospitalId);
          } catch (loadError) {
            console.warn('[검진결과추이] 데이터 로드 실패:', loadError);
          }
        } else {
          // localStorage에서 확인 (재접속 시, 하위 호환: 레거시 키도 확인)
          const savedUuid = StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID) || localStorage.getItem('tilko_patient_uuid');
          const savedHospitalId = StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID) || localStorage.getItem('tilko_hospital_id');
          
          // 레거시 키에서 읽었으면 새 키로 마이그레이션
          if (savedUuid && !StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID)) {
            StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, savedUuid);
          }
          if (savedHospitalId && !StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID)) {
            StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, savedHospitalId);
          }
          
          if (savedUuid && savedHospitalId) {
            console.log('[검진결과추이] localStorage에서 데이터 발견:', { uuid: savedUuid, hospitalId: savedHospitalId });
            uuid = savedUuid;
            hospitalId = savedHospitalId;
            
            // Context 로드 시도
            try {
              await actions.loadPatientData(uuid, hospitalId);
            } catch (loadError) {
              console.warn('[검진결과추이] localStorage 데이터 로드 실패:', loadError);
            }
          } else {
            // 데이터 없음 - 인증 페이지로 이동
            console.log('[검진결과추이] 데이터 없음 - Tilko 인증으로 이동');
            
            // 환자 이름 확인 (고객인지 체크)
            const patientName = patient?.name || displayPatient.name || '고객';
            const isCustomer = patientName === '고객';
            
            // 스피너 메시지 설정
            if (isCustomer) {
              setTransitionMessage('건강보험 공단에서 고객님의 데이터를 받기 위해\n인증을 진행합니다 😄');
            } else {
              setTransitionMessage('검진 결과를 불러오는 중입니다...');
            }
            
            // URL 파라미터에 from=chart 추가 (AuthForm에서 메시지 표시용)
            const authQuery = isCustomer ? `${queryString ? queryString + '&' : '?'}from=chart&customer=true` : queryString;
            
            // 2.5초 후 페이지 이동 (스피너를 조금 더 길게 표시)
            setTimeout(() => {
              const authPath = `/login${authQuery}`;
              navigate(authPath);
              setIsPageTransitioning(false);
            }, 2500);
            return;
          }
        }
        
        if (uuid && hospitalId) {
          try {
            console.log('[메인페이지] 기존 데이터 확인 중...', { uuid, hospitalId });
            
            // 기존 데이터 확인
            const hasData = await checkHasData(uuid, hospitalId);
            
            if (hasData) {
              console.log('[메인페이지] 웰노 데이터 발견!');
              
              // 먼저 비밀번호 설정 여부 확인
              try {
                const passwordStatus = await PasswordService.checkPasswordStatus(uuid, hospitalId);
                
                if (!passwordStatus.has_password) {
                  // 비밀번호가 없으면 설정 권유 여부 확인
                  console.log('[비밀번호] 설정되지 않음 - 권유 여부 확인');
                  const promptResponse = await PasswordService.checkPromptPasswordSetup(uuid, hospitalId);
                  
                  if (promptResponse.should_prompt) {
                    // 권유해야 하는 경우 - 바로 설정 모드로 진입
                    console.log('[비밀번호] 설정 권유 필요 - 바로 설정 모드');
                    setIsPageTransitioning(false); // 로딩 스피너 숨김
                    setPendingNavigation(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                    setPasswordModalType('setup');
                    setShowPasswordModal(true);
                    return;
                  } else {
                    // 권유하지 않는 경우 (이미 거부했거나 최근에 물어봄)
                    console.log('[비밀번호] 권유 생략 - 바로 이동');
                    // 스피너 메시지 설정
                    setTransitionMessage('검진 결과를 불러오는 중입니다...');
                    // 로딩이 보이도록 충분한 시간 후 navigate (스피너를 조금 더 길게 표시)
                    setTimeout(() => {
                      navigate(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                      setIsPageTransitioning(false);
                    }, 2500);
                    return;
                  }
                }
                
                // 비밀번호가 있으면 세션 기반 인증 상태 확인
                const isValid = await isPasswordAuthValid(uuid, hospitalId);
                if (isValid) {
                  console.log('[비밀번호] 인증 유효 - 바로 이동');
                  // 스피너 메시지 설정
                  setTransitionMessage('검진 결과를 불러오는 중입니다...');
                  // 로딩이 보이도록 충분한 시간 후 navigate (스피너를 조금 더 길게 표시)
                  setTimeout(() => {
                    navigate(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                    setIsPageTransitioning(false);
                  }, 2500);
                  return;
                }
                
                // IndexedDB에서 비밀번호 인증 캐시 확인 (10분 이내)
                try {
                  const cachedAuth = await WelnoIndexedDB.getPasswordAuth(uuid, hospitalId);
                  if (cachedAuth) {
                    console.log('[비밀번호] IndexedDB 캐시 인증 유효 - 바로 이동');
                    // 스피너 메시지 설정
                    setTransitionMessage('검진 결과를 불러오는 중입니다...');
                    // 스피너를 조금 더 길게 표시
                    setTimeout(() => {
                      navigate(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                      setIsPageTransitioning(false);
                    }, 2500);
                    return;
                  }
                } catch (error) {
                  console.warn('[비밀번호] IndexedDB 확인 실패 (무시):', error);
                  // IndexedDB 확인 실패해도 기존 로직 진행
                }
                
                // 비밀번호 확인 필요 - 모달 표시하므로 로딩 숨김
                console.log('[비밀번호] 인증 필요');
                setIsPageTransitioning(false);
                setPendingNavigation(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                setPasswordModalType('confirm');
                setShowPasswordModal(true);
                return;
                
              } catch (error) {
                console.warn('[비밀번호확인] 실패:', error);
                // 🔒 보안 강화: API 오류 시에도 비밀번호 모달 표시
                console.log('[비밀번호] API 오류로 인한 비밀번호 확인 필요');
                setPendingNavigation(`/results-trend?uuid=${uuid}&hospital=${hospitalId}`);
                setPasswordModalType('confirm');
                setShowPasswordModal(true);
                return;
              }
            } else {
              // 웰노 데이터 없음 → Tilko 인증으로 이동
              console.log('[메인페이지] 웰노 데이터 없음 - Tilko 인증으로 이동');
              
              // MDX 데이터 검색 모달은 나중에 사용할 예정이므로 주석처리
              // const IS_DEVELOPMENT = window.location.hostname !== 'xogxog.com';
              // 
              // if (IS_DEVELOPMENT && patient) {
              //   // 개발 모드에서만 MDX 검색 다이얼로그 표시
              //   console.log('[메인페이지] 개발 모드 - MDX 검색 다이얼로그 표시');
              //   setIsPageTransitioning(false);
              //   setShowMdxSearchModal(true);
              //   return;
              // }
              
              // 데이터 없을 때 바로 Tilko 인증으로 이동 (/login 경로 사용)
              const authPath = `/login${queryString}`;
              console.log('[메인페이지] 데이터 없음 - Tilko 인증으로 이동:', authPath);
              setIsPageTransitioning(false); // 로딩 스피너 숨김
              setTimeout(() => {
                navigate(authPath);
              }, 300);
              return;
            }
          } catch (error) {
            console.warn('[메인페이지] 기존 데이터 확인 실패:', error);
            // 에러 발생 시에도 리다이렉트하지 않고 현재 페이지에 유지
            setIsPageTransitioning(false); // 로딩 스피너만 숨김
            // 사용자에게 에러 메시지 표시하지 않고 조용히 실패 처리
            return; // 에러 발생 시 더 이상 진행하지 않음
          }
        }
        
        // 웰노 데이터 없을 때 Tilko 인증으로 이동 (fallback - 위에서 이미 처리되지만 안전장치)
        // 하지만 에러가 발생한 경우에는 여기까지 오지 않음
        const authPath = `/login${queryString}`;
        console.log('[메인페이지] 데이터 없음 - Tilko 인증으로 이동 (fallback):', authPath);
        setIsPageTransitioning(false);
        setTimeout(() => {
          navigate(authPath);
        }, 300);
        break;
      }
        
      case 'design': {
        // 검진항목 설계하기는 건강 데이터 확인 후 처리
        // Context에서 환자 데이터 확인 (검진결과추이와 동일한 로직)
        if (patient && patient.uuid && patient.hospital_id) {
          uuid = patient.uuid;
          hospitalId = patient.hospital_id;
          console.log('[검진설계] Context에서 데이터 발견:', { uuid, hospitalId });
        } else if (uuid && hospitalId) {
          // URL 파라미터가 있으면 Context 로드 시도
          console.log('[검진설계] URL 파라미터로 데이터 로드 시도:', { uuid, hospitalId });
          try {
            await actions.loadPatientData(uuid, hospitalId);
          } catch (loadError) {
            console.warn('[검진설계] 데이터 로드 실패:', loadError);
          }
        } else {
          // localStorage에서 확인 (재접속 시, 하위 호환: 레거시 키도 확인)
          const savedUuid = StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID) || localStorage.getItem('tilko_patient_uuid');
          const savedHospitalId = StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID) || localStorage.getItem('tilko_hospital_id');
          
          // 레거시 키에서 읽었으면 새 키로 마이그레이션
          if (savedUuid && !StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID)) {
            StorageManager.setItem(STORAGE_KEYS.PATIENT_UUID, savedUuid);
          }
          if (savedHospitalId && !StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID)) {
            StorageManager.setItem(STORAGE_KEYS.HOSPITAL_ID, savedHospitalId);
          }
          
          if (savedUuid && savedHospitalId) {
            console.log('[검진설계] localStorage에서 데이터 발견:', { uuid: savedUuid, hospitalId: savedHospitalId });
            uuid = savedUuid;
            hospitalId = savedHospitalId;
            
            // Context 로드 시도
            try {
              await actions.loadPatientData(uuid, hospitalId);
            } catch (loadError) {
              console.warn('[검진설계] localStorage 데이터 로드 실패:', loadError);
            }
          }
        }
        
        if (uuid && hospitalId) {
          try {
            console.log('[검진설계] 기존 데이터 확인 중...', { uuid, hospitalId });
            
            // 1. 먼저 기존 설계 결과가 있는지 확인
            try {
              const designResult = await checkupDesignService.getLatestCheckupDesign(uuid, hospitalId);
              if (designResult.success && designResult.data) {
                console.log('[검진설계] 기존 설계 결과 발견 - 결과 페이지로 바로 이동');
                const designQueryString = `?uuid=${uuid}&hospital=${hospitalId}`;
                setTimeout(() => {
                  navigate(`/recommendations${designQueryString}`, {
                    state: {
                      checkupDesign: designResult.data,
                      fromExisting: true
                    }
                  });
                }, 300);
                setIsPageTransitioning(false);
                return;
              }
            } catch (designError) {
              console.log('[검진설계] 기존 설계 결과 확인 실패 (계속 진행):', designError);
              // 설계 결과 확인 실패해도 계속 진행 (처음 설계하는 경우일 수 있음)
            }
            
            // 2. 기존 설계 결과가 없으면 건강 데이터 확인
            const hasData = await checkHasData(uuid, hospitalId);
            
            if (hasData) {
              console.log('[검진설계] 웰노 데이터 발견! - 설계 페이지로 이동');
              // 데이터가 있으면 설계 페이지로 이동 (queryString에 uuid와 hospital 포함)
              const designQueryString = `?uuid=${uuid}&hospital=${hospitalId}`;
              setTimeout(() => {
                navigate(`/checkup-design${designQueryString}`);
              }, 300);
              return;
            } else {
              // 웰노 데이터 없음 → 메시지 표시 후 Tilko 인증으로 이동
              console.log('[검진설계] 웰노 데이터 없음 - 메시지 표시 후 Tilko 인증으로 이동');
              
              // 메시지와 함께 스피너 표시 (3초간)
              const message = '건강검진 데이터 기반의 검진설계를 위하여\n공단에서 데이터를 수집하는 화면으로 이동합니다';
              setTransitionMessage(message);
              
              // 3초 후 틸코로 이동
              setTimeout(() => {
                setIsPageTransitioning(false); // 로딩 스피너 숨김
                setTransitionMessage(undefined); // 메시지 제거
                const authPath = `/login${queryString}`;
                console.log('[검진설계] 데이터 없음 - Tilko 인증으로 이동:', authPath);
                setTimeout(() => {
                  navigate(authPath);
                }, 300);
              }, 3000); // 3초 대기
              
              return; // 여기서 종료 (메시지 표시 중)
            }
          } catch (error) {
            console.warn('[검진설계] 기존 데이터 확인 실패:', error);
            // 에러 발생 시에도 Tilko 인증으로 이동
            setIsPageTransitioning(false);
            setTimeout(() => {
              navigate(`/login${queryString}`);
            }, 300);
            return;
          }
        }
        
        // UUID나 hospitalId가 없으면 Tilko 인증으로 이동
        console.log('[검진설계] 환자 정보 없음 - Tilko 인증으로 이동');
        const authPath = `/login${queryString || ''}`;
        setIsPageTransitioning(false);
        setTimeout(() => {
          navigate(authPath);
        }, 300);
        break;
      }
        
      case 'prediction': {
        // ⭐⭐⭐ 매트릭스 통합: 통합 상태 API 호출 후 redirect_url 기반 이동
        try {
          console.log('[질병예측리포트] 매트릭스 통합 체크 시작');
          
          // 우선순위: 1) URL 파라미터 2) WelnoDataContext 3) StorageManager
          const urlParams = new URLSearchParams(location.search);
          let patientUuid = urlParams.get('uuid') || patient?.uuid || StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID);
          let hospitalId = urlParams.get('hospital') || urlParams.get('hospitalId') || patient?.hospital_id || StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID);
          
          // 1. 환자 정보 없으면 틸코 인증 필요
          if (!patientUuid || !hospitalId) {
            console.log('[질병예측리포트] 환자 정보 없음 → 틸코 인증 필요');
            
            // 스피너 메시지 표시
            setTransitionMessage('상세한 분석을 위해\n본인 인증 후 공단 데이터를 가져와 분석할게요 😄');
            
            // 1.5초 후 페이지 이동
            setTimeout(() => {
              navigate('/login?redirect=/disease-report');
              setIsPageTransitioning(false);
            }, 1500);
            return;
          }
          
          console.log('[질병예측리포트] 환자 정보 확인:', { uuid: patientUuid, hospitalId });
          
          // 2. 통합 상태 API 호출
          console.log('[질병예측리포트] 통합 상태 조회 중...');
          const statusRes = await fetch(`/api/v1/welno/user-status?uuid=${patientUuid}&hospital_id=${hospitalId}`);
          const statusData = await statusRes.json();
          
          if (!statusData.success) {
            console.error('[질병예측리포트] 통합 상태 조회 실패:', statusData);
            setIsPageTransitioning(false);
            return;
          }
          
          console.log('[질병예측리포트] 통합 상태:', statusData);
          
          // 3. 상태별 처리
          const { status, redirect_url } = statusData;
          
          // REPORT_READY → 바로 리포트 페이지
          if (status === 'REPORT_READY') {
            console.log('[질병예측리포트] ✅ 리포트 준비됨 → 바로 표시');
            navigate(`/disease-report?uuid=${patientUuid}&hospital=${hospitalId}`);
            setIsPageTransitioning(false);
            return;
          }
          
          // REPORT_PENDING → 생성 중 페이지
          if (status === 'REPORT_PENDING') {
            console.log('[질병예측리포트] ⏳ 리포트 생성 중 → 대기 페이지');
            navigate(`/disease-report?uuid=${patientUuid}&hospital=${hospitalId}`);
            setIsPageTransitioning(false);
            return;
          }
          
          // REPORT_EXPIRED → 만료 페이지
          if (status === 'REPORT_EXPIRED') {
            console.log('[질병예측리포트] ⚠️ 리포트 만료 → 재생성 페이지');
            navigate(`/disease-report?uuid=${patientUuid}&hospital=${hospitalId}`);
            setIsPageTransitioning(false);
            return;
          }
          
          // TERMS_REQUIRED* → 약관 페이지
          if (status.startsWith('TERMS_REQUIRED')) {
            console.log('[질병예측리포트] 📝 약관 동의 필요 → 약관 페이지');
            
            // 스피너 메시지 표시
            setTransitionMessage('서비스 이용을 위해\n약관 동의가 필요해요 🙏');
            
            // 1.5초 후 페이지 이동
            setTimeout(() => {
              navigate(`/campaigns/disease-prediction?page=terms&uuid=${patientUuid}`);
              setIsPageTransitioning(false);
            }, 1500);
            return;
          }
          
          // PAYMENT_REQUIRED → 결제 페이지
          if (status === 'PAYMENT_REQUIRED') {
            console.log('[질병예측리포트] 💳 결제 필요 → 결제 페이지');
            
            // 스피너 메시지 표시
            setTransitionMessage('리포트 생성을 위해\n결제가 필요해요 😊');
            
            // 1.5초 후 페이지 이동
            setTimeout(() => {
              navigate(`/campaigns/disease-prediction?page=payment&uuid=${patientUuid}`);
              setIsPageTransitioning(false);
            }, 1500);
            return;
          }
          
          // ACTION_REQUIRED* → 데이터 수집 필요
          if (status === 'ACTION_REQUIRED' || status === 'ACTION_REQUIRED_PAID') {
            console.log('[질병예측리포트] 🔍 데이터 수집 필요 → 틸코 인증');
            
            // 스피너 메시지 표시
            setTransitionMessage('상세한 분석을 위해\n건강검진 데이터를 수집할게요 💊');
            
            // 1.5초 후 페이지 이동
            setTimeout(() => {
              navigate('/login?redirect=/disease-report');
              setIsPageTransitioning(false);
            }, 1500);
            return;
          }
          
          // 기타 상태 → 기본 에러
          console.error('[질병예측리포트] 알 수 없는 상태:', status);
          setIsPageTransitioning(false);
          
        } catch (error) {
          console.error('[질병예측리포트] 데이터 체크 오류:', error);
          setIsPageTransitioning(false);
        }
        
        /* ⚠️ 기존 내부 데이터 체크 로직 (주석처리)
        // 데이터 체크 순서: Mediarc 리포트 → 검진 데이터 → 틸코 인증
        try {
          console.log('[질병예측리포트] 데이터 체크 시작');
          
          // 우선순위: 1) URL 파라미터 2) WelnoDataContext 3) StorageManager
          const urlParams = new URLSearchParams(location.search);
          let patientUuid = urlParams.get('uuid') || patient?.uuid || StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID);
          let hospitalId = urlParams.get('hospital') || urlParams.get('hospitalId') || patient?.hospital_id || StorageManager.getItem(STORAGE_KEYS.HOSPITAL_ID);
          
          // 출처 확인
          let source = 'Unknown';
          if (urlParams.get('uuid')) {
            source = 'URL';
          } else if (patient?.uuid) {
            source = 'Context';
          } else if (StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID)) {
            source = 'Storage';
          }
          
          // 1. 환자 정보 없으면 틸코 인증 필요
          if (!patientUuid || !hospitalId) {
            console.log('[질병예측리포트] 환자 정보 없음 → 틸코 인증 필요');
            alert('먼저 본인 인증을 진행해주세요.');
            navigate('/login?redirect=/disease-report');
            setIsPageTransitioning(false);
            return;
          }
          
          console.log('[질병예측리포트] 환자 정보 확인:', { 
            uuid: patientUuid, 
            hospitalId, 
            source,
            urlUuid: urlParams.get('uuid'),
            contextUuid: patient?.uuid,
            storageUuid: StorageManager.getItem(STORAGE_KEYS.PATIENT_UUID)
          });
          
          // 2. Mediarc 리포트 존재 여부 확인
          console.log('[질병예측리포트] Mediarc 리포트 조회 중...');
          const reportRes = await fetch(`/api/v1/welno/mediarc-report?uuid=${patientUuid}&hospital_id=${hospitalId}`);
          const reportData = await reportRes.json();
          
          if (reportData.success && reportData.has_report) {
            console.log('[질병예측리포트] Mediarc 리포트 있음 → 바로 표시');
            navigate(`/disease-report?uuid=${patientUuid}&hospital=${hospitalId}`);
            setIsPageTransitioning(false);
            return;
          }
          
          console.log('[질병예측리포트] Mediarc 리포트 없음 → 검진 데이터 확인');
          
          // 3. 검진 데이터 확인
          const healthRes = await fetch(API_ENDPOINTS.HEALTH_DATA(patientUuid, hospitalId));
          
          // 404 또는 기타 에러 처리
          if (!healthRes.ok) {
            const errorData = await healthRes.json().catch(() => ({ detail: '데이터 조회 실패' }));
            console.log('[질병예측리포트] 검진 데이터 조회 실패:', errorData);
            // 검진 데이터도 없음 → 틸코 인증 필요
            alert('건강 데이터가 없습니다. 먼저 건강검진 데이터를 수집해주세요.');
            navigate('/login?redirect=/disease-report');
            setIsPageTransitioning(false);
            return;
          }
          
          const healthData = await healthRes.json();
          console.log('[질병예측리포트] 검진 데이터 응답:', healthData);
          
          if (healthData.success && healthData.data?.health_data && healthData.data.health_data.length > 0) {
            console.log('[질병예측리포트] 검진 데이터 있음 → Mediarc 생성 페이지로 이동');
            // 검진 데이터는 있지만 Mediarc 리포트가 없음 → 생성 필요
            navigate(`/disease-report?uuid=${patientUuid}&hospital=${hospitalId}&generate=true`);
            setIsPageTransitioning(false);
            return;
          }
          
          // 4. 검진 데이터도 없음 → 틸코 인증 필요
          console.log('[질병예측리포트] 검진 데이터 없음 → 틸코 인증 필요');
          alert('건강 데이터가 없습니다. 먼저 건강검진 데이터를 수집해주세요.');
          navigate('/login?redirect=/disease-report');
          setIsPageTransitioning(false);
          
        } catch (error) {
          console.error('[질병예측리포트] 데이터 체크 오류:', error);
          setIsPageTransitioning(false);
          alert('질병예측 리포트 확인 중 오류가 발생했습니다.');
        }
        */
        
        /* ⚠️ 기존 파트너 인증 API 로직 (주석처리)
        // 질병예측 리포트 보기는 파트너 인증 API를 거쳐 캠페인 페이지로 이동
        // mkt_uuid는 선택사항 (없으면 새 사용자로 등록)
        try {
          // 환경 설정 가져오기
          const CAMPAIGN_REDIRECT_URL = apiConfig.CAMPAIGN_REDIRECT_URL;
          const WELNO_PARTNER_API_KEY = apiConfig.WELNO_PARTNER_API_KEY;
          const IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          
          // 환자 정보 가져오기
          const patientName = patient?.name || urlParams.get('name') || '';
          const patientBirthdayRaw = 
            patient?.birthday || 
            state.patient?.birthday ||
            urlParams.get('birthday') || 
            '';
          
          // 생년월일을 YYYYMMDD 형식으로 변환 (YYYY-MM-DD -> YYYYMMDD)
          let patientBirthday = '';
          if (patientBirthdayRaw) {
            patientBirthday = patientBirthdayRaw.replace(/-/g, '');
          }
          
          // API 요청 페이로드 구성 (mkt_uuid는 선택사항)
          const requestPayload: {
            api_key: string;
            mkt_uuid?: string;
            name?: string;
            birthday?: string;
            redirect_url: string;
            return_url?: string;
          } = {
            api_key: WELNO_PARTNER_API_KEY,
            redirect_url: CAMPAIGN_REDIRECT_URL
          };
          
          // mkt_uuid가 있으면 추가 (없으면 새 사용자로 처리)
          if (uuid) {
            requestPayload.mkt_uuid = uuid;
          }
          
          // name이 있으면 추가 (새 사용자 등록 시 필수)
          if (patientName) {
            requestPayload.name = patientName;
          }
          
          // birthday가 있으면 추가 (새 사용자 등록 시 권장)
          if (patientBirthday) {
            requestPayload.birthday = patientBirthday;
          }
          
          // return_url 추가: 리포트에서 뒤로가기 시 현재 페이지로 복귀
          const currentUrl = window.location.href;
          requestPayload.return_url = currentUrl;
          
          // 개발/프로덕션 모두 모달 없이 바로 호출 (페이지 변경)
          console.log('[질병예측리포트] 파트너 인증 API 호출 시작');
          setIsPageTransitioning(false); // 로딩 스피너 숨김
          await callPartnerAuthAPI(requestPayload, API_ENDPOINTS.PARTNER_AUTH);
        } catch (error) {
          console.error('[질병예측리포트] 파트너 인증 오류:', error);
          setIsPageTransitioning(false);
          alert('질병예측 리포트 접속 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
        }
        */
        break;
      }
        
      case 'habit': {
        // 준비중 모달 표시
        console.log('[착한습관만들기] 준비중 모달 표시');
        setIsPageTransitioning(false);
        setShowComingSoonModal(true);
        break;
      }
        
      default: {
        break;
      }
      }
    } catch (error) {
      console.error('[카드클릭] 오류:', error);
      setIsPageTransitioning(false);
    }
  };

  // 최신 검진 일자 가져오기
  const getLatestCheckupDate = (): string => {
    try {
      const storedData = localStorage.getItem('welno_health_data');
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

  // 오른쪽 상단 클릭 핸들러 (3번 클릭 시 건강데이터 삭제)
  const handleTopRightClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    // 클릭 위치가 오른쪽 상단 영역인지 확인 (화면 너비의 상단 20%, 오른쪽 20%)
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const isTopRight = clickX > rect.width * 0.8 && clickY < rect.height * 0.2;

    if (!isTopRight) {
      return;
    }

    // 기존 타이머 초기화
    if (topRightClickTimer.current) {
      clearTimeout(topRightClickTimer.current);
    }

    topRightClickCount.current += 1;

    // 2초 내에 3번 클릭했는지 확인
    if (topRightClickCount.current >= 3) {
      topRightClickCount.current = 0;
      
      // 건강데이터 삭제 확인
      if (window.confirm('모든 건강데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        try {
          // 백엔드 데이터베이스 삭제
          if (patient?.uuid && hospital?.hospital_id) {
            const deleteResponse = await fetch(
              API_ENDPOINTS.DELETE_HEALTH_DATA(patient.uuid, hospital.hospital_id),
              {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!deleteResponse.ok) {
              throw new Error('백엔드 데이터 삭제 실패');
            }

            const deleteResult = await deleteResponse.json();
            console.log('[데이터삭제] 백엔드 삭제 완료:', deleteResult);
          }

          // IndexedDB 데이터 삭제
          await WelnoIndexedDB.clearAllData();
          
          // localStorage의 건강데이터 관련 항목 삭제
          const keysToRemove = [
            'welno_health_data',
            'welno_view_mode',
            'tilko_session_id',
            'tilko_session_data'
          ];
          keysToRemove.forEach(key => {
            localStorage.removeItem(key);
          });
          
          // UUID별로 구분된 약관 동의 키 삭제
          if (patient?.uuid) {
            const termsKey = `welno_terms_agreed_${patient.uuid}`;
            const termsAtKey = `welno_terms_agreed_at_${patient.uuid}`;
            const termsListKey = `welno_terms_agreed_list_${patient.uuid}`;
            const termsAgreementKey = `welno_terms_agreement_${patient.uuid}`;
            
            localStorage.removeItem(termsKey);
            localStorage.removeItem(termsAtKey);
            localStorage.removeItem(termsListKey);
            localStorage.removeItem(termsAgreementKey);
            
            console.log('[데이터삭제] UUID별 약관 동의 키 삭제 완료:', patient.uuid);
          }
          
          // 기존 전역 약관 동의 키도 삭제 (하위 호환성)
          localStorage.removeItem('welno_terms_agreed');
          localStorage.removeItem('welno_terms_agreed_at');
          localStorage.removeItem('welno_terms_agreed_list');
          localStorage.removeItem('welno_terms_agreement');

          // 세션 데이터 삭제
          if (patient?.uuid && hospital?.hospital_id) {
            PasswordSessionService.clearSession(patient.uuid, hospital.hospital_id);
          }

          alert('건강데이터가 삭제되었습니다.');
          
          // 페이지 새로고침
          window.location.reload();
        } catch (error) {
          console.error('건강데이터 삭제 실패:', error);
          alert('건강데이터 삭제 중 오류가 발생했습니다.');
        }
      } else {
        topRightClickCount.current = 0;
      }
    } else {
      // 2초 후 카운터 리셋
      topRightClickTimer.current = setTimeout(() => {
        topRightClickCount.current = 0;
      }, 2000);
    }
  };

  // 로고 5번 클릭 핸들러
  const handleLogoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // 헤더 클릭 이벤트와 분리
    
    // 기존 타이머 초기화
    if (logoClickTimer.current) {
      clearTimeout(logoClickTimer.current);
    }
    
    logoClickCount.current += 1;
    
    // 2초 내에 5번 클릭했는지 확인
    if (logoClickCount.current >= 5) {
      logoClickCount.current = 0;
      setShowIndexedDBClearModal(true);
    } else {
      // 2초 후 카운터 리셋
      logoClickTimer.current = setTimeout(() => {
        logoClickCount.current = 0;
      }, 2000);
    }
  };

  // IndexedDB 완전 삭제 확인 핸들러 (자동 복구 방지)
  const handleIndexedDBClearConfirm = async () => {
    try {
      console.log('🗑️ [완전 삭제] 모든 Welno 데이터 삭제 시작 (서버 + 로컬)...');
      
      // 0. 서버 데이터 삭제 (제일 먼저)
      const uuid = patient?.uuid;
      const hospitalId = hospital?.hospital_id;
      
      if (uuid && hospitalId) {
        try {
          console.log('🌐 [서버 삭제] 서버 데이터 삭제 시작...');
          const API_BASE_URL = apiConfig.API_BASE_URL;
          const response = await fetch(
            `${API_BASE_URL}/welno-data/patient-health-data?uuid=${uuid}&hospital_id=${hospitalId}`,
            {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ [서버 삭제] 서버 데이터 삭제 완료:', result);
          } else {
            console.warn('⚠️ [서버 삭제] 서버 데이터 삭제 실패 (무시하고 계속 진행):', response.status);
          }
        } catch (serverError) {
          console.warn('⚠️ [서버 삭제] 서버 통신 오류 (무시하고 계속 진행):', serverError);
        }
      } else {
        console.log('ℹ️ [서버 삭제] uuid 또는 hospital_id 없음, 서버 삭제 건너뜀');
      }
      
      // 1. localStorage 완전 정리 (모든 welno/tilko 관련 키)
      const localStorageKeys = Object.keys(localStorage);
      const welnoKeys = localStorageKeys.filter(key => 
        key.toLowerCase().includes('welno') || 
        key.toLowerCase().includes('tilko') ||
        key.toLowerCase().includes('patient') ||
        key.toLowerCase().includes('hospital') ||
        key.toLowerCase().includes('uuid') ||
        key.toLowerCase().includes('password') ||
        key.toLowerCase().includes('session') ||
        key.toLowerCase().includes('cache')
      );
      
      console.log(`📋 발견된 localStorage 키: ${welnoKeys.length}개`);
      welnoKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`✅ localStorage 삭제: ${key}`);
      });
      
      // 2. sessionStorage 완전 정리
      const sessionStorageKeys = Object.keys(sessionStorage);
      const welnoSessionKeys = sessionStorageKeys.filter(key => 
        key.toLowerCase().includes('welno') || 
        key.toLowerCase().includes('tilko') ||
        key.toLowerCase().includes('patient') ||
        key.toLowerCase().includes('hospital') ||
        key.toLowerCase().includes('uuid')
      );
      
      console.log(`📋 발견된 sessionStorage 키: ${welnoSessionKeys.length}개`);
      welnoSessionKeys.forEach(key => {
        sessionStorage.removeItem(key);
        console.log(`✅ sessionStorage 삭제: ${key}`);
      });
      
      // 3. IndexedDB 완전 삭제 (모든 스토어)
      const DB_NAME = 'WelnoHealthDB';
      const STORES = ['health_data', 'session_data'];
      
      try {
        // 먼저 clearAllData로 모든 데이터 삭제
        await WelnoIndexedDB.clearAllData();
        console.log('[IndexedDB] clearAllData 완료');
        
        // 데이터베이스 자체 삭제 시도 (완전 제거)
        await new Promise<void>((resolve, reject) => {
          const deleteReq = indexedDB.deleteDatabase(DB_NAME);
          deleteReq.onsuccess = () => {
            console.log(`✅ IndexedDB 데이터베이스 삭제 완료: ${DB_NAME}`);
            resolve();
          };
          deleteReq.onerror = () => {
            console.warn(`⚠️ IndexedDB 데이터베이스 삭제 실패 (무시 가능):`, deleteReq.error);
            // 삭제 실패해도 계속 진행
            resolve();
          };
          deleteReq.onblocked = () => {
            console.warn(`⚠️ IndexedDB 삭제 차단됨 (다른 탭에서 사용 중일 수 있음)`);
            // 차단되어도 계속 진행
            resolve();
          };
        });
      } catch (indexedError) {
        console.warn('[IndexedDB] 삭제 중 오류 (무시 가능):', indexedError);
      }
      
      // 4. WelnoDataContext 캐시 클리어
      if (actions.clearCache) {
        actions.clearCache();
        console.log('[완전 삭제] WelnoDataContext 캐시 클리어 완료');
      }
      
      // 5. 비밀번호 세션 삭제
      if (patient?.uuid && hospital?.hospital_id) {
        try {
          await PasswordSessionService.clearSession(patient.uuid, hospital.hospital_id);
          console.log('[완전 삭제] 비밀번호 세션 삭제 완료');
        } catch (sessionError) {
          console.warn('[완전 삭제] 비밀번호 세션 삭제 실패 (무시 가능):', sessionError);
        }
      }
      
      // 6. 쿠키 삭제 (모든 welno 관련 쿠키)
      try {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
          const cookieName = cookie.split('=')[0].trim();
          if (cookieName.toLowerCase().includes('welno') || 
              cookieName.toLowerCase().includes('tilko') ||
              cookieName.toLowerCase().includes('session')) {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            console.log(`✅ 쿠키 삭제: ${cookieName}`);
          }
        }
        console.log('[완전 삭제] 쿠키 삭제 완료');
      } catch (cookieError) {
        console.warn('[완전 삭제] 쿠키 삭제 실패 (무시 가능):', cookieError);
      }
      
      setShowIndexedDBClearModal(false);
      console.log('\n✅ [완전 삭제] 모든 데이터 삭제 완료 (서버 + 로컬)!');
      alert('서버와 로컬의 모든 데이터가 완전히 삭제되었습니다.\n페이지를 새로고침합니다.');
      
      // 페이지 새로고침
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('❌ [완전 삭제] 오류:', error);
      alert('데이터 삭제 중 오류가 발생했습니다.');
      setShowIndexedDBClearModal(false);
    }
  };

  // IndexedDB 삭제 취소 핸들러
  const handleIndexedDBClearCancel = () => {
    setShowIndexedDBClearModal(false);
    logoClickCount.current = 0;
  };

  // 통합 레이아웃 컨텐츠 (이미지 디자인 반영)
  const renderUnifiedContent = () => (
    <>
      {/* 헤더 + 인사말 섹션 (하나의 영역) */}
      <div 
        className="main-page__header-greeting-section"
        onClick={handleTopRightClick}
        style={{ cursor: 'default' }}
      >
        {/* 헤더 (로고만 표시) */}
        <div className="main-page__header">
          <div className="main-page__header-logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
            {/* 카인드해빗 도메인이면 전용 로고 표시, 아니면 기존 로직 유지 */}
            {isKindHabitDomain ? (
              <img 
                src="/kindhabit_logo.png"
                alt="착한습관 로고"
                className="main-page__header-logo-image"
                style={{ height: '28px', width: 'auto', objectFit: 'contain' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = WELNO_LOGO_IMAGE; // 실패 시 웰노 로고로 폴백
                }}
              />
            ) : !displayHospital.hospital_id ? (
              <img 
                src={WELNO_LOGO_IMAGE}
                alt="웰노 로고"
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
            ) : (
              <img 
                src={getHospitalLogoUrl(displayHospital)} 
                alt={`${displayHospital.name} 로고`}
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
            )}
            <div className="main-page__header-logo-icon" style={{ display: 'none' }}>W</div>
          </div>
        </div>

        {/* 환자 인사말 (왼쪽 정렬, 정확한 줄바꿈) */}
        <div className="main-page__greeting">
          <h1 className="main-page__greeting-title">
            <span className="greeting-text">안녕하세요</span> <span className="patient-name">{displayPatient.name}</span><span className="greeting-text">님,</span>
          </h1>
          <p className="main-page__greeting-subtitle">
            {isKindHabitDomain ? (
              <span className="hospital-name">착한습관 만들기 프로젝트에요 😊</span>
            ) : isWelnoDomain ? (
              <>
                <span className="hospital-name">웰노</span> <span className="hospital-suffix">입니다.</span>
              </>
            ) : (
              <>
                <span className="hospital-name">{displayHospital.name}</span> <span className="hospital-suffix">입니다.</span>
              </>
            )}
          </p>
          {!isKindHabitDomain && (
            <p className="main-page__greeting-message">
              {isWelnoDomain ? (
                <>
                  <span className="hospital-name">웰노</span><span className="greeting-text">에서 준비한</span><br />
                  <span className="greeting-text-thin">건강관리 서비스를 이용하시고</span><br />
                  <span className="greeting-text-thin">착한습관 만들어 보세요!</span>
                </>
              ) : (
                <>
                  <span className="hospital-name">{displayHospital.name}</span><span className="greeting-text">에서</span><br />
                  <span className="greeting-text-thin">더 의미있는 내원이 되시길 바라며</span><br />
                  <span className="greeting-text-thin">준비한 건강관리 서비스를 확인해보세요!</span>
                </>
              )}
            </p>
          )}
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
          <div className="main-page__card-wrapper">
            <Card
              type="vertical"
              icon="chart"
              title="검진 결과 추이"
              description="공단검진결과를 이용해서
내 건강 추이를 확인하세요"
              onClick={() => handleCardClick('chart')}
              imageUrl={trendsChartImage}
              imageAlt="검진 결과 추이 그래프"
              imageFlash={cardFlashStates.chart}
            />
          </div>
          <div className="main-page__card-wrapper">
            <Card
              type="vertical"
              icon="habit"
              title="착한습관 만들기"
              description="건강검진결과로 만드는
나만의 착한 습관을 만들어보세요"
              onClick={() => handleCardClick('habit')}
              imageUrl={healthHabitImage}
              imageAlt="착한습관 만들기"
              imageFlash={cardFlashStates.habit}
            />
          </div>
          <div className="main-page__card-wrapper">
            <Card
              type="vertical"
              icon="design"
              title="검진항목 설계하기"
              description="내 검진결과를 이용해서
올해 건강검진 항목을 설계해보세요"
              onClick={() => handleCardClick('design')}
              imageUrl={checkupDesignImage}
              imageAlt="검진항목 설계하기"
              imageFlash={cardFlashStates.design}
            />
          </div>
          <div className="main-page__card-wrapper">
            <Card
              type="vertical"
              icon="prediction"
              title="질병예측 리포트 보기"
              description="AI 기반 건강 데이터 분석으로
질병 예측 리포트를 확인하세요"
              onClick={() => handleCardClick('prediction')}
              imageUrl={reportImage}
              imageAlt="질병예측 리포트"
              imageFlash={cardFlashStates.prediction}
            />
          </div>
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
        const uuidValue = urlParams.get('uuid') || patient?.uuid || '';
        const hospitalIdValue = 
          patient?.hospital_id || 
          hospital?.hospital_id || 
          urlParams.get('hospital') || 
          urlParams.get('hospital_id') || 
          urlParams.get('hospitalId') || 
          '';
        return (
          <PasswordModal
            isOpen={showPasswordModal}
            onClose={handlePasswordClose}
            onSuccess={handlePasswordSuccess}
            onCancel={handlePasswordCancel}
            type={passwordModalType}
            uuid={uuidValue}
            hospitalId={hospitalIdValue}
            initialMessage="데이터 접근을 위해 비밀번호를 입력해주세요."
            patientInfo={{
              name: patient?.name,
              phone: patient?.phone,
              birthday: patient?.birthday || state.patient?.birthday,
              gender: patient?.gender === 'male' ? 'M' : patient?.gender === 'female' ? 'F' : 'M'
            }}
          />
        );
      })()}

      {/* 세션 상태 모달 */}
      <SessionStatusModal
        isOpen={showSessionStatusModal}
        sessionExpiresAt={sessionExpiresAt || undefined}
        onComplete={handleSessionStatusComplete}
      />
      
      {/* MDX 데이터 검색 모달 (개발 모드 전용) */}
      <MdxDataSearchModal
        isOpen={showMdxSearchModal}
        onConfirm={handleMdxSearchConfirm}
        onCancel={handleMdxSearchCancel}
      />
      
      {/* IndexedDB 삭제 확인 모달 */}
      <IndexedDBClearModal
        isOpen={showIndexedDBClearModal}
        onConfirm={handleIndexedDBClearConfirm}
        onCancel={handleIndexedDBClearCancel}
      />
      
      {/* 파트너 인증 확인 모달 */}
      {pendingPartnerAuthPayload && (
        <PartnerAuthConfirmModal
          isOpen={showPartnerAuthModal}
          onConfirm={handlePartnerAuthConfirm}
          onCancel={handlePartnerAuthCancel}
          requestPayload={pendingPartnerAuthPayload}
          apiEndpoint={pendingPartnerAuthEndpoint}
        />
      )}
      
      {/* 페이지 전환 로딩 스피너 */}
      <PageTransitionLoader isVisible={isPageTransitioning} message={transitionMessage} />
      
      {/* 인트로 티저 (처음 접근 유저만) */}
      {showIntroTeaser && (
        <IntroTeaser
          onClose={handleIntroTeaserClose}
          onDontShowAgain={handleIntroTeaserDontShowAgain}
        />
      )}
      
      {/* 준비중 모달 */}
      {/* <ComingSoonModal
        isOpen={showComingSoonModal}
        onClose={() => setShowComingSoonModal(false)}
        title="준비중입니다"
        message={`14일 건강관리 서비스를 준비하고 있습니다.
곧 만나뵐 수 있도록 노력하겠습니다.`}
      /> */}
      
    </div>
  );
};

export default MainPage;