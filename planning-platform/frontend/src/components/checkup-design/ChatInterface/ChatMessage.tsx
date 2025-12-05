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

  // 기간 텍스트 강조 및 볼드 처리를 위해 HTML 파싱
  const renderContent = (content: string) => {
    // HTML 태그를 파싱하여 React 요소로 변환
    const parseHTML = (html: string): React.ReactNode[] => {
      const parts: React.ReactNode[] = [];
      let currentIndex = 0;
      
      // <strong>...</strong> 태그 찾기
      const strongRegex = /<strong>(.*?)<\/strong>/g;
      // <span class="highlight-period">...</span> 태그 찾기
      const spanRegex = /<span class="highlight-period">(.*?)<\/span>/g;
      // 중첩된 태그 처리: <strong><span>...</span></strong>
      const nestedRegex = /<strong><span class="highlight-period">(.*?)<\/span><\/strong>/g;
      
      const matches: Array<{ start: number; end: number; type: 'nested' | 'strong' | 'span'; content: string }> = [];
      
      // 중첩된 태그 먼저 찾기
      let match: RegExpExecArray | null;
      while ((match = nestedRegex.exec(html)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: 'nested',
          content: match[1]
        });
      }
      
      // 일반 strong 태그 찾기 (중첩된 것 제외)
      while ((match = strongRegex.exec(html)) !== null) {
        const isNested = matches.some(m => 
          match!.index >= m.start && match!.index < m.end
        );
        if (!isNested) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: 'strong',
            content: match[1]
          });
        }
      }
      
      // 일반 span 태그 찾기 (중첩된 것 제외)
      while ((match = spanRegex.exec(html)) !== null) {
        const isNested = matches.some(m => 
          match!.index >= m.start && match!.index < m.end
        );
        if (!isNested) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: 'span',
            content: match[1]
          });
        }
      }
      
      // 시작 위치로 정렬
      matches.sort((a, b) => a.start - b.start);
      
      // 텍스트와 태그를 순서대로 처리
      matches.forEach((match, matchIndex) => {
        // 태그 이전의 일반 텍스트
        if (match.start > currentIndex) {
          const text = html.substring(currentIndex, match.start);
          if (text) {
            parts.push(text);
          }
        }
        
        // 태그 내용 렌더링
        if (match.type === 'nested') {
          parts.push(
            <strong key={`nested-${matchIndex}`}>
              <span className="chat-message__highlight-period">
                {match.content}
              </span>
            </strong>
          );
        } else if (match.type === 'strong') {
          parts.push(
            <strong key={`strong-${matchIndex}`}>
              {match.content}
            </strong>
          );
        } else if (match.type === 'span') {
          parts.push(
            <span key={`span-${matchIndex}`} className="chat-message__highlight-period">
              {match.content}
          </span>
        );
      }
        
        currentIndex = match.end;
      });
      
      // 마지막 남은 텍스트
      if (currentIndex < html.length) {
        const text = html.substring(currentIndex);
        if (text) {
          parts.push(text);
        }
      }
      
      return parts.length > 0 ? parts : [html];
    };
    
    return parseHTML(content);
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

