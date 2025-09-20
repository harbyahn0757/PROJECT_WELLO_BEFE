/**
 * 건강 데이터 뷰어 컴포넌트 (간소화 버전)
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

  useEffect(() => {
    // 모의 로딩 시뮬레이션
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

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
          {/* 뒤로가기 버튼 */}
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

        <div className="question__title" style={{ marginTop: '60px' }}>
          <h1 className="question__title-text">검진 결과 조회</h1>
        </div>

        {/* 통계 카드 */}
        <div className="stats-cards">
          <div className="stats-card">
            <div className="stats-number">3</div>
            <div className="stats-label">검진 기록</div>
          </div>
          <div className="stats-card">
            <div className="stats-number">12</div>
            <div className="stats-label">처방전</div>
          </div>
          <div className="stats-card">
            <div className="stats-number">85%</div>
            <div className="stats-label">정상 수치</div>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="tab-menu">
          <button 
            className={`tab-button ${activeTab === 'checkups' ? 'active' : ''}`}
            onClick={() => setActiveTab('checkups')}
          >
            검진 결과
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
              <h3>최근 검진 결과</h3>
              <div style={{ 
                background: 'white', 
                padding: '20px', 
                borderRadius: '12px', 
                marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h4>2024년 종합검진</h4>
                <p style={{ color: '#666', fontSize: '14px' }}>2024.03.15 | 삼성서울병원</p>
                <div style={{ marginTop: '12px' }}>
                  <span style={{ 
                    background: '#e8f5e8', 
                    color: '#2d7d2d', 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    정상
                  </span>
                </div>
              </div>
              
              <div style={{ 
                background: 'white', 
                padding: '20px', 
                borderRadius: '12px', 
                marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h4>2023년 건강검진</h4>
                <p style={{ color: '#666', fontSize: '14px' }}>2023.09.22 | 연세의료원</p>
                <div style={{ marginTop: '12px' }}>
                  <span style={{ 
                    background: '#fff3cd', 
                    color: '#856404', 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    주의 필요
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="prescription-content">
              <h3>최근 처방전</h3>
              <div style={{ 
                background: 'white', 
                padding: '20px', 
                borderRadius: '12px', 
                marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h4>감기약 처방</h4>
                <p style={{ color: '#666', fontSize: '14px' }}>2024.01.20 | 김현우내과의원</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  • 타이레놀 (1일 3회, 7일분)<br/>
                  • 콧물약 (1일 2회, 5일분)
                </p>
              </div>
              
              <div style={{ 
                background: 'white', 
                padding: '20px', 
                borderRadius: '12px', 
                marginBottom: '16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <h4>고혈압 약물</h4>
                <p style={{ color: '#666', fontSize: '14px' }}>2023.12.15 | 서울대병원</p>
                <p style={{ fontSize: '14px', marginTop: '8px' }}>
                  • 노바스크 (1일 1회, 30일분)<br/>
                  • 디오반 (1일 1회, 30일분)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 마지막 업데이트 시간 */}
        <div className="last-update">
          마지막 업데이트: 2024년 3월 15일
        </div>
      </div>

      {/* 플로팅 버튼 */}
      <div className="survey-floating-button">
        <button 
          className="survey-floating-button__btn"
          onClick={() => {
            // Health Connect 인증 시작
            alert('국민건강보험공단 연동을 시작합니다.');
          }}
        >
          건보공단 연동하기
        </button>
      </div>
    </div>
  );
};

export { HealthDataViewer };