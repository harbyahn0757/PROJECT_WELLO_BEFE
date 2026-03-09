import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RagChatMessage from './RagChatMessage';
import RagChatInput from './RagChatInput';
import SurveyTriggerPrompt from './SurveyTriggerPrompt';
import PNTInlineSurvey from './PNTInlineSurvey';
import AuthPromptBubble from './AuthPromptBubble';
import CategoryCardsGrid from '../health/CategoryView/CategoryCardsGrid';
import apiConfig from '../../config/api';
import { useWelnoData } from '../../contexts/WelnoDataContext';

interface Source {
  text: string;
  score?: number;
  title?: string;
  page?: string;
  category?: string;
  source_type?: string;
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
  role: 'user' | 'assistant' | 'pnt_question' | 'auth_prompt' | 'health_category';
  content: string;
  timestamp: string;
  sources?: Source[];
  pnt_question?: PNTQuestion;
  pnt_recommendations?: {
    recommended_tests?: any[];
    recommended_supplements?: any[];
    recommended_foods?: any[];
  };
  categoryData?: any[]; // 카테고리 데이터 (CategoryData[])
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
  const [visibleSuggestionsCount, setVisibleSuggestionsCount] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [hasHealthData, setHasHealthData] = useState<boolean | null>(null);
  const [pendingActions, setPendingActions] = useState<{
    suggestions: string[];
    needsAuth: boolean;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useWelnoData();
  const { frontendConfig } = state;

  // URL에서 uuid와 hospital_id 추출
  const searchParams = new URLSearchParams(location.search);
  const uuid = searchParams.get('uuid') || 'guest';
  const hospitalId = searchParams.get('hospital') || searchParams.get('hospital_id') || 'default';

  useEffect(() => {
    // 테마 색상 적용 (브라우저 최상단 및 위젯 로컬)
    if (frontendConfig?.primaryColor) {
      document.documentElement.style.setProperty('--brand-color', frontendConfig.primaryColor);
      
      // RGB 변수도 생성 (투명도 조절용)
      const hex = frontendConfig.primaryColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      document.documentElement.style.setProperty('--brand-color-rgb', `${r}, ${g}, ${b}`);
    }
  }, [frontendConfig?.primaryColor]);

  useEffect(() => {
    // 세션 ID 생성
    if (!sessionId) {
      const sid = `rag_chat_${uuid}_${hospitalId}_${Date.now()}`;
      setSessionId(sid);
      
      // 환영 메시지 (이미 메시지가 없는 경우만)
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: frontendConfig?.welcomeMessage || '안녕하세요! 건강과 영양에 대해 궁금한 점을 물어보세요. 😊',
          timestamp: new Date().toISOString()
        }]);
      }
    }
  }, [uuid, hospitalId, sessionId, messages.length, frontendConfig?.welcomeMessage]);

  useEffect(() => {
    // 데이터 유무 확인 (게스트가 아니고 기본 hospital이 아닐 때만)
    const checkHealthData = async () => {
      if (uuid === 'guest' || hospitalId === 'default') {
        setHasHealthData(false);
        return;
      }

      try {
        const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
        const response = await fetch(
          `${baseUrl}/api/v1/welno/check-existing-data?uuid=${uuid}&hospital_id=${hospitalId}`
        );
        
        if (response.ok) {
          const result = await response.json();
          // 기존 API 응답: { success: true, data: { exists: true, ... } }
          setHasHealthData(result.data?.exists || false);
        } else {
          setHasHealthData(false);
        }
      } catch (error) {
        console.error('[RAG 챗] 데이터 확인 실패:', error);
        setHasHealthData(false);
      }
    };

    checkHealthData();
  }, [uuid, hospitalId]);

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
    setVisibleSuggestionsCount(0); // 추가 질문 카운트 초기화
    setPendingActions(null); // 이전 pendingActions 초기화

    try {
      // API 호출
      const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/welno-rag-chat/message`, {
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
      let hasReceivedAnswer = false;
      let sseBuffer = ''; // SSE 버퍼: 청크 분할 시 불완전한 줄 보존

      const processSSELine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) return;
        try {
          const data = JSON.parse(trimmed.slice(6));

          if (data.answer) {
            assistantContent += data.answer;

            // 첫 답변이 올 때 버블 생성 및 로딩 숨김
            if (!hasReceivedAnswer) {
              setIsLoading(false);
              hasReceivedAnswer = true;
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: assistantContent,
                timestamp: new Date().toISOString()
              }]);
            } else {
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

            setTimeout(() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 50);
          }

          if (data.done) {
            finalSources = data.sources || [];
            finalTriggerSurvey = !!data.trigger_survey;
            finalSuggestions = data.suggestions || [];
            const suggestPNT = !!data.suggest_pnt;

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

            setPendingActions({
              suggestions: finalSuggestions,
              needsAuth: hasHealthData === false && uuid !== 'guest'
            });

            if (suggestPNT && !showPNTPrompt) {
              setShowPNTPrompt(true);
              setShowSurveyPrompt(false);
            } else if (finalTriggerSurvey && !showSurveyPrompt && !showPNTPrompt) {
              setShowSurveyPrompt(true);
            }
          }
        } catch (e) {
          // 불완전한 JSON (스트리밍 중 잘린 줄)은 무시
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || ''; // 마지막 불완전한 줄은 버퍼에 보존

        for (const line of lines) {
          processSSELine(line);
        }
      }

      // 스트림 종료 후 버퍼에 남은 데이터 처리
      if (sseBuffer.trim()) {
        processSSELine(sseBuffer);
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
      // 에러 케이스에서만 로딩 상태 해제 (정상 케이스는 첫 답변 수신 시 이미 해제됨)
      if (isLoading) {
        setIsLoading(false);
      }
    }
  };

  const handleTypingComplete = () => {
    if (!pendingActions) return;
    
    // 1. 참고문헌은 이미 표시됨 (sources가 메시지에 추가됨)
    
    // 2. 인증 버블 (500ms 후)
    if (pendingActions.needsAuth) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'auth_prompt',
          content: '건강 데이터로 더 자세한 안내를 받아보세요',
          timestamp: new Date().toISOString()
        }]);
      }, 500);
    }
    
    // 3. 추가 질문 (인증 버블 후 또는 참고문헌 후)
    const baseDelay = pendingActions.needsAuth ? 1000 : 500;
    if (pendingActions.suggestions.length > 0) {
      setSuggestions(pendingActions.suggestions);
      setTimeout(() => {
        setVisibleSuggestionsCount(0);
        pendingActions.suggestions.forEach((suggestion, index) => {
          setTimeout(() => {
            setVisibleSuggestionsCount(prev => prev + 1);
          }, index * 400);
        });
      }, baseDelay);
    }
    
    setPendingActions(null);
  };

  const handleStartSurvey = async () => {
    // PNT 문진 시작 (채팅창 내에서)
    try {
      setIsLoading(true);
      setShowPNTPrompt(false); // 프롬프트 숨김
      setShowSurveyPrompt(false); // 일반 문진 프롬프트도 숨김
      
      const baseUrl = apiConfig.IS_DEVELOPMENT ? '' : apiConfig.API_BASE_URL;
      const response = await fetch(`${baseUrl}/api/v1/welno-rag-chat/pnt/start`, {
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
      const response = await fetch(`${baseUrl}/api/v1/welno-rag-chat/pnt/answer`, {
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
      fetch(`${baseUrl}/api/v1/welno-rag-chat/summarize`, {
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
        <div className="header-bot-info">
          <div className="bot-text">
            <span className="bot-name">{frontendConfig?.partnerName || '웰로'} 건강 상담</span>
            <span className="bot-status">온라인</span>
          </div>
        </div>
        <button onClick={handleClose} className="close-button" aria-label="닫기">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
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
          if (msg.role === 'auth_prompt') {
            return (
              <AuthPromptBubble
                key={idx}
                onClick={() => navigate(`/login?uuid=${uuid}&hospital=${hospitalId}`)}
              />
            );
          }
          if (msg.role === 'health_category') {
            return (
              <div key={idx} className="chat-message assistant">
                <CategoryCardsGrid
                  categories={msg.categoryData || []}
                  onCategoryClick={(catId) => {
                    const categoryName = msg.categoryData?.find((c: any) => c.id === catId)?.name || '';
                    handleSendMessage(`${categoryName} 카테고리 상세 정보를 알려주세요`);
                  }}
                  compact={true}
                />
              </div>
            );
          }
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;
          const isConsecutive = prevMsg?.role === msg.role && (msg.role === 'user' || msg.role === 'assistant');
          const isLastInGroup = !nextMsg || nextMsg.role !== msg.role;
          return (
            <RagChatMessage
              key={idx}
              message={msg}
              isConsecutive={isConsecutive}
              isLastInGroup={isLastInGroup}
              onTypingUpdate={() => {
                requestAnimationFrame(() => {
                  if (messagesEndRef.current) {
                    messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
                  }
                });
              }}
              onTypingComplete={
                msg.role === 'assistant' && idx === messages.length - 1
                  ? handleTypingComplete
                  : undefined
              }
            />
          );
        })}
        {isLoading && (
          <div className="typing-bubble">
            <div className="typing-bubble-content">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
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

        <div ref={messagesEndRef} />
      </div>

      {/* 추가 질문 제안 (입력창 위, 가로 스크롤) */}
      {!isLoading && suggestions.length > 0 && visibleSuggestionsCount > 0 && (
        <div className="chat-suggestions-horizontal">
          <div className="suggestions-scroll">
            {suggestions.slice(0, visibleSuggestionsCount).map((sug, idx) => (
              <button 
                key={idx} 
                className="suggestion-item-horizontal"
                onClick={() => handleSendMessage(sug)}
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      <RagChatInput
        onSend={handleSendMessage}
        disabled={isLoading}
        placeholder="궁금한 내용을 물어보세요"
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
      />
    </div>
  );
};

export default WelnoRagChatWindow;
