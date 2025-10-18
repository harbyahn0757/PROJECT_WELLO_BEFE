/**
 * 건강 데이터 뷰어 컴포넌트 (실제 데이터 표시)
 */
import React, { useState, useEffect } from 'react';
import { HealthDataViewerProps } from '../../../types/health';
import './styles.scss';

const HealthDataViewer: React.FC<HealthDataViewerProps> = ({
  onBack,
  onError
}) => {
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'checkups' | 'prescriptions'>('checkups');
  const [healthData, setHealthData] = useState<any>(null);
  const [prescriptionData, setPrescriptionData] = useState<any>(null);

  useEffect(() => {
    // localStorage에서 수집된 데이터 로드
    const loadCollectedData = () => {
      try {
        const collectedDataStr = localStorage.getItem('tilko_collected_data');
        if (collectedDataStr) {
          const collectedData = JSON.parse(collectedDataStr);
          console.log('📊 [결과페이지] 수집된 데이터 로드:', collectedData);
          
          // 건강검진 데이터 구조 확인
          if (collectedData.health_data) {
            console.log('🏥 [결과페이지] 건강검진 데이터 구조:', collectedData.health_data);
            console.log('🏥 [결과페이지] ResultList 존재 여부:', !!collectedData.health_data.ResultList);
            if (collectedData.health_data.ResultList) {
              console.log('🏥 [결과페이지] ResultList 길이:', collectedData.health_data.ResultList.length);
              console.log('🏥 [결과페이지] 첫 번째 항목:', collectedData.health_data.ResultList[0]);
            }
          }
          
          // 처방전 데이터 구조 확인
          if (collectedData.prescription_data) {
            console.log('💊 [결과페이지] 처방전 데이터 구조:', collectedData.prescription_data);
            console.log('💊 [결과페이지] ResultList 존재 여부:', !!collectedData.prescription_data.ResultList);
            if (collectedData.prescription_data.ResultList) {
              console.log('💊 [결과페이지] ResultList 길이:', collectedData.prescription_data.ResultList.length);
              console.log('💊 [결과페이지] 첫 번째 항목:', collectedData.prescription_data.ResultList[0]);
            }
          }
          
          setHealthData(collectedData.health_data);
          setPrescriptionData(collectedData.prescription_data);
        } else {
          console.warn('⚠️ [결과페이지] 수집된 데이터가 없습니다');
        }
      } catch (err) {
        console.error('❌ [결과페이지] 데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    // 1.5초 후 데이터 로드 (로딩 애니메이션 표시)
    const timer = setTimeout(loadCollectedData, 1500);

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

          <div className="question__title" style={{ marginTop: '60px' }}>
            <h1 className="question__title-text">검진 결과 조회</h1>
          </div>

          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div className="loading-spinner loading-spinner--medium">
              <div className="spinner"></div>
              <p className="loading-spinner__message">건강 데이터를 불러오는 중...</p>
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
          <h1 className="question__title-text">건강 데이터</h1>
          <p className="question__subtitle">
            국민건강보험공단 연동 데이터
          </p>
        </div>

        {/* 탭 메뉴 */}
        <div className="tab-menu">
          <button 
            className={`tab-button ${activeTab === 'checkups' ? 'active' : ''}`}
            onClick={() => setActiveTab('checkups')}
          >
            건강검진
          </button>
          <button 
            className={`tab-button ${activeTab === 'prescriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('prescriptions')}
          >
            처방전
          </button>
        </div>

        {/* 콘텐츠 영역 */}
        <div style={{ padding: '20px' }}>
          {activeTab === 'checkups' ? (
            <div className="checkup-content">
              <h3>최근 건강검진</h3>
              {healthData && healthData.ResultList && healthData.ResultList.length > 0 ? (
                healthData.ResultList.map((checkup: any, index: number) => (
                  <div key={index} style={{ 
                    background: 'white', 
                    padding: '20px', 
                    borderRadius: '12px', 
                    marginBottom: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    <h4>{checkup.Year} {checkup.CheckUpDate} 건강검진</h4>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                      {checkup.CheckUpDate} | {checkup.Location || '국민건강보험공단'}
                    </p>
                    <div style={{ marginTop: '12px', fontSize: '14px' }}>
                      {checkup.Height && <p>• 신장: {checkup.Height}cm</p>}
                      {checkup.Weight && <p>• 체중: {checkup.Weight}kg</p>}
                      {checkup.BloodPressureHigh && checkup.BloodPressureLow && (
                        <p>• 혈압: {checkup.BloodPressureHigh}/{checkup.BloodPressureLow} mmHg</p>
                      )}
                      {checkup.BloodSugar && <p>• 공복혈당: {checkup.BloodSugar} mg/dL</p>}
                      {checkup.Cholesterol && <p>• 총콜레스테롤: {checkup.Cholesterol} mg/dL</p>}
                      {checkup.Code && (
                        <p style={{ 
                          marginTop: '8px', 
                          color: checkup.Code === '정상' ? '#10b981' : checkup.Code === '의심' ? '#f59e0b' : '#ef4444', 
                          fontWeight: 'bold' 
                        }}>
                          • 판정: {checkup.Code}
                        </p>
                      )}
                      {checkup.Description && (
                        <p style={{ marginTop: '4px', fontSize: '13px', color: '#666' }}>
                          • 상세: {checkup.Description}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ 
                  background: 'white', 
                  padding: '40px 20px', 
                  borderRadius: '12px', 
                  textAlign: 'center',
                  color: '#666'
                }}>
                  <p>건강검진 데이터가 없습니다.</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>
                    최근 10년 내 건강검진 기록이 조회됩니다.
                  </p>
                </div>
              )}
            </div>

          ) : (
            <div className="prescription-content">
              <h3>최근 처방전</h3>
              {prescriptionData && prescriptionData.ResultList && prescriptionData.ResultList.length > 0 ? (
                prescriptionData.ResultList.map((prescription: any, index: number) => (
                  <div key={index} style={{ 
                    background: 'white', 
                    padding: '20px', 
                    borderRadius: '12px', 
                    marginBottom: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    <h4>{prescription.ByungEuiwonYakGukMyung || '병원'}</h4>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                      {prescription.JinRyoGaesiIl} | {prescription.Address}
                    </p>
                    <div style={{ fontSize: '14px', marginTop: '8px' }}>
                      {prescription.JinRyoHyungTae && <p>• 진료형태: {prescription.JinRyoHyungTae}</p>}
                      {prescription.BangMoonIpWonIlsoo && <p>• 방문횟수: {prescription.BangMoonIpWonIlsoo}회</p>}
                      {prescription.TuYakYoYangHoiSoo && <p>• 투약요양횟수: {prescription.TuYakYoYangHoiSoo}회</p>}
                      {prescription.CheoBangHoiSoo && <p>• 처방횟수: {prescription.CheoBangHoiSoo}회</p>}
                      {prescription.RetrieveTreatmentInjectionInformationPersonDetailList && 
                       prescription.RetrieveTreatmentInjectionInformationPersonDetailList.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <p style={{ fontWeight: 'bold', color: '#2E86AB' }}>• 처방 상세:</p>
                          {prescription.RetrieveTreatmentInjectionInformationPersonDetailList.slice(0, 3).map((detail: any, idx: number) => (
                            <p key={idx} style={{ marginLeft: '12px', fontSize: '13px', color: '#666' }}>
                              - {detail.약품명 || detail.처치명 || '상세정보'}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ 
                  background: 'white', 
                  padding: '40px 20px', 
                  borderRadius: '12px', 
                  textAlign: 'center',
                  color: '#666'
                }}>
                  <p>처방전 데이터가 없습니다.</p>
                  <p style={{ fontSize: '14px', marginTop: '8px' }}>
                    최근 14개월 내 처방 기록이 조회됩니다.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 마지막 업데이트 시간 */}
        <div className="last-update">
          마지막 업데이트: {new Date().toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
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
