/**
 * 채팅 메시지 버블 컴포넌트
 */
import React from 'react';
import { ChatMessage as ChatMessageType } from './types';
import './styles.scss';

interface ChatMessageProps {
  message: ChatMessageType;
  style?: React.CSSProperties;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, style }) => {
  const isBot = message.sender === 'bot';
  const isUser = message.sender === 'user';

  // 기간 텍스트 강조를 위해 HTML 파싱
  const renderContent = (content: string) => {
    // <span class="highlight-period">...</span> 태그를 실제 스타일이 적용된 span으로 변환
    const parts = content.split(/(<span class="highlight-period">.*?<\/span>)/g);
    return parts.map((part, index) => {
      if (part.startsWith('<span class="highlight-period">')) {
        const text = part.replace(/<span class="highlight-period">|<\/span>/g, '');
        return (
          <span key={index} className="chat-message__highlight-period">
            {text}
          </span>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  return (
    <div className={`chat-message chat-message--${message.sender}`} style={style}>
      <div className={`chat-message__bubble chat-message__bubble--${message.sender}`}>
        <div className="chat-message__content">
          {renderContent(message.content)}
        </div>
        {message.timestamp && (
          <div className="chat-message__timestamp">
            {new Date(message.timestamp).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;

