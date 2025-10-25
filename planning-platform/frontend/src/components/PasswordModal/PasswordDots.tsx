import React from 'react';
import './styles.scss';

interface PasswordDotsProps {
  length: number;
  maxLength: number;
  className?: string;
}

const PasswordDots: React.FC<PasswordDotsProps> = ({
  length,
  maxLength,
  className = ''
}) => {
  return (
    <div className={`password-dots ${className}`}>
      {Array.from({ length: maxLength }, (_, index) => (
        <div
          key={index}
          className={`password-dot ${index < length ? 'filled' : 'empty'}`}
        >
          {index < length ? '●' : '○'}
        </div>
      ))}
    </div>
  );
};

export default PasswordDots;
