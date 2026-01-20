import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.scss';
import App from './App';

// 개발 환경에서 HMR 관련 불필요한 로그 억제
if (process.env.NODE_ENV === 'development') {
  // React Router 경고 및 passive event listener 경고 필터링
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const message = args[0];
    const fullMessage = args.map(arg => String(arg)).join(' ');
    
    if (
      (typeof message === 'string' &&
       (message.includes('sockjs-node') || 
        message.includes('is not able to match the URL') ||
        message.includes('does not start with the basename'))) ||
      fullMessage.includes('passive event listener') ||
      fullMessage.includes('Unable to preventDefault') ||
      fullMessage.includes('blockPointerEvent') ||
      fullMessage.includes('Intervention')
    ) {
      return; // 경고 무시
    }
    originalWarn.apply(console, args);
  };

  // WebSocket 연결 실패 에러 필터링 (HMR 정상 동작)
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const message = args[0];
    const fullMessage = args.map(arg => String(arg)).join(' ');
    
    // sockjs-node 관련 모든 에러 필터링 (더 강력하게)
    if (
      (typeof message === 'string' || fullMessage) &&
      (fullMessage.includes('sockjs-node') ||
       fullMessage.includes('WebSocket connection') ||
       fullMessage.includes('WebSocket is closed') ||
       fullMessage.includes('eventsource') ||
       fullMessage.includes('jsonp') ||
       fullMessage.includes('Unexpected token') ||
       fullMessage.includes('GET http://localhost') && fullMessage.includes('sockjs-node') ||
       fullMessage.includes('transportTimeout') ||
       fullMessage.includes('transportClose'))
    ) {
      return; // 에러 무시
    }
    originalError.apply(console, args);
  };

  // 전역 에러 핸들러로 네트워크 에러 필터링 (더 강력하게)
  window.addEventListener('error', (event) => {
    const message = event.message || '';
    const filename = event.filename || '';
    
    if (
      message.includes('sockjs-node') ||
      message.includes('jsonp') ||
      message.includes('WebSocket') ||
      message.includes('eventsource') ||
      message.includes('passive event listener') ||
      message.includes('blockPointerEvent') ||
      filename.includes('sockjs-node') ||
      filename.includes('jsonp')
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);

  // 전역 에러 핸들러로 네트워크 에러 필터링 (Promise rejection)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason);
    if (
      reason.includes('sockjs-node') ||
      reason.includes('WebSocket') ||
      reason.includes('jsonp')
    ) {
      event.preventDefault();
    }
  });
}

// 우클릭 방지 및 보안 설정
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
}, { passive: false });

// 텍스트 선택 방지 (선택적 - 필요시 주석 해제)
// document.addEventListener('selectstart', (e) => {
//   e.preventDefault();
//   return false;
// }, { passive: false });

// 이미지 드래그 방지
document.addEventListener('dragstart', (e) => {
  if (e.target instanceof HTMLImageElement) {
    e.preventDefault();
    return false;
  }
}, { passive: false });

// 키보드 단축키 방지 (F12, Ctrl+Shift+I 등)
document.addEventListener('keydown', (e) => {
  // F12 (개발자 도구)
  if (e.key === 'F12') {
    e.preventDefault();
    return false;
  }
  
  // Ctrl+Shift+I (개발자 도구)
  if (e.ctrlKey && e.shiftKey && e.key === 'I') {
    e.preventDefault();
    return false;
  }
  
  // Ctrl+Shift+J (콘솔)
  if (e.ctrlKey && e.shiftKey && e.key === 'J') {
    e.preventDefault();
    return false;
  }
  
  // Ctrl+U (소스 보기)
  if (e.ctrlKey && e.key === 'u') {
    e.preventDefault();
    return false;
  }
  
  // Ctrl+S (저장 방지)
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    return false;
  }
}, { passive: false });

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  process.env.NODE_ENV === 'production' ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  )
);

