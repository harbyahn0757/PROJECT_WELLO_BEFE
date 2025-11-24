/**
 * MDX 데이터 검색 모달 (개발 모드 전용)
 * wello 데이터가 없을 때 mdx_agr_list에서 데이터를 찾을지 물어보는 다이얼로그
 */
import React from 'react';
import WelloModal from '../common/WelloModal';
import './styles.scss';

interface MdxDataSearchModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const MdxDataSearchModal: React.FC<MdxDataSearchModalProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  return (
    <WelloModal
      isOpen={isOpen}
      onClose={onCancel}
      showCloseButton={true}
      showWelloIcon={true}
      size="medium"
    >
      <div className="mdx-data-search-modal">
        <h2 className="mdx-data-search-modal__title">
          MDX 데이터에서 검색하시겠습니까?
        </h2>
        <p className="mdx-data-search-modal__description">
          웰로 데이터가 없어서<br />
          MDX 데이터베이스에서<br />
          검진 정보를 찾아볼까요?
        </p>
        <div className="mdx-data-search-modal__actions">
          <button
            className="mdx-data-search-modal__btn mdx-data-search-modal__btn--cancel"
            onClick={onCancel}
          >
            취소
          </button>
          <button
            className="mdx-data-search-modal__btn mdx-data-search-modal__btn--confirm"
            onClick={onConfirm}
          >
            검색하기
          </button>
        </div>
      </div>
    </WelloModal>
  );
};

export default MdxDataSearchModal;



