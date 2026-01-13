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
          모든 로컬 데이터 완전 삭제
        </h2>
        <p className="indexed-db-clear-modal__description">
          다음 데이터가 모두 삭제됩니다:<br />
          • IndexedDB (건강검진, 처방전 데이터)<br />
          • localStorage (세션, 캐시, 환자 정보)<br />
          • sessionStorage (임시 세션 데이터)<br />
          • 비밀번호 세션 정보<br /><br />
          <strong>이 작업은 되돌릴 수 없으며, 자동 복구되지 않습니다.</strong>
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
