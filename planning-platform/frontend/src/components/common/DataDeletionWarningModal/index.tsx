import React from 'react';
import WelnoModal from '../WelnoModal';
import './styles.scss';

interface DataDeletionWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const DataDeletionWarningModal: React.FC<DataDeletionWarningModalProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  return (
    <WelnoModal
      isOpen={isOpen}
      onClose={onCancel}
      showCloseButton={true}
      showWelnoIcon={true}
      size="medium"
    >
      <div className="data-deletion-warning-modal">
        <h2 className="data-deletion-warning-modal__title">
          서버 데이터 삭제 안내
        </h2>
        <p className="data-deletion-warning-modal__description">
          서버에 데이터가 있지만 비밀번호가 설정되어 있지 않아서<br />
          서버에 있는 데이터는 지워집니다.
        </p>
        <div className="data-deletion-warning-modal__actions">
          <button
            className="data-deletion-warning-modal__btn data-deletion-warning-modal__btn--cancel"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            className="data-deletion-warning-modal__btn data-deletion-warning-modal__btn--confirm"
            onClick={onConfirm}
          >
            확인
          </button>
        </div>
      </div>
    </WelnoModal>
  );
};

export default DataDeletionWarningModal;
