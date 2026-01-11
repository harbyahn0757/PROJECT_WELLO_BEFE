import React from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: any[];
}

interface RagChatMessageProps {
  message: Message;
}

const RagChatMessage: React.FC<RagChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-content">
        {message.content}
      </div>
      {!isUser && message.sources && message.sources.length > 0 && (
        <div className="message-sources">
          <small>참고: {message.sources.length}개 문서</small>
        </div>
      )}
    </div>
  );
};

export default RagChatMessage;
