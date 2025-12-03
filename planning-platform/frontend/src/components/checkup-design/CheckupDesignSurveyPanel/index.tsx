/**
 * 검진 설계 추가 설문 패널 컴포넌트
 * 슬라이드 형태로 하나씩 질문을 표시
 */
import React, { useState, useEffect, useMemo } from 'react';
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
  // 선택적 추가 질문
  optional_questions_enabled?: string; // 'yes' | 'no'
  cancer_history?: string;
  hepatitis_carrier?: string;
  colonoscopy_experience?: string;
  lung_nodule?: string;
  gastritis?: string;
  imaging_aversion?: string[]; // 체크박스 필드는 배열
  genetic_test?: string;
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
  isOptional?: boolean; // 선택적 질문 여부
  showIf?: { key: keyof SurveyResponses; value: string }; // 조건부 표시
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
    additional_concerns: '',
    optional_questions_enabled: undefined,
    imaging_aversion: [] // 체크박스 필드는 배열로 초기화
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
        additional_concerns: '',
        optional_questions_enabled: undefined,
        imaging_aversion: [] // 체크박스 필드는 배열로 초기화
      });
      setErrors({});
    }
  }, [isOpen]);

  // 기본 질문 정의 (필수)
  const basicQuestions: Question[] = [
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
    },
    // 선택적 질문 활성화 여부 질문
    {
      key: 'optional_questions_enabled',
      label: '더 정확한 검진 설계를 위해 추가 질문에 답하시겠어요?',
      type: 'radio',
      options: [
        { value: 'yes', label: '예, 답하겠습니다' },
        { value: 'no', label: '아니오, 이대로 진행하겠습니다' }
      ]
    }
  ];

  // 선택적 추가 질문 정의 (optional_questions_enabled가 'yes'일 때만 표시)
  const optionalQuestions: Question[] = [
    {
      key: 'cancer_history',
      label: '과거 암 진단을 받으신 적이 있으신가요?',
      type: 'radio',
      options: [
        { value: 'yes_current', label: '예, 현재 치료 중입니다' },
        { value: 'yes_past', label: '예, 과거에 치료를 받았습니다' },
        { value: 'no', label: '아니오' }
      ],
      isOptional: true,
      showIf: { key: 'optional_questions_enabled', value: 'yes' }
    },
    {
      key: 'hepatitis_carrier',
      label: 'B형 또는 C형 간염 보균자이신가요?',
      type: 'radio',
      options: [
        { value: 'hepatitis_b', label: 'B형 간염 보균자' },
        { value: 'hepatitis_c', label: 'C형 간염 보균자' },
        { value: 'both', label: '둘 다' },
        { value: 'no', label: '아니오' }
      ],
      isOptional: true,
      showIf: { key: 'optional_questions_enabled', value: 'yes' }
    },
    {
      key: 'colonoscopy_experience',
      label: '대장내시경 검사를 받으신 적이 있으신가요?',
      type: 'radio',
      options: [
        { value: 'yes_comfortable', label: '예, 불편함 없이 받았습니다' },
        { value: 'yes_uncomfortable', label: '예, 불편했습니다' },
        { value: 'no_afraid', label: '아니오, 두려워서 받지 않았습니다' },
        { value: 'no_never', label: '아니오, 받아본 적이 없습니다' }
      ],
      isOptional: true,
      showIf: { key: 'optional_questions_enabled', value: 'yes' }
    },
    {
      key: 'lung_nodule',
      label: '흉부 CT나 X-ray에서 폐 결절이 발견된 적이 있으신가요?',
      type: 'radio',
      options: [
        { value: 'yes', label: '예' },
        { value: 'no', label: '아니오' },
        { value: 'unknown', label: '모르겠습니다' }
      ],
      isOptional: true,
      showIf: { key: 'optional_questions_enabled', value: 'yes' }
    },
    {
      key: 'gastritis',
      label: '현재 또는 과거에 위염이나 소화불량 증상이 있으신가요?',
      type: 'radio',
      options: [
        { value: 'yes_current', label: '예, 현재 있습니다' },
        { value: 'yes_past', label: '예, 과거에 있었습니다' },
        { value: 'no', label: '아니오' }
      ],
      isOptional: true,
      showIf: { key: 'optional_questions_enabled', value: 'yes' }
    },
    {
      key: 'imaging_aversion',
      label: '다음 검사 중 기피하거나 불편함을 느끼는 검사가 있으신가요?',
      type: 'checkbox',
      options: [
        { value: 'ct', label: 'CT (컴퓨터 단층촬영)' },
        { value: 'xray', label: 'X-ray (엑스레이)' },
        { value: 'mri', label: 'MRI (자기공명영상)' },
        { value: 'none', label: '없음' }
      ],
      isOptional: true,
      showIf: { key: 'optional_questions_enabled', value: 'yes' }
    },
    {
      key: 'genetic_test',
      label: '가족 중 유전성 암(브라카 변이 등)이 의심되는 경우가 있으신가요?',
      type: 'radio',
      options: [
        { value: 'yes', label: '예' },
        { value: 'no', label: '아니오' },
        { value: 'unknown', label: '모르겠습니다' }
      ],
      isOptional: true,
      showIf: { key: 'optional_questions_enabled', value: 'yes' }
    }
  ];

  // 표시할 질문 목록 계산 (조건부 필터링)
  const questions = useMemo(() => {
    const allQuestions = [...basicQuestions];
    
    // optional_questions_enabled가 'yes'인 경우에만 선택적 질문 추가
    if (responses.optional_questions_enabled === 'yes') {
      allQuestions.push(...optionalQuestions);
    }
    
    return allQuestions;
  }, [responses.optional_questions_enabled]);

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
    
    // optional_questions_enabled가 'no'로 선택되면 바로 제출 가능
    if (currentQuestion.key === 'optional_questions_enabled' && value === 'no') {
      // 기본 질문만으로 제출 가능 (선택적 질문은 빈 값으로)
      setTimeout(() => {
        handleSubmit();
      }, 300);
      return;
    }
    
    // 다음 질문으로 자동 이동 (마지막 질문이 아니면)
    if (!isLastQuestion) {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 300); // 부드러운 전환을 위한 딜레이
    }
  };

  // 체크박스 변경 핸들러 (범용)
  const handleCheckboxChange = (value: string) => {
    const questionKey = currentQuestion.key;
    
    // 가족력은 특별 처리
    if (questionKey === 'family_history') {
      handleFamilyHistoryChange(value);
    } else {
      // 다른 체크박스 필드 (imaging_aversion 등)
      setResponses(prev => {
        const current = (prev[questionKey] as string[]) || [];
        if (value === 'none') {
          return { ...prev, [questionKey]: ['none'] };
        } else {
          const filtered = current.filter(v => v !== 'none');
          if (filtered.includes(value)) {
            return { ...prev, [questionKey]: filtered.filter(v => v !== value) };
          } else {
            return { ...prev, [questionKey]: [...filtered, value] };
          }
        }
      });
    }
    setErrors(prev => ({ ...prev, [questionKey]: '' }));
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

    // "아니오"를 선택한 경우, optional_questions_enabled 질문까지의 기본 질문만 검증
    // (optional_questions_enabled 질문 자체는 이미 선택되었으므로 검증 제외)
    const questionsToValidate = responses.optional_questions_enabled === 'yes' 
      ? questions 
      : basicQuestions.filter(q => q.key !== 'optional_questions_enabled' || responses.optional_questions_enabled === 'no');

    questionsToValidate.forEach(question => {
      // optional_questions_enabled 질문은 이미 선택되었으므로 검증 제외
      if (question.key === 'optional_questions_enabled') {
        return;
      }
      
      // 선택적 질문은 optional_questions_enabled가 'yes'일 때만 검증
      if (question.isOptional && responses.optional_questions_enabled !== 'yes') {
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
