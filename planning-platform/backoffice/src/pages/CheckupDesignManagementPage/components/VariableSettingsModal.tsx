/**
 * 변수 설정 모달
 */
import React from 'react';
import VariableMapping, { VarMapping } from './VariableMapping';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variables: string[];
  mappings: Record<string, VarMapping>;
  onMappingChange: (varName: string, mapping: VarMapping) => void;
  selectedHospital?: string;
}

const VariableSettingsModal: React.FC<Props> = ({
  isOpen, onClose, variables, mappings, onMappingChange, selectedHospital,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content var-modal" onClick={e => e.stopPropagation()}>
        <div className="var-modal__header">
          <h3>변수 설정</h3>
          <button className="var-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="var-modal__body">
          <VariableMapping
            variables={variables}
            mappings={mappings}
            onMappingChange={onMappingChange}
            selectedHospital={selectedHospital}
          />
        </div>
        <div className="var-modal__footer">
          <button className="btn-outline" onClick={onClose}>닫기</button>
          <button className="btn-primary" onClick={onClose}>적용</button>
        </div>
      </div>
    </div>
  );
};

export default VariableSettingsModal;
