import React, { useState, useEffect } from 'react';
import { useCampaignSkin } from '../hooks/useCampaignSkin';
import welnoLogo from '../assets/images/welno_logo 2.png';
import '../styles/birthdate-verification-modal.scss';

interface BirthDateVerificationModalProps {
  isOpen: boolean;
  onVerify: (birthDate: string) => void;
  onClose?: () => void;
  customerBirthday?: string; // API에서 조회한 생년월일 (YYYY-MM-DD 또는 YYYYMMDD)
  isLoading?: boolean; // 고객 정보 조회 중인지 여부
}

export const BirthDateVerificationModal: React.FC<BirthDateVerificationModalProps> = ({
  isOpen,
  onVerify,
  onClose,
  customerBirthday,
  isLoading = false,
}) => {
  const { skinType, skinConfig } = useCampaignSkin();
  const [birthDateInput, setBirthDateInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // 모달이 열릴 때 입력 필드 초기화
  useEffect(() => {
    if (isOpen) {
      setBirthDateInput('');
      setError(null);
      setIsVerifying(false);
    }
  }, [isOpen]);

  // 생년월일 형식 변환 (YYYY-MM-DD 또는 YYYYMMDD -> YYMMDD)
  const convertBirthdayToYYMMDD = (birthday: string): string | null => {
    if (!birthday) return null;

    let year: string, month: string, day: string;

    if (birthday.includes('-')) {
      // YYYY-MM-DD 형식
      const parts = birthday.split('-');
      if (parts.length === 3) {
        year = parts[0];
        month = parts[1];
        day = parts[2];
      } else {
        return null;
      }
    } else if (birthday.length === 8) {
      // YYYYMMDD 형식
      year = birthday.substring(0, 4);
      month = birthday.substring(4, 6);
      day = birthday.substring(6, 8);
    } else {
      return null;
    }

    // YYMMDD 형식으로 변환 (연도는 뒤 2자리)
    const yearLastTwo = year.substring(2, 4);
    return `${yearLastTwo}${month}${day}`;
  };

  // 생년월일 검증
  const handleVerify = async () => {
    if (!birthDateInput || birthDateInput.length !== 6) {
      setError('생년월일을 6자리로 입력해주세요 (예: 740610)');
      return;
    }

    // 숫자만 입력되었는지 확인
    if (!/^\d{6}$/.test(birthDateInput)) {
      setError('숫자만 입력해주세요');
      return;
    }

    setIsVerifying(true);
    setError(null);

    // 개발자 모드 비밀번호 확인
    if (birthDateInput === '003507') {
      setIsVerifying(false);
      onVerify(birthDateInput);
      return;
    }

    // 실제 생년월일과 비교
    if (customerBirthday) {
      const convertedBirthday = convertBirthdayToYYMMDD(customerBirthday);
      if (convertedBirthday === birthDateInput) {
        setIsVerifying(false);
        onVerify(birthDateInput);
        return;
      } else {
        setIsVerifying(false);
        setError('생년월일이 일치하지 않습니다.');
        return;
      }
    } else {
      // 고객 정보가 없는 경우 (이론적으로는 발생하지 않아야 함)
      setIsVerifying(false);
      setError('고객 정보를 찾을 수 없습니다.');
      return;
    }
  };

  // 입력 필드 변경 핸들러 (숫자만 입력, 최대 6자리)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // 숫자만 추출
    if (value.length <= 6) {
      setBirthDateInput(value);
      setError(null);
    }
  };

  // Enter 키 입력 시 검증
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="birthdate-verification-modal-overlay">
      <div className={`birthdate-verification-modal skin-${skinType.toLowerCase()} ${isLoading ? 'loading' : ''}`}>
        {/* 로딩 스피너 */}
        {isLoading && (
          <div className="modal-loading-overlay">
            <div className="modal-loading-spinner">
              <img src={welnoLogo} alt="웰노 로고" className="loading-spinner-icon" />
            </div>
          </div>
        )}
        
        <div className="modal-header">
          <h2 className="modal-title">생년월일 확인</h2>
          {onClose && !isLoading && (
            <button className="modal-close-button" onClick={onClose} type="button">
              ×
            </button>
          )}
        </div>
        
        <div className="modal-content">
          {isLoading ? (
            <div className="loading-content">
              <p className="loading-message">고객 정보를 불러오는 중...</p>
            </div>
          ) : (
            <>
              <p className="modal-description">
                레포트를 확인하기 위해 생년월일을 입력해주세요
              </p>
              
              <div className="input-wrapper">
                <label htmlFor="birthdate-input" className="input-label">
                  생년월일 (6자리)
                </label>
                <input
                  id="birthdate-input"
                  type="text"
                  className={`birthdate-input ${error ? 'error' : ''}`}
                  placeholder="예: 740610 (YYMMDD)"
                  value={birthDateInput}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  maxLength={6}
                  autoFocus
                  disabled={isVerifying}
                />
                {error && (
                  <p className="error-message">{error}</p>
                )}
              </div>

              <div className="modal-actions">
                <button
                  className="verify-button"
                  onClick={handleVerify}
                  disabled={!birthDateInput || birthDateInput.length !== 6 || isVerifying}
                  type="button"
                >
                  {isVerifying ? '확인 중...' : '확인'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

