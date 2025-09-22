import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Survey, 
  SurveySection,
  SurveyQuestion, 
  SurveyAnswer, 
  SurveyResponse 
} from '../types/survey';
import '../styles/_survey.scss';

interface DynamicSurveyProps {
  survey: Survey;
  initialResponse?: SurveyResponse;
  onSave?: (response: SurveyResponse) => Promise<void>;
  onComplete?: (response: SurveyResponse) => Promise<void>;
  onBack?: () => void;
}

const DynamicSurvey: React.FC<DynamicSurveyProps> = ({
  survey,
  initialResponse,
  onSave,
  onComplete,
  onBack
}) => {
  const navigate = useNavigate();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswer[]>(initialResponse?.answers || []);
  const [sessionId] = useState<string>(initialResponse?.sessionId || `session_${Date.now()}`);

  const currentPage = survey.pages[currentPageIndex];
  const isLastPage = currentPageIndex === survey.pages.length - 1;
  
  // response 변수 제거됨 - hasAnswerForPage 함수로 대체
  
  // 답변이 있는 페이지들을 확인하기 위한 헬퍼 함수
  const hasAnswerForPage = (pageId: string): boolean => {
    const page = survey.pages.find(page => page.id === pageId);
    if (!page) return false;
    
    return page.sections.some(section => 
      section.questions.some(question => 
        answers.some(answer => answer.questionId === question.id)
      )
    );
  };

  // SurveyResponse 객체 생성 헬퍼 함수
  const createResponse = (): SurveyResponse => ({
    sessionId,
    surveyId: survey.id,
    currentPageId: currentPage.id,
    answers,
    isCompleted: isLastPage && answers.length > 0,
    startedAt: initialResponse?.startedAt || new Date(),
    completedAt: isLastPage ? new Date() : undefined,
    lastSavedAt: new Date()
  });

  // 답변 저장
  const saveAnswer = (questionId: string, value: string | number | boolean | string[] | number[]) => {
    setAnswers(prev => {
      const existingIndex = prev.findIndex(answer => answer.questionId === questionId);
      const newAnswer: SurveyAnswer = {
        questionId,
        value,
        timestamp: new Date()
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newAnswer;
        return updated;
      } else {
        return [...prev, newAnswer];
      }
    });
  };

  // 답변 가져오기
  const getAnswer = (questionId: string) => {
    const answer = answers.find(a => a.questionId === questionId);
    return answer?.value;
  };

  // 조건부 질문 표시 여부 확인
  const shouldShowQuestion = (question: SurveyQuestion): boolean => {
    if (!question.showIf) return true;
    
    const conditionAnswer = getAnswer(question.showIf.questionId);
    return conditionAnswer === question.showIf.value;
  };

  // 체크박스 이벤트 핸들러
  const handleCheckboxChange = (questionId: string, optionValue: string, checked: boolean, isNone?: boolean) => {
    const currentAnswers = getAnswer(questionId) as string[] || [];
    
    if (isNone && checked) {
      // "해당없음" 선택 시 모든 선택 해제
      saveAnswer(questionId, [optionValue]);
    } else if (checked) {
      // 일반 옵션 선택 시 "해당없음" 제거
      const filteredAnswers = currentAnswers.filter(val => {
        const question = findQuestionById(questionId);
        const noneOption = question?.options?.find(opt => opt.isNone);
        return !noneOption || val !== noneOption.value;
      });
      saveAnswer(questionId, [...filteredAnswers, optionValue]);
    } else {
      // 선택 해제
      const filteredAnswers = currentAnswers.filter(val => val !== optionValue);
      saveAnswer(questionId, filteredAnswers);
    }
  };

  // 라디오 이벤트 핸들러
  const handleRadioChange = (questionId: string, value: string) => {
    saveAnswer(questionId, value);
  };

  // 입력 이벤트 핸들러
  const handleInputChange = (questionId: string, value: string | number) => {
    saveAnswer(questionId, value);
  };

  // 질문 ID로 질문 찾기
  const findQuestionById = (questionId: string): SurveyQuestion | undefined => {
    for (const page of survey.pages) {
      for (const section of page.sections) {
        const question = section.questions.find(q => q.id === questionId);
        if (question) return question;
      }
    }
    return undefined;
  };

  // 다음 페이지
  const handleNext = async () => {
    const response = createResponse();

    if (survey.settings.autoSave && onSave) {
      await onSave(response);
    }

    if (isLastPage) {
      if (onComplete) {
        await onComplete(response);
      }
    } else {
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  // 이전 페이지
  const handleBack = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    } else if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  // 질문 렌더링
  const renderQuestion = (question: SurveyQuestion) => {
    if (!shouldShowQuestion(question)) return null;

    const answer = getAnswer(question.id);

    switch (question.type) {
      case 'checkbox':
        return (
          <div key={question.id}>
            <span className="question__content-input-label">
              {question.title}
              {question.subtitle && (
                <>
                  <br />
                  <small>{question.subtitle}</small>
                </>
              )}
            </span>
            <div>
              {question.options?.map(option => (
                <label 
                  key={option.id} 
                  htmlFor={`${question.id}_${option.id}`} 
                  className={`question__content-input-button ${option.isNone ? 'nothing' : ''}`}
                >
                  <input
                    id={`${question.id}_${option.id}`}
                    type="checkbox"
                    checked={(answer as string[] || []).includes(option.value as string)}
                    onChange={(e) => handleCheckboxChange(
                      question.id, 
                      option.value as string, 
                      e.target.checked, 
                      option.isNone
                    )}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'radio':
        return (
          <div key={question.id}>
            <span className="question__content-input-label">
              {question.title}
              {question.subtitle && (
                <>
                  <br />
                  <small>{question.subtitle}</small>
                </>
              )}
            </span>
            <div>
              {question.options?.map(option => (
                <label 
                  key={option.id} 
                  htmlFor={`${question.id}_${option.id}`} 
                  className="question__content-input-button"
                >
                  <input
                    id={`${question.id}_${option.id}`}
                    type="radio"
                    name={question.id}
                    value={option.value as string}
                    checked={answer === option.value}
                    onChange={(e) => handleRadioChange(question.id, e.target.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'input':
        return (
          <div key={question.id}>
            <span className="question__content-input-label">{question.title}</span>
            <input
              type={question.inputType || 'text'}
              className="question__content-input"
              value={answer as string || ''}
              onChange={(e) => handleInputChange(question.id, 
                question.inputType === 'number' ? Number(e.target.value) : e.target.value
              )}
              placeholder={question.subtitle}
            />
          </div>
        );

      case 'select':
        return (
          <div key={question.id}>
            <span className="question__content-input-label">{question.title}</span>
            <select
              className="question__content-input"
              value={answer as string || ''}
              onChange={(e) => handleInputChange(question.id, e.target.value)}
            >
              <option value="">선택해주세요</option>
              {question.options?.map(option => (
                <option key={option.id} value={option.value as string}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  // 섹션 렌더링
  const renderSection = (section: SurveySection) => {
    const visibleQuestions = section.questions.filter(shouldShowQuestion);
    if (visibleQuestions.length === 0) return null;

    return (
      <div key={section.id} className="question__content-input-area">
        {section.title && (
          <span className="question__content-input-label">
            <strong>{section.title}</strong>
            {section.subtitle && (
              <>
                <br />
                {section.subtitle}
              </>
            )}
          </span>
        )}
        {visibleQuestions.map(renderQuestion)}
      </div>
    );
  };

  return (
    <>
      {/* 뒤로가기 버튼 */}
      {survey.settings.allowBack && (
        <div className="back-button-container">
          <button className="back-button" onClick={handleBack}>
            ←
          </button>
        </div>
      )}
      
      <div className="question__content">
        {/* 제목 */}
        <div className="question__title" style={{ marginTop: '60px' }}>
          <span className="question__title-text--ss">{currentPage.title}</span>
          <span className="question__title-text">
            {survey.settings.showProgress && (
              <>페이지 {currentPageIndex + 1}/{survey.pages.length}<br /></>
            )}
            {currentPage.subtitle}
          </span>
        </div>
        
        {/* 설문 내용 */}
        <div className="question__content-input-area">
          {currentPage.sections.map(renderSection)}
        </div>
        
        {/* 콘텐츠 하단 여백 (플로팅 버튼을 위한) */}
        <div style={{ height: '100px' }}></div>
      </div>
      
      {/* 하단 고정 플로팅 버튼 */}
      <div className="survey-floating-button">
        {/* 뒤로/앞으로 네비게이션 버튼들 */}
        {currentPageIndex > 0 && (
          <button 
            type="button" 
            className="survey-floating-button__btn survey-floating-button__btn--secondary" 
            onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
            style={{ 
              marginRight: '12px',
              backgroundColor: '#6b7280',
              flex: '0 0 auto',
              minWidth: '80px'
            }}
          >
            이전
          </button>
        )}
        
        <button 
          type="button" 
          className="survey-floating-button__btn" 
          onClick={handleNext}
          style={{ flex: '1' }}
        >
          {isLastPage ? '완료' : '다음'}
        </button>
        
        {/* 앞으로가기 버튼 (이미 진행했던 페이지가 있는 경우) */}
        {currentPageIndex < survey.pages.length - 1 && hasAnswerForPage(survey.pages[currentPageIndex + 1]?.id) && (
          <button 
            type="button" 
            className="survey-floating-button__btn survey-floating-button__btn--tertiary" 
            onClick={() => setCurrentPageIndex(prev => Math.min(survey.pages.length - 1, prev + 1))}
            style={{ 
              marginLeft: '12px',
              backgroundColor: '#9ca3af',
              flex: '0 0 auto',
              minWidth: '80px'
            }}
          >
            건너뛰기
          </button>
        )}
      </div>
    </>
  );
};

export default DynamicSurvey;
