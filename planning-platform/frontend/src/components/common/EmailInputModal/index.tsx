import React, { useState } from 'react';
import './styles.scss';

interface EmailInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
  loading?: boolean;
  initialEmail?: string;
}

export const EmailInputModal: React.FC<EmailInputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  initialEmail = '',
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    // 이메일 유효성 검증
    if (!email || !email.includes('@')) {
      setError('올바른 이메일 주소를 입력해주세요.');
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('올바른 이메일 주소 형식이 아닙니다.');
      return;
    }

    setError('');
    try {
      await onSubmit(email);
    } catch (err) {
      setError('이메일 전송 중 오류가 발생했습니다.');
      console.error('Email submit error:', err);
    }
  };

  const handleClose = () => {
    setEmail(initialEmail);
    setError('');
    onClose();
  };

  return (
    <div className="email-input-modal-overlay" onClick={handleClose}>
      <div className="email-input-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">리포트 받기</h2>
          <button className="modal-close-button" onClick={handleClose} type="button" aria-label="닫기">
            ×
          </button>
        </div>
        
        <div className="modal-content">
          <p className="modal-description">
            질병예측 리포트(PDF)를 받으실 이메일 주소를 입력해주세요.
          </p>
          
          <div className="email-input-group">
            <input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              disabled={loading}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !loading && email) {
                  handleSubmit();
                }
              }}
            />
            {error && <p className="error-message">{error}</p>}
          </div>
          
          <div className="modal-actions">
            <button
              className="action-button cancel-button"
              onClick={handleClose}
              type="button"
              disabled={loading}
            >
              취소
            </button>
            <button
              className="action-button submit-button"
              onClick={handleSubmit}
              type="button"
              disabled={loading || !email}
            >
              {loading ? '처리 중...' : '리포트 받기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailInputModal;
