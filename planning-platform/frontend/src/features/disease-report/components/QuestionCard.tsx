import React from 'react';
import { QuestionInfo, OptionItem as OptionItemType } from '../types';
import { OptionItem } from './OptionItem';

interface QuestionCardProps {
  question: QuestionInfo;
  values: string | string[] | undefined;
  onRadioChange: (value: string) => void;
  onCheckboxChange: (value: string, checked: boolean) => void;
  className?: string;
  totalQuestions?: number; // 전체 질문 수 (동적 질문 지원)
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  values,
  onRadioChange,
  onCheckboxChange,
  className = '',
  totalQuestions,
}) => {
  const { number, title, subtitle, type, options, name } = question;
  
  // 전체 질문 수 (동적 질문 지원, 기본값 5는 하위 호환성)
  const total = totalQuestions || 5;

  // 체크박스 값 배열
  const checkboxValues = Array.isArray(values) ? values : [];
  
  // 라디오 값
  const radioValue = typeof values === 'string' ? values : '';

  // "없음" 옵션이 선택되었는지 확인
  const isNoneSelected = checkboxValues.includes('none');

  const handleOptionChange = (value: string, checked: boolean) => {
    if (type === 'radio') {
      onRadioChange(value);
    } else {
      onCheckboxChange(value, checked);
    }
  };

  const isOptionSelected = (optionValue: string): boolean => {
    if (type === 'radio') {
      return radioValue === optionValue;
    } else {
      return checkboxValues.includes(optionValue);
    }
  };

  const isOptionChecked = (optionValue: string): boolean => {
    if (type === 'radio') {
      return radioValue === optionValue;
    } else {
      return checkboxValues.includes(optionValue);
    }
  };

  return (
    <div className={`question-card ${className}`}>
      <div className="question-number">질문 {number}/{total}</div>
      <div className="question-title">{title}</div>
      {subtitle && <div className="question-subtitle">{subtitle}</div>}
      
      {/* 생년월일 타입은 별도 처리 */}
      {type === 'birthdate' ? (
        <div>생년월일 입력은 별도 컴포넌트에서 처리됩니다.</div>
      ) : (
        <div className={type === 'checkbox' ? 'checkbox-grid' : 'options-grid'}>
          {options?.map((option: OptionItemType) => (
            <OptionItem
              key={option.id}
              option={option}
              type={type as 'radio' | 'checkbox'}
              name={name}
              checked={isOptionChecked(option.value)}
              selected={isOptionSelected(option.value)}
              noneSelected={type === 'checkbox' && isNoneSelected && option.value !== 'none'}
              onChange={handleOptionChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}; 