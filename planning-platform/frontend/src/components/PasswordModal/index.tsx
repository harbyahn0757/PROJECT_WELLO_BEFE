import React, { useState, useEffect } from 'react';
import { PasswordModalProps, PasswordModalType } from './types';
import { PasswordService } from './PasswordService';
import PasswordKeypad from './PasswordKeypad';
import PasswordDots from './PasswordDots';
import { STORAGE_KEYS } from '../../constants/storage';
import { PASSWORD_MESSAGES, PasswordValidator } from '../../constants/passwordMessages';
import { WELNO_LOGO_IMAGE } from '../../constants/images';
import './styles.scss';

const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onCancel,
  type,
  uuid,
  hospitalId,
  initialMessage
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'first' | 'confirm'>('first');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(initialMessage || '');

  const maxLength = 6;
  const isSetupMode = type === 'setup' || type === 'change';
  const isConfirmMode = type === 'confirm';
  const isPromptMode = type === 'prompt';
  const isInitialSetup = type === 'setup' && step === 'first'; // 최초 비밀번호 설정

  useEffect(() => {
    if (isOpen) {
      // 모달이 열릴 때 기존 포커스 제거
      if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      // body에 클래스 추가하여 포커스 상태 초기화
      document.body.classList.add('password-modal-open');
      
      resetState();
      const headerInfo = getHeaderInfo();
      setMessage(headerInfo.subtitle);
      // 모달이 열릴 때 localStorage에 상태 저장
      localStorage.setItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN, 'true');
      window.dispatchEvent(new CustomEvent('password-modal-change'));
    } else {
      // 모달이 닫힐 때 body 클래스 제거
      document.body.classList.remove('password-modal-open');
      
      // 모달이 닫힐 때 localStorage에서 상태 제거
      localStorage.removeItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN);
      window.dispatchEvent(new CustomEvent('password-modal-change'));
    }
  }, [isOpen, type]);

  const resetState = () => {
    setPassword('');
    setConfirmPassword('');
    setStep('first');
    setLoading(false);
    setError('');
  };

  const getHeaderInfo = () => {
    switch (type) {
      case 'setup':
        if (step === 'first') {
          return {
            title: '웰로서비스 비밀번호 설정',
            subtitle: '중요한 데이터이니까\n비밀번호를 설정하세요'
          };
        } else {
          return {
            title: '비밀번호 확인',
            subtitle: '같은 비밀번호를\n다시 입력해주세요'
          };
        }
      case 'confirm':
        return {
          title: '비밀번호 입력',
          subtitle: '설정하신 비밀번호를\n입력해주세요'
        };
      case 'change':
        return step === 'first' 
          ? {
              title: '현재 비밀번호 확인',
              subtitle: '현재 비밀번호를\n입력해주세요'
            }
          : {
              title: '비밀번호 재설정',
              subtitle: '새로운 비밀번호를\n설정해주세요'
            };
      case 'prompt':
        return {
          title: '비밀번호 설정 안내',
          subtitle: '안전한 이용을 위해\n비밀번호 설정을 권장합니다'
        };
      default:
        return {
          title: '비밀번호',
          subtitle: initialMessage || ''
        };
    }
  };

  const getCurrentPassword = () => {
    return step === 'confirm' ? confirmPassword : password;
  };

  const handleKeyPress = (key: string) => {
    const currentPassword = getCurrentPassword();
    if (currentPassword.length < maxLength) {
      if (step === 'confirm') {
        const newConfirmPassword = confirmPassword + key;
        setConfirmPassword(newConfirmPassword);
        // 6자리가 채워지면 자동으로 확인 (setup 모드의 confirm 단계에서만)
        if (newConfirmPassword.length === maxLength && isSetupMode && step === 'confirm') {
          setTimeout(() => handleConfirm(newConfirmPassword), 100);
        }
      } else {
        const newPassword = password + key;
        setPassword(newPassword);
        // 6자리가 채워지면 자동으로 확인 (confirm 모드 또는 setup 모드의 첫 단계)
        if (newPassword.length === maxLength && (isConfirmMode || (isSetupMode && step === 'first'))) {
          setTimeout(() => handleConfirm(newPassword), 100);
        }
      }
      setError('');
    }
  };

  const handleDelete = () => {
    if (step === 'confirm') {
      setConfirmPassword(prev => prev.slice(0, -1));
    } else {
      setPassword(prev => prev.slice(0, -1));
    }
    setError('');
  };

  const handleConfirm = async (directPassword?: string) => {
    if (loading) return;

    const currentPassword = directPassword || getCurrentPassword();
    const validation = PasswordValidator.validate(currentPassword);
    if (!validation.isValid) {
      setError(validation.message || PASSWORD_MESSAGES.VALIDATION.REQUIRED);
      return;
    }

    if (isSetupMode && step === 'first') {
      // 설정 모드의 첫 번째 단계 - 비밀번호 저장하고 확인 단계로 이동
      setPassword(currentPassword);
      setStep('confirm');
      setConfirmPassword('');
      setError('');
      return;
    }

    if (isSetupMode && step === 'confirm') {
      // 설정 모드의 확인 단계 - 두 비밀번호가 일치하는지 확인
      const matchValidation = PasswordValidator.validateMatch(password, currentPassword);
      if (!matchValidation.isValid) {
        setError(matchValidation.message || PASSWORD_MESSAGES.VALIDATION.MISMATCH);
        setConfirmPassword('');
        return;
      }
    }

    // API 호출
    setLoading(true);
    try {
      let result;
      
      switch (type) {
        case 'setup':
          result = await PasswordService.setPassword(uuid, hospitalId, currentPassword);
          break;
        case 'confirm':
          result = await PasswordService.verifyPassword(uuid, hospitalId, currentPassword);
          break;
        case 'change':
          if (step === 'first') {
            // 현재 비밀번호 확인
            result = await PasswordService.verifyPassword(uuid, hospitalId, password);
            if (result.success) {
              setStep('confirm');
              setMessage('새 비밀번호를 설정해주세요');
              setPassword('');
              setLoading(false);
              return;
            }
          } else {
            // 새 비밀번호 설정 (현재 비밀번호는 이미 확인됨)
            result = await PasswordService.changePassword(uuid, hospitalId, password, confirmPassword);
          }
          break;
        default:
          throw new Error('지원하지 않는 모달 타입입니다');
      }

      if (result.success) {
        onSuccess(type);
        onClose();
      } else {
        setError(result.message);
        if (type === 'confirm') {
          setPassword('');
        }
      }
    } catch (error: any) {
      setError(error.message || '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onClose();
  };

  const handlePromptSetup = () => {
    // 프롬프트에서 설정하기 선택
    onSuccess('setup');
  };

  const handlePromptSkip = async () => {
    // 프롬프트에서 나중에 하기 선택
    await PasswordService.updatePasswordPromptTime(uuid, hospitalId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="password-modal-overlay">
      <div className="password-modal">
        {/* 웰노 로고 (상단, 깜박이는 효과) */}
        <div className="password-modal-icon">
          <img 
            src={WELNO_LOGO_IMAGE}
            alt="웰노 로고" 
            className="welno-icon-blink"
          />
          {/* 닫기 버튼을 아이콘 영역으로 이동 */}
          <button className="password-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="password-modal-header">
          {/* 제목과 부제목 */}
          <h2 className="password-modal-title">
            {getHeaderInfo().title}
          </h2>
          <p className="password-modal-subtitle">
            {getHeaderInfo().subtitle.split('\n').map((line: string, index: number) => (
              <span key={index}>
                {line}
                {index < getHeaderInfo().subtitle.split('\n').length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>

        <div className="password-modal-content">
          {/* 메시지는 헤더에서 이미 표시하므로 제거 */}

          {!isPromptMode && (
            <>
              <div className="password-input-area">
                <PasswordDots 
                  length={getCurrentPassword().length} 
                  maxLength={maxLength}
                  className="password-dots-display"
                />
              </div>

              {error && (
                <div className="password-error">
                  {error}
                </div>
              )}

              <PasswordKeypad
                onKeyPress={handleKeyPress}
                onDelete={handleDelete}
                disabled={loading}
                showConfirmButton={false}
              />
            </>
          )}

          {isPromptMode && (
            <div className="password-prompt-buttons">
              <button 
                className="password-button secondary"
                onClick={handlePromptSkip}
              >
                나중에 하기
              </button>
              <button 
                className="password-button primary"
                onClick={handlePromptSetup}
              >
                설정하기
              </button>
            </div>
          )}

          {!isPromptMode && isInitialSetup && (
            <div className="password-modal-actions">
              <button 
                className="password-button secondary"
                onClick={handlePromptSkip}
                disabled={loading}
              >
                나중에 하기
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="password-loading">
            <div className="password-spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordModal;
