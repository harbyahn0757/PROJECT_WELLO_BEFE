import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RagChatMessage from './RagChatMessage';
import RagChatInput from './RagChatInput';
import SurveyTriggerPrompt from './SurveyTriggerPrompt';
import PNTInlineSurvey from './PNTInlineSurvey';
import apiConfig from '../../config/api';

interface Source {
  text: string;
  score?: number;
  metadata?: any;
}

interface PNTQuestion {
  question_id: string;
  question_text: string;
  question_type: 'radio' | 'checkbox' | 'scale';
  options: Array<{
    option_id?: string;
    option_value: string;
    option_label: string;
    score: number;
  }>;
  group_name: string;
  question_index: number;
  total_questions: number;
}

interface Message {
  role: 'user' | 'assistant' | 'pnt_question';
  content: string;
  timestamp: string;
  sources?: Source[];
  pnt_question?: PNTQuestion;
  pnt_recommendations?: {
    recommended_tests?: any[];
    recommended_supplements?: any[];
    recommended_foods?: any[];
  };
}

interface WelnoRagChatWindowProps {
  onClose: () => void;
}

const WelnoRagChatWindow: React.FC<WelnoRagChatWindowProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSurveyPrompt, setShowSurveyPrompt] = useState(false);
  const [showPNTPrompt, setShowPNTPrompt] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsExpanded, setIsSuggestionsExpanded] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // URL에서 uuid와 hospital_id 추출
  const searchParams = new URLSearchParams(location.search);
  const uuid = searchParams.get('uuid') || 'guest';
  const hospitalId = searchParams.get('hospital') || searchParams.get('hospital_id') || 'default';

  useEffect(() => {
    // 세션 ID 생성
    if (!sessionId) {
      const sid = `rag_chat_${uuid}_${hospitalId}_${Date.now()}`;
      setSessionId(sid);
      
      // 환영 메시지 (이미 메시지가 없는 경우만)
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: '안녕하세요! 건강과 영양에 대해 궁금한 점을 물어보세요. 😊',
          timestamp: new Date().toISOString()
        }]);
      }
    }
  }, [uuid, hospitalId, sessionId, messages.length]);

  useEffect(() => {
    // 모바일에서 스크롤 방지
    if (window.innerWidth <= 480) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, []);

  useEffect(() => {
    // 모바일 키보드 대응: Visual Viewport API로 키보드 높이 감지
    if (window.innerWidth <= 480 && window.visualViewport) {
      const container = document.querySelector('.welno-rag-chat-window-container') as HTMLElement;
      if (!container) return;

      const handleViewportResize = () => {
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const windowHeight = window.innerHeight;
        const keyboardHeight = windowHeight - viewportHeight;
        
        // 키보드가 나타났을 때 컨테이너 높이 조정
        if (keyboardHeight > 0) {
          container.style.height = `${viewportHeight}px`;
        } else {
          // 키보드가 사라졌을 때 원래 높이로 복원
          container.style.height = '';
        }
      };
      
      window.visualViewport.addEventListener('resize', handleViewportResize);
      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportResize);
      };
    }
  }, []);

  useEffect(() => {
    // 메시지 스크롤 (모바일 포커스 시에는 즉시 스크롤, 그 외에는 부드럽게)
    if (messagesEndRef.current) {
      const behavior = isInputFocused ? 'auto' : 'smooth';
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, [messages, isInputFocused]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    // 사용자 메시지 추가
    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setSuggestions([]); // 새 질문 시작 시 이전 제안 삭제
    setIsSuggestionsExpanded(true); // 새 제안 시 다시 펼치기

    try {
      // API 호출
      const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
      const response = await fetch(`${baseUrl}/welno-api/v1/welno-rag-chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid,
          hospital_id: hospitalId,
          message,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 응답 오류:', response.status, errorText);
        throw new Error(`상담 서버 응답 오류 (${response.status}). 잠시 후 다시 시도해주세요.`);
      }

      // 스트리밍 응답 처리
      const reader = response.body?.getReader();
      if (!reader) throw new Error('응답 본문을 읽을 수 없습니다.');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let finalSources: Source[] = [];
      let finalTriggerSurvey = false;
      let finalSuggestions: string[] = [];

      // 초기 어시스턴트 메시지 추가 (비어있음)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString()
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            
            if (data.answer) {
              assistantContent += data.answer;
              // 메시지 업데이트
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIdx = newMessages.length - 1;
                if (newMessages[lastIdx].role === 'assistant') {
                  newMessages[lastIdx] = {
                    ...newMessages[lastIdx],
                    content: assistantContent
                  };
                }
                return newMessages;
              });
            }

            if (data.done) {
              finalSources = data.sources || [];
              finalTriggerSurvey = !!data.trigger_survey;
              finalSuggestions = data.suggestions || [];
              const suggestPNT = !!data.suggest_pnt;
              
              // 최종 메타데이터 업데이트
              setMessages(prev => {
                const newMessages = [...prev];
                const lastIdx = newMessages.length - 1;
                if (newMessages[lastIdx].role === 'assistant') {
                  newMessages[lastIdx] = {
                    ...newMessages[lastIdx],
                    sources: finalSources
                  };
                }
                return newMessages;
              });

              if (finalSuggestions.length > 0) {
                setSuggestions(finalSuggestions);
              }

              // PNT 문진 시작 제안 (우선순위: PNT > 일반 문진)
              if (suggestPNT && !showPNTPrompt) {
                setShowPNTPrompt(true);
                setShowSurveyPrompt(false); // PNT가 있으면 일반 문진 숨김
              } else if (finalTriggerSurvey && !showSurveyPrompt && !showPNTPrompt) {
                setShowSurveyPrompt(true);
              }
            }
          } catch (e) {
            console.error('JSON 파싱 오류:', e, line);
          }
        }
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error);
      let errorMsg = error instanceof Error ? error.message : String(error);
      
      // TypeError: Failed to fetch는 보통 네트워크 단절이나 ERR_EMPTY_RESPONSE임
      if (errorMsg.includes('Failed to fetch')) {
        errorMsg = "서버와의 연결이 끊어졌거나 응답이 없습니다. 네트워크 상태를 확인하고 잠시 후 다시 메시지를 보내주세요.";
      }

      const errorMessage: Message = {
        role: 'assistant',
        content: `죄송합니다. 오류가 발생했습니다: ${errorMsg}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSurvey = async () => {
    // PNT 문진 시작 (채팅창 내에서)
    try {
      setIsLoading(true);
      setShowPNTPrompt(false); // 프롬프트 숨김
      setShowSurveyPrompt(false); // 일반 문진 프롬프트도 숨김
      
      const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
      const response = await fetch(`${baseUrl}/welno-api/v1/welno-rag-chat/pnt/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid,
          hospital_id: hospitalId,
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error('PNT 문진 시작 실패');
      }

      const result = await response.json();
      if (result.success && result.question) {
        // PNT 질문 메시지 추가
        setMessages(prev => [...prev, {
          role: 'pnt_question',
          content: '',
          timestamp: new Date().toISOString(),
          pnt_question: result.question
        }]);
      } else {
        console.error('PNT 문진 시작 실패:', result.error);
      }
    } catch (error) {
      console.error('PNT 문진 시작 실패:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePNTAnswer = async (questionId: string, answerValue: string, answerScore: number) => {
    try {
      const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
      const response = await fetch(`${baseUrl}/welno-api/v1/welno-rag-chat/pnt/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid,
          hospital_id: hospitalId,
          session_id: sessionId,
          question_id: questionId,
          answer_value: answerValue,
          answer_score: answerScore
        })
      });

      if (!response.ok) {
        throw new Error('PNT 답변 제출 실패');
      }

      const result = await response.json();
      
      if (result.success) {
        // 이전 질문 메시지 제거
        setMessages(prev => prev.filter(msg => !(msg.role === 'pnt_question' && msg.pnt_question?.question_id === questionId)));
        
        if (result.is_complete && result.recommendations) {
          // 추천 표시
          const recs = result.recommendations;
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'PNT 문진이 완료되었습니다. 추천 항목을 확인해주세요.',
            timestamp: new Date().toISOString(),
            pnt_recommendations: {
              recommended_tests: Array.isArray(recs.recommended_tests) ? recs.recommended_tests : [],
              recommended_supplements: Array.isArray(recs.recommended_supplements) ? recs.recommended_supplements : [],
              recommended_foods: Array.isArray(recs.recommended_foods) ? recs.recommended_foods : []
            }
          }]);
        } else if (result.question) {
          // 다음 질문 표시
          setMessages(prev => [...prev, {
            role: 'pnt_question',
            content: '',
            timestamp: new Date().toISOString(),
            pnt_question: result.question
          }]);
        }
      }
    } catch (error) {
      console.error('PNT 답변 제출 실패:', error);
    }
  };

  const handleClose = async () => {
    // 닫기 전 요약 요청 (백그라운드)
    try {
      const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
      fetch(`${baseUrl}/welno-api/v1/welno-rag-chat/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, hospital_id: hospitalId })
      });
    } catch (e) {
      console.error('요약 요청 실패:', e);
    }
    onClose();
  };

  return (
    <div className="welno-rag-chat-window">
      {/* 헤더 */}
      <div className="chat-header">
        <h3>웰로 건강 상담</h3>
        <button onClick={handleClose} className="close-button">✕</button>
      </div>

      {/* 메시지 영역 (통합 스크롤) */}
      <div className="chat-messages">
        {messages.map((msg, idx) => {
          if (msg.role === 'pnt_question' && msg.pnt_question) {
            return (
              <PNTInlineSurvey
                key={idx}
                question={msg.pnt_question}
                onAnswer={handlePNTAnswer}
                uuid={uuid}
                hospitalId={hospitalId}
                sessionId={sessionId}
              />
            );
          }
          return <RagChatMessage key={idx} message={msg} />;
        })}
        {isLoading && (
          <div className="loading-indicator">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        )}

        {/* 문진 제안 프롬프트 (채팅 영역 내부) */}
        {showSurveyPrompt && (
          <SurveyTriggerPrompt
            onStart={handleStartSurvey}
            onLater={() => setShowSurveyPrompt(false)}
          />
        )}

        {/* PNT 문진 시작 제안 프롬프트 (채팅 영역 내부) */}
        {showPNTPrompt && (
          <div className="survey-trigger-prompt">
            <div className="prompt-content">
              <p>
                💡 더 정밀한 맞춤 영양 치료를 위해<br/>
                간단한 문진을 진행해 보시겠어요?
              </p>
              <div className="prompt-buttons">
                <button className="btn-start" onClick={handleStartSurvey}>
                  시작하기
                </button>
                <button className="btn-later" onClick={() => setShowPNTPrompt(false)}>
                  나중에
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 예상 질문 제안 (아코디언 스타일, 채팅 영역 내부) */}
        {!isLoading && suggestions.length > 0 && (
          <div className={`chat-suggestions-accordion ${isSuggestionsExpanded ? 'expanded' : 'collapsed'}`}>
            <div 
              className="suggestions-header" 
              onClick={() => setIsSuggestionsExpanded(!isSuggestionsExpanded)}
            >
              <span className="header-title">💡 이런 질문은 어떠세요?</span>
              <span className="header-icon">{isSuggestionsExpanded ? '▾' : '▴'}</span>
            </div>
            {isSuggestionsExpanded && (
              <div className="suggestions-list">
                {suggestions.map((sug, idx) => (
                  <button 
                    key={idx} 
                    className="suggestion-item"
                    onClick={() => handleSendMessage(sug)}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <RagChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        placeholder="궁금한 점을 물어보세요..."
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
      />
    </div>
  );
};

export default WelnoRagChatWindow;
