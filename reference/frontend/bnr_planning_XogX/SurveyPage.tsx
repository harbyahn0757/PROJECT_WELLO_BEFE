import React, { useEffect, useState } from 'react';
import { useCampaignSkin } from './hooks/useCampaignSkin';
import { useSurveyData } from './hooks/useSurveyData';
import { ProgressBar } from './components/ProgressBar';
import { QuestionCard } from './components/QuestionCard';
import { CustomCalendar } from './components/CustomCalendar';
import { QuestionInfo } from './types';
import { checkQuestionnaireStatus } from '../../xog-partner-office/services/partnerMarketingApi';
import { usePageTracking, getMktUuidFromUrl } from '../../hooks/usePageTracking';
import './styles/campaign.scss';
import xogIcon from './assets/images/xog_icon.png';

interface SurveyPageProps {
  onComplete?: () => void;
  className?: string;
}

// 설문 질문 정보
const SURVEY_QUESTIONS: QuestionInfo[] = [
  {
    number: 1,
    title: '흡연을 하시나요?',
    type: 'radio',
    name: 'smoking',
    options: [
      { value: 'yes', label: '예', id: 'smoking_yes' },
      { value: 'quit', label: '금연중', id: 'smoking_quit' },
      { value: 'no', label: '아니오', id: 'smoking_no' },
    ],
  },
  {
    number: 2,
    title: '가족력이 있는 질병이 있나요?',
    subtitle: '없음 선택 또는 질병 중복 체크 가능',
    type: 'checkbox',
    name: 'familyHistory',
    options: [
      { value: 'none', label: '없음', id: 'family_none' },
      { value: 'hypertension', label: '고혈압', id: 'family_hypertension' },
      { value: 'stroke', label: '뇌혈관질환', id: 'family_stroke' },
      { value: 'diabetes', label: '당뇨', id: 'family_diabetes' },
      { value: 'colon_cancer', label: '대장암', id: 'family_colon_cancer' },
      { value: 'heart_disease', label: '심혈관질환', id: 'family_heart_disease' },
      { value: 'thyroid_cancer', label: '갑상선암', id: 'family_thyroid_cancer' },
      { value: 'kidney_cancer', label: '신장암', id: 'family_kidney_cancer' },
      { value: 'breast_cancer', label: '유방암', id: 'family_breast_cancer' },
      { value: 'prostate_cancer', label: '전립선암', id: 'family_prostate_cancer' },
      { value: 'lung_cancer', label: '폐암', id: 'family_lung_cancer' },
    ],
  },
  {
    number: 3,
    title: '현재 앓고 있는 질환이 있나요?',
    subtitle: '없음 선택 또는 질병 중복 체크 가능',
    type: 'checkbox',
    name: 'currentDisease',
    options: [
      { value: 'none', label: '없음', id: 'current_none' },
      { value: 'cirrhosis', label: '간경화', id: 'current_cirrhosis' },
      { value: 'thyroiditis', label: '갑상선염', id: 'current_thyroiditis' },
      { value: 'hypertension', label: '고혈압', id: 'current_hypertension' },
      { value: 'colitis', label: '궤양성대장염', id: 'current_colitis' },
      { value: 'stroke', label: '뇌혈관질환', id: 'current_stroke' },
      { value: 'late_menopause', label: '늦은 폐경', id: 'current_late_menopause' },
      { value: 'gallbladder_polyp', label: '담낭용종', id: 'current_gallbladder_polyp' },
      { value: 'gallstones', label: '담석증', id: 'current_gallstones' },
      { value: 'diabetes', label: '당뇨', id: 'current_diabetes' },
      { value: 'gastritis', label: '만성위염', id: 'current_gastritis' },
      { value: 'hepatitis_b', label: '바이러스성 간염 B형', id: 'current_hepatitis_b' },
      { value: 'hepatitis_c', label: '바이러스성 간염 C형', id: 'current_hepatitis_c' },
      { value: 'heart_disease', label: '심혈관질환', id: 'current_heart_disease' },
      { value: 'alzheimer', label: '알츠하이머병', id: 'current_alzheimer' },
      { value: 'typhoid_carrier', label: '장티푸스 보균자', id: 'current_typhoid_carrier' },
      { value: 'pancreatitis', label: '췌장염', id: 'current_pancreatitis' },
      { value: 'helicobacter', label: '헬리코박터균 감염', id: 'current_helicobacter' },
    ],
  },
  {
    number: 4,
    title: '현재 앓고 있는 암이 있나요?',
    subtitle: '없음 선택 또는 암 중복 체크 가능',
    type: 'checkbox',
    name: 'currentCancer',
    options: [
      { value: 'none', label: '없음', id: 'cancer_none' },
      { value: 'liver', label: '간암', id: 'cancer_liver' },
      { value: 'thyroid', label: '갑상선암', id: 'cancer_thyroid' },
      { value: 'gallbladder', label: '담낭암', id: 'cancer_gallbladder' },
      { value: 'colon', label: '대장암', id: 'cancer_colon' },
      { value: 'kidney', label: '신장암', id: 'cancer_kidney' },
      { value: 'stomach', label: '위암', id: 'cancer_stomach' },
      { value: 'breast', label: '유방암', id: 'cancer_breast' },
      { value: 'prostate', label: '전립선암', id: 'cancer_prostate' },
      { value: 'pancreatic', label: '췌장암', id: 'cancer_pancreatic' },
      { value: 'lung', label: '폐암', id: 'cancer_lung' },
    ],
  },
  {
    number: 5,
    title: '음주를 하시나요?',
    subtitle: '기준: 주 1회 이상, 소주 1병 이상 또는 맥주 1000cc 이상',
    type: 'radio',
    name: 'drinking',
    options: [
      { value: 'yes', label: '예', id: 'drinking_yes' },
      { value: 'no', label: '아니오', id: 'drinking_no' },
    ],
  },
];

export const SurveyPage: React.FC<SurveyPageProps> = ({
  onComplete,
  className = '',
}) => {
  const { createUrlWithSkin } = useCampaignSkin();
  const {
    currentQuestion,
    surveyData,
    progressInfo,
    isCompleted,
    buttonText,
    isButtonEnabled,
    updateBirthDate,
    updateRadioAnswer,
    updateCheckboxAnswer,
    goToNextQuestion,
    setCurrentQuestion,
  } = useSurveyData();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  
  // 페이지 추적 훅 추가
  const mktUuid = getMktUuidFromUrl();
  const { recordPageExit } = usePageTracking({
    mktUuid: mktUuid || undefined,
    enabled: !!mktUuid,
    trackTimeSpent: true
  });

  // 이전 질문 상태 추적용
  const [prevQuestion, setPrevQuestion] = useState<number>(currentQuestion);

  // 문진 단계별 이벤트 기록
  const recordQuestionStepEvent = async (questionNum: number, action: 'enter' | 'exit') => {
    if (!mktUuid) return;
    
    try {
      await fetch('/api/partner-marketing/tracking/page-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mkt_uuid: mktUuid,
          page_url: `${window.location.href}#question-${questionNum}`,
          session_id: `survey-session-${Date.now()}`,
          event_type: `survey_question_${action}`,
          question_number: questionNum,
          progress_info: progressInfo
        }),
      });
      console.log(`📝 문진 ${questionNum}단계 ${action} 기록 완료`);
    } catch (error) {
      console.warn(`문진 단계 추적 실패:`, error);
    }
  };

  // 질문 변경 감지 및 이벤트 기록
  useEffect(() => {
    if (currentQuestion !== prevQuestion) {
      // 이전 질문에서 나가는 이벤트
      if (prevQuestion >= -1) {
        recordQuestionStepEvent(prevQuestion, 'exit');
      }
      
      // 새 질문으로 들어가는 이벤트
      if (currentQuestion >= -1) {
        recordQuestionStepEvent(currentQuestion, 'enter');
      }
      
      setPrevQuestion(currentQuestion);
    }
  }, [currentQuestion, prevQuestion, mktUuid]);

  // 설문 데이터를 백엔드로 전송
  const submitQuestionnaire = async (mktUuid: string, questionnaireData: any) => {
    try {
      const response = await fetch('/api/partner-marketing/campaign/questionnaire-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mkt_uuid: mktUuid,
          questionnaire_data: questionnaireData
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '설문 전송에 실패했습니다.');
      }

      return result;
    } catch (error) {
      console.error('설문 전송 오류:', error);
      throw error;
    }
  };

  // 완료 처리
  const handleComplete = async () => {
    if (isSubmitting) return;

    const mktUuid = getMktUuidFromUrl();
    if (!mktUuid) {
      console.error('mkt_uuid를 찾을 수 없습니다.');
      setSubmitError('잘못된 접근입니다.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 설문 데이터 준비
      const questionnaireData = {
        birthDate: surveyData.birthDate,
        smoking: surveyData.smoking,
        drinking: surveyData.drinking,
        familyHistory: surveyData.familyHistory,
        currentDisease: surveyData.currentDisease,
        currentCancer: surveyData.currentCancer,
        completed_at: new Date().toISOString(),
        source: 'campaign_survey'
      };

      // 백엔드로 전송
      const result = await submitQuestionnaire(mktUuid, questionnaireData);
      
      console.log('설문 완료:', result);
      
      // 성공 후 기본 동작 수행
      if (onComplete) {
        onComplete();
      } else {
        // 기본 동작: 이벤트 페이지로 돌아가기
        const eventUrl = createUrlWithSkin('/');
        window.location.href = eventUrl;
      }
    } catch (error) {
      console.error('설문 완료 처리 오류:', error);
      setSubmitError(error instanceof Error ? error.message : '설문 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 액션 버튼 클릭
  const handleActionClick = () => {
    if (isCompleted) {
      handleComplete();
    } else {
      goToNextQuestion();
    }
  };

  // 라디오 답변 변경
  const handleRadioChange = (questionName: keyof typeof surveyData, value: string) => {
    updateRadioAnswer(questionName, value);
    
    // 흡연 질문(질문 1)에서 선택하면 자동으로 다음 페이지로 이동
    if (questionName === 'smoking' && currentQuestion === 1) {
      setTimeout(() => {
        goToNextQuestion();
      }, 800); // 800ms 후 자동 이동 (사용자가 선택을 확인할 수 있는 시간)
    }
    
    // 음주 질문(질문 5)에서 선택하면 자동으로 완료로 이동
    if (questionName === 'drinking' && currentQuestion === 5) {
      setTimeout(() => {
        goToNextQuestion(); // 완료 상태로 이동
      }, 300); // 300ms 후 자동 이동 (더 빠르게)
    }
  };

  // 체크박스 답변 변경
  const handleCheckboxChange = (questionName: keyof typeof surveyData, value: string, checked: boolean) => {
    updateCheckboxAnswer(questionName, value, checked);
  };

  // 현재 질문 정보 가져오기
  const getCurrentQuestion = (): QuestionInfo | null => {
    if (currentQuestion >= 1 && currentQuestion <= 5) {
      return SURVEY_QUESTIONS[currentQuestion - 1];
    }
    return null;
  };

  // 현재 질문 답변 가져오기
  const getCurrentAnswers = () => {
    const question = getCurrentQuestion();
    if (!question) return undefined;

    switch (question.name) {
      case 'smoking':
        return surveyData.smoking;
      case 'drinking':
        return surveyData.drinking;
      case 'familyHistory':
        return surveyData.familyHistory;
      case 'currentDisease':
        return surveyData.currentDisease;
      case 'currentCancer':
        return surveyData.currentCancer;
      default:
        return undefined;
    }
  };

  // 컴포넌트 마운트 시 문진 완료 상태 체크
  useEffect(() => {
    const checkExistingQuestionnaire = async () => {
      const mktUuid = getMktUuidFromUrl();
      if (!mktUuid) {
        setIsCheckingStatus(false);
        setCurrentQuestion(-1);
        return;
      }

      try {
        console.log('🔍 문진 완료 상태 체크 시작:', mktUuid);
        const status = await checkQuestionnaireStatus(mktUuid);
        
        if (status.success && status.questionnaire_completed) {
          console.log('✅ 문진이 이미 완료됨:', status.customer_info?.name);
          // 문진이 이미 완료된 경우 완료 상태로 바로 이동
          setCurrentQuestion(6); // 완료 상태 (currentQuestion > 5)
        } else {
          console.log('📝 문진을 새로 시작합니다.');
          // 문진이 완료되지 않은 경우 생년월일 입력 페이지로 이동
          setCurrentQuestion(-1);
        }
      } catch (error) {
        console.error('❌ 문진 상태 체크 실패:', error);
        // 에러 시에는 새로운 문진을 시작
        setCurrentQuestion(-1);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkExistingQuestionnaire();
  }, [setCurrentQuestion]);

  // 상태 체크 로딩 중일 때는 렌더링하지 않음
  if (isCheckingStatus) {
    return (
      <div className={`survey-page campaign-container ${className}`}>
        <div className="survey-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <div className="loading-text">문진 정보 확인 중...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`survey-page campaign-container ${className}`}>
      {/* 상단 헤더 */}
      <div className="survey-header">
        <div className="header-content">
          <div className="xog-icon">
            <img src={xogIcon} alt="Xog 쏙" className="icon-image" />
          </div>
          <h1>건강 문진</h1>
          <p>간단한 문진으로 질병 예측 리포트로 검진 설계 받으세요</p>
        </div>
      </div>

      {/* 프로그레스바 */}
      <div className="progress-section">
        <ProgressBar progressInfo={progressInfo} />
      </div>
        
        <div className="survey-content">
          {/* 생년월일 입력 페이지 */}
          {currentQuestion === -1 && (
            <div className="question-card">
              <CustomCalendar
                value={surveyData.birthDate}
                onChange={updateBirthDate}
              />
              <div style={{ 
                fontSize: 'var(--font-sm)', 
                color: 'var(--text-secondary)', 
                textAlign: 'center', 
                marginTop: '16px' 
              }}>
                입력하신 정보는 건강 분석 목적으로만 사용됩니다
              </div>
            </div>
          )}

          {/* 질문 1-5 */}
          {currentQuestion >= 1 && currentQuestion <= 5 && (
            <QuestionCard
              question={getCurrentQuestion()!}
              values={getCurrentAnswers()}
              onRadioChange={(value) => handleRadioChange(getCurrentQuestion()!.name as keyof typeof surveyData, value)}
              onCheckboxChange={(value, checked) => handleCheckboxChange(getCurrentQuestion()!.name as keyof typeof surveyData, value, checked)}
            />
          )}

          {/* 결과 페이지 */}
          {isCompleted && (
            <div className="question-card">
              <div className="completion-card">
                {isSubmitting ? (
                  <>
                    <div className="completion-icon processing">
                      <div className="loading-spinner"></div>
                    </div>
                    <div className="completion-title">설문을 처리하고 있습니다...</div>
                    <div className="completion-text">잠시만 기다려주세요</div>
                  </>
                ) : submitError ? (
                  <>
                    <div className="completion-icon error">❌</div>
                    <div className="completion-title error">오류가 발생했습니다</div>
                    <div className="completion-text">{submitError}</div>
                  </>
                ) : (
                  <>
                    <div className="completion-icon success">
                      <div className="success-checkmark">✓</div>
                    </div>
                    <div className="completion-title success">🎉 질병예측서비스 선택 완료!</div>
                    <div className="completion-subtitle">AI 기반 맞춤형 건강검진 플래닝이 시작됩니다</div>
                    <div className="completion-features">
                      <div className="feature-item">
                        <span className="feature-icon">🧬</span>
                        <span className="feature-text">AI 질병 위험도 분석</span>
                      </div>
                      <div className="feature-item">
                        <span className="feature-icon">📋</span>
                        <span className="feature-text">개인 맞춤 검진 계획</span>
                      </div>
                      <div className="feature-item">
                        <span className="feature-icon">📱</span>
                        <span className="feature-text">실시간 레포트 전송</span>
                      </div>
                    </div>
                    <div className="completion-text">귀하의 건강 정보를 바탕으로<br/>맞춤형 질병예측 리포트가 곧 생성됩니다</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* 하단 액션 버튼 - 완료 상태에서는 숨김 */}
        {!isCompleted && (
          <div className="bottom-actions">
            <button 
              className="action-button" 
              onClick={handleActionClick}
              disabled={!isButtonEnabled || isSubmitting}
              type="button"
            >
              {isSubmitting ? '처리 중...' : buttonText}
            </button>
          </div>
        )}
      </div>
  );
};

export default SurveyPage; 