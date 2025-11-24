import React, { useMemo } from 'react';
import './styles.scss';

interface PasswordKeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
  disabled?: boolean;
  showConfirmButton?: boolean;
}

const PasswordKeypad: React.FC<PasswordKeypadProps> = ({
  onKeyPress,
  onDelete,
  onCancel,
  onConfirm,
  disabled = false,
  showConfirmButton = false
}) => {
  // 랜덤 배치된 키패드 레이아웃 (1-9)
  const keyLayout = useMemo(() => {
    const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    // Fisher-Yates 셔플 알고리즘으로 랜덤 배치
    const shuffled = [...numbers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, []); // 컴포넌트 마운트 시 한 번만 랜덤 배치

  const handleKeyPress = (key: string) => {
    if (disabled) return;
    onKeyPress(key);
  };

  const handleDelete = () => {
    if (disabled) return;
    onDelete();
  };

  const handleCancel = () => {
    if (disabled || !onCancel) return;
    onCancel();
  };

  const handleConfirm = () => {
    if (disabled || !onConfirm) return;
    onConfirm();
  };

  return (
    <div className="password-keypad">
      <div className="keypad-grid">
        {keyLayout.map((key, index) => (
          <button
            key={`${key}-${index}`}
            className="keypad-button number-key"
            onClick={() => handleKeyPress(key)}
            disabled={disabled}
          >
            {key}
          </button>
        ))}
      </div>
      
      {/* 하단 버튼들 - 0, 삭제 (취소 버튼 제거) */}
      <div className="keypad-bottom-row">
        <div className="keypad-empty"></div>
        <button
          className="keypad-button number-key"
          onClick={() => handleKeyPress('0')}
          disabled={disabled}
        >
          0
        </button>
        <button
          className="keypad-button delete-key"
          onClick={handleDelete}
          disabled={disabled}
        >
          ⌫
        </button>
      </div>
    </div>
  );
};

export default PasswordKeypad;
