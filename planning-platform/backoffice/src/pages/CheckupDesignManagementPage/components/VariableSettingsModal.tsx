/**
 * 변수 설정 모달
 * WELNO _modals.scss 패턴 (overlay + content)
 */
import React from 'react';
import VariableMapping from './VariableMapping';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variables: string[];
  fixedVars: Record<string, string>;
  onVarChange: (k: string, v: string) => void;
  selectedHospital?: string;
  excelHeaders?: string[];
  excelMapping?: Record<string, string>;
  onMappingChange?: (k: string, h: string) => void;
}

const VariableSettingsModal: React.FC<Props> = ({
  isOpen, onClose, variables, fixedVars, onVarChange,
  selectedHospital, excelHeaders, excelMapping, onMappingChange,
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
            fixedVars={fixedVars}
            onVarChange={onVarChange}
            selectedHospital={selectedHospital}
            excelHeaders={excelHeaders}
            excelMapping={excelMapping}
            onMappingChange={onMappingChange}
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
