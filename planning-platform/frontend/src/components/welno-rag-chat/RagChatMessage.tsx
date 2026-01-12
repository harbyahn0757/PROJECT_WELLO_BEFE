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
          <div className="sources-title">📚 참고 문헌</div>
          <ul className="sources-list">
            {message.sources.map((source, idx) => (
              <li key={idx} className="source-item" title={source.text}>
                {source.title || `문서 ${idx + 1}`} {source.page && `(p.${source.page})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RagChatMessage;
