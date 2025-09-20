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
    if (type === 'radio') {
      onChange(option.value, true);
    } else {
      onChange(option.value, !checked);
    }
    onClick?.();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(option.value, e.target.checked);
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
        name={name}
        value={option.value}
        id={option.id}
        checked={checked}
        onChange={handleInputChange}
        onClick={(e) => e.stopPropagation()}
      />
      <label htmlFor={option.id}>
        {option.label}
      </label>
    </div>
  );
}; 