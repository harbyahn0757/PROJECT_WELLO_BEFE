import React from 'react';
import '../styles/data-preview-modal.scss';

interface DataPreviewModalProps {
  isOpen: boolean;
  title: string;
  data: any;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export const DataPreviewModal: React.FC<DataPreviewModalProps> = ({
  isOpen,
  title,
  data,
  onConfirm,
  onCancel,
  confirmLabel = '전송',
  cancelLabel = '취소',
}) => {
  if (!isOpen) return null;

  const formattedData = JSON.stringify(data, null, 2);

  return (
    <div className="data-preview-modal-overlay">
      <div className="data-preview-modal">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close-button" onClick={onCancel} type="button">
            ×
          </button>
        </div>
        
        <div className="modal-content">
          <div className="data-preview-container">
            <pre className="data-preview-json">{formattedData}</pre>
          </div>
          
          <div className="modal-actions">
            <button
              className="action-button cancel-button"
              onClick={onCancel}
              type="button"
            >
              {cancelLabel}
            </button>
            <button
              className="action-button confirm-button"
              onClick={onConfirm}
              type="button"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

