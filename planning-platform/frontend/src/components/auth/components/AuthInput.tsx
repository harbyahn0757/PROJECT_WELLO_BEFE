import React, { useEffect, useRef } from 'react';
import './AuthInput.scss';

export type InputFieldType = 'name' | 'phone' | 'birthday';

export interface AuthInputProps {
  type: InputFieldType;
  value: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  error?: string;
}

/**
 * AuthInput 컴포넌트
 * 이름, 전화번호, 생년월일 입력 필드를 처리합니다.
 */
const AuthInput: React.FC<AuthInputProps> = ({
  type,
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  placeholder,
  error,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    
    switch (type) {
      case 'name':
        return '이름을 입력해주세요';
      case 'phone':
        return '휴대폰 번호를 입력해주세요 (- 없이)';
      case 'birthday':
        return '생년월일 8자리 (예: 19900101)';
      default:
        return '';
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'name':
        return '이름을 입력해주세요';
      case 'phone':
        return '휴대폰 번호를 입력해주세요';
      case 'birthday':
        return '생년월일을 입력해주세요';
      default:
        return '';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'name':
        return '이름이 정확한가요?\n본인 명의 휴대폰이 있어야 합니다';
      case 'phone':
        return '본인 명의 휴대폰 번호를 입력하세요';
      case 'birthday':
        return '생년월일 8자리를 입력하세요\n예) 1990년 1월 1일 → 19900101';
      default:
        return '';
    }
  };

  const formatValue = (rawValue: string): string => {
    switch (type) {
      case 'phone':
        // 숫자만 추출
        const digits = rawValue.replace(/\D/g, '');
        // 최대 11자리
        return digits.slice(0, 11);
      case 'birthday':
        // 숫자만 추출
        const bdayDigits = rawValue.replace(/\D/g, '');
        // 최대 8자리
        return bdayDigits.slice(0, 8);
      case 'name':
        // 이름은 최대 50자
        return rawValue.slice(0, 50);
      default:
        return rawValue;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatValue(e.target.value);
    onChange(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onComplete) {
      e.preventDefault();
      onComplete();
    }
  };

  const getInputType = () => {
    return type === 'phone' || type === 'birthday' ? 'tel' : 'text';
  };

  const getInputMode = (): 'text' | 'tel' | 'numeric' | 'decimal' | 'search' | 'email' | 'url' | undefined => {
    return type === 'phone' || type === 'birthday' ? 'numeric' : 'text';
  };

  return (
    <div className="auth-input">
      <div className="auth-input__header">
        <h2 className="auth-input__label">{getLabel()}</h2>
      </div>
      
      <div className="auth-input__description">
        {getDescription().split('\n').map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>

      <div className="auth-input__field-wrapper">
        <input
          ref={inputRef}
          type={getInputType()}
          inputMode={getInputMode()}
          className={`auth-input__field ${error ? 'auth-input__field--error' : ''}`}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          disabled={disabled}
          autoComplete="off"
        />
        {error && <p className="auth-input__error">{error}</p>}
      </div>
    </div>
  );
};

export default AuthInput;
