import React, { ReactNode } from 'react';
import './Button.scss';

// 버튼 타입 정의
export type ButtonVariant = 'primary' | 'secondary' | 'outline';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  width?: string | number; // '100%', '80%', 320, etc.
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

/**
 * Button - 재사용 가능한 버튼 컴포넌트
 * 
 * 사용법:
 * <Button variant="primary" size="large" width="80%">버튼 텍스트</Button>
 * <Button variant="secondary" width="100%">버튼 텍스트</Button>
 */
const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  width,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = ''
}) => {
  const buttonClass = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    loading && 'button--loading',
    disabled && 'button--disabled',
    className
  ].filter(Boolean).join(' ');

  const buttonStyle: React.CSSProperties = {};
  if (width) {
    buttonStyle.width = typeof width === 'number' ? `${width}px` : width;
  }

  return (
    <button
      className={buttonClass}
      style={buttonStyle}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
    >
      {loading && <span className="button__spinner"></span>}
      <span className="button__content">{children}</span>
    </button>
  );
};

export default Button;
