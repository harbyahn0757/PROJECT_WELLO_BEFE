import React from 'react';
import './styles.scss';

interface PasswordKeypadProps {
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onConfirm?: () => void;
  disabled?: boolean;
  showConfirmButton?: boolean;
}

const PasswordKeypad: React.FC<PasswordKeypadProps> = ({
  onKeyPress,
  onDelete,
  onConfirm,
  disabled = false,
  showConfirmButton = false
}) => {
  // 일반적인 키패드 레이아웃 (1-9, 0은 하단 중앙)
  const keyLayout = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  const handleKeyPress = (key: string) => {
    if (disabled) return;
    onKeyPress(key);
  };

  const handleDelete = () => {
    if (disabled) return;
    onDelete();
  };

  const handleConfirm = () => {
    if (disabled || !onConfirm) return;
    onConfirm();
  };

  // 랜덤 배치 기능 제거

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
      
      {/* 하단 버튼들 - 0과 삭제 */}
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
