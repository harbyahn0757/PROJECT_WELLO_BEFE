import React, { useState } from 'react';
import apiConfig from '../../config/api';

interface PNTQuestion {
  question_id: string;
  question_text: string;
  question_type: 'radio' | 'checkbox' | 'scale';
  options: Array<{
    option_id?: string;
    option_value: string;
    option_label: string;
    score: number;
  }>;
  group_name: string;
  question_index: number;
  total_questions: number;
}

interface PNTInlineSurveyProps {
  question: PNTQuestion;
  onAnswer: (questionId: string, answerValue: string, answerScore: number) => Promise<void>;
  uuid: string;
  hospitalId: string;
  sessionId: string;
}

const PNTInlineSurvey: React.FC<PNTInlineSurveyProps> = ({
  question,
  onAnswer,
  uuid,
  hospitalId,
  sessionId
}) => {
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRadioChange = async (value: string, score: number) => {
    if (isSubmitting) return;
    setSelectedValue(value);
    setIsSubmitting(true);
    await onAnswer(question.question_id, value, score);
    setIsSubmitting(false);
  };

  const handleCheckboxChange = (value: string) => {
    if (isSubmitting) return;
    setSelectedValues(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const handleCheckboxSubmit = async () => {
    if (isSubmitting || selectedValues.length === 0) return;
    
    // 체크박스는 첫 번째 선택값과 평균 점수 사용 (간단화)
    const firstOption = question.options.find(opt => selectedValues.includes(opt.option_value));
    if (firstOption) {
      setIsSubmitting(true);
      await onAnswer(question.question_id, selectedValues.join(','), firstOption.score);
      setIsSubmitting(false);
    }
  };

  const handleScaleChange = async (value: string, score: number) => {
    if (isSubmitting) return;
    setSelectedValue(value);
    setIsSubmitting(true);
    await onAnswer(question.question_id, value, score);
    setIsSubmitting(false);
  };

  return (
    <div className="pnt-inline-survey">
      <div className="pnt-survey-header">
        <div className="pnt-survey-progress">
          {question.question_index} / {question.total_questions}
        </div>
        <div className="pnt-survey-group">{question.group_name}</div>
      </div>
      
      <div className="pnt-survey-question">
        <h4>{question.question_text}</h4>
      </div>

      <div className="pnt-survey-options">
        {question.question_type === 'radio' && (
          <div className="pnt-radio-options">
            {question.options.map((option) => (
              <label
                key={option.option_value}
                className={`pnt-option ${selectedValue === option.option_value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name={question.question_id}
                  value={option.option_value}
                  checked={selectedValue === option.option_value}
                  onChange={() => handleRadioChange(option.option_value, option.score)}
                  disabled={isSubmitting}
                />
                <span>{option.option_label}</span>
              </label>
            ))}
          </div>
        )}

        {question.question_type === 'checkbox' && (
          <div className="pnt-checkbox-options">
            {question.options.map((option) => (
              <label
                key={option.option_value}
                className={`pnt-option ${selectedValues.includes(option.option_value) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  value={option.option_value}
                  checked={selectedValues.includes(option.option_value)}
                  onChange={() => handleCheckboxChange(option.option_value)}
                  disabled={isSubmitting}
                />
                <span>{option.option_label}</span>
              </label>
            ))}
            <button
              className="pnt-submit-button"
              onClick={handleCheckboxSubmit}
              disabled={isSubmitting || selectedValues.length === 0}
            >
              {isSubmitting ? '처리 중...' : '다음'}
            </button>
          </div>
        )}

        {question.question_type === 'scale' && (
          <div className="pnt-scale-options">
            {question.options.map((option) => (
              <label
                key={option.option_value}
                className={`pnt-option ${selectedValue === option.option_value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name={question.question_id}
                  value={option.option_value}
                  checked={selectedValue === option.option_value}
                  onChange={() => handleScaleChange(option.option_value, option.score)}
                  disabled={isSubmitting}
                />
                <span>{option.option_label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {isSubmitting && (
        <div className="pnt-survey-loading">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      )}
    </div>
  );
};

export default PNTInlineSurvey;
