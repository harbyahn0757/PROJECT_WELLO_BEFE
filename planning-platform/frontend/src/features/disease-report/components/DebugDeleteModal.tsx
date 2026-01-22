import React, { useState } from 'react';
import '../styles/debug-delete-modal.scss';

interface DebugDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: (deleteQuestionnaire: boolean, deleteReport: boolean) => Promise<void>;
  mktUuid: string | null;
}

export const DebugDeleteModal: React.FC<DebugDeleteModalProps> = ({
  isOpen,
  onClose,
  onDelete,
  mktUuid
}) => {
  const [deleteQuestionnaire, setDeleteQuestionnaire] = useState(false);
  const [deleteReport, setDeleteReport] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (!deleteQuestionnaire && !deleteReport) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }

    if (!window.confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(deleteQuestionnaire, deleteReport);
      alert('삭제가 완료되었습니다.');
      setDeleteQuestionnaire(false);
      setDeleteReport(false);
      onClose();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="debug-delete-modal-overlay" onClick={onClose}>
      <div className="debug-delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="debug-delete-modal-header">
          <h3>디버그: 데이터 삭제</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="debug-delete-modal-body">
          <p className="debug-warning">⚠️ 개발용 기능입니다. 신중하게 사용하세요.</p>
          <p className="mkt-uuid-info">mkt_uuid: {mktUuid || 'N/A'}</p>
          
          <div className="delete-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={deleteQuestionnaire}
                onChange={(e) => setDeleteQuestionnaire(e.target.checked)}
                disabled={isDeleting}
              />
              <span>문진내역 삭제</span>
            </label>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={deleteReport}
                onChange={(e) => setDeleteReport(e.target.checked)}
                disabled={isDeleting}
              />
              <span>질병레포트내역 삭제</span>
            </label>
          </div>
        </div>
        <div className="debug-delete-modal-footer">
          <button
            className="delete-button"
            onClick={handleDelete}
            disabled={isDeleting || (!deleteQuestionnaire && !deleteReport)}
          >
            {isDeleting ? '삭제 중...' : '지우기'}
          </button>
          <button
            className="cancel-button"
            onClick={onClose}
            disabled={isDeleting}
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
};

