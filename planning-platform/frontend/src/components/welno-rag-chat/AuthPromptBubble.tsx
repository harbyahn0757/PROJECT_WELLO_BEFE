import React from 'react';

interface AuthPromptBubbleProps {
  onClick: () => void;
}

const AuthPromptBubble: React.FC<AuthPromptBubbleProps> = ({ onClick }) => {
  return (
    <div className="auth-prompt-bubble" onClick={onClick}>
      <div className="auth-prompt-icon">🏥</div>
      <div className="auth-prompt-content">
        <div className="auth-prompt-title">건강 데이터로 더 자세한 안내받기</div>
        <div className="auth-prompt-desc">건강검진 데이터를 연동하면 맞춤 분석이 가능합니다</div>
      </div>
      <div className="auth-prompt-arrow">→</div>
    </div>
  );
};

export default AuthPromptBubble;
