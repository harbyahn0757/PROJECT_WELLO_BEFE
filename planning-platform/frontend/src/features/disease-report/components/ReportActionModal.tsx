import React from 'react';
import { useCampaignSkin } from '../hooks/useCampaignSkin';
import '../styles/report-action-modal.scss';

interface ReportActionModalProps {
  isOpen: boolean;
  onRestartSurvey: () => void;
  onViewReport: () => void;
  onClose?: () => void;
}

export const ReportActionModal: React.FC<ReportActionModalProps> = ({
  isOpen,
  onRestartSurvey,
  onViewReport,
  onClose,
}) => {
  const { skinType, skinConfig } = useCampaignSkin();

  if (!isOpen) return null;

  return (
    <div className="report-action-modal-overlay">
      <div className={`report-action-modal skin-${skinType.toLowerCase()}`}>
        <div className="modal-header">
          <h2 className="modal-title">레포트가 이미 생성되었습니다</h2>
          {onClose && (
            <button className="modal-close-button" onClick={onClose} type="button">
              ×
            </button>
          )}
        </div>
        
        <div className="modal-content">
          <p className="modal-description">
            이미 생성된 레포트를 확인하거나<br />
            새로운 문진을 시작할 수 있습니다
          </p>
          
          <div className="modal-actions">
            <button
              className="action-button view-report-button"
              onClick={onViewReport}
              type="button"
            >
              레포트 보기
            </button>
            <button
              className="action-button restart-survey-button"
              onClick={onRestartSurvey}
              type="button"
            >
              다시 문진하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

