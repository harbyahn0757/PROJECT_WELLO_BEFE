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
  
  // 플로팅 버튼인 경우 하단 흰줄 완전 제거를 위한 인라인 스타일 강제 적용
  if (className.includes('floating-button')) {
    // 모든 border 완전 제거 (0과 none 모두 사용)
    buttonStyle.border = '0';
    buttonStyle.borderWidth = '0';
    buttonStyle.borderStyle = 'none';
    buttonStyle.borderColor = 'transparent';
    buttonStyle.borderTop = '0';
    buttonStyle.borderTop = '0';
    buttonStyle.borderBottom = '0';
    buttonStyle.borderLeft = '0';
    buttonStyle.borderRight = '0';
    buttonStyle.borderTopWidth = '0';
    buttonStyle.borderBottomWidth = '0';
    buttonStyle.borderLeftWidth = '0';
    buttonStyle.borderRightWidth = '0';
    // border-bottom-color 명시적으로 transparent 설정 (rgb(45, 55, 72) 제거)
    buttonStyle.borderTopColor = 'transparent';
    buttonStyle.borderBottomColor = 'transparent';
    buttonStyle.borderLeftColor = 'transparent';
    buttonStyle.borderRightColor = 'transparent';
    // outline 완전 제거
    buttonStyle.outline = '0';
    buttonStyle.outlineWidth = '0';
    buttonStyle.outlineStyle = 'none';
    buttonStyle.outlineColor = 'transparent';
    buttonStyle.outlineOffset = '0';
    // 마진/패딩 제거
    buttonStyle.margin = '0';
    buttonStyle.marginBottom = '0';
    buttonStyle.paddingBottom = '0';
    // 그림자 제거
    buttonStyle.boxShadow = 'none';
    // 브라우저 기본 스타일 제거
    buttonStyle.WebkitAppearance = 'none';
    buttonStyle.MozAppearance = 'none';
    buttonStyle.appearance = 'none';
  }

  // button__content에 대한 인라인 스타일도 추가 (플로팅 버튼인 경우)
  const contentStyle: React.CSSProperties = {};
  if (className.includes('floating-button')) {
    contentStyle.border = '0';
    contentStyle.borderWidth = '0';
    contentStyle.borderStyle = 'none';
    contentStyle.borderColor = 'transparent';
    contentStyle.borderTop = '0';
    contentStyle.borderBottom = '0';
    contentStyle.borderLeft = '0';
    contentStyle.borderRight = '0';
    // border-bottom-color 명시적으로 transparent 설정
    contentStyle.borderTopColor = 'transparent';
    contentStyle.borderBottomColor = 'transparent';
    contentStyle.borderLeftColor = 'transparent';
    contentStyle.borderRightColor = 'transparent';
    contentStyle.outline = '0';
    contentStyle.margin = '0';
    contentStyle.marginBottom = '0';
    contentStyle.padding = '0';
    contentStyle.paddingBottom = '0';
    contentStyle.boxShadow = 'none';
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
      <span className="button__content" style={contentStyle}>{children}</span>
    </button>
  );
};

export default Button;
