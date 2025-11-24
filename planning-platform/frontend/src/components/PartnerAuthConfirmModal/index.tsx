/**
 * 파트너 인증 API 호출 전 전문 확인 모달
 */
import React from 'react';
import WelloModal from '../common/WelloModal';
import './styles.scss';

interface PartnerAuthConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  requestPayload: {
    api_key: string;
    mkt_uuid?: string;
    name?: string;
    birthday?: string;
    redirect_url: string;
  };
  apiEndpoint: string;
}

const PartnerAuthConfirmModal: React.FC<PartnerAuthConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  requestPayload,
  apiEndpoint
}) => {
  return (
    <WelloModal
      isOpen={isOpen}
      onClose={onCancel}
      showCloseButton={true}
      showWelloIcon={true}
      size="large"
    >
      <div className="partner-auth-confirm-modal">
        <h2 className="partner-auth-confirm-modal__title">
          파트너 인증 API 호출 확인
        </h2>
        <p className="partner-auth-confirm-modal__description">
          다음 전문으로 API를 호출합니다.
        </p>
        
        <div className="partner-auth-confirm-modal__info">
          <div className="partner-auth-confirm-modal__endpoint">
            <strong>엔드포인트:</strong>
            <code>{apiEndpoint}</code>
          </div>
          
          <div className="partner-auth-confirm-modal__payload">
            <strong>요청 바디 (JSON):</strong>
            <pre className="partner-auth-confirm-modal__json">
              {JSON.stringify(requestPayload, null, 2)}
            </pre>
          </div>
        </div>
        
        <div className="partner-auth-confirm-modal__actions">
          <button
            className="partner-auth-confirm-modal__btn partner-auth-confirm-modal__btn--cancel"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            className="partner-auth-confirm-modal__btn partner-auth-confirm-modal__btn--confirm"
            onClick={onConfirm}
          >
            확인 및 호출
          </button>
        </div>
      </div>
    </WelloModal>
  );
};

export default PartnerAuthConfirmModal;



