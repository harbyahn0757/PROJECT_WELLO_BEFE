/**
 * 건강 데이터 뷰어 컴포넌트 (실제 데이터 표시)
 * 통합 타임라인 형태로 건강검진과 처방전을 함께 표시
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HealthDataViewerProps } from '../../../types/health';
import UnifiedHealthTimeline from '../UnifiedHealthTimeline/index';
import TrendsSection from './TrendsSection';
import { useWelloData } from '../../../contexts/WelloDataContext';
import { API_ENDPOINTS } from '../../../config/api';
import { useNavigate } from 'react-router-dom';
import { WelloIndexedDB, HealthDataRecord } from '../../../services/WelloIndexedDB';
import usePasswordSessionGuard from '../../../hooks/usePasswordSessionGuard';
import { STORAGE_KEYS } from '../../../constants/storage';
import AIAnalysisSection from '../AIAnalysisSection'; // 🔧 AI 분석 섹션 컴포넌트
import './styles.scss';

const pillIconPath = `${process.env.PUBLIC_URL || ''}/free-icon-pill-5405585.png`;

const HealthDataViewer: React.FC<HealthDataViewerProps> = ({
  onBack,
  onError
}) => {
  const { state } = useWelloData(); // 환자 데이터 가져오기
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [prescriptionData, setPrescriptionData] = useState<any>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'checkup' | 'pharmacy' | 'treatment'>('all');
  
  // 🔧 뷰 모드 상태 추가 (trends: 추이분석, timeline: 타임라인)
  const [viewMode, setViewMode] = useState<'trends' | 'timeline'>(() => {
    // localStorage에서 저장된 viewMode 복원 (기본값: trends)
    const savedViewMode = localStorage.getItem('wello_view_mode') as 'trends' | 'timeline';
    return savedViewMode || 'trends';
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoadingTrends] = useState(false);
  const [showAIAnalysis, setShowAIAnalysis] = useState(false); // 🔧 AI 분석 섹션 표시 상태
  
  // Pull-to-refresh 관련 상태
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [pullCount, setPullCount] = useState(0);
  
  // 토스트 메시지 상태
  const [showToast, setShowToast] = useState(false);
  
  // 터치 이벤트 관련 ref
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  
  // 환자 이름 추출 (기본값: "사용자")
  const patientName = state.patient?.name || '사용자';

  // 🔧 페이지 타이틀 동적 변경 로직
  const getPageTitle = () => {
    if (viewMode === 'trends') {
      return `${patientName}님의 건강 추이 분석`;
    } else {
      // timeline 모드
      switch (filterMode) {
        case 'checkup':
          return `${patientName}님의 건강검진 기록`;
        case 'pharmacy':
          return `${patientName}님의 약국 방문 기록`;
        case 'treatment':
          return `${patientName}님의 진료 기록`;
        default:
          return `${patientName}님의 전체 건강 기록`;
      }
    }
  };

  // 비밀번호 세션 가드 - 직접 접속 시에는 체크하지 않음
  usePasswordSessionGuard({
    enabled: false, // 🔧 직접 접속 허용을 위해 비활성화
    checkInterval: 30000 // 30초마다 체크
  });

  // 🔧 플로팅 버튼 표시를 위한 비밀번호 모달 상태 정리
  useEffect(() => {
    // 결과 페이지 로드 시 비밀번호 모달 상태 정리
    localStorage.removeItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN);
    window.dispatchEvent(new CustomEvent('password-modal-change'));
    console.log('🧹 [결과페이지] 비밀번호 모달 상태 정리 완료');
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // 🔧 AI 분석 섹션 표시 이벤트 리스너
  useEffect(() => {
    const handleShowAIAnalysis = () => {
      console.log('🧠 [결과페이지] AI 분석 섹션 표시 요청 받음');
      setShowAIAnalysis(true);
      
      // 🔧 바로 AI 분석 시작 이벤트 발생
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('start-ai-analysis'));
        
        // AI 분석 섹션으로 스크롤
        const aiSection = document.querySelector('.ai-analysis-section');
        if (aiSection) {
          aiSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }
      }, 100);
    };

    window.addEventListener('show-ai-analysis-section', handleShowAIAnalysis);
    
    return () => {
      window.removeEventListener('show-ai-analysis-section', handleShowAIAnalysis);
    };
  }, []);

  // 🔧 토글 버튼 핸들러 (분석 = 뷰 토글, 검진/약국/진료 = 필터)
  const handleToggleClick = async (mode: string) => {
    if (isTransitioning) return; // 전환 중이면 무시
    
    setIsTransitioning(true);
    console.log(`🔄 [토글] ${mode} 버튼 클릭 - 전환 시작`);
    
    // 짧은 로딩 애니메이션
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (mode === 'all') {
      // [분석] 버튼 - 뷰 모드 토글
      const newViewMode = viewMode === 'trends' ? 'timeline' : 'trends';
      setViewMode(newViewMode);
      setFilterMode('all');
      
      // 🔧 localStorage에 viewMode 저장
      localStorage.setItem('wello_view_mode', newViewMode);
      
      // 🔧 플로팅 버튼 업데이트를 위한 커스텀 이벤트 발생
      window.dispatchEvent(new CustomEvent('wello-view-mode-change', {
        detail: { viewMode: newViewMode, filterMode: 'all' }
      }));
      
      console.log(`🔄 [토글] 뷰 모드 변경: ${viewMode} → ${newViewMode}`);
    } else {
      // [검진/약국/진료] 버튼 - 타임라인 + 필터
      setViewMode('timeline');
      setFilterMode(mode as 'checkup' | 'pharmacy' | 'treatment');
      
      // 🔧 localStorage에 viewMode 저장
      localStorage.setItem('wello_view_mode', 'timeline');
      
      // 🔧 플로팅 버튼 업데이트를 위한 커스텀 이벤트 발생
      window.dispatchEvent(new CustomEvent('wello-view-mode-change', {
        detail: { viewMode: 'timeline', filterMode: mode }
      }));
      
      console.log(`🔄 [토글] 필터 모드: ${mode}, 뷰: timeline`);
    }
    
    setIsTransitioning(false);
  };

  useEffect(() => {
    // DB에서 저장된 데이터 로드 또는 localStorage에서 최근 수집된 데이터 로드
    const loadHealthData = async () => {
      try {
        // URL 파라미터에서 환자 정보 추출
        const urlParams = new URLSearchParams(window.location.search);
        const uuid = urlParams.get('uuid');
        const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');

        if (uuid && hospital) {
          console.log('📊 [결과페이지] DB에서 저장된 데이터 로드 시도:', { uuid, hospital });
          
          // DB에서 저장된 데이터 조회
          const response = await fetch(API_ENDPOINTS.HEALTH_DATA(uuid, hospital));
          
          if (response.ok) {
            const result = await response.json();
            console.log('✅ [결과페이지] DB 데이터 로드 성공:', result);
            
            if (result.success && result.data) {
              const { health_data, prescription_data } = result.data;
              
              // 변수를 블록 밖에서 선언
              let healthDataFormatted = { ResultList: [] };
              let prescriptionDataFormatted = { ResultList: [] };
              
              // DB 데이터를 Tilko 형식으로 변환 (파싱된 필드들도 포함)
              if (health_data && health_data.length > 0) {
                healthDataFormatted = {
                  ResultList: health_data.map((item: any) => ({
                    ...item.raw_data,
                    // 🔧 raw_data 필드 보존 (상태 판정에 필요)
                    raw_data: item.raw_data,
                    // DB에서 파싱된 필드들 추가
                    height: item.height,
                    weight: item.weight,
                    bmi: item.bmi,
                    waist_circumference: item.waist_circumference,
                    blood_pressure_high: item.blood_pressure_high,
                    blood_pressure_low: item.blood_pressure_low,
                    blood_sugar: item.blood_sugar,
                    cholesterol: item.cholesterol,
                    hdl_cholesterol: item.hdl_cholesterol,
                    ldl_cholesterol: item.ldl_cholesterol,
                    triglyceride: item.triglyceride,
                    hemoglobin: item.hemoglobin,
                    year: item.year,
                    checkup_date: item.checkup_date,
                    location: item.location,
                    code: item.code
                  }))
                };
                setHealthData(healthDataFormatted);
                console.log('🏥 [결과페이지] 건강검진 데이터 설정 완료:', healthDataFormatted);
              }
              
              if (prescription_data && prescription_data.length > 0) {
                prescriptionDataFormatted = {
                  ResultList: prescription_data.map((item: any) => ({
                    ...item.raw_data,
                    // DB에서 파싱된 필드들 추가
                    hospital_name: item.hospital_name,
                    address: item.address,
                    treatment_date: item.treatment_date,
                    treatment_type: item.treatment_type,
                    visit_count: item.visit_count,
                    medication_count: item.medication_count,
                    prescription_count: item.prescription_count,
                    detail_records_count: item.detail_records_count
                  }))
                };
                setPrescriptionData(prescriptionDataFormatted);
                console.log('💊 [결과페이지] 처방전 데이터 설정 완료:', prescriptionDataFormatted);
              }
              
              // 마지막 업데이트 시간 설정
              if (result.data.last_update) {
                setLastUpdateTime(result.data.last_update);
                // 토스트 메시지 표시
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000); // 3초 후 자동 숨김
              }
              
              // 🔄 [IndexedDB] 건강 데이터 저장 (AI 종합 분석용)
              try {
                const healthRecord: HealthDataRecord = {
                  uuid: uuid!,
                  patientName: state.patient?.name || '사용자',
                  hospitalId: hospital!,
                  healthData: healthDataFormatted?.ResultList || [],
                  prescriptionData: prescriptionDataFormatted?.ResultList || [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  dataSource: 'api'
                };

                const saveSuccess = await WelloIndexedDB.saveHealthData(healthRecord);
                
                if (saveSuccess) {
                  console.log('✅ [IndexedDB] 건강 데이터 저장 성공:', {
                    uuid: uuid,
                    건강검진개수: healthDataFormatted?.ResultList?.length || 0,
                    처방전개수: prescriptionDataFormatted?.ResultList?.length || 0,
                    데이터크기: `${(JSON.stringify(healthRecord).length/1024).toFixed(1)}KB`
                  });

                  // localStorage에는 최소 플래그만 저장 (기존 호환성)
                  localStorage.setItem('tilko_collected_data', JSON.stringify({
                    health_data: { ResultList: [] }, // 빈 배열로 플래그만
                    prescription_data: { ResultList: [] }, // 빈 배열로 플래그만
                    collected_at: new Date().toISOString(),
                    source: 'indexeddb',
                    uuid: uuid,
                    dataSize: `${(JSON.stringify(healthRecord).length/1024).toFixed(1)}KB`
                  }));
                } else {
                  throw new Error('IndexedDB 저장 실패');
                }
                
              } catch (error: any) {
                console.error('❌ [IndexedDB 저장 오류]', {
                  오류타입: error.name,
                  오류메시지: error.message,
                  건강검진개수: healthDataFormatted?.ResultList?.length || 0,
                  처방전개수: prescriptionDataFormatted?.ResultList?.length || 0
                });
                
                // IndexedDB 실패 시 localStorage 폴백
                try {
                  console.log('🔄 [폴백] localStorage로 최소 데이터 저장');
                  const minimalData = {
                    health_data: healthDataFormatted,
                    prescription_data: { ResultList: prescriptionDataFormatted?.ResultList?.slice(0, 10) || [] }, // 처방전 10개만
                    collected_at: new Date().toISOString(),
                    source: 'localStorage_fallback'
                  };
                  localStorage.setItem('tilko_collected_data', JSON.stringify(minimalData));
                  console.log('✅ [폴백] localStorage 저장 완료');
                  
                } catch (fallbackError: any) {
                  console.error('❌ [폴백 실패]', fallbackError.message);
                  // 사용자에게 알림
                  setShowToast(true);
                  setLastUpdateTime('저장공간 부족으로 일부 기능 제한');
                  setTimeout(() => setShowToast(false), 5000);
                }
              }
              
              // 플로팅 버튼 업데이트를 위한 이벤트 발생
              window.dispatchEvent(new Event('localStorageChange'));
              
              setLoading(false);
              return;
            }
          } else {
            console.warn('⚠️ [결과페이지] DB 데이터 조회 실패, localStorage 확인');
          }
        }

        // DB에서 데이터를 가져올 수 없는 경우 IndexedDB에서 로드
        if (uuid) {
          console.log('📊 [결과페이지] IndexedDB에서 데이터 로드 시도:', uuid);
          
          try {
            const indexedDBRecord = await WelloIndexedDB.getHealthData(uuid);
            
            if (indexedDBRecord) {
              console.log('✅ [IndexedDB] 데이터 로드 성공:', indexedDBRecord);
              
              // IndexedDB 데이터를 Tilko 형식으로 변환
              const healthDataFormatted = {
                ResultList: indexedDBRecord.healthData
              };
              const prescriptionDataFormatted = {
                ResultList: indexedDBRecord.prescriptionData
              };
              
              setHealthData(healthDataFormatted);
              setPrescriptionData(prescriptionDataFormatted);
              setLastUpdateTime(indexedDBRecord.updatedAt);
              
              // 토스트 메시지 표시
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
              
            } else {
              // IndexedDB에 데이터가 없으면 localStorage 확인 (폴백)
              console.log('📭 [IndexedDB] 데이터 없음, localStorage 확인');
              
              const collectedDataStr = localStorage.getItem('tilko_collected_data');
              if (collectedDataStr) {
                const collectedData = JSON.parse(collectedDataStr);
                console.log('📊 [폴백] localStorage에서 데이터 로드:', collectedData);
                
                setHealthData(collectedData.health_data);
                setPrescriptionData(collectedData.prescription_data);
                
                if (collectedData.collected_at) {
                  setLastUpdateTime(collectedData.collected_at);
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
                } else {
                  const fallbackTime = new Date().toISOString();
                  setLastUpdateTime(fallbackTime);
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
                }
              } else {
                console.warn('⚠️ [결과페이지] IndexedDB와 localStorage 모두에 저장된 데이터가 없습니다');
              }
            }
            
          } catch (error) {
            console.error('❌ [IndexedDB] 데이터 로드 실패:', error);
            
            // IndexedDB 실패 시 localStorage 폴백
            const collectedDataStr = localStorage.getItem('tilko_collected_data');
            if (collectedDataStr) {
              const collectedData = JSON.parse(collectedDataStr);
              console.log('📊 [폴백] localStorage에서 데이터 로드:', collectedData);
              
              setHealthData(collectedData.health_data);
              setPrescriptionData(collectedData.prescription_data);
              setLastUpdateTime(collectedData.collected_at || new Date().toISOString());
              setShowToast(true);
              setTimeout(() => setShowToast(false), 3000);
            }
          }
        } else {
          console.warn('⚠️ [결과페이지] UUID가 없어 데이터를 로드할 수 없습니다');
        }
        
      } catch (err) {
        console.error('❌ [결과페이지] 데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    // 즉시 데이터 로드 (로딩 상태는 useState로 관리)
    loadHealthData();
  }, []);

  // Pull-to-refresh 터치 이벤트 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || !containerRef.current) return;

    currentY.current = e.touches[0].clientY;
    const distance = currentY.current - startY.current;

    if (distance > 0 && containerRef.current.scrollTop === 0) {
      e.preventDefault();
      const pullDistance = Math.min(distance * 0.5, 100); // 최대 100px
      setPullDistance(pullDistance);
    }
  }, [isPulling]);

  const handleTouchEnd = useCallback(() => {
    if (!isPulling) return;

    if (pullDistance > 60) {
      // 횟수 증가
      const newCount = pullCount + 1;
      setPullCount(newCount);
      
      // 3번째부터 모달 표시
      if (newCount >= 3) {
        setShowRefreshModal(true);
        setPullCount(0); // 리셋
      } else {
        console.log(`🔄 [Pull-to-refresh] ${newCount}/3회 - ${3 - newCount}번 더 당기면 새로고침`);
      }
    }

    setIsPulling(false);
    setPullDistance(0);
  }, [isPulling, pullDistance, pullCount]);

  // 새로고침 확인 모달 핸들러
  const handleRefreshConfirm = useCallback(() => {
    setShowRefreshModal(false);
    
    // 환자 정보 유지하면서 재인증 페이지로 이동
    const urlParams = new URLSearchParams(window.location.search);
    const uuid = urlParams.get('uuid');
    const hospital = urlParams.get('hospital') || urlParams.get('hospitalId');
    
    if (uuid && hospital) {
      // 기존 데이터 정리
      localStorage.removeItem('tilko_collected_data');
      localStorage.removeItem('tilko_session_id');
      localStorage.removeItem('tilko_session_data');
      
      // 재인증 페이지로 이동 (환자 정보 유지)
      navigate(`/login?uuid=${uuid}&hospital=${hospital}`);
    }
  }, [navigate]);

  const handleRefreshCancel = useCallback(() => {
    setShowRefreshModal(false);
  }, []);

  // 마지막 업데이트 시간 포맷팅
  const formatLastUpdateTime = useCallback((timeString: string | null) => {
    if (!timeString) return '알 수 없음';
    
    try {
      const date = new Date(timeString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffMins < 1) return '방금 전';
      if (diffMins < 60) return `${diffMins}분 전`;
      if (diffHours < 24) return `${diffHours}시간 전`;
      if (diffDays < 7) return `${diffDays}일 전`;
      
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '알 수 없음';
    }
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  if (loading) {
    return (
      <div className="health-data-viewer">
        <div className="question__content">
          {/* 뒤로가기 버튼 */}
          <div className="back-button-container">
            <button className="back-button" onClick={handleBack}>
              ←
            </button>
          </div>

          {/* 중앙 정렬된 스피너 */}
          <div className="centered-loading-container">
            <div className="loading-spinner">
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
              <p className="loading-spinner__message">{patientName}님의 건강 데이터를 불러오는 중...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="health-data-viewer">
        <div className="question__content">
          <div className="back-button-container">
            <button className="back-button" onClick={handleBack}>
              ←
            </button>
          </div>

          <div className="question__title" style={{ marginTop: '60px' }}>
            <h1 className="question__title-text">검진 결과 조회</h1>
          </div>

          <div className="error-message">
            <div className="error-message__icon">⚠️</div>
            <div className="error-message__title">데이터 조회 실패</div>
            <div className="error-message__text">{error}</div>
            <div className="error-message__actions">
              <button 
                className="error-message__button error-message__button--primary"
                onClick={() => window.location.reload()}
              >
                다시 시도
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="health-data-viewer">
      <div 
        className="question__content"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: isPulling ? `translateY(${pullDistance}px)` : 'translateY(0)',
          transition: isPulling ? 'none' : 'transform 0.3s ease-out'
        }}
      >
        {/* Pull-to-refresh 인디케이터 */}
        {isPulling && (
          <div 
            className="pull-to-refresh-indicator"
            style={{
              position: 'absolute',
              top: `-${Math.min(pullDistance, 60)}px`,
              left: '50%',
              transform: 'translateX(-50%)',
              opacity: Math.min(pullDistance / 60, 1),
              transition: 'opacity 0.2s ease-out'
            }}
          >
            <div className="refresh-icon">
              {pullDistance > 60 ? '↻' : '↓'}
            </div>
            <div className="refresh-text">
              {pullDistance > 60 ? '놓으면 새로고침' : '아래로 당겨서 새로고침'}
            </div>
          </div>
        )}
        {/* 뒤로가기 버튼 */}
        <div className="back-button-container">
          <button className="back-button" onClick={handleBack}>
            ←
          </button>
        </div>

        {/* 마지막 업데이트 시간 (우상단 플로팅) */}
        {lastUpdateTime && (
          <div className="last-update-floating">
            <span className="update-text">마지막 업데이트: {formatLastUpdateTime(lastUpdateTime)}</span>
          </div>
        )}

        {/* 타이틀 */}
        <div className="question__title" style={{ marginTop: '10px' }}>
          <div className="title-with-toggle">
            <div className="title-content">
              <h1 className="question__title-text">{getPageTitle()}</h1>
            </div>
            
            {/* 🔧 토글 버튼들 (분석=뷰토글, 검진/약국/진료=필터) */}
            <div className="external-view-toggle">
              <button
                className={`toggle-btn ${isTransitioning ? 'loading' : ''} ${
                  (viewMode === 'trends' || (viewMode === 'timeline' && filterMode === 'all')) ? 'active' : ''
                }`}
                onClick={() => handleToggleClick('all')}
                disabled={isTransitioning}
                title={viewMode === 'trends' ? '타임라인 보기' : '분석 보기'}
              >
                {isTransitioning ? (
                  <div className="button-spinner" />
                ) : viewMode === 'trends' ? (
                  // 🔧 trends 모드: 햄버거 메뉴 아이콘 (3줄)
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                ) : (
                  // 🔧 timeline 모드: ChatGPT 아이콘
                  <img 
                    src="/wello/icons8-chatgpt-50.png" 
                    alt="AI 분석" 
                    style={{ width: '16px', height: '16px', objectFit: 'contain' }}
                  />
                )}
              </button>
              <button
                className={`toggle-btn ${isTransitioning ? 'loading' : ''} ${filterMode === 'checkup' ? 'active' : ''}`}
                onClick={() => handleToggleClick('checkup')}
                disabled={isTransitioning}
                title="검진만 보기"
              >
                {isTransitioning ? (
                  <div className="button-spinner" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                  </svg>
                )}
              </button>
              <button
                className={`toggle-btn pharmacy ${isTransitioning ? 'loading' : ''} ${filterMode === 'pharmacy' ? 'active' : ''}`}
                onClick={() => handleToggleClick('pharmacy')}
                disabled={isTransitioning}
                title="약국만 보기"
              >
                {isTransitioning ? (
                  <div className="button-spinner" />
                ) : (
                  <img src={pillIconPath} alt="약국" />
                )}
              </button>
              <button
                className={`toggle-btn ${isTransitioning ? 'loading' : ''} ${filterMode === 'treatment' ? 'active' : ''}`}
                onClick={() => handleToggleClick('treatment')}
                disabled={isTransitioning}
                title="진료만 보기"
              >
                {isTransitioning ? (
                  <div className="button-spinner" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 🔧 조건부 렌더링: viewMode에 따라 TrendsSection 또는 UnifiedHealthTimeline 표시 */}
        {isTransitioning ? (
          <div className="view-transition-loading">
            <div className="loading-spinner">
              <img 
                src="/wello/wello-icon.png" 
                alt="전환 중" 
                className="spinner-icon"
                style={{
                  width: '48px',
                  height: '48px',
                  animation: 'faviconBlink 1.5s ease-in-out infinite'
                }}
              />
            </div>
            <p className="loading-text">화면을 전환하는 중...</p>
          </div>
        ) : viewMode === 'trends' ? (
          <TrendsSection 
            healthData={healthData?.ResultList || []}
            prescriptionData={prescriptionData?.ResultList || []}
            filterMode={filterMode}
            isLoading={isLoadingTrends}
          />
        ) : (
          <UnifiedHealthTimeline 
            healthData={healthData}
            prescriptionData={prescriptionData}
            loading={loading}
            filterMode={filterMode}
          />
        )}

        {/* 🔧 AI 종합 분석 섹션 (조건부 표시) */}
        {showAIAnalysis && (
          <AIAnalysisSection />
        )}
      </div>

      {/* 새로고침 확인 모달 */}
      {showRefreshModal && (
        <div className="refresh-modal-overlay">
          <div className="refresh-modal">
            <div className="refresh-modal-header">
              <h3>데이터 새로고침</h3>
            </div>
            <div className="refresh-modal-content">
              <div className="refresh-info">
                <div className="refresh-info-item">
                  <span className="info-label">현재 데이터 수집 시점:</span>
                  <span className="info-value">{formatLastUpdateTime(lastUpdateTime)}</span>
                </div>
              </div>
              <p className="refresh-description">
                새로운 건강정보를 수집하시겠습니까?<br/>
                다시 인증 과정을 거쳐 최신 데이터를 가져옵니다.
              </p>
            </div>
            <div className="refresh-modal-actions">
              <button 
                className="refresh-btn refresh-btn-cancel"
                onClick={handleRefreshCancel}
              >
                취소
              </button>
              <button 
                className="refresh-btn refresh-btn-confirm"
                onClick={handleRefreshConfirm}
              >
                새로고침
              </button>
            </div>
          </div>
        </div>
        )}

        {/* 토스트 메시지 */}
        {showToast && lastUpdateTime && (
          <div className="toast-message">
            <div className="toast-content">
              <span className="toast-text">
                마지막 업데이트: {formatLastUpdateTime(lastUpdateTime)}
              </span>
            </div>
          </div>
        )}

    </div>
  );
};

export { HealthDataViewer };