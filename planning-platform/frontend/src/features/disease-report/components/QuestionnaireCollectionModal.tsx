import React from 'react';
import { useCampaignSkin } from '../hooks/useCampaignSkin';
import '../styles/questionnaire-collection-modal.scss';

interface QuestionnaireCollectionModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose?: () => void;
}

export const QuestionnaireCollectionModal: React.FC<QuestionnaireCollectionModalProps> = ({
  isOpen,
  onConfirm,
  onClose,
}) => {
  const { skinType, skinConfig } = useCampaignSkin();

  if (!isOpen) return null;

  return (
    <div className="questionnaire-collection-modal-overlay">
      <div className={`questionnaire-collection-modal skin-${skinType.toLowerCase()}`}>
        <div className="modal-header">
          <h2 className="modal-title">문진 수집 안내</h2>
          {onClose && (
            <button className="modal-close-button" onClick={onClose} type="button">
              ×
            </button>
          )}
        </div>
        
        <div className="modal-content">
          <p className="modal-description">
            문진 데이터가 없고 결과지는 있습니다.<br />
            문진 수집을 위해 기존 리포트 화면을 보여드립니다.
          </p>
          
          <div className="modal-actions">
            <button
              className="action-button confirm-button"
              onClick={onConfirm}
              type="button"
            >
              리포트 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

