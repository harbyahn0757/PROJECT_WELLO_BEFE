import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSurveyData } from '../hooks/useSurveyData';
import { QuestionCard } from './QuestionCard';
import { CustomCalendar } from './CustomCalendar';
import { QuestionInfo } from '../types';
import { SURVEY_QUESTIONS } from '../constants/surveyQuestions';
import { AIMSRequestModal } from './AIMSRequestModal';
import { AIMSLoadingScreen } from './AIMSLoadingScreen';
import { convertSchemaToQuestionInfo } from '../utils/questionnaireConverter';
import { getMktUuidFromUrl, checkQuestionnaireStatus, questionnaireAPI } from '../utils/legacyCompat';
import { trackSurveyStep } from '../utils/gtm';
import welnoLogo from '../assets/images/welno_logo 2.png';
import '../styles/survey-slideup.scss';

interface SurveySlideUpPanelProps {
  isOpen: boolean;
  onComplete?: () => void;
  onClose?: () => void;
  agreementData?: Array<{id: string; label: string; required: boolean; checked: boolean; agreedAt?: string}> | null;
  birthDate?: {year: string | null; month: string | null; day: string | null} | null;
  initialName?: string | null;
  partnerId?: string | null; // 파트너 ID (템플릿 조회용)
}

/**
 * 동적 문진 데이터를 기존 형식으로 변환 (AIMS API 호환성)
 */
const convertDynamicToLegacyFormat = (
  surveyData: Record<string, any>,
  questions: QuestionInfo[]
): Record<string, any> => {
  // 기존 형식 필드명 매핑
  const legacyData: Record<string, any> = {
    birthDate: surveyData.birthDate,
    smoking: surveyData.smoking,
    drinking: surveyData.drinking,
    familyHistory: surveyData.familyHistory || [],
    currentDisease: surveyData.currentDisease || [],
    currentCancer: surveyData.currentCancer || [],
    completed_at: new Date().toISOString(),
    source: 'campaign_survey'
  };
  
  // 질문 이름 기반으로 매핑 (동적 질문 지원)
  questions.forEach(question => {
    const answer = surveyData[question.name];
    
    // 기존 필드명과 매칭
    if (question.name === 'smoking' || question.name.toLowerCase().includes('smoking')) {
      legacyData.smoking = answer;
    } else if (question.name === 'drinking' || question.name.toLowerCase().includes('drinking')) {
      legacyData.drinking = answer;
    } else if (question.name === 'familyHistory' || question.name.toLowerCase().includes('family')) {
      legacyData.familyHistory = Array.isArray(answer) ? answer : [];
    } else if (question.name === 'currentDisease' || question.name.toLowerCase().includes('disease')) {
      legacyData.currentDisease = Array.isArray(answer) ? answer : [];
    } else if (question.name === 'currentCancer' || question.name.toLowerCase().includes('cancer')) {
      legacyData.currentCancer = Array.isArray(answer) ? answer : [];
    } else if (question.name === 'birthDate' || question.name.toLowerCase().includes('birth')) {
      legacyData.birthDate = answer;
    }
  });
  
  return legacyData;
};

// 진행 네비게이션 인디케이터 컴포넌트
const SurveyNavigationIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}> = ({ currentStep, totalSteps, onPrevious, onNext, canGoPrevious, canGoNext }) => {
  return (
    <div className="survey-navigation-indicator">
      {/* 왼쪽 버튼 - 공간 고정 */}
      <div className="nav-arrow-container nav-arrow-left-container">
        {canGoPrevious && (
          <button
            type="button"
            className="nav-arrow nav-arrow-left"
            onClick={onPrevious}
            aria-label="이전"
          >
            &lt;
          </button>
        )}
      </div>
      <div className="nav-dots-container">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;
          
          return (
            <React.Fragment key={stepNumber}>
              <div
                className={`nav-dot ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                {isCompleted && (
                  <img src={welnoLogo} alt="웰노 로고" className="nav-dot-icon" />
                )}
              </div>
              {index < totalSteps - 1 && (
                <div className={`nav-line ${isCompleted ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {/* 오른쪽 버튼 - 공간 고정 */}
      <div className="nav-arrow-container nav-arrow-right-container">
        {canGoNext && (
          <button
            type="button"
            className="nav-arrow nav-arrow-right"
            onClick={onNext}
            aria-label="다음"
          >
            &gt;
          </button>
        )}
      </div>
    </div>
  );
};

export const SurveySlideUpPanel: React.FC<SurveySlideUpPanelProps> = ({
  isOpen,
  onComplete,
  onClose,
  agreementData,
  birthDate,
  initialName,
  partnerId,
}) => {
  // 템플릿 및 질문 상태
  const [questionnaireTemplate, setQuestionnaireTemplate] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionInfo[]>([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  
  const {
    currentQuestion,
    surveyData,
    progressInfo,
    isCurrentQuestionAnswered,
    isCompleted,
    buttonText,
    isButtonEnabled,
    canGoPrevious,
    canGoNext,
    updateBirthDate,
    updateRadioAnswer,
    updateCheckboxAnswer,
    goToNextQuestion,
    goToPreviousQuestion,
    setCurrentQuestion,
    restoreSurveyData,
  } = useSurveyData(questions); // 동적 질문 배열 전달

  // 스와이프 제스처 상태 (X축: 좌우, Y축: 상하)
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  // 최소 스와이프 거리 (50px)
  const minSwipeDistance = 50;

  // 터치 시작
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchEndY(null);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  // 터치 이동
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  // 터치 종료 및 스와이프 처리
  const onTouchEnd = () => {
    if (!touchStartX || !touchEndX || !touchStartY || !touchEndY) return;

    // Y축 스와이프 (아래로 내리기) - 패널 닫기
    const distanceY = touchEndY - touchStartY;
    const isDownSwipe = distanceY > minSwipeDistance;
    
    if (isDownSwipe && onClose) {
      // 아래로 스와이프 시 패널 닫기
      onClose();
      return;
    }

    // X축 스와이프 (좌우) - 이전/다음 질문
    const distanceX = touchStartX - touchEndX;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;

    if (isLeftSwipe && canGoNext && isButtonEnabled) {
      // 왼쪽으로 스와이프 (다음) - 답변이 완료되었을 때만
      goToNextQuestion();
    } else if (isRightSwipe && canGoPrevious) {
      // 오른쪽으로 스와이프 (이전)
      handlePreviousButtonClick();
    }
  };


  // 이전 버튼 클릭 핸들러 (추적 추가)
  const handlePreviousButtonClick = () => {
    const currentQ = questions[currentQuestion - 1];
    const previousQ = questions[currentQuestion - 2];
    
    // 이전 단계로 이동 추적
    trackSurveyStep('step_previous', {
      mkt_uuid: getMktUuidFromUrl() || null,
      from_step: currentQuestion,
      to_step: currentQuestion - 1,
      total_steps: totalSteps,
      current_question_name: currentQ?.name,
      current_question_title: currentQ?.title,
      previous_question_name: previousQ?.name,
      previous_question_title: previousQ?.title,
      current_answer: surveyData[currentQ?.name]
    });
    
    goToPreviousQuestion();
    
    // 이전 단계 시작 추적
    if (currentQuestion > 1) {
      trackSurveyStep('step_start', {
        mkt_uuid: getMktUuidFromUrl() || null,
        step_number: currentQuestion - 1,
        total_steps: totalSteps,
        question_name: previousQ?.name,
        question_title: previousQ?.title,
        question_type: previousQ?.type,
        is_returning: true // 이전 질문으로 돌아온 경우
      });
    }
  };

  // 다음 버튼 클릭 핸들러 (로깅 추가)
  const handleNextButtonClick = () => {
    const currentQ = questions[currentQuestion - 1];
    const nextQ = questions[currentQuestion];
    console.log('🔘 [다음 버튼] 다음 버튼 클릭:', {
      currentQuestion,
      totalSteps,
      isButtonEnabled,
      isCurrentQuestionAnswered,
      questionName: currentQ?.name,
      currentAnswer: surveyData[currentQ?.name]
    });
    
    // 단계 완료 추적 (더 상세하게)
    trackSurveyStep('step_complete', {
      mkt_uuid: getMktUuidFromUrl() || null,
      step_number: currentQuestion,
      total_steps: totalSteps,
      question_name: currentQ?.name,
      question_title: currentQ?.title,
      question_type: currentQ?.type,
      answer: surveyData[currentQ?.name],
      answer_type: currentQ?.type,
      time_spent_seconds: null, // TODO: 시간 측정 추가 가능
      is_answered: isCurrentQuestionAnswered
    });
    
    goToNextQuestion();
    
    // 다음 단계 시작 추적 (더 상세하게)
    if (currentQuestion < totalSteps && nextQ) {
      trackSurveyStep('step_start', {
        mkt_uuid: getMktUuidFromUrl() || null,
        step_number: currentQuestion + 1,
        total_steps: totalSteps,
        question_name: nextQ?.name,
        question_title: nextQ?.title,
        question_type: nextQ?.type,
        question_subtitle: nextQ?.subtitle,
        total_options: nextQ?.options?.length || 0,
        is_returning: false
      });
    }
  };

  // 질문 화면
  const renderQuestion = (question: QuestionInfo) => {
    // 동적 질문 지원: question.name을 키로 사용
    const currentAnswer = surveyData[question.name];
    
    // BirthDate 타입이 아닌 경우에만 QuestionCard에 전달
    const questionValues: string | string[] | undefined = 
      question.name === 'birthDate' || question.type === 'birthdate'
        ? undefined 
        : (currentAnswer as string | string[] | undefined);
    
    // 라디오 버튼 변경 핸들러
    const handleRadioChange = (value: string) => {
      console.log('🔘 [라디오 변경] 라디오 버튼 선택:', {
        questionName: question.name,
        selectedValue: value,
        previousValue: currentAnswer
      });
      
      // 답변 변경 추적
      trackSurveyStep('answer_change', {
        mkt_uuid: getMktUuidFromUrl() || null,
        step_number: currentQuestion,
        total_steps: totalSteps,
        question_name: question.name,
        question_title: question.title,
        question_type: question.type,
        answer_type: 'radio',
        selected_value: value,
        previous_value: currentAnswer,
        all_options: question.options?.map(opt => opt.value) || []
      });
      
      updateRadioAnswer(question.name, value);
      
      // 라디오 타입 질문에서 선택하면 자동으로 다음 질문으로 이동
      if (question.type === 'radio') {
        console.log('⏳ [라디오 변경] 300ms 후 자동으로 다음 질문으로 이동');
        // 약간의 지연 후 자동으로 다음 질문으로 이동 (사용자가 선택을 확인할 수 있는 시간)
        setTimeout(() => {
          console.log('🔄 [라디오 변경] 자동 다음 질문 이동 실행');
          goToNextQuestion();
        }, 300);
      }
    };
    
    return (
      <QuestionCard
        question={question}
        values={questionValues}
        onRadioChange={handleRadioChange}
        onCheckboxChange={(value, checked) => {
          console.log('☑️ [체크박스 변경] 체크박스 선택:', {
            questionName: question.name,
            value,
            checked,
            previousValues: surveyData[question.name]
          });
          
          // 답변 변경 추적
          const previousValues = Array.isArray(surveyData[question.name]) ? surveyData[question.name] : [];
          const newValues = checked 
            ? [...previousValues, value].filter((v: string) => v !== 'none' || value === 'none')
            : previousValues.filter((v: string) => v !== value);
          
          trackSurveyStep('answer_change', {
            mkt_uuid: getMktUuidFromUrl() || null,
            step_number: currentQuestion,
            total_steps: totalSteps,
            question_name: question.name,
            question_title: question.title,
            question_type: question.type,
            answer_type: 'checkbox',
            selected_value: value,
            is_checked: checked,
            previous_values: previousValues,
            current_values: checked ? newValues : previousValues.filter((v: string) => v !== value),
            all_options: question.options?.map(opt => opt.value) || []
          });
          
          updateCheckboxAnswer(question.name, value, checked);
        }}
        totalQuestions={totalSteps}
      />
    );
  };

  // AIMS Request Body 생성
  const handleGenerateAIMSRequest = async () => {
    const mktUuid = getMktUuidFromUrl();
    if (!mktUuid) {
      console.error('mkt_uuid를 찾을 수 없습니다.');
      return;
    }

    setIsGeneratingRequest(true);
    try {
      // 동적 데이터를 기존 형식으로 변환
      const legacyQuestionnaireData = convertDynamicToLegacyFormat(surveyData, questions);
      
      // API 호출
      const response = await fetch('/api/partner-marketing/generate-aims-request-body', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mkt_uuid: mktUuid,
          questionnaire_data: legacyQuestionnaireData, // 기존 형식으로 변환된 데이터
          agreement_data: agreementData || [],
          template_id: questionnaireTemplate?.content_type_id // 템플릿 ID 전달 (동적 매핑용)
        }),
      });

      const result = await response.json();

      if (result.success && result.request_body) {
        setAimsRequestBody(result.request_body);
        setShowAIMSModal(true);
      } else {
        console.error('AIMS Request Body 생성 실패:', result.error);
        alert(`Request Body 생성 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('AIMS Request Body 생성 중 오류:', error);
      alert('Request Body 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingRequest(false);
    }
  };

  // 완료 화면
  // 리포트 페이지로 이동하는 공통 함수
  const navigateToReportPage = useCallback((mktUuid: string) => {
    console.log('🔄 [리포트 페이지 이동] 리포트 페이지로 이동 시작');
    if (!mktUuid) {
      console.error('❌ [리포트 페이지 이동] mkt_uuid 없음 - 리포트 페이지 이동 불가');
      return;
    }
    // 현재 URL을 기반으로 리포트 페이지 URL 생성 (모든 파라미터 유지)
    const reportUrl = new URL(window.location.href);
    
    // 원본 파라미터가 있으면 우선 사용, 없으면 현재 URL 파라미터 사용
    if (originalUrlParamsRef.current) {
      originalUrlParamsRef.current.forEach((value, key) => {
        if (key !== 'page' && key !== 'uid') {
          reportUrl.searchParams.set(key, value);
        }
      });
    }
    
    // uid와 page 파라미터 설정
    reportUrl.searchParams.set('uid', mktUuid);
    reportUrl.searchParams.set('page', 'report');
    
    console.log('🔄 [리포트 페이지 이동] 리포트 페이지 URL:', reportUrl.toString());
    window.location.href = reportUrl.toString();
  }, []);

  const renderCompletion = () => {
    // 로딩 화면 표시 중이면 로딩 화면만 표시
    if (showLoadingScreen) {
      const mktUuid = mktUuidRef.current || getMktUuidFromUrl();
      return (
        <AIMSLoadingScreen
          customerName={customerName}
          hasError={aimsApiError}
          onComplete={() => {
            // 에러 상태가 아니면 리포트 페이지로 이동
            if (!aimsApiError && mktUuid) {
              navigateToReportPage(mktUuid);
            } else if (aimsApiError) {
              // 에러 상태면 랜딩 화면으로 돌아가기 (page 파라미터를 event-fixed로 설정, 나머지 파라미터 유지)
              console.log('⚠️ [에러 상태] 랜딩 화면으로 이동');
              const landingUrl = new URL(window.location.href);
              landingUrl.searchParams.set('page', 'event-fixed');
              window.location.href = landingUrl.toString();
            } else {
              console.error('❌ [리포트 페이지 이동] mkt_uuid 없음');
              // mkt_uuid 없을 때도 랜딩 화면으로 이동 (page 파라미터를 event-fixed로 설정, 나머지 파라미터 유지)
              const landingUrl = new URL(window.location.href);
              landingUrl.searchParams.set('page', 'event-fixed');
              window.location.href = landingUrl.toString();
            }
          }}
        />
      );
    }

    return (
      <div className="survey-completion-section">
        {(isGeneratingRequest || isSending || errorMessage) ? (
          <>
            <div className="completion-spinner">
              <div className="spinner"></div>
            </div>
            <h3 className="completion-title">문진이 완료되었습니다</h3>
            <p className="completion-message">
              {errorMessage 
                ? errorMessage 
                : (isGeneratingRequest ? 'Request Body 생성 중...' : 'AIMS API 전송 중...')
              }
            </p>
            {errorMessage && (
              <p className="completion-error" style={{ color: '#ef4444', marginTop: '16px', fontSize: '14px' }}>
                테스트 페이지로 이동합니다...
              </p>
            )}
          </>
        ) : (
          <>
            <img 
              src={welnoLogo} 
              alt="웰노 로고" 
              className="completion-icon-image"
            />
            <h3 className="completion-title">문진이 완료되었습니다</h3>
            <p className="completion-message">
              질병예측 리포트가 생성 후 곧 알림톡으로 발송됩니다.
            </p>
          </>
        )}
      </div>
    );
  };

  // 현재 단계 계산 (동적)
  const getCurrentStep = (): number => {
    const maxSteps = questions.length > 0 ? questions.length : 5;
    if (currentQuestion >= 1 && currentQuestion <= maxSteps) {
      return currentQuestion;
    }
    return maxSteps; // 완료 상태
  };

  const currentStep = getCurrentStep();
  const totalSteps = questions.length > 0 ? questions.length : 5; // 동적 질문 수 (기본값 5는 하위 호환성)
  const [showAIMSModal, setShowAIMSModal] = useState(false);
  const [aimsRequestBody, setAimsRequestBody] = useState<any>(null);
  const [isGeneratingRequest, setIsGeneratingRequest] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(initialName || null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aimsApiError, setAimsApiError] = useState<boolean>(false); // AIMS API 에러 상태
  
  const hasSentRef = useRef(false); // 중복 전송 방지용 ref
  const mktUuidRef = useRef<string | null>(null); // mkt_uuid 저장용 ref
  const originalUrlParamsRef = useRef<URLSearchParams | null>(null); // 원본 URL 파라미터 저장용 ref
  const hasRestoredDataRef = useRef(false); // 데이터 복원 여부 추적용 ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null); // 자동 저장 타이머 ref
  const hasTrackedInitialStepRef = useRef(false); // 초기 step_start 이벤트 전송 여부 추적용 ref

  // 템플릿 로드
  useEffect(() => {
    const loadTemplate = async () => {
      if (!isOpen) return;
      
      setIsLoadingTemplate(true);
      try {
        // 템플릿 ID 결정 (AIMS_DISEASE_PREDICTION_REPORT)
        const templateId = 'AIMS_DISEASE_PREDICTION_REPORT';
        
        console.log('📋 템플릿 로드 시작:', { templateId, partnerId: partnerId || '없음 (공개 API 사용)' });
        
        // 공개 템플릿 조회 API 사용 (인증 불필요)
        let response;
        try {
          response = await questionnaireAPI.getPublicTemplate(templateId);
          
          console.log('🔍 공개 템플릿 API 응답:', response);
          
          // fetch 응답 형식 처리
          if (response.status === 200 && response.data && (response.data as any).success && (response.data as any).data?.templates?.length > 0) {
            const template = (response.data as any).data.templates[0];
            setQuestionnaireTemplate(template);
            
            console.log('✅ 공개 템플릿 로드 성공:', template.content_name);
            
            // 스키마를 QuestionInfo 배열로 변환
            const convertedQuestions = convertSchemaToQuestionInfo(
              template.questionnaire_schema,
              template.content_name
            );
            
            if (convertedQuestions.length > 0) {
              setQuestions(convertedQuestions);
              console.log(`✅ ${convertedQuestions.length}개의 질문으로 변환 완료`);
              console.log('🎯 [동적 문진 시스템] 동적 생성된 문진을 사용합니다.');
              console.log('📋 템플릿 정보:', {
                template_id: template.content_type_id,
                template_name: template.content_name,
                question_count: convertedQuestions.length
              });
              setIsLoadingTemplate(false);
              return;
            } else {
              console.warn('⚠️ 변환된 질문이 없습니다. 응답:', response);
            }
          } else {
            console.warn('⚠️ 공개 템플릿 조회 실패 - 응답 형식 오류:', response);
          }
        } catch (publicError) {
          console.warn('⚠️ 공개 템플릿 조회 실패, 인증된 API 시도:', publicError);
          
          // 공개 API 실패 시 인증된 API 시도 (로그인된 경우)
          try {
            response = await questionnaireAPI.getTemplates(templateId, partnerId || undefined, {
              partner_type: 'marketing'
            });
            
            if (response.data && (response.data as any).success && (response.data as any).data?.templates?.length > 0) {
              const template = (response.data as any).data.templates[0];
              setQuestionnaireTemplate(template);
              
              console.log('✅ 인증된 템플릿 로드 성공:', template.content_name);
              
              // 스키마를 QuestionInfo 배열로 변환
              const convertedQuestions = convertSchemaToQuestionInfo(
                template.questionnaire_schema,
                template.content_name
              );
              
              if (convertedQuestions.length > 0) {
                setQuestions(convertedQuestions);
                console.log(`✅ ${convertedQuestions.length}개의 질문으로 변환 완료`);
                console.log('🎯 [동적 문진 시스템] 동적 생성된 문진을 사용합니다.');
                console.log('📋 템플릿 정보:', {
                  template_id: template.content_type_id,
                  template_name: template.content_name,
                  question_count: convertedQuestions.length
                });
                setIsLoadingTemplate(false);
                return;
              }
            }
          } catch (authError) {
            console.warn('⚠️ 인증된 템플릿 조회도 실패:', authError);
          }
        }
        
        // 템플릿이 없으면 기존 하드코딩된 질문 사용 (폴백)
        console.warn('⚠️ 템플릿을 찾을 수 없습니다. 기본 질문을 사용합니다.');
        console.log('📌 [기본 문진 시스템] 하드코딩된 기본 질문을 사용합니다.');
        setQuestions(SURVEY_QUESTIONS);
      } catch (error) {
        console.error('❌ 템플릿 로드 실패:', error);
        console.log('📌 [기본 문진 시스템] 템플릿 로드 실패로 하드코딩된 기본 질문을 사용합니다.');
        // 에러 시 기존 하드코딩된 질문 사용 (폴백)
        setQuestions(SURVEY_QUESTIONS);
      } finally {
        setIsLoadingTemplate(false);
      }
    };
    
    loadTemplate();
  }, [isOpen, partnerId]);

  // initialName이 변경되면 customerName 업데이트
  useEffect(() => {
    if (initialName && !customerName) {
      setCustomerName(initialName);
      console.log('✅ SurveySlideUpPanel 초기 이름 설정:', initialName);
    }
  }, [initialName, customerName]);

  // 패널이 닫혔다가 다시 열릴 때 전송 상태 리셋
  useEffect(() => {
    if (!isOpen) {
      // 패널이 닫히면 전송 상태 리셋
      hasSentRef.current = false;
      setIsSending(false);
      setIsGeneratingRequest(false);
      setErrorMessage(null);
      hasRestoredDataRef.current = false; // 패널이 닫히면 복원 플래그도 리셋
      hasTrackedInitialStepRef.current = false; // 초기 step_start 이벤트 추적 리셋
    }
  }, [isOpen]);

  // URL 파라미터에서 새 사용자 등록 정보 읽기
  const getNewUserInfo = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const name = urlParams.get('name');
    const birthday = urlParams.get('birthday'); // YYYYMMDD 형식
    const partnerId = urlParams.get('partner_id');
    const isNewUser = urlParams.get('is_new_user') === 'true';
    const apiKey = urlParams.get('api_key'); // API Key (URL 파라미터에서)
    
    return {
      name: name ? decodeURIComponent(name) : null,
      birthday: birthday || null,
      partnerId: partnerId || null,
      isNewUser,
      apiKey: apiKey || null
    };
  };

  // 문진 데이터 자동 저장 함수 (debounce 적용)
  const autoSaveQuestionnaireData = useCallback(async (dataToSave: Record<string, any>) => {
    console.log('💾 [자동 저장] 자동 저장 함수 호출:', {
      data_keys: Object.keys(dataToSave),
      data_sample: Object.keys(dataToSave).slice(0, 3).reduce((acc, key) => {
        acc[key] = dataToSave[key];
        return acc;
      }, {} as Record<string, any>)
    });

    // mkt_uuid 우선순위: 1) URL에서 가져오기, 2) ref에서 가져오기 (저장 API 응답에서 받은 값)
    const mktUuidFromUrl = getMktUuidFromUrl();
    const mktUuid = mktUuidFromUrl || mktUuidRef.current;
    const newUserInfo = getNewUserInfo();
    
    // mkt_uuid가 없고 새 사용자도 아니면 자동 저장 건너뜀
    if (!mktUuid && !newUserInfo.isNewUser) {
      console.log('⏳ [자동 저장] mkt_uuid 없고 새 사용자도 아님 - 자동 저장 건너뜀');
      return;
    }

    // 복원 중이면 저장하지 않음
    if (hasRestoredDataRef.current) {
      console.log('⏳ [자동 저장] 복원 중 - 자동 저장 건너뜀');
      return;
    }

    console.log('📤 [자동 저장] 자동 저장 API 호출 시작', {
      mkt_uuid_from_url: mktUuidFromUrl,
      mkt_uuid_from_ref: mktUuidRef.current,
      mkt_uuid_to_use: mktUuid,
      is_new_user: newUserInfo.isNewUser
    });
    try {
      const dynamicQuestionnaireData = {
        template_id: questionnaireTemplate?.content_type_id || 'AIMS_DISEASE_PREDICTION_REPORT',
        template_name: questionnaireTemplate?.content_name || 'AIMS 질병예측리포트',
        responses: dataToSave,
        completed_at: new Date().toISOString(),
        source: 'campaign_survey_dynamic_autosave'
      };
      
      // 새 사용자 등록 정보 추가
      const newUserInfo = getNewUserInfo();
      
      const savePayload: any = {
        mkt_uuid: mktUuid || undefined, // ref에서 가져온 mkt_uuid 사용
        order_name: undefined,
        content_type_id: questionnaireTemplate?.content_type_id || 'AIMS_DISEASE_PREDICTION_REPORT',
        dynamic_questionnaire_data: dynamicQuestionnaireData
      };
      
      // 새 사용자 등록 정보 추가
      if (newUserInfo.isNewUser || !mktUuid) {
        if (newUserInfo.partnerId) {
          savePayload.partner_id = newUserInfo.partnerId;
        }
        if (newUserInfo.name) {
          savePayload.customer_name = newUserInfo.name;
        }
        if (newUserInfo.birthday) {
          savePayload.customer_birthday = newUserInfo.birthday;
        }
      }
      
      // API Key 추가 (order_name 조회용)
      if (newUserInfo.apiKey) {
        savePayload.api_key = newUserInfo.apiKey;
      }
      
      const saveResponse = await questionnaireAPI.saveDynamicDataPublic(savePayload);
      console.log('📥 [자동 저장] 자동 저장 API 응답:', {
        status: saveResponse.status,
        has_data: !!saveResponse.data,
        data_type: typeof saveResponse.data
      });

      const responseData = saveResponse.data || saveResponse;
      const isSuccess = (responseData && typeof responseData === 'object' && 'success' in responseData && responseData.success === true) || saveResponse.status === 200;
      
      if (isSuccess) {
        console.log('✅ [자동 저장] 문진 데이터 자동 저장 완료');
        
        // 저장 API 응답에서 mkt_uuid를 받아서 ref에 저장 (다음 자동 저장 시 재사용)
        if ((responseData as any).mkt_uuid && !mktUuidRef.current) {
          mktUuidRef.current = (responseData as any).mkt_uuid;
          console.log('✅ [자동 저장] 저장 API 응답에서 mkt_uuid 받아서 ref에 저장:', (responseData as any).mkt_uuid);
        }
      } else {
        console.warn('⚠️ [자동 저장] 문진 데이터 자동 저장 실패:', (responseData as any).error || responseData.message);
      }
    } catch (error) {
      console.warn('⚠️ [자동 저장] 문진 데이터 자동 저장 실패:', error);
    }
  }, [questionnaireTemplate]);

  // 질문 전환 시 자동 저장 (패널 전환 시점)
  useEffect(() => {
    // 복원 중이거나 질문이 없거나 문진 데이터가 없으면 저장하지 않음
    if (hasRestoredDataRef.current || questions.length === 0 || Object.keys(surveyData).length === 0) {
      return;
    }

    // 첫 번째 질문으로 이동하는 경우는 저장하지 않음 (초기 로드)
    if (currentQuestion === 1) {
      return;
    }

    // 완료 상태에서는 저장하지 않음 (자동 전송 로직에서 저장)
    // 단, 마지막 질문에서 다음 버튼 클릭 시 (currentQuestion === totalSteps + 1)는 저장
    const totalSteps = questions.length;
    if (currentQuestion > totalSteps + 1) {
      return;
    }
    
    autoSaveQuestionnaireData(surveyData);
  }, [currentQuestion, questions.length, autoSaveQuestionnaireData]); // surveyData 제거, currentQuestion 추가

  // 저장된 문진 데이터 불러오기
  useEffect(() => {
    const loadSavedQuestionnaire = async () => {
      if (!isOpen || questions.length === 0) {
        console.log('⏳ 저장된 문진 데이터 불러오기 대기:', { isOpen, questionsLength: questions.length });
        return;
      }
      
      const mktUuid = getMktUuidFromUrl();
      if (!mktUuid) {
        console.log('⏳ mkt_uuid 없음 - 저장된 문진 데이터 불러오기 건너뜀');
        return;
      }
      
      try {
        // 공개 API로 저장된 문진 데이터 조회
        const response = await fetch(`/api/questionnaire/data/public/?mkt_uuid=${encodeURIComponent(mktUuid)}`);
        const result = await response.json();
        
        if (result.success && result.data?.dynamic_questionnaire) {
          const savedData = result.data.dynamic_questionnaire;
          const responses = savedData.responses;
          
          if (responses && Object.keys(responses).length > 0) {
            // 데이터 복원 플래그 설정
            hasRestoredDataRef.current = true;
            
            // 약간의 지연을 두어 질문이 완전히 로드된 후 복원
            setTimeout(() => {
              // 저장된 데이터 복원
              restoreSurveyData(responses);
              
              // 복원 완료 후 플래그 해제 (자동 저장 활성화)
              setTimeout(() => {
                hasRestoredDataRef.current = false;
              }, 1000);
            }, 200);
          }
        }
      } catch (error) {
        // 저장된 데이터가 없으면 새로 시작
      }
    };
    
    // 질문이 로드된 후 저장된 데이터 불러오기
    if (isOpen && questions.length > 0) {
      // 약간의 지연을 두어 questions 배열이 완전히 설정된 후 실행
      const timer = setTimeout(() => {
        loadSavedQuestionnaire();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, questions.length, restoreSurveyData]);

  // 패널이 열릴 때 초기 step_start 이벤트 전송 (한 번만)
  useEffect(() => {
    if (!isOpen || isCompleted || questions.length === 0) return;
    if (hasTrackedInitialStepRef.current) return; // 이미 전송했으면 건너뛰기
    
    const currentQ = questions[currentQuestion - 1];
    if (currentQ) {
      const stepData = {
        mkt_uuid: getMktUuidFromUrl() || null,
        step_number: currentQuestion,
        total_steps: questions.length,
        question_name: currentQ?.name,
        question_title: currentQ?.title,
        question_type: currentQ?.type,
        question_subtitle: currentQ?.subtitle,
        total_options: currentQ?.options?.length || 0,
        has_existing_answer: !!surveyData[currentQ?.name],
        is_returning: false
      };
      
      // GTM 이벤트 전송 (기존)
      trackSurveyStep('step_start', stepData);
      
      // 첫 문진 (step_number=1)인 경우 백엔드 API 호출
      if (currentQuestion === 1) {
        const mktUuid = getMktUuidFromUrl();
        if (mktUuid) {
          fetch('/api/partner-marketing/tracking/survey-step-start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(stepData),
          }).catch(error => {
            console.warn('문진 단계 시작 추적 실패:', error);
          });
        }
      }
      
      hasTrackedInitialStepRef.current = true; // 전송 완료 표시
    }
  }, [isOpen, isCompleted, questions.length, currentQuestion]); // 최소한의 dependency만

  // 패널이 열릴 때 원본 URL 파라미터 저장 및 생년월일 설정
  useEffect(() => {
    if (!isOpen) return;
    
    // 완료 상태이면 생년월일 설정 건너뛰기
    if (isCompleted) {
      return;
    }
    
    // 데이터가 복원되었으면 생년월일 설정 건너뛰기 (복원된 데이터에 이미 생년월일이 포함됨)
    if (hasRestoredDataRef.current) {
      return;
    }
    
    if (!originalUrlParamsRef.current) {
      originalUrlParamsRef.current = new URLSearchParams(window.location.search);
    }
    
    // 생년월일 설정 (복원된 데이터가 없을 때만, 질문이 로드된 후에만)
    if (birthDate && birthDate.year && birthDate.month && birthDate.day && questions.length > 0) {
      // 현재 surveyData의 생년월일과 비교하여 다를 때만 업데이트 (무한 루프 방지)
      const currentBirthDate = surveyData.birthDate as { year?: string; month?: string; day?: string } | undefined;
      const shouldUpdate = !currentBirthDate || 
        currentBirthDate.year !== birthDate.year ||
        currentBirthDate.month !== birthDate.month ||
        currentBirthDate.day !== birthDate.day;
      
      if (shouldUpdate) {
        updateBirthDate({
          year: birthDate.year,
          month: birthDate.month,
          day: birthDate.day,
        });
        console.log(`✅ 생년월일 설정 (동의 패널에서 전달): ${birthDate.year}-${birthDate.month}-${birthDate.day}`);
      }
    }
  }, [isOpen, isCompleted, birthDate?.year, birthDate?.month, birthDate?.day, updateBirthDate, surveyData.birthDate?.year, surveyData.birthDate?.month, surveyData.birthDate?.day, questions.length]);

  // 고객 이름 조회
  useEffect(() => {
    const fetchCustomerName = async () => {
      if (!isOpen) return;
      const mktUuid = getMktUuidFromUrl();
      if (!mktUuid) return;

      try {
        const status = await checkQuestionnaireStatus(mktUuid);
        if (status.success && status.customer_info?.name) {
          setCustomerName(status.customer_info.name);
        }
      } catch (err: any) {
        // 404는 데이터가 없는 경우이므로 정상 (새 사용자 등)
        // 에러 로그를 출력하지 않고 조용히 처리
        if (err?.message?.includes('404') || err?.message?.includes('Not Found')) {
          console.log('📝 고객 정보 없음 (새 사용자 또는 데이터 없음)');
        } else {
          console.error('고객 이름 조회 실패:', err);
        }
      }
    };

    fetchCustomerName();
  }, [isOpen]);

  // 기존 데이터 확인 후 리다이렉트
  const checkExistingDataAndRedirect = useCallback(async (mktUuid: string) => {
    try {
      const response = await fetch(`/api/partner-marketing/aims-report?mkt_uuid=${encodeURIComponent(mktUuid)}`);
      const data = await response.json();
      
      // 리포트 페이지 URL 생성 함수
      const createReportUrl = () => {
        // 현재 URL을 기반으로 리포트 페이지 URL 생성 (모든 파라미터 유지)
        const reportUrl = new URL(window.location.href);
        
        // 원본 파라미터가 있으면 우선 사용, 없으면 현재 URL 파라미터 사용
        if (originalUrlParamsRef.current) {
          originalUrlParamsRef.current.forEach((value, key) => {
            if (key !== 'page' && key !== 'uid') {
              reportUrl.searchParams.set(key, value);
            }
          });
        }
        
        // uid와 page 파라미터 설정
        reportUrl.searchParams.set('uid', mktUuid);
        reportUrl.searchParams.set('page', 'report');
        
        return reportUrl.toString();
      };
      
      // has_report 플래그 우선 확인
      if (data.success && data.has_report === true && data.data && data.data.aims_response) {
        // 데이터가 있으면 리포트 페이지로 이동
        console.log('기존 리포트 데이터 발견: 리포트 페이지로 이동');
        setErrorMessage('기존 리포트 데이터가 있습니다: 리포트 페이지로 이동합니다.');
        setTimeout(() => {
          window.location.href = createReportUrl();
        }, 2000);
      } else {
        // 데이터가 없으면 초기 랜딩 페이지(event-fixed)로 돌아가기
        console.log('기존 리포트 데이터 없음: 초기 랜딩 페이지로 이동');
        setErrorMessage('리포트가 준비되면 알림톡으로 발송해드립니다.');
        setTimeout(() => {
          // 초기 랜딩 페이지로 이동 (page=event-fixed로 설정, uid는 유지)
          const landingUrl = new URL(window.location.href);
          landingUrl.searchParams.set('page', 'event-fixed');
          // uid는 유지
          const mktUuid = landingUrl.searchParams.get('uid');
          if (mktUuid) {
            landingUrl.searchParams.set('uid', mktUuid);
          }
          // 원본 파라미터가 있으면 uid 외 다른 파라미터도 복원 (page는 event-fixed로 고정)
          if (originalUrlParamsRef.current) {
            originalUrlParamsRef.current.forEach((value, key) => {
              if (key !== 'page' && key !== 'uid') {
                landingUrl.searchParams.set(key, value);
              }
            });
          }
          window.location.href = landingUrl.toString();
        }, 3000);
      }
    } catch (err) {
      console.error('기존 데이터 확인 실패:', err);
      // 확인 실패 시 초기 랜딩 페이지(event-fixed)로 돌아가기
      setErrorMessage('리포트가 준비되면 알림톡으로 발송해드립니다.');
      setTimeout(() => {
        // 초기 랜딩 페이지로 이동 (page=event-fixed로 설정, uid는 유지)
        const landingUrl = new URL(window.location.href);
        landingUrl.searchParams.set('page', 'event-fixed');
        // uid는 유지
        const mktUuid = landingUrl.searchParams.get('uid');
        if (mktUuid) {
          landingUrl.searchParams.set('uid', mktUuid);
        }
        // 원본 파라미터가 있으면 uid 외 다른 파라미터도 복원 (page는 event-fixed로 고정)
        if (originalUrlParamsRef.current) {
          originalUrlParamsRef.current.forEach((value, key) => {
            if (key !== 'page' && key !== 'uid') {
              landingUrl.searchParams.set(key, value);
            }
          });
        }
        window.location.href = landingUrl.toString();
      }, 3000);
    }
  }, []);

  // 문진 완료 시 자동 전송
  useEffect(() => {
    // 중복 전송 방지: 이미 전송했거나 전송 중이면 실행하지 않음
    if (!isCompleted) {
      return;
    }
    if (isSending) {
      return;
    }
    if (showLoadingScreen) {
      return;
    }
    if (showAIMSModal) {
      return;
    }
    if (hasSentRef.current) {
      return;
    }

    console.log('🚀 [자동 전송] 문진 완료 - 자동 전송 시작');
    console.log('🔍 [자동 전송] 시작 전 상태:', {
      hasSentBefore: hasSentRef.current,
      isSendingBefore: isSending,
      isGeneratingRequestBefore: isGeneratingRequest
    });
    
    // 문진 완료 추적 (더 상세하게)
    const answeredQuestions = questions.filter(q => {
      const answer = surveyData[q.name];
      if (q.type === 'checkbox') {
        return Array.isArray(answer) && answer.length > 0;
      } else if (q.type === 'birthdate') {
        return answer && answer.year && answer.month && answer.day;
      }
      return !!answer;
    });
    
    trackSurveyStep('survey_complete', {
      mkt_uuid: getMktUuidFromUrl() || null,
      total_steps: totalSteps,
      completed_steps: currentQuestion,
      answered_questions_count: answeredQuestions.length,
      has_all_answers: Object.keys(surveyData).length > 0,
      answered_question_names: answeredQuestions.map(q => q.name),
      unanswered_question_names: questions
        .filter(q => !answeredQuestions.includes(q))
        .map(q => q.name),
      survey_data_keys: Object.keys(surveyData)
    });
    
    // 전송 시작 표시 (즉시 설정하여 중복 실행 방지)
    // hasSentRef를 먼저 설정하여 cleanup에서 타이머가 취소되지 않도록 함
    hasSentRef.current = true;
    console.log('✅ [자동 전송] hasSentRef.current = true 설정 완료');
    
    // isSending은 타이머 실행 후에 설정하여 useEffect 재실행 방지
    // setIsSending(true);
    // setIsGeneratingRequest(true);
    
    const autoSend = async () => {
      console.log('📤 [자동 전송] autoSend 함수 실행 시작');
      const mktUuid = getMktUuidFromUrl();
      const newUserInfo = getNewUserInfo();
      
      // mkt_uuid가 없고 새 사용자도 아니면 에러
      if (!mktUuid && !newUserInfo.isNewUser) {
        console.error('❌ [자동 전송] mkt_uuid를 찾을 수 없고 새 사용자도 아닙니다.');
        hasSentRef.current = false;
        return;
      }

      // mkt_uuid가 있으면 사용, 없으면 저장 API 응답에서 받을 예정
      let currentMktUuid = mktUuid;
      if (mktUuid) {
        console.log('✅ [자동 전송] mkt_uuid 확인:', mktUuid);
        mktUuidRef.current = mktUuid;
      } else {
        console.log('📝 [자동 전송] 새 사용자 플로우 - 저장 API 응답에서 mkt_uuid 받을 예정');
      }
      
      if (!originalUrlParamsRef.current) {
        originalUrlParamsRef.current = new URLSearchParams(window.location.search);
        console.log('📋 [자동 전송] 원본 URL 파라미터 저장:', Array.from(originalUrlParamsRef.current.entries()));
      }

      try {
        console.log('📝 [자동 전송] 1단계: 동적 문진 데이터 저장 시작');
        // 1. 동적 문진 데이터 저장 (기존 프로세스에 추가)
        // 템플릿이 있으면 동적 형식으로, 없으면 기본 형식으로 저장
        if (questionnaireTemplate && questions.length > 0) {
          try {
            const dynamicQuestionnaireData = {
              template_id: questionnaireTemplate.content_type_id || 'AIMS_DISEASE_PREDICTION_REPORT',
              template_name: questionnaireTemplate.content_name || 'AIMS 질병예측리포트',
              responses: surveyData,  // { [questionId]: answer }
              completed_at: new Date().toISOString(),
              source: 'campaign_survey_dynamic'
            };
            
            // 새 사용자 등록 정보 추가
            const newUserInfo = getNewUserInfo();
            
            const savePayload: any = {
              mkt_uuid: currentMktUuid || undefined, // 새 사용자는 mkt_uuid 없음
              order_name: undefined, // order_name은 백엔드에서 조회
              content_type_id: questionnaireTemplate.content_type_id,
              dynamic_questionnaire_data: dynamicQuestionnaireData
            };
            
            // 새 사용자 등록 정보 추가
            if (newUserInfo.isNewUser || !currentMktUuid) {
              if (newUserInfo.partnerId) {
                savePayload.partner_id = newUserInfo.partnerId;
              }
              if (newUserInfo.name) {
                savePayload.customer_name = newUserInfo.name;
              }
              if (newUserInfo.birthday) {
                savePayload.customer_birthday = newUserInfo.birthday;
              }
            }
            
            // API Key 추가 (order_name 조회용)
            if (newUserInfo.apiKey) {
              savePayload.api_key = newUserInfo.apiKey;
            }
            
            // 저장 API 호출 (캠페인 페이지용 public API 사용)
            try {
              const saveResponse = await questionnaireAPI.saveDynamicDataPublic(savePayload);
              console.log('✅ 동적 문진 데이터 저장 응답:', saveResponse);
              
              // 응답 형식 확인: { data: { success, message }, status } 또는 { success, message }
              const responseData = saveResponse.data || saveResponse;
              const isSuccess = responseData.success === true || saveResponse.status === 200;
              
              if (!isSuccess) {
                // 저장 실패 시 장애 안내 후 원래 페이지로 이동
                console.error('❌ 문진 데이터 저장 실패:', (responseData as any).error || responseData.message);
                setErrorMessage('장애로 인하여 나중에 다시 시도해주세요.');
                setIsSending(false);
                setIsGeneratingRequest(false);
                hasSentRef.current = false;
                
                // 3초 후 랜딩 페이지로 이동
                setTimeout(() => {
                  const landingUrl = new URL(window.location.href);
                  landingUrl.searchParams.delete('page');
                  if (originalUrlParamsRef.current) {
                    originalUrlParamsRef.current.forEach((value, key) => {
                      if (key !== 'page') {
                        landingUrl.searchParams.set(key, value);
                      }
                    });
                  }
                  window.location.href = landingUrl.toString();
                }, 3000);
                return;
              } else {
                console.log('✅ 문진 데이터 저장 완료');
                
                // 저장 API 응답에서 mkt_uuid 추출 (새 사용자 등록 시)
                if (!currentMktUuid && (responseData as any).mkt_uuid) {
                  currentMktUuid = (responseData as any).mkt_uuid;
                  mktUuidRef.current = currentMktUuid;
                  console.log('✅ [자동 전송] 저장 API 응답에서 mkt_uuid 받음:', currentMktUuid);
                }
              }
            } catch (saveError: any) {
              // 저장 실패 시 장애 안내 후 원래 페이지로 이동
              console.error('❌ 문진 데이터 저장 실패:', saveError);
              setErrorMessage('장애로 인하여 나중에 다시 시도해주세요.');
              setIsSending(false);
              setIsGeneratingRequest(false);
              hasSentRef.current = false;
              
              // 3초 후 랜딩 페이지로 이동
              setTimeout(() => {
                const landingUrl = new URL(window.location.href);
                landingUrl.searchParams.delete('page');
                if (originalUrlParamsRef.current) {
                  originalUrlParamsRef.current.forEach((value, key) => {
                    if (key !== 'page') {
                      landingUrl.searchParams.set(key, value);
                    }
                  });
                }
                window.location.href = landingUrl.toString();
              }, 3000);
              return;
            }
          } catch (saveError) {
            console.warn('⚠️ 동적 문진 데이터 저장 실패 (계속 진행):', saveError);
          }
        } else if (questions.length > 0) {
          // 템플릿이 없어도 기본 질문을 사용한 경우 저장 시도
          try {
            const dynamicQuestionnaireData = {
              template_id: 'AIMS_DISEASE_PREDICTION_REPORT',
              template_name: 'AIMS 질병예측리포트 (기본 질문)',
              responses: surveyData,
              completed_at: new Date().toISOString(),
              source: 'campaign_survey_fallback'
            };
            
            // 새 사용자 등록 정보 추가
            const newUserInfo = getNewUserInfo();
            
            const savePayload: any = {
              mkt_uuid: currentMktUuid || undefined, // 새 사용자는 mkt_uuid 없음
              order_name: undefined,
              content_type_id: 'AIMS_DISEASE_PREDICTION_REPORT',
              dynamic_questionnaire_data: dynamicQuestionnaireData
            };
            
            // 새 사용자 등록 정보 추가
            if (newUserInfo.isNewUser || !currentMktUuid) {
              if (newUserInfo.partnerId) {
                savePayload.partner_id = newUserInfo.partnerId;
              }
              if (newUserInfo.name) {
                savePayload.customer_name = newUserInfo.name;
              }
              if (newUserInfo.birthday) {
                savePayload.customer_birthday = newUserInfo.birthday;
              }
            }
            
            // API Key 추가 (order_name 조회용)
            if (newUserInfo.apiKey) {
              savePayload.api_key = newUserInfo.apiKey;
            }
            
            // 저장 API 호출 (캠페인 페이지용 public API 사용)
            try {
              const saveResponse = await questionnaireAPI.saveDynamicDataPublic(savePayload);
              console.log('✅ 기본 질문 데이터 저장 응답:', saveResponse);
              
              // 응답 형식 확인: { data: { success, message }, status } 또는 { success, message }
              const responseData = saveResponse.data || saveResponse;
              const isSuccess = responseData.success === true || saveResponse.status === 200;
              
              if (!isSuccess) {
                // 저장 실패 시 장애 안내 후 원래 페이지로 이동
                console.error('❌ 기본 질문 데이터 저장 실패:', (responseData as any).error || responseData.message);
                setErrorMessage('장애로 인하여 나중에 다시 시도해주세요.');
                setIsSending(false);
                setIsGeneratingRequest(false);
                hasSentRef.current = false;
                
                // 3초 후 랜딩 페이지로 이동
                setTimeout(() => {
                  const landingUrl = new URL(window.location.href);
                  landingUrl.searchParams.delete('page');
                  if (originalUrlParamsRef.current) {
                    originalUrlParamsRef.current.forEach((value, key) => {
                      if (key !== 'page') {
                        landingUrl.searchParams.set(key, value);
                      }
                    });
                  }
                  window.location.href = landingUrl.toString();
                }, 3000);
                return;
              } else {
                console.log('✅ 기본 질문 데이터 저장 완료');
                
                // 저장 API 응답에서 mkt_uuid 추출 (새 사용자 등록 시)
                if (!currentMktUuid && (responseData as any).mkt_uuid) {
                  currentMktUuid = (responseData as any).mkt_uuid;
                  mktUuidRef.current = currentMktUuid;
                  console.log('✅ [자동 전송] 저장 API 응답에서 mkt_uuid 받음:', currentMktUuid);
                }
              }
            } catch (saveError: any) {
              // 저장 실패 시 장애 안내 후 원래 페이지로 이동
              console.error('❌ 기본 질문 데이터 저장 실패:', saveError);
              setErrorMessage('장애로 인하여 나중에 다시 시도해주세요.');
              setIsSending(false);
              setIsGeneratingRequest(false);
              hasSentRef.current = false;
              
              // 3초 후 랜딩 페이지로 이동
              setTimeout(() => {
                const landingUrl = new URL(window.location.href);
                landingUrl.searchParams.delete('page');
                if (originalUrlParamsRef.current) {
                  originalUrlParamsRef.current.forEach((value, key) => {
                    if (key !== 'page') {
                      landingUrl.searchParams.set(key, value);
                    }
                  });
                }
                window.location.href = landingUrl.toString();
              }, 3000);
              return;
            }
          } catch (saveError) {
            console.warn('⚠️ 기본 질문 데이터 저장 실패 (계속 진행):', saveError);
          }
        }
        
        console.log('✅ [자동 전송] 1단계 완료: 동적 문진 데이터 저장 성공');
        
        // 저장 후 mkt_uuid 확인 (새 사용자 등록 시 저장 API 응답에서 받은 mkt_uuid 사용)
        if (!currentMktUuid) {
          console.error('❌ [자동 전송] mkt_uuid를 찾을 수 없습니다. 저장 API 응답을 확인하세요.');
          hasSentRef.current = false;
          setIsSending(false);
          setIsGeneratingRequest(false);
          return;
        }
        
        console.log('✅ [자동 전송] 최종 mkt_uuid 확인:', currentMktUuid);
        mktUuidRef.current = currentMktUuid;
        
        // 2. AIMS Request Body 생성 (기존 프로세스)
        console.log('📤 [자동 전송] 2단계: AIMS Request Body 생성 시작');
        const legacyQuestionnaireData = convertDynamicToLegacyFormat(surveyData, questions);
        
        console.log('📤 [자동 전송] AIMS Request Body 생성 API 호출 시작:', {
          mkt_uuid: currentMktUuid,
          questionnaire_data_keys: Object.keys(legacyQuestionnaireData),
          questionnaire_data_sample: Object.keys(legacyQuestionnaireData).slice(0, 3).reduce((acc, key) => {
            acc[key] = legacyQuestionnaireData[key];
            return acc;
          }, {} as Record<string, any>),
          agreement_data_count: agreementData?.length || 0,
          template_id: questionnaireTemplate?.content_type_id
        });

        const response = await fetch('/api/partner-marketing/generate-aims-request-body', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            mkt_uuid: currentMktUuid,
            questionnaire_data: legacyQuestionnaireData,
            agreement_data: agreementData || [],
            template_id: questionnaireTemplate?.content_type_id
          }),
        });

        console.log('📥 [자동 전송] AIMS Request Body 생성 API 응답 상태:', response.status, response.statusText);

        if (!response.ok) {
          console.error('❌ [자동 전송] AIMS Request Body 생성 API HTTP 에러:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('❌ [자동 전송] 에러 응답 본문:', errorText);
          setErrorMessage(`Request Body 생성 실패 (HTTP ${response.status}): ${response.statusText}`);
          setIsSending(false);
          setIsGeneratingRequest(false);
          hasSentRef.current = false;
          console.log('🔄 [자동 전송] 기존 데이터 확인 후 리다이렉트');
          checkExistingDataAndRedirect(currentMktUuid);
          return;
        }

        const result = await response.json();
        console.log('📥 [자동 전송] AIMS Request Body 생성 API 응답:', {
          success: result.success,
          has_request_body: !!result.request_body,
          error: result.error
        });

        if (!result.success || !result.request_body) {
          console.error('❌ [자동 전송] AIMS Request Body 생성 실패:', result.error);
          setErrorMessage('Request Body 생성 실패: 기존 데이터 확인 중...');
          setIsSending(false);
          setIsGeneratingRequest(false);
          hasSentRef.current = false; // 실패 시 리셋하여 재시도 가능하게
          
          console.log('🔄 [자동 전송] 기존 데이터 확인 후 리다이렉트');
          // 기존 데이터 확인
          checkExistingDataAndRedirect(currentMktUuid);
          return;
        }

        console.log('✅ [자동 전송] 2단계 완료: AIMS Request Body 생성 성공');
        const requestBody = result.request_body;

        // 3. AIMS API 전송 (기존 프로세스)
        console.log('📤 [자동 전송] 3단계: AIMS API 전송 시작');
        
        // 리포트 생성 요청 시간을 AIMS API 호출 전에 미리 저장 (무조건 저장)
        const reportRequestTime = new Date().toISOString();
        console.log('💾 [자동 전송] 리포트 생성 요청 시간 저장 시작 (AIMS API 호출 전):', reportRequestTime);
        
        // 리포트 생성 요청 시간 데이터 (AIMS API 실패 시에도 사용)
        const dynamicQuestionnaireDataForRequestTime = {
          template_id: questionnaireTemplate?.content_type_id || 'AIMS_DISEASE_PREDICTION_REPORT',
          template_name: questionnaireTemplate?.content_name || 'AIMS 질병예측리포트',
          responses: surveyData,
          completed_at: new Date().toISOString(),
          report_request_time: reportRequestTime, // 리포트 생성 요청 시간 추가
          source: 'campaign_survey_aims_request'
        };
        
        try {
          // 리포트 생성 요청 시간을 먼저 저장 (AIMS API 성공/실패와 관계없이)
          
          const requestTimePayload = {
            mkt_uuid: currentMktUuid,
            order_name: undefined,
            content_type_id: questionnaireTemplate?.content_type_id || 'AIMS_DISEASE_PREDICTION_REPORT',
            dynamic_questionnaire_data: dynamicQuestionnaireDataForRequestTime
          };
          
          console.log('📤 [자동 전송] 리포트 생성 요청 시간 저장 API 호출:', {
            mkt_uuid: currentMktUuid,
            has_report_request_time: !!requestTimePayload.dynamic_questionnaire_data.report_request_time,
            report_request_time: requestTimePayload.dynamic_questionnaire_data.report_request_time
          });
          
          const requestTimeSaveResponse = await questionnaireAPI.saveDynamicDataPublic(requestTimePayload);
          const requestTimeResponseData = requestTimeSaveResponse.data || requestTimeSaveResponse;
          const requestTimeIsSuccess = (requestTimeResponseData && typeof requestTimeResponseData === 'object' && 'success' in requestTimeResponseData && requestTimeResponseData.success === true) || requestTimeSaveResponse.status === 200;
          
          console.log('✅ [자동 전송] 리포트 생성 요청 시간 저장 응답:', {
            status: requestTimeSaveResponse.status,
            success: requestTimeIsSuccess,
            has_data: !!requestTimeSaveResponse.data
          });
          
          if (!requestTimeIsSuccess) {
            console.error('❌ [자동 전송] 리포트 생성 요청 시간 저장 실패 - 응답:', requestTimeResponseData);
          }
        } catch (requestTimeError) {
          console.error('❌ [자동 전송] 리포트 생성 요청 시간 저장 실패 - 예외 발생:', requestTimeError);
        }
        
        const sendResponse = await fetch('/api/partner-marketing/send-to-aims-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            request_body: requestBody,
            mkt_uuid: currentMktUuid,
          }),
        });

        console.log('📥 [자동 전송] AIMS API 전송 응답 상태:', sendResponse.status, sendResponse.statusText);
        const sendResult = await sendResponse.json();
        console.log('📥 [자동 전송] AIMS API 전송 응답:', {
          success: sendResult.success,
          error: sendResult.error
        });

        if (sendResult.success) {
          console.log('✅ [자동 전송] 3단계 완료: AIMS API 전송 성공');
          // 리포트 생성 요청 시간은 이미 AIMS API 호출 전에 저장했으므로 여기서는 추가 작업 없음
          
          setIsGeneratingRequest(false);
          setIsSending(false);
          setShowLoadingScreen(true); // AIMSLoadingScreen 표시 (카운트다운 포함)
          
          console.log('⏳ [자동 전송] AIMSLoadingScreen 표시 - 카운트다운 완료 후 리포트 페이지로 이동');
        } else {
          // 저장 성공 + AIMS API 실패 시: 에러 상태 저장 및 AIMSLoadingScreen 표시
          console.error('❌ [자동 전송] AIMS API 전송 실패:', sendResult.error);
          setIsSending(false);
          setIsGeneratingRequest(false);
          hasSentRef.current = true; // 재실행 방지
          
          // AIMS API 에러 상태 설정
          setAimsApiError(true);
          
          // AIMS API 실패 상태를 DB에 저장
          try {
            const errorStatusPayload = {
              mkt_uuid: currentMktUuid,
              order_name: undefined,
              content_type_id: questionnaireTemplate?.content_type_id || 'AIMS_DISEASE_PREDICTION_REPORT',
              dynamic_questionnaire_data: {
                ...dynamicQuestionnaireDataForRequestTime,
                aims_api_error: true,
                aims_api_error_message: sendResult.error || 'AIMS API 전송 실패',
                aims_api_failed_at: new Date().toISOString()
              }
            };
            
            console.log('💾 [자동 전송] AIMS API 실패 상태 저장 시작');
            const errorStatusResponse = await questionnaireAPI.saveDynamicDataPublic(errorStatusPayload);
            const errorStatusResponseData = errorStatusResponse.data || errorStatusResponse;
            const errorStatusIsSuccess = (errorStatusResponseData && typeof errorStatusResponseData === 'object' && 'success' in errorStatusResponseData && errorStatusResponseData.success === true) || errorStatusResponse.status === 200;
            
            if (errorStatusIsSuccess) {
              console.log('✅ [자동 전송] AIMS API 실패 상태 저장 완료');
            } else {
              console.error('❌ [자동 전송] AIMS API 실패 상태 저장 실패:', errorStatusResponseData);
            }
          } catch (errorStatusError) {
            console.error('❌ [자동 전송] AIMS API 실패 상태 저장 중 예외 발생:', errorStatusError);
          }
          
          // 실패 시에도 AIMSLoadingScreen 표시 (에러 메시지 포함)
          setShowLoadingScreen(true);
          console.log('⏳ [자동 전송] AIMS API 실패 - 에러 메시지와 함께 AIMSLoadingScreen 표시');
        }
      } catch (error) {
        console.error('❌ [자동 전송] 자동 전송 중 오류 발생:', error);
        setIsSending(false);
        setIsGeneratingRequest(false);
        hasSentRef.current = true; // 재실행 방지
        
        // 예외 발생 시에도 AIMSLoadingScreen 표시 (통일된 플로우)
        const errorMktUuid = getMktUuidFromUrl() || mktUuidRef.current || currentMktUuid;
        if (errorMktUuid) {
          setShowLoadingScreen(true);
          console.log('⏳ [자동 전송] 예외 발생 - AIMSLoadingScreen 표시 후 리포트 페이지로 이동');
        } else {
          // mkt_uuid가 없으면 에러 메시지 표시 후 랜딩 페이지로 이동
          setErrorMessage('전송 중 오류가 발생했습니다.');
          console.log('🔄 [자동 전송] 랜딩 페이지로 이동 (mkt_uuid 없음)');
          setTimeout(() => {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('page');
            window.location.href = currentUrl.toString();
          }, 3000);
        }
      }
    };

    // 약간의 지연 후 자동 전송 시작
    console.log('⏳ [자동 전송] 500ms 후 자동 전송 시작 예정');
    console.log('🔍 [자동 전송] 타이머 설정 시점 상태:', {
      hasSent: hasSentRef.current,
      isSending,
      showLoadingScreen,
      showAIMSModal,
      mktUuid: getMktUuidFromUrl(),
      isCompleted
    });
    
    const timer = setTimeout(() => {
      console.log('🚀 [자동 전송] 타이머 실행 - autoSend 호출 시작');
      console.log('🔍 [자동 전송] 타이머 실행 시점 상태:', {
        hasSent: hasSentRef.current,
        isSending,
        showLoadingScreen,
        showAIMSModal,
        mktUuid: getMktUuidFromUrl()
      });
      
      // 타이머 실행 시점에 상태 설정 (useEffect 재실행 방지)
      setIsSending(true);
      setIsGeneratingRequest(true);
      
      autoSend();
      console.log('✅ [자동 전송] 타이머 실행 - autoSend 호출 완료');
    }, 500);

    return () => {
      console.log('🧹 [자동 전송] cleanup 함수 실행 - 타이머 취소');
      clearTimeout(timer);
    };
  }, [isCompleted, isSending, showLoadingScreen, showAIMSModal, checkExistingDataAndRedirect]);


  // 백그라운드 터치 핸들러 (모바일)
  const handleOverlayTouch = (e: React.TouchEvent) => {
    // 오버레이 자체를 터치한 경우에만 닫기
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* 패널 바깥 영역 오버레이 - 문진 패널은 배경 터치로 닫히지 않음 (데이터 손실 방지) */}
      {isOpen && (
        <div 
          className="survey-panel-overlay"
          // onClick과 onTouchStart 제거 - 배경 터치로 닫히지 않도록
        />
      )}
      <div className={`survey-slideup-panel ${isOpen ? 'open' : ''}`}>
        <div 
          className="survey-panel-content"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
        {/* 진행 네비게이션 인디케이터 */}
        <div 
          className="survey-panel-header"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <SurveyNavigationIndicator
            currentStep={currentStep}
            totalSteps={totalSteps}
            onPrevious={handlePreviousButtonClick}
            onNext={goToNextQuestion}
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
          />
        </div>

        {/* 문진 내용 영역 */}
        <div 
          className="survey-panel-body"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* 질문 로드 중 스피너 표시 */}
          {isLoadingTemplate && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '40px 20px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #f59e0b',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '16px'
              }}></div>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '8px'
              }}>
                문진 질문 로딩 중...
              </div>
              <div style={{ 
                fontSize: '14px', 
                color: '#6b7280'
              }}>
                잠시만 기다려주세요.
              </div>
            </div>
          )}
          {/* 질문 로드 완료 후 질문 표시 */}
          {!isLoadingTemplate && !isCompleted && currentQuestion >= 1 && currentQuestion <= totalSteps && questions.length > 0 && 
            renderQuestion(questions[currentQuestion - 1])}
          {!isLoadingTemplate && isCompleted && renderCompletion()}
        </div>

        {/* 하단 버튼 - 완료 화면이나 로딩 중에는 버튼 숨김 */}
        {!isCompleted && !isLoadingTemplate && (
          <div className="survey-panel-footer">
            <button
              type="button"
              className="survey-next-button"
              onClick={handleNextButtonClick}
              disabled={!isButtonEnabled}
            >
              {buttonText}
            </button>
          </div>
        )}
      </div>

        {/* AIMS Request Body 모달 */}
        <AIMSRequestModal
          isOpen={showAIMSModal}
          requestBody={aimsRequestBody}
          onClose={() => setShowAIMSModal(false)}
          onSendSuccess={(responseData) => {
            console.log('AIMS API 전송 성공:', responseData);
            // 전송 성공 후 처리 (예: 리포트 페이지로 이동 등)
          }}
        />
      </div>
    </>
  );
};

