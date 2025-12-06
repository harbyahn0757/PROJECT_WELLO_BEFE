/**
 * 검진 설계 추가 설문 패널 컴포넌트
 * 슬라이드 형태로 하나씩 질문을 표시
 */
import React, { useState, useEffect, useMemo } from 'react';
import checkPlannerImage from '../../../assets/images/check_planner.png';
import { useSurveyTracker, InteractionEvent } from './useSurveyTracker';
import './styles.scss';

export interface SurveyResponses {
  weight_change: string;
  daily_routine: string[]; // 멀티셀렉트 (체크박스)
  exercise_frequency: string;
  smoking: string;
  drinking: string;
  sleep_hours: string;
  family_history: string[];
  colonoscopy_experience?: string; // 35세 이상 조건부
  additional_concerns: string;
}

interface CheckupDesignSurveyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (responses: SurveyResponses, events: InteractionEvent[]) => void;
  selectedCount: number;
  patientAge?: number; // 나이 정보 추가 (colonoscopy_experience 조건부 표시용)
}

interface Question {
  key: keyof SurveyResponses;
  label: string;
  type: 'radio' | 'checkbox' | 'textarea';
  options?: { value: string; label: string }[];
  placeholder?: string;
  maxLength?: number;
  isOptional?: boolean; // 선택적 질문 여부
  showIf?: { key: keyof SurveyResponses; value: string }; // 조건부 표시
}

const CheckupDesignSurveyPanel: React.FC<CheckupDesignSurveyPanelProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedCount,
  patientAge
}) => {
  const [responses, setResponses] = useState<SurveyResponses>({
    weight_change: '',
    daily_routine: [],
    exercise_frequency: '',
    smoking: '',
    drinking: '',
    sleep_hours: '',
    family_history: [],
    additional_concerns: ''
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 이벤트 트래커 훅 사용
  const { 
    events, 
    trackSlideEnter, 
    trackOptionClick, 
    trackNavigation, 
    trackInputTyping 
  } = useSurveyTracker();

  // 패널이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setCurrentQuestionIndex(0);
      setResponses({
        weight_change: '',
        daily_routine: [],
        exercise_frequency: '',
        smoking: '',
        drinking: '',
        sleep_hours: '',
        family_history: [],
        additional_concerns: ''
      });
      setErrors({});
      // 첫 질문 슬라이드 진입 추적
      // questions 배열이 렌더링 시점에 생성되므로, 여기서 직접 접근하기보다 questions가 준비된 후 호출하도록 함
    }
  }, [isOpen]);

  // 질문 정의 (10개 구조)
  const basicQuestions: Question[] = [
    {
      key: 'weight_change',
      label: '최근 1년, 체중 변화가 있었나요?',
      type: 'radio',
      options: [
        { value: 'maintain', label: '변화 없음' },
        { value: 'decrease_bad', label: '의도치 않게 빠짐 (3kg 이상)' },
        { value: 'decrease_good', label: '다이어트로 뺌' },
        { value: 'increase_some', label: '조금 쪘음 (1~3kg)' },
        { value: 'increase_more', label: '많이 쪘음 (3kg 이상)' }
      ]
    },
    {
      key: 'daily_routine',
      label: '평소 하루 일과는 어떠신가요? (복수 선택 가능)',
      type: 'checkbox',
      options: [
        { value: 'desk_job', label: '주로 앉아서 모니터 집중' },
        { value: 'mental_stress', label: '중요한 결정/정신적 압박' },
        { value: 'service_job', label: '사람 상대/감정 소모' },
        { value: 'physical_job', label: '몸을 쓰거나 서 있는 일' },
        { value: 'irregular', label: '밤낮 불규칙/식사 불규칙' },
        { value: 'home_maker', label: '가사/은퇴 후 휴식' }
      ]
    },
    {
      key: 'exercise_frequency',
      label: '운동은 하시나요?',
      type: 'radio',
      options: [
        { value: 'regular', label: '규칙적으로 운동함 (주 3회 이상)' },
        { value: 'sometimes', label: '가끔 운동함 (주 1-2회)' },
        { value: 'rarely', label: '거의 안 함' },
        { value: 'never', label: '전혀 안 함' }
      ]
    },
    {
      key: 'smoking',
      label: '흡연하시나요?',
      type: 'radio',
      options: [
        { value: 'non_smoker', label: '비흡연' },
        { value: 'ex_smoker', label: '과거 흡연 (금연)' },
        { value: 'current_smoker', label: '현재 흡연' }
      ]
    },
    {
      key: 'drinking',
      label: '음주 빈도는?',
      type: 'radio',
      options: [
        { value: 'never', label: '전혀 안 함' },
        { value: 'monthly_less', label: '월 1회 미만' },
        { value: 'monthly_1_2', label: '월 1-2회' },
        { value: 'weekly_1_2', label: '주 1-2회' },
        { value: 'weekly_3plus', label: '주 3회 이상' }
      ]
    },
    {
      key: 'sleep_hours',
      label: '평균 수면 시간은?',
      type: 'radio',
      options: [
        { value: 'less_5', label: '5시간 미만' },
        { value: '5_6', label: '5-6시간' },
        { value: '6_7', label: '6-7시간' },
        { value: '7_8', label: '7-8시간' },
        { value: 'more_8', label: '8시간 이상' }
      ]
    },
    {
      key: 'family_history',
      label: '가족 중에 다음 질환이 있으신가요? (복수 선택 가능)',
      type: 'checkbox',
      options: [
        { value: 'cancer', label: '암' },
        { value: 'stroke', label: '뇌졸중' },
        { value: 'heart_disease', label: '심장질환' },
        { value: 'diabetes', label: '당뇨' },
        { value: 'hypertension', label: '고혈압' },
        { value: 'none', label: '없음' }
      ]
    },
    {
      key: 'additional_concerns',
      label: '특별히 걱정되거나 확인하고 싶은 부분이 있으신가요?',
      type: 'textarea',
      placeholder: '예: 최근 두통이 자주 발생합니다, 소화가 잘 안됩니다 등 (선택사항)',
      maxLength: 500
    }
  ];

  // 35세 이상일 경우 추가되는 질문
  const conditionalQuestions: Question[] = [];
  if (patientAge && patientAge >= 35) {
    conditionalQuestions.push({
      key: 'colonoscopy_experience',
      label: '대장내시경 경험이 있나요?',
      type: 'radio',
      options: [
        { value: 'yes_comfortable', label: '예, 불편함 없이 받았습니다' },
        { value: 'yes_uncomfortable', label: '예, 불편했습니다' },
        { value: 'no_afraid', label: '아니오, 두려워서 받지 않았습니다' },
        { value: 'no_never', label: '아니오, 받아본 적이 없습니다' }
      ]
    });
  }

  // 전체 질문 목록 (기본 + 조건부)
  const questions = useMemo(() => {
    return [...basicQuestions, ...conditionalQuestions];
  }, [patientAge]);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  // 질문 인덱스 변경 시 슬라이드 진입 추적
  useEffect(() => {
    if (isOpen && currentQuestion) {
      trackSlideEnter(currentQuestion.key);
    }
  }, [isOpen, currentQuestionIndex, currentQuestion, trackSlideEnter]);

  // 가족력 다중 선택 핸들러
  const handleFamilyHistoryChange = (value: string) => {
    trackOptionClick('family_history', value); // 클릭 추적
    setResponses(prev => {
      const current = [...prev.family_history];
      if (value === 'none') {
        return { ...prev, family_history: ['none'] };
      } else {
        const filtered = current.filter(v => v !== 'none');
        if (filtered.includes(value)) {
          return { ...prev, family_history: filtered.filter(v => v !== value) };
        } else {
          return { ...prev, family_history: [...filtered, value] };
        }
      }
    });
  };

  // daily_routine 다중 선택 핸들러
  const handleDailyRoutineChange = (value: string) => {
    trackOptionClick('daily_routine', value); // 클릭 추적
    setResponses(prev => {
      const current = [...prev.daily_routine];
      if (current.includes(value)) {
        return { ...prev, daily_routine: current.filter(v => v !== value) };
      } else {
        return { ...prev, daily_routine: [...current, value] };
      }
    });
  };

  // 라디오 선택 핸들러 (자동으로 다음 질문으로 이동)
  const handleRadioChange = (value: string) => {
    trackOptionClick(currentQuestion.key, value); // 클릭 추적
    setResponses(prev => ({ ...prev, [currentQuestion.key]: value }));
    setErrors(prev => ({ ...prev, [currentQuestion.key]: '' }));
    
    // 다음 질문으로 자동 이동 (마지막 질문이 아니면)
    if (!isLastQuestion) {
      setTimeout(() => {
        trackNavigation(currentQuestion.key, 'NEXT'); // 자동 이동도 네비게이션으로 추적
        setCurrentQuestionIndex(prev => prev + 1);
      }, 300); // 부드러운 전환을 위한 딜레이
    }
  };

  // 체크박스 변경 핸들러 (family_history, daily_routine)
  const handleCheckboxChange = (value: string) => {
    // family_history는 특별 처리 ('none' 선택 시 단독 선택)
    if (currentQuestion.key === 'family_history') {
      handleFamilyHistoryChange(value);
    } else if (currentQuestion.key === 'daily_routine') {
      handleDailyRoutineChange(value);
    }
    setErrors(prev => ({ ...prev, [currentQuestion.key]: '' }));
  };

  // 텍스트 영역 변경 핸들러
  const handleTextareaChange = (value: string) => {
    trackInputTyping(currentQuestion.key, value.length); // 타이핑 추적
    setResponses(prev => ({ ...prev, [currentQuestion.key]: value }));
    setErrors(prev => ({ ...prev, [currentQuestion.key]: '' }));
  };

  // 이전 질문으로 이동
  const handlePrevious = () => {
    if (!isFirstQuestion) {
      trackNavigation(currentQuestion.key, 'PREV'); // 이전 버튼 클릭 추적
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  // 다음 질문으로 이동
  const handleNext = () => {
    // 현재 질문 검증
    if (currentQuestion.type === 'radio' && !responses[currentQuestion.key]) {
      setErrors(prev => ({ ...prev, [currentQuestion.key]: '항목을 선택해주세요.' }));
      return;
    }
    if (currentQuestion.type === 'checkbox' && (responses[currentQuestion.key] as string[]).length === 0) {
      setErrors(prev => ({ ...prev, [currentQuestion.key]: '항목을 선택해주세요.' }));
      return;
    }

    if (!isLastQuestion) {
      trackNavigation(currentQuestion.key, 'NEXT'); // 다음 버튼 클릭 추적
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  // 폼 검증
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    questions.forEach(question => {
      // textarea는 선택사항이므로 검증 제외
      if (question.type === 'textarea') {
        return;
      }
      
      if (question.type === 'radio' && !responses[question.key]) {
        newErrors[question.key] = '항목을 선택해주세요.';
      } else if (question.type === 'checkbox' && (responses[question.key] as string[]).length === 0) {
        newErrors[question.key] = '항목을 선택해주세요.';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 제출 핸들러
  const handleSubmit = () => {
    if (validate()) {
      trackNavigation(currentQuestion.key, 'NEXT'); // 제출도 네비게이션으로 간주 (마지막 완료)
      onSubmit(responses, events);
    } else {
      // 에러가 있는 첫 번째 질문으로 이동
      const firstErrorIndex = questions.findIndex(q => errors[q.key]);
      if (firstErrorIndex !== -1) {
        setCurrentQuestionIndex(firstErrorIndex);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 오버레이 */}
      <div 
        className="checkup-design-survey-panel__overlay"
        onClick={onClose}
      />
      
      {/* 패널 */}
      <div className="checkup-design-survey-panel">
        <div className="checkup-design-survey-panel__header">
          <h2 className="checkup-design-survey-panel__title">
            검진 설계를 위한 추가 정보
          </h2>
          <p className="checkup-design-survey-panel__subtitle">
            선택하신 {selectedCount}개 항목을 바탕으로 더 정확한 검진 설계를 위해 몇 가지 질문에 답변해주세요.
          </p>
          <button
            className="checkup-design-survey-panel__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 진행 상태 표시 */}
        <div className="checkup-design-survey-panel__progress">
          <div className="checkup-design-survey-panel__progress-bar">
            <div 
              className="checkup-design-survey-panel__progress-fill"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
          <div className="checkup-design-survey-panel__progress-text">
            {currentQuestionIndex + 1} / {questions.length}
          </div>
        </div>

        {/* 질문 슬라이드 컨테이너 */}
        <div className="checkup-design-survey-panel__content">
          <div 
            className="checkup-design-survey-panel__slide-container"
            style={{ transform: `translateX(-${currentQuestionIndex * 100}%)` }}
          >
            {questions.map((question, index) => (
              <div
                key={question.key}
                className="checkup-design-survey-panel__slide"
              >
                <div className="survey-question">
                  <div className="survey-question__header">
                    <div className="survey-question__step-image">
                      <img
                        src={checkPlannerImage}
                        alt="간호사 설명"
                        className="survey-question__nurse-illustration"
                      />
                    </div>
                    <label className="survey-question__label">
                      {question.label}
                    </label>
                  </div>

                  {question.type === 'radio' && question.options && (
                    <div className="survey-question__options">
                      {question.options.map(option => (
                        <label key={option.value} className="survey-option">
                          <input
                            type="radio"
                            name={question.key}
                            value={option.value}
                            checked={(responses[question.key] as string) === option.value}
                            onChange={() => handleRadioChange(option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {question.type === 'checkbox' && question.options && (
                    <div className="survey-question__options">
                      {question.options.map(option => {
                        const currentValue = responses[question.key];
                        const valueArray = Array.isArray(currentValue) ? currentValue : [];
                        return (
                          <label key={option.value} className="survey-option">
                            <input
                              type="checkbox"
                              value={option.value}
                              checked={valueArray.includes(option.value)}
                              onChange={() => handleCheckboxChange(option.value)}
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {question.type === 'textarea' && (
                    <div className="survey-question__textarea-wrapper">
                      <textarea
                        className="survey-question__textarea"
                        placeholder={question.placeholder}
                        value={responses[question.key] as string}
                        onChange={(e) => handleTextareaChange(e.target.value)}
                        maxLength={question.maxLength}
                        rows={4}
                      />
                      <div className="survey-question__char-count">
                        {(responses[question.key] as string).length} / {question.maxLength}
                      </div>
                    </div>
                  )}

                  {errors[question.key] && (
                    <span className="survey-question__error">{errors[question.key]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 (이전/다음 또는 제출 버튼) */}
        <div className="checkup-design-survey-panel__footer">
          {!isFirstQuestion && (
            <button
              className="checkup-design-survey-panel__prev"
              onClick={handlePrevious}
            >
              이전
            </button>
          )}
          {!isLastQuestion ? (
            <button
              className="checkup-design-survey-panel__next"
              onClick={handleNext}
            >
              다음
            </button>
          ) : (
            <button
              className="checkup-design-survey-panel__submit"
              onClick={handleSubmit}
            >
              검진 설계하기
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default CheckupDesignSurveyPanel;
