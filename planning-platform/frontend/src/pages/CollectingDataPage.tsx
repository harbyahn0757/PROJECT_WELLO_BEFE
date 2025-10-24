/**
 * 데이터 수집 중 전용 페이지
 * Redis 세션 상태를 실시간으로 모니터링하며 진행률 표시
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './CollectingDataPage.scss';

interface CollectionProgress {
  sessionId: string;
  status: string;
  message: string;
  progress: number;
  currentStep: string;
  isCompleted: boolean;
  hasError: boolean;
  errorMessage?: string;
}

const CollectingDataPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [progress, setProgress] = useState<CollectionProgress>({
    sessionId: '',
    status: 'initializing',
    message: '데이터 수집을 준비하고 있습니다...',
    progress: 0,
    currentStep: '초기화',
    isCompleted: false,
    hasError: false
  });

  const [dots, setDots] = useState('');

  // URL 파라미터 추출
  const urlParams = new URLSearchParams(location.search);
  const uuid = urlParams.get('uuid');
  const hospital = urlParams.get('hospital');
  const sessionId = urlParams.get('session');

  // 애니메이션 점들
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // 세션 상태 모니터링
  const checkCollectionStatus = useCallback(async () => {
    if (!sessionId) {
      console.error('❌ [수집페이지] 세션 ID 없음');
      return;
    }

    try {
      const response = await fetch(`/wello-api/v1/tilko/session/status/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 [수집페이지] 세션 상태:', result);

      if (!result.success) {
        throw new Error(result.message || '세션 상태 확인 실패');
      }

      const status = result.status;
      let newProgress: CollectionProgress = {
        sessionId: sessionId,
        status: status,
        message: '데이터 수집 중...',
        progress: 0,
        currentStep: '준비 중',
        isCompleted: false,
        hasError: false
      };

      // 상태별 진행률 및 메시지 설정
      switch (status) {
        case 'authenticated':
        case 'auth_completed':
          newProgress.progress = 10;
          newProgress.currentStep = '인증 완료';
          newProgress.message = '인증이 완료되었습니다. 데이터 수집을 시작합니다...';
          break;

        case 'fetching_health_data':
          newProgress.progress = 30;
          newProgress.currentStep = '건강검진 데이터 수집';
          newProgress.message = '건강검진 데이터를 수집하고 있습니다...';
          break;

        case 'fetching_prescription_data':
          newProgress.progress = 70;
          newProgress.currentStep = '처방전 데이터 수집';
          newProgress.message = '처방전 데이터를 수집하고 있습니다...';
          break;

        case 'completed':
          newProgress.progress = 100;
          newProgress.currentStep = '수집 완료';
          newProgress.message = '모든 데이터 수집이 완료되었습니다!';
          newProgress.isCompleted = true;
          break;

        case 'error':
          newProgress.hasError = true;
          newProgress.currentStep = '오류 발생';
          newProgress.message = '데이터 수집 중 오류가 발생했습니다.';
          newProgress.errorMessage = result.error_message || '알 수 없는 오류';
          break;

        default:
          newProgress.progress = 5;
          newProgress.currentStep = '초기화';
          newProgress.message = '데이터 수집을 준비하고 있습니다...';
      }

      setProgress(newProgress);

      // 완료되면 결과 페이지로 이동
      if (newProgress.isCompleted && uuid && hospital) {
        setTimeout(() => {
          console.log('✅ [수집페이지] 수집 완료 - 결과 페이지로 이동');
          navigate(`/results-trend?uuid=${uuid}&hospital=${hospital}`);
        }, 2000);
      }

    } catch (error) {
      console.error('❌ [수집페이지] 상태 확인 실패:', error);
      setProgress(prev => ({
        ...prev,
        hasError: true,
        currentStep: '연결 오류',
        message: '서버와의 연결에 문제가 발생했습니다.',
        errorMessage: error instanceof Error ? error.message : '알 수 없는 오류'
      }));
    }
  }, [sessionId, uuid, hospital, navigate]);

  // 초기 상태 확인 및 주기적 업데이트
  useEffect(() => {
    if (!sessionId) {
      console.error('❌ [수집페이지] 세션 ID 누락');
      navigate('/');
      return;
    }

    // 즉시 한 번 확인
    checkCollectionStatus();

    // 2초마다 상태 확인
    const interval = setInterval(checkCollectionStatus, 2000);

    return () => clearInterval(interval);
  }, [sessionId, checkCollectionStatus, navigate]);

  const handleRetry = () => {
    console.log('🔄 [수집페이지] 재시도');
    setProgress(prev => ({
      ...prev,
      hasError: false,
      errorMessage: undefined
    }));
    checkCollectionStatus();
  };

  const handleGoHome = () => {
    console.log('🏠 [수집페이지] 홈으로 이동');
    // 세션 정리
    localStorage.removeItem('tilko_session_id');
    localStorage.removeItem('tilko_session_data');
    navigate('/');
  };

  return (
    <div className="collecting-data-page">
      <div className="collecting-container">
        <div className="collecting-header">
          <h1>건강정보 수집 중</h1>
          <p>잠시만 기다려 주세요. 안전하게 데이터를 수집하고 있습니다.</p>
        </div>

        <div className="progress-section">
          {/* 진행률 바 */}
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            <div className="progress-text">
              {progress.progress}%
            </div>
          </div>

          {/* 현재 단계 */}
          <div className="current-step">
            <div className="step-icon">
              {progress.hasError ? (
                <span className="error-icon">❌</span>
              ) : progress.isCompleted ? (
                <span className="success-icon">✅</span>
              ) : (
                <div className="loading-spinner" />
              )}
            </div>
            <div className="step-info">
              <h3>{progress.currentStep}</h3>
              <p>{progress.message}{!progress.hasError && !progress.isCompleted && dots}</p>
              {progress.errorMessage && (
                <p className="error-message">{progress.errorMessage}</p>
              )}
            </div>
          </div>

          {/* 단계별 체크리스트 */}
          <div className="steps-checklist">
            <div className={`step-item ${progress.progress >= 10 ? 'completed' : 'pending'}`}>
              <span className="step-number">1</span>
              <span className="step-label">인증 완료</span>
              {progress.progress >= 10 && <span className="check-mark">✓</span>}
            </div>
            <div className={`step-item ${progress.progress >= 30 ? 'completed' : progress.progress >= 10 ? 'active' : 'pending'}`}>
              <span className="step-number">2</span>
              <span className="step-label">건강검진 데이터 수집</span>
              {progress.progress >= 70 && <span className="check-mark">✓</span>}
            </div>
            <div className={`step-item ${progress.progress >= 70 ? 'completed' : progress.progress >= 30 ? 'active' : 'pending'}`}>
              <span className="step-number">3</span>
              <span className="step-label">처방전 데이터 수집</span>
              {progress.progress >= 100 && <span className="check-mark">✓</span>}
            </div>
            <div className={`step-item ${progress.progress >= 100 ? 'completed' : progress.progress >= 70 ? 'active' : 'pending'}`}>
              <span className="step-number">4</span>
              <span className="step-label">데이터 저장 완료</span>
              {progress.progress >= 100 && <span className="check-mark">✓</span>}
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="action-buttons">
          {progress.hasError && (
            <>
              <button onClick={handleRetry} className="retry-button">
                다시 시도
              </button>
              <button onClick={handleGoHome} className="home-button">
                처음으로
              </button>
            </>
          )}
          {progress.isCompleted && (
            <button 
              onClick={() => navigate(`/results-trend?uuid=${uuid}&hospital=${hospital}`)}
              className="view-results-button"
            >
              결과 보기
            </button>
          )}
        </div>

        {/* 안내 메시지 */}
        <div className="info-message">
          <p>🔒 개인정보는 안전하게 암호화되어 처리됩니다.</p>
          <p>📊 수집된 데이터는 건강 분석에만 사용됩니다.</p>
          <p>⏱️ 일반적으로 1-2분 정도 소요됩니다.</p>
        </div>
      </div>
    </div>
  );
};

export default CollectingDataPage;

