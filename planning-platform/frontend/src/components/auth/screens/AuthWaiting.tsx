import React, { useState, useEffect, useRef } from 'react';
import './AuthWaiting.scss';

interface AuthWaitingProps {
  authMethod: string;
  userName?: string;
  currentStatus: string;
  statusMessage?: string;
}

/**
 * AuthWaiting 컴포넌트
 * 
 * 인증 대기 화면을 렌더링합니다.
 * 사용자가 모바일에서 인증을 완료하기를 기다리는 동안 표시됩니다.
 */
const AuthWaiting: React.FC<AuthWaitingProps> = ({
  authMethod,
  userName = '사용자',
  currentStatus,
  statusMessage,
}) => {
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 인증 방식별 이름 매핑
  const getAuthMethodName = (method: string): string => {
    switch (method) {
      case '0': return '카카오톡';
      case '4': return '통신사Pass';
      case '6': return '네이버';
      default: return '선택하신 방식';
    }
  };
  
  const authMethodName = getAuthMethodName(authMethod);
  
  /**
   * 타이핑 효과로 메시지 표시
   */
  const typeMessage = (message: string, speed = 80) => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }
    
    setIsTyping(true);
    setTypingText('');
    
    let index = 0;
    typingTimerRef.current = setInterval(() => {
      if (index < message.length) {
        setTypingText(prev => prev + message.charAt(index));
        index++;
      } else {
        clearInterval(typingTimerRef.current!);
        setIsTyping(false);
      }
    }, speed);
  };
  
  // 초기 메시지 타이핑
  useEffect(() => {
    const initialMessage = `${authMethodName} 인증 요청을 보냈습니다.\n폰에서 인증을 완료하고 하단 플로팅 버튼 "인증 완료했어요"를 눌러주시면\n건강추이확인 하실 수 있습니다.`;
    typeMessage(initialMessage);
    
    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, [authMethod, authMethodName]);
  
  // 상태 변경에 따른 메시지 업데이트
  useEffect(() => {
    if (currentStatus === 'auth_completed') {
      const completedMessage = `${authMethodName} 인증이 완료되었습니다!\n하단 플로팅 버튼 "인증 완료했어요"를 눌러주세요.`;
      typeMessage(completedMessage);
    }
  }, [currentStatus, authMethodName]);
  
  return (
    <div className="auth-waiting-container">
      <div className="auth-waiting-content">
        {/* 로고 또는 아이콘 */}
        <div className="auth-waiting-icon">
          <div className="auth-pulse-circle"></div>
        </div>
        
        {/* 메시지 */}
        <div className="auth-waiting-message">
          <p className="auth-waiting-text">
            {typingText.split('\n').map((line, idx) => (
              <React.Fragment key={idx}>
                {line}
                {idx < typingText.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
            {isTyping && <span className="typing-cursor">|</span>}
          </p>
        </div>
        
        {/* 상태 메시지 (옵션) */}
        {statusMessage && (
          <div className="auth-status-message">
            {statusMessage}
          </div>
        )}
        
        {/* 안내 텍스트 */}
        <div className="auth-waiting-guide">
          <p>
            인증 완료 후 하단 플로팅 버튼 <strong>"인증 완료했어요"</strong>를 눌러주세요
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthWaiting;
