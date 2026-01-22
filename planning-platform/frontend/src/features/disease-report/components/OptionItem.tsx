import React from 'react';
import { OptionItem as OptionItemType } from '../types';

interface OptionItemProps {
  option: OptionItemType;
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  selected?: boolean;
  noneSelected?: boolean;
  onChange: (value: string, checked: boolean) => void;
  onClick?: () => void;
}

export const OptionItem: React.FC<OptionItemProps> = ({
  option,
  type,
  name,
  checked,
  selected = false,
  noneSelected = false,
  onChange,
  onClick,
}) => {
  const handleClick = () => {
    // div 전체 영역 클릭 시 체크 상태 토글
    if (type === 'radio') {
      onChange(option.value, true);
    } else {
      onChange(option.value, !checked);
    }
    onClick?.();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // input의 onChange는 div 클릭으로 처리되므로 여기서는 처리하지 않음
    // 하지만 브라우저 기본 동작을 위해 유지
    e.stopPropagation();
  };

  return (
    <div 
      className={`
        option-item 
        ${selected ? 'selected' : ''} 
        ${noneSelected ? 'none-selected' : ''}
      `}
      onClick={handleClick}
    >
      <input
        type={type}
        name={type === 'checkbox' ? `${name}_${option.value}` : name}
        value={option.value}
        id={option.id}
        checked={checked}
        onChange={handleInputChange}
        tabIndex={-1}
      />
      <label htmlFor={option.id}>
        {option.label}
      </label>
    </div>
  );
}; 