import React, { useState, useEffect } from 'react';
import WelnoRagChatWindow from './WelnoRagChatWindow';
import { STORAGE_KEYS } from '../../constants/storage';
import { useWelnoData } from '../../contexts/WelnoDataContext';
import './WelnoRagChat.scss';

interface WelnoRagChatButtonProps {
  onToggle?: (isOpen: boolean) => void;
}

const WelnoRagChatButton: React.FC<WelnoRagChatButtonProps> = ({ onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);
  const { state } = useWelnoData();
  const iconUrl = state.frontendConfig?.iconUrl;

  useEffect(() => {
    const checkHideStatus = () => {
      const path = window.location.pathname;
      
      // 메인 페이지에서는 항상 버튼 표시
      const isMainPage = path === '/' || path === '' || path === '/welno';
      if (isMainPage) {
        console.log('[WelnoRagChatButton] 메인 페이지 감지 - 버튼 표시:', { path, isMainPage });
        setShouldHide(false);
        return;
      }
      
      const manualCollect = localStorage.getItem(STORAGE_KEYS.TILKO_MANUAL_COLLECT) === 'true';
      const collectingStatus = localStorage.getItem(STORAGE_KEYS.TILKO_COLLECTING_STATUS) === 'true';
      const passwordModalOpen = localStorage.getItem(STORAGE_KEYS.PASSWORD_MODAL_OPEN) === 'true';
      const surveyPanelOpen = localStorage.getItem('checkup_survey_panel_open') === 'true';
      
      // 특정 페이지에서 숨김 (checkup-design은 문진 패널 열릴 때만 숨김)
      const isSpecialPage = path.includes('/questionnaire') || 
                           path.includes('/survey') ||
                           path.includes('/habits');
      
      const shouldHide = manualCollect || collectingStatus || passwordModalOpen || surveyPanelOpen || isSpecialPage;
      console.log('[WelnoRagChatButton] 상태 확인:', { 
        path, 
        isMainPage, 
        manualCollect, 
        collectingStatus, 
        passwordModalOpen, 
        surveyPanelOpen,
        isSpecialPage, 
        shouldHide 
      });
      setShouldHide(shouldHide);
    };

    checkHideStatus();

    const handleEvents = () => checkHideStatus();
    window.addEventListener('storage', handleEvents);
    window.addEventListener('tilko-status-change', handleEvents);
    window.addEventListener('password-modal-change', handleEvents);

    return () => {
      window.removeEventListener('storage', handleEvents);
      window.removeEventListener('tilko-status-change', handleEvents);
      window.removeEventListener('password-modal-change', handleEvents);
    };
  }, []);

  const handleClick = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  if (shouldHide) return null;

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
          iconUrl ? (
            <img src={iconUrl} alt="Chat Icon" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )
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
