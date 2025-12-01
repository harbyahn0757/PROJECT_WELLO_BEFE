/**
 * 채팅 선택 버튼 컴포넌트
 */
import React from 'react';
import { ChatOption } from './types';
import './styles.scss';

interface ChatOptionButtonProps {
  option: ChatOption;
  onClick: (option: ChatOption) => void;
  selected?: boolean;
  animationDelay?: number; // 애니메이션 딜레이 (ms)
}

const ChatOptionButton: React.FC<ChatOptionButtonProps> = ({
  option,
  onClick,
  selected = false,
  animationDelay = 0
}) => {
  return (
    <button
      className={`chat-option-button ${selected ? 'chat-option-button--selected' : ''}`}
      onClick={() => onClick(option)}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {option.icon && (
        <span className="chat-option-button__icon">{option.icon}</span>
      )}
      <div className="chat-option-button__content">
        <span className="chat-option-button__label">{option.label}</span>
        {option.description && (
          <span className="chat-option-button__description">{option.description}</span>
        )}
      </div>
    </button>
  );
};

export default ChatOptionButton;

