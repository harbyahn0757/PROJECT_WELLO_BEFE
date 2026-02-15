import React from 'react';
import { IconExcel, IconJson } from './ExportIcons';

interface ExportButtonsProps {
  onExcel?: () => void;
  onJson?: () => void;
  disabled?: boolean;
  excelLabel?: string;
  className?: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  onExcel,
  onJson,
  disabled = false,
  excelLabel = '엑셀',
  className = '',
}) => (
  <div className={`export-btns ${className}`.trim()}>
    {onExcel && (
      <button className="btn-excel" onClick={onExcel} disabled={disabled}>
        <IconExcel />{excelLabel}
      </button>
    )}
    {onJson && (
      <button className="btn-excel" onClick={onJson} disabled={disabled}>
        <IconJson />JSON
      </button>
    )}
  </div>
);
