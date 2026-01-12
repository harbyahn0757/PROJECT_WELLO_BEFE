/**
 * IndexedDB 삭제 확인 모달
 * 로고 연속 클릭 시 표시되는 모달
 */
import React from 'react';
import WelnoModal from '../WelnoModal';
import './styles.scss';

interface IndexedDBClearModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const IndexedDBClearModal: React.FC<IndexedDBClearModalProps> = ({
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
      <div className="indexed-db-clear-modal">
        <h2 className="indexed-db-clear-modal__title">
          IndexedDB 데이터 삭제
        </h2>
        <p className="indexed-db-clear-modal__description">
          모든 로컬 저장 데이터를 삭제하시겠습니까?<br />
          이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="indexed-db-clear-modal__actions">
          <button
            className="indexed-db-clear-modal__btn indexed-db-clear-modal__btn--cancel"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            className="indexed-db-clear-modal__btn indexed-db-clear-modal__btn--confirm"
            onClick={onConfirm}
          >
            삭제
          </button>
        </div>
      </div>
    </WelnoModal>
  );
};

export default IndexedDBClearModal;
