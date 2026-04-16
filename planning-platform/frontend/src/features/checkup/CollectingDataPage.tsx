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
      console.error('[수집페이지] 세션 ID 없음');
      return;
    }

    try {
      const response = await fetch(`/api/v1/tilko/session/status/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log('[수집페이지] 세션 상태:', result);

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
          newProgress.message = '인증 완료! 데이터를 가져올게요';
          break;

        case 'fetching_health_data':
          newProgress.progress = 30;
          newProgress.currentStep = '건강검진 데이터 수집';
          newProgress.message = '가져오고 있어요';
          break;

        case 'fetching_prescription_data':
          newProgress.progress = 70;
          newProgress.currentStep = '처방전 데이터 수집';
          newProgress.message = '가져오고 있어요';
          break;

        case 'completed':
          newProgress.progress = 100;
          newProgress.currentStep = '수집 완료';
          newProgress.message = '모든 데이터를 가져왔어요!';
          newProgress.isCompleted = true;
          break;

        case 'info_required':
          newProgress.hasError = true;
          newProgress.currentStep = '정보를 확인해주세요';
          newProgress.message = '정보를 확인해주세요';
          // 에러 메시지에서 상세 정보 추출
          const errorMessages = result.messages || [];
          const lastError = errorMessages[errorMessages.length - 1];
          if (lastError && lastError.message) {
            const errorMsg = typeof lastError.message === 'object' 
              ? lastError.message.message || lastError.message.title || '정보를 확인해주세요'
              : lastError.message;
            newProgress.errorMessage = errorMsg;
          } else {
            newProgress.errorMessage = '이름, 생년월일, 전화번호가 맞는지 한번 확인해주세요';
          }
          // 정보 확인 페이지로 리다이렉트
          setTimeout(() => {
            console.log('[수집페이지] 정보 확인 필요 - 로그인 페이지로 이동');
            navigate(`/login?uuid=${uuid}&hospital=${hospital}&info_required=true`);
          }, 3000);
          break;

        case 'error':
          newProgress.hasError = true;
          newProgress.currentStep = '문제가 생겼어요';
          newProgress.message = '수집 중 문제가 생겼어요';
          // 에러 메시지에서 상세 정보 추출
          const errorMsgs = result.messages || [];
          const lastErr = errorMsgs[errorMsgs.length - 1];
          if (lastErr && lastErr.message) {
            const errMsg = typeof lastErr.message === 'object' 
              ? lastErr.message.message || lastErr.message.title || '알 수 없는 오류'
              : lastErr.message;
            
            // 사용자 정보 오류인 경우 정보 확인 페이지로 리다이렉트
            if (typeof lastErr.message === 'object' && lastErr.message.requires_info_recheck) {
              newProgress.errorMessage = errMsg;
              setTimeout(() => {
                console.log('[수집페이지] 사용자 정보 오류 - 로그인 페이지로 이동');
                navigate(`/login?uuid=${uuid}&hospital=${hospital}&info_required=true`);
              }, 3000);
            } else {
              newProgress.errorMessage = errMsg;
              // 처방전 타임아웃 등 일반 에러인 경우 5초 후 랜딩 페이지로 이동
              setTimeout(() => {
                console.log('[수집페이지] 에러 발생 - 랜딩 페이지로 이동');
                navigate('/');
              }, 5000);
            }
          } else {
            newProgress.errorMessage = result.error_message || '알 수 없는 오류';
            // 에러 메시지가 없는 경우에도 5초 후 랜딩 페이지로 이동
            setTimeout(() => {
              console.log('[수집페이지] 에러 발생 - 랜딩 페이지로 이동');
              navigate('/');
            }, 5000);
          }
          break;

        default:
          newProgress.progress = 5;
          newProgress.currentStep = '초기화';
          newProgress.message = '데이터 수집을 준비하고 있습니다...';
      }

      setProgress(newProgress);

      // 완료되면 결과 페이지로 이동 - 세션에서 uuid와 hospital 가져오기
      if (newProgress.isCompleted) {
        setTimeout(async () => {
          console.log('[수집페이지] 수집 완료 - 결과 페이지로 이동');
          
          // URL 파라미터에서 가져오기
          let finalUuid = uuid;
          let finalHospital = hospital;
          
          // URL 파라미터가 없으면 세션에서 가져오기
          if (!finalUuid || !finalHospital) {
            try {
              const savedSessionId = localStorage.getItem('tilko_session_id');
              if (savedSessionId) {
                // 세션 상태 API 호출하여 patient_uuid와 hospital_id 가져오기
                const response = await fetch(`/api/v1/tilko/session/status/${savedSessionId}`);
                if (response.ok) {
                  const result = await response.json();
                  if (result.success && result.patient_uuid && result.hospital_id) {
                    finalUuid = result.patient_uuid;
                    finalHospital = result.hospital_id;
                    console.log('[수집페이지] 세션에서 UUID/Hospital 가져옴:', { uuid: finalUuid, hospital: finalHospital });
                  }
                }
              }
              
              // 세션 API 실패 시 localStorage의 세션 데이터에서 가져오기
              if (!finalUuid || !finalHospital) {
                const savedSessionData = localStorage.getItem('tilko_session_data');
                if (savedSessionData) {
                  try {
                    const sessionData = JSON.parse(savedSessionData);
                    finalUuid = finalUuid || sessionData?.patient_uuid || sessionData?.user_info?.patient_uuid;
                    finalHospital = finalHospital || sessionData?.hospital_id || sessionData?.user_info?.hospital_id;
                    console.log('[수집페이지] localStorage 세션 데이터에서 UUID/Hospital 가져옴:', { uuid: finalUuid, hospital: finalHospital });
                  } catch (e) {
                    console.warn('[수집페이지] 세션 데이터 파싱 실패:', e);
                  }
                }
              }
            } catch (error) {
              console.warn('[수집페이지] 세션에서 UUID/Hospital 가져오기 실패:', error);
            }
          }
          
          if (finalUuid && finalHospital) {
            navigate(`/results-trend?uuid=${finalUuid}&hospital=${finalHospital}`);
          } else {
            console.warn('[수집페이지] UUID/Hospital 없음 - 결과 페이지로 이동 (파라미터 없음)');
            navigate('/results-trend');
          }
        }, 2000);
      }

    } catch (error) {
      console.error('[수집페이지] 상태 확인 실패:', error);
      setProgress(prev => ({
        ...prev,
        hasError: true,
        currentStep: '연결이 끊겼어요',
        message: '연결이 잠시 끊겼어요',
        errorMessage: error instanceof Error ? error.message : '알 수 없는 오류'
      }));
      
      // 에러 발생 시 5초 후 랜딩 페이지로 이동
      setTimeout(() => {
        console.log('[수집페이지] 연결 오류 - 랜딩 페이지로 이동');
        navigate('/');
      }, 5000);
    }
  }, [sessionId, uuid, hospital, navigate]);

  // 초기 상태 확인 및 주기적 업데이트
  useEffect(() => {
    if (!sessionId) {
      console.error('[수집페이지] 세션 ID 누락');
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
    console.log('[수집페이지] 재시도');
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
    <div className="collecting-data-page" data-testid="collecting-data-page">
      <div className="collecting-container">
        <div className="collecting-header">
          <h1>건강정보 수집 중</h1>
          <p>안전하게 가져오고 있어요. 조금만 기다려주세요</p>
        </div>

        <div className="progress-section">
          {/* 진행률 바 */}
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              data-testid="collecting-progress"
              role="progressbar"
              aria-valuenow={progress.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`데이터 수집 진행률 ${progress.progress}%`}
            >
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
                <span className="error-icon" role="img" aria-label="오류">❌</span>
              ) : progress.isCompleted ? (
                <span className="success-icon" role="img" aria-label="완료">✅</span>
              ) : (
                <div className="loading-spinner" aria-hidden="true" />
              )}
            </div>
            <div className="step-info">
              <h3>{progress.currentStep}</h3>
              <p
                data-testid="collecting-status-text"
                aria-live="polite"
                aria-atomic="true"
              >
                {progress.message}{!progress.hasError && !progress.isCompleted && dots}
              </p>
              {progress.errorMessage && (
                <p className="error-message" role="alert" aria-live="assertive">
                  {progress.errorMessage}
                </p>
              )}
            </div>
          </div>

          {/* 단계별 체크리스트 */}
          <div className="steps-checklist" role="list" aria-label="수집 단계">
            <div
              className={`step-item ${progress.progress >= 10 ? 'completed' : 'pending'}`}
              role="listitem"
              aria-label={`1단계: 인증 완료 ${progress.progress >= 10 ? '완료' : '대기 중'}`}
            >
              <span className="step-number">1</span>
              <span className="step-label">인증 완료</span>
              {progress.progress >= 10 && <span className="check-mark" aria-hidden="true">✓</span>}
            </div>
            <div
              className={`step-item ${progress.progress >= 30 ? 'completed' : progress.progress >= 10 ? 'active' : 'pending'}`}
              role="listitem"
              aria-label={`2단계: 건강검진 데이터 수집 ${progress.progress >= 70 ? '완료' : progress.progress >= 10 ? '진행 중' : '대기 중'}`}
            >
              <span className="step-number">2</span>
              <span className="step-label">건강검진 데이터 수집</span>
              {progress.progress >= 70 && <span className="check-mark" aria-hidden="true">✓</span>}
            </div>
            <div
              className={`step-item ${progress.progress >= 70 ? 'completed' : progress.progress >= 30 ? 'active' : 'pending'}`}
              role="listitem"
              aria-label={`3단계: 처방전 데이터 수집 ${progress.progress >= 100 ? '완료' : progress.progress >= 30 ? '진행 중' : '대기 중'}`}
            >
              <span className="step-number">3</span>
              <span className="step-label">처방전 데이터 수집</span>
              {progress.progress >= 100 && <span className="check-mark" aria-hidden="true">✓</span>}
            </div>
            <div
              className={`step-item ${progress.progress >= 100 ? 'completed' : progress.progress >= 70 ? 'active' : 'pending'}`}
              role="listitem"
              aria-label={`4단계: 데이터 저장 완료 ${progress.progress >= 100 ? '완료' : progress.progress >= 70 ? '진행 중' : '대기 중'}`}
            >
              <span className="step-number">4</span>
              <span className="step-label">데이터 저장 완료</span>
              {progress.progress >= 100 && <span className="check-mark" aria-hidden="true">✓</span>}
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="action-buttons">
          {progress.hasError && (
            <>
              <button
                onClick={handleRetry}
                className="retry-button"
                aria-label="데이터 수집 다시 시도"
              >
                다시 시도
              </button>
              <button
                onClick={handleGoHome}
                className="home-button"
                aria-label="처음 페이지로 돌아가기"
              >
                처음으로
              </button>
            </>
          )}
          {progress.isCompleted && (
            <button
              onClick={() => navigate(`/results-trend?uuid=${uuid}&hospital=${hospital}`)}
              className="view-results-button"
              aria-label="수집 완료 — 결과 보기"
            >
              결과 보기
            </button>
          )}
        </div>

        {/* 안내 메시지 */}
        <div className="info-message" aria-label="개인정보 안내">
          <p>🛡️ 개인정보는 안전하게 암호화되어 처리됩니다.</p>
          <p>수집된 데이터는 건강 분석에만 사용됩니다.</p>
          <p>⏱️ 일반적으로 1-2분 정도 소요됩니다.</p>
        </div>
      </div>
    </div>
  );
};

export default CollectingDataPage;

