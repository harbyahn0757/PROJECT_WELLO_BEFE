import React, { useState, useEffect, useRef } from 'react';
import { parseMarkdownWithLists } from '../../utils/markdownParser';

interface Message {
  role: 'user' | 'assistant' | 'pnt_question' | 'auth_prompt';
  content: string;
  timestamp: string;
  sources?: any[];
  pnt_recommendations?: {
    recommended_tests?: any[];
    recommended_supplements?: any[];
    recommended_foods?: any[];
  };
}

interface RagChatMessageProps {
  message: Message;
  onTypingUpdate?: () => void;
  onTypingComplete?: () => void;
}

const RagChatMessage: React.FC<RagChatMessageProps> = ({ message, onTypingUpdate, onTypingComplete }) => {
  const isUser = message.role === 'user';
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const prevContentRef = useRef('');

  // 타이핑 효과 (assistant 메시지만)
  useEffect(() => {
    if (isUser) {
      setDisplayedContent(message.content);
      prevContentRef.current = message.content;
      return;
    }

    const currentContent = message.content;
    const prevContent = prevContentRef.current;

    // 새로운 내용이 추가된 경우
    if (currentContent.length > prevContent.length && currentContent.startsWith(prevContent)) {
      const newChars = currentContent.slice(prevContent.length);
      
      // 스트리밍 속도에 따라 타이핑 효과 조절
      // 천천히 부드럽게 타이핑되는 효과
      const typingSpeed = newChars.length > 50 ? 20 : 30; // 20-30ms마다 한 글자씩
      
      setIsTyping(true);
      let charIndex = 0;
      
      const typingInterval = setInterval(() => {
        if (charIndex < newChars.length) {
          setDisplayedContent(prevContent + newChars.slice(0, charIndex + 1));
          charIndex++;
          // 타이핑 중 스크롤 업데이트
          if (onTypingUpdate) {
            requestAnimationFrame(() => {
              onTypingUpdate();
            });
          }
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
          setDisplayedContent(currentContent);
          prevContentRef.current = currentContent;
          // 타이핑 완료 콜백 호출
          if (onTypingComplete) {
            onTypingComplete();
          }
        }
      }, typingSpeed);

      return () => clearInterval(typingInterval);
    } else if (currentContent !== prevContent) {
      // 내용이 완전히 바뀐 경우 (즉시 표시)
      setDisplayedContent(currentContent);
      prevContentRef.current = currentContent;
      setIsTyping(false);
    }
  }, [message.content, isUser, onTypingUpdate, onTypingComplete]);

  const handleDetailClick = async (type: 'test' | 'supplement' | 'food', item: any) => {
    // TODO: PNTRagService로 상세 설명 조회
    console.log('상세 설명 요청:', type, item);
  };

  // 빈 assistant 메시지는 렌더링하지 않음
  if (!isUser && !message.content.trim()) {
    return null;
  }

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'} ${isTyping ? 'typing' : ''}`}>
      <div className="message-content">
        {parseMarkdownWithLists(displayedContent)}
      </div>
      
      {/* PNT 추천 표시 */}
      {!isUser && message.pnt_recommendations && (
        <div className="pnt-recommendations">
          <h4>🎯 맞춤 추천 항목</h4>
          
          {message.pnt_recommendations.recommended_tests && message.pnt_recommendations.recommended_tests.length > 0 && (
            <div className="pnt-section">
              <div 
                className="pnt-section-header"
                onClick={() => setExpandedSection(expandedSection === 'tests' ? null : 'tests')}
              >
                <span>🔬 추천 검사 ({message.pnt_recommendations.recommended_tests.length}개)</span>
                <span>{expandedSection === 'tests' ? '▾' : '▴'}</span>
              </div>
              {expandedSection === 'tests' && (
                <ul className="pnt-items">
                  {message.pnt_recommendations.recommended_tests.map((test: any, idx: number) => (
                    <li key={idx} className="pnt-item">
                      <strong>{test.test_name_ko || test.test_code}</strong>
                      {test.brief_reason && <span className="pnt-reason"> - {test.brief_reason}</span>}
                      <button 
                        className="pnt-detail-btn"
                        onClick={() => handleDetailClick('test', test)}
                      >
                        상세보기
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {message.pnt_recommendations.recommended_supplements && message.pnt_recommendations.recommended_supplements.length > 0 && (
            <div className="pnt-section">
              <div 
                className="pnt-section-header"
                onClick={() => setExpandedSection(expandedSection === 'supplements' ? null : 'supplements')}
              >
                <span>💊 추천 건강기능식품 ({message.pnt_recommendations.recommended_supplements.length}개)</span>
                <span>{expandedSection === 'supplements' ? '▾' : '▴'}</span>
              </div>
              {expandedSection === 'supplements' && (
                <ul className="pnt-items">
                  {message.pnt_recommendations.recommended_supplements.map((supplement: any, idx: number) => (
                    <li key={idx} className="pnt-item">
                      <strong>{supplement.supplement_name_ko || supplement.supplement_code}</strong>
                      {supplement.brief_reason && <span className="pnt-reason"> - {supplement.brief_reason}</span>}
                      <button 
                        className="pnt-detail-btn"
                        onClick={() => handleDetailClick('supplement', supplement)}
                      >
                        상세보기
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {message.pnt_recommendations.recommended_foods && message.pnt_recommendations.recommended_foods.length > 0 && (
            <div className="pnt-section">
              <div 
                className="pnt-section-header"
                onClick={() => setExpandedSection(expandedSection === 'foods' ? null : 'foods')}
              >
                <span>🥗 추천 식품 ({message.pnt_recommendations.recommended_foods.length}개)</span>
                <span>{expandedSection === 'foods' ? '▾' : '▴'}</span>
              </div>
              {expandedSection === 'foods' && (
                <ul className="pnt-items">
                  {message.pnt_recommendations.recommended_foods.map((food: any, idx: number) => (
                    <li key={idx} className="pnt-item">
                      <strong>{food.food_name_ko || food.food_code}</strong>
                      {food.brief_reason && <span className="pnt-reason"> - {food.brief_reason}</span>}
                      <button 
                        className="pnt-detail-btn"
                        onClick={() => handleDetailClick('food', food)}
                      >
                        상세보기
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {!isUser && !isTyping && message.sources && message.sources.length > 0 && (
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
