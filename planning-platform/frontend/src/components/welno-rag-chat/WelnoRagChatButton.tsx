import React, { useState } from 'react';
import WelnoRagChatWindow from './WelnoRagChatWindow';
import './WelnoRagChat.scss';

interface WelnoRagChatButtonProps {
  onToggle?: (isOpen: boolean) => void;
}

const WelnoRagChatButton: React.FC<WelnoRagChatButtonProps> = ({ onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <>
      <button
        className={`welno-rag-chat-button ${isOpen ? 'active' : ''}`}
        onClick={handleClick}
        aria-label="채팅 열기"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="welno-rag-chat-window-container">
          <WelnoRagChatWindow
            onClose={() => {
              setIsOpen(false);
              onToggle?.(false);
            }}
          />
        </div>
      )}
    </>
  );
};

export default WelnoRagChatButton;
