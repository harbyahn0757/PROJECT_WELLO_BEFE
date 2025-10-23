/**
 * 건강 데이터 뷰어 컴포넌트 (실제 데이터 표시)
 * 통합 타임라인 형태로 건강검진과 처방전을 함께 표시
 */
import React, { useState, useEffect } from 'react';
import { HealthDataViewerProps } from '../../../types/health';
import UnifiedHealthTimeline from '../UnifiedHealthTimeline/index';
import { useWelloData } from '../../../contexts/WelloDataContext';
import { API_ENDPOINTS } from '../../../config/api';
import './styles.scss';

const pillIconPath = `${process.env.PUBLIC_URL || ''}/free-icon-pill-5405585.png`;

const HealthDataViewer: React.FC<HealthDataViewerProps> = ({
  onBack,
  onError
}) => {
  const { state } = useWelloData(); // 환자 데이터 가져오기
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [prescriptionData, setPrescriptionData] = useState<any>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'checkup' | 'pharmacy' | 'treatment'>('all');
  
  // 환자 이름 추출 (기본값: "사용자")
  const patientName = state.patient?.name || '사용자';

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
              
              // DB 데이터를 Tilko 형식으로 변환 (파싱된 필드들도 포함)
              if (health_data && health_data.length > 0) {
                const healthDataFormatted = {
                  ResultList: health_data.map((item: any) => ({
                    ...item.raw_data,
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
                const prescriptionDataFormatted = {
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
              
              setLoading(false);
              return;
            }
          } else {
            console.warn('⚠️ [결과페이지] DB 데이터 조회 실패, localStorage 확인');
          }
        }

        // DB에서 데이터를 가져올 수 없는 경우 localStorage에서 로드
        const collectedDataStr = localStorage.getItem('tilko_collected_data');
        if (collectedDataStr) {
          const collectedData = JSON.parse(collectedDataStr);
          console.log('📊 [결과페이지] localStorage에서 데이터 로드:', collectedData);
          
          setHealthData(collectedData.health_data);
          setPrescriptionData(collectedData.prescription_data);
        } else {
          console.warn('⚠️ [결과페이지] 저장된 데이터가 없습니다');
        }
        
      } catch (err) {
        console.error('❌ [결과페이지] 데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    // 1.5초 후 데이터 로드 (로딩 애니메이션 표시)
    const timer = setTimeout(loadHealthData, 1500);

    return () => clearTimeout(timer);
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
      <div className="question__content">
        {/* 뒤로가기 버튼 */}
        <div className="back-button-container">
          <button className="back-button" onClick={handleBack}>
            ←
          </button>
        </div>

        {/* 타이틀 */}
        <div className="question__title" style={{ marginTop: '60px' }}>
          <div className="title-with-toggle">
            <div className="title-content">
              <h1 className="question__title-text">{patientName}님의 건강 기록 타임라인</h1>
            </div>
            
            {/* 토글 버튼들을 여기로 이동 */}
            <div className="external-view-toggle">
              <button
                className={`toggle-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
                title="모두 보기"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              </button>
              <button
                className={`toggle-btn ${filterMode === 'checkup' ? 'active' : ''}`}
                onClick={() => setFilterMode('checkup')}
                title="검진만 보기"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                </svg>
              </button>
              <button
                className={`toggle-btn pharmacy ${filterMode === 'pharmacy' ? 'active' : ''}`}
                onClick={() => setFilterMode('pharmacy')}
                title="약국만 보기"
              >
                <img src={pillIconPath} alt="약국" />
              </button>
              <button
                className={`toggle-btn ${filterMode === 'treatment' ? 'active' : ''}`}
                onClick={() => setFilterMode('treatment')}
                title="진료만 보기"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 통합 타임라인 컴포넌트 */}
        <UnifiedHealthTimeline 
          healthData={healthData}
          prescriptionData={prescriptionData}
          loading={loading}
          filterMode={filterMode}
        />
      </div>

      {/* 플로팅 버튼 */}
      <div className="survey-floating-button">
        <button 
          className="survey-floating-button__btn"
          onClick={() => {
            // 홈으로 이동
            window.location.href = '/';
          }}
        >
          홈으로 가기
        </button>
      </div>
    </div>
  );
};

export { HealthDataViewer };