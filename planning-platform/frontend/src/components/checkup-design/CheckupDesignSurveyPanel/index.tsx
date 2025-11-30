/**
 * 검진 설계 추가 설문 패널 컴포넌트
 * 슬라이드 형태로 하나씩 질문을 표시
 */
import React, { useState, useEffect } from 'react';
import checkPlannerImage from '../../../assets/images/check_planner.png';
import './styles.scss';

export interface SurveyResponses {
  weight_change: string;
  exercise_frequency: string;
  family_history: string[];
  smoking: string;
  drinking: string;
  sleep_hours: string;
  stress_level: string;
  additional_concerns: string;
}

interface CheckupDesignSurveyPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (responses: SurveyResponses) => void;
  selectedCount: number;
}

interface Question {
  key: keyof SurveyResponses;
  label: string;
  type: 'radio' | 'checkbox' | 'textarea';
  options?: { value: string; label: string }[];
  placeholder?: string;
  maxLength?: number;
}

const CheckupDesignSurveyPanel: React.FC<CheckupDesignSurveyPanelProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedCount
}) => {
  const [responses, setResponses] = useState<SurveyResponses>({
    weight_change: '',
    exercise_frequency: '',
    family_history: [],
    smoking: '',
    drinking: '',
    sleep_hours: '',
    stress_level: '',
    additional_concerns: ''
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // 패널이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setCurrentQuestionIndex(0);
      setResponses({
        weight_change: '',
        exercise_frequency: '',
        family_history: [],
        smoking: '',
        drinking: '',
        sleep_hours: '',
        stress_level: '',
        additional_concerns: ''
      });
      setErrors({});
    }
  }, [isOpen]);

  // 질문 정의
  const questions: Question[] = [
    {
      key: 'weight_change',
      label: '최근 3개월간 체중 변화가 있으신가요?',
      type: 'radio',
      options: [
        { value: 'increase_more', label: '증가 (3kg 이상)' },
        { value: 'increase_some', label: '약간 증가 (1-3kg)' },
        { value: 'maintain', label: '유지' },
        { value: 'decrease_some', label: '약간 감소 (1-3kg)' },
        { value: 'decrease_more', label: '감소 (3kg 이상)' }
      ]
    },
    {
      key: 'exercise_frequency',
      label: '최근 운동을 하시나요?',
      type: 'radio',
      options: [
        { value: 'regular', label: '규칙적으로 운동함 (주 3회 이상)' },
        { value: 'sometimes', label: '가끔 운동함 (주 1-2회)' },
        { value: 'rarely', label: '거의 안 함' },
        { value: 'never', label: '전혀 안 함' }
      ]
    },
    {
      key: 'family_history',
      label: '가족 중에 다음 질환이 있으신가요? (복수 선택 가능)',
      type: 'checkbox',
      options: [
        { value: 'hypertension', label: '고혈압' },
        { value: 'diabetes', label: '당뇨병' },
        { value: 'heart_disease', label: '심장질환' },
        { value: 'cancer', label: '암' },
        { value: 'stroke', label: '뇌졸중' },
        { value: 'none', label: '없음' }
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
      key: 'stress_level',
      label: '최근 스트레스 수준은?',
      type: 'radio',
      options: [
        { value: 'very_high', label: '매우 높음' },
        { value: 'high', label: '높음' },
        { value: 'medium', label: '보통' },
        { value: 'low', label: '낮음' },
        { value: 'very_low', label: '매우 낮음' }
      ]
    },
    {
      key: 'additional_concerns',
      label: '검진 설계 시 고려해주셨으면 하는 특이사항이나 고민사항이 있으신가요?',
      type: 'textarea',
      placeholder: '예: 최근 두통이 자주 발생합니다, 가족 중 암 환자가 있어서 걱정됩니다 등',
      maxLength: 500
    }
  ];

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  // 가족력 다중 선택 핸들러
  const handleFamilyHistoryChange = (value: string) => {
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

  // 라디오 선택 핸들러 (자동으로 다음 질문으로 이동)
  const handleRadioChange = (value: string) => {
    setResponses(prev => ({ ...prev, [currentQuestion.key]: value }));
    setErrors(prev => ({ ...prev, [currentQuestion.key]: '' }));
    
    // 다음 질문으로 자동 이동 (마지막 질문이 아니면)
    if (!isLastQuestion) {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 300); // 부드러운 전환을 위한 딜레이
    }
  };

  // 체크박스 변경 핸들러
  const handleCheckboxChange = (value: string) => {
    handleFamilyHistoryChange(value);
    setErrors(prev => ({ ...prev, [currentQuestion.key]: '' }));
  };

  // 텍스트 영역 변경 핸들러
  const handleTextareaChange = (value: string) => {
    setResponses(prev => ({ ...prev, [currentQuestion.key]: value }));
    setErrors(prev => ({ ...prev, [currentQuestion.key]: '' }));
  };

  // 이전 질문으로 이동
  const handlePrevious = () => {
    if (!isFirstQuestion) {
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
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  // 폼 검증
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    questions.forEach(question => {
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
      onSubmit(responses);
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
                      {question.options.map(option => (
                        <label key={option.value} className="survey-option">
                          <input
                            type="checkbox"
                            value={option.value}
                            checked={(responses[question.key] as string[]).includes(option.value)}
                            onChange={() => handleCheckboxChange(option.value)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
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
