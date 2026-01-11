import React from 'react';
import './AuthMethodSelect.scss';

export type AuthMethodType = string;

export interface AuthMethod {
  value: AuthMethodType;
  label: string;
  description: string;
  icon?: string;
  disabled?: boolean;
}

export interface AuthMethodSelectProps {
  methods: AuthMethod[];
  selectedMethod: AuthMethodType;
  onChange: (method: AuthMethodType) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * AuthMethodSelect 컴포넌트
 * 인증 방식 선택을 처리합니다.
 */
const AuthMethodSelect: React.FC<AuthMethodSelectProps> = ({
  methods,
  selectedMethod,
  onChange,
  disabled = false,
  error,
}) => {
  const handleSelect = (methodValue: AuthMethodType, isMethodDisabled?: boolean) => {
    if (!disabled && !isMethodDisabled) {
      onChange(methodValue);
    }
  };

  return (
    <div className="auth-method-select">
      <div className="auth-method-select__header">
        <h2 className="auth-method-select__title">인증 방법을 선택하세요</h2>
        <p className="auth-method-select__description">
          간편하게 본인인증을 진행할 수 있습니다
        </p>
      </div>

      <div className="auth-method-select__options">
        {methods.map((method) => {
          const isMethodDisabled = disabled || method.disabled;
          
          return (
            <button
              key={method.value}
              type="button"
              className={`auth-method-select__option ${
                selectedMethod === method.value ? 'auth-method-select__option--selected' : ''
              } ${isMethodDisabled ? 'auth-method-select__option--disabled' : ''}`}
              onClick={() => handleSelect(method.value, method.disabled)}
              disabled={isMethodDisabled}
            >
              <div className="auth-method-select__option-content">
                {method.icon && (
                  <div className="auth-method-select__option-icon">
                    <img src={method.icon} alt={`${method.label} 아이콘`} />
                  </div>
                )}
                <div className="auth-method-select__option-text">
                  <h3 className="auth-method-select__option-name">{method.label}</h3>
                  <p className="auth-method-select__option-desc">{method.description}</p>
                </div>
                <div className="auth-method-select__option-check">
                  {selectedMethod === method.value && (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="12" cy="12" r="10" fill="currentColor" />
                      <circle cx="12" cy="12" r="4" fill="#ffffff" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="auth-method-select__error">{error}</p>}
    </div>
  );
};

export default AuthMethodSelect;
