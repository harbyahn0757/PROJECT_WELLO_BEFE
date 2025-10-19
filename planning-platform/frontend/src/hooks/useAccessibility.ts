/**
 * useAccessibility - 접근성 기능 관리 훅
 * 스크린 리더, 키보드 네비게이션, 고대비 모드 등 지원
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
}

export interface AccessibilityOptions {
  announcePageChanges?: boolean;
  skipLinks?: boolean;
  focusManagement?: boolean;
  ariaLive?: boolean;
}

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  screenReader: false,
  keyboardNavigation: false
};

const STORAGE_KEY = 'wello_accessibility_settings';

export const useAccessibility = (options: AccessibilityOptions = {}) => {
  const {
    announcePageChanges = true,
    skipLinks = true,
    focusManagement = true,
    ariaLive = true
  } = options;

  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isScreenReaderActive, setIsScreenReaderActive] = useState(false);
  const [currentFocus, setCurrentFocus] = useState<HTMLElement | null>(null);
  const announceRef = useRef<HTMLDivElement>(null);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);

  // 시스템 접근성 설정 감지
  useEffect(() => {
    const detectSystemPreferences = () => {
      const newSettings = { ...settings };

      // 고대비 모드 감지
      if (window.matchMedia('(prefers-contrast: high)').matches) {
        newSettings.highContrast = true;
      }

      // 애니메이션 감소 설정 감지
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        newSettings.reducedMotion = true;
      }

      // 스크린 리더 감지 (간접적)
      const hasScreenReader = 
        navigator.userAgent.includes('NVDA') ||
        navigator.userAgent.includes('JAWS') ||
        navigator.userAgent.includes('VoiceOver') ||
        window.speechSynthesis !== undefined;

      if (hasScreenReader) {
        newSettings.screenReader = true;
        setIsScreenReaderActive(true);
      }

      setSettings(newSettings);
    };

    detectSystemPreferences();

    // 미디어 쿼리 변경 감지
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleContrastChange = (e: MediaQueryListEvent) => {
      setSettings(prev => ({ ...prev, highContrast: e.matches }));
    };

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setSettings(prev => ({ ...prev, reducedMotion: e.matches }));
    };

    contrastQuery.addEventListener('change', handleContrastChange);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      contrastQuery.removeEventListener('change', handleContrastChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  // localStorage에서 설정 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const storedSettings = JSON.parse(stored);
        setSettings(prev => ({ ...prev, ...storedSettings }));
      }
    } catch (error) {
      console.error('접근성 설정 로드 실패:', error);
    }
  }, []);

  // 설정 변경 시 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('접근성 설정 저장 실패:', error);
    }
  }, [settings]);

  // CSS 클래스 적용
  useEffect(() => {
    const body = document.body;
    
    // 고대비 모드
    if (settings.highContrast) {
      body.classList.add('high-contrast');
    } else {
      body.classList.remove('high-contrast');
    }

    // 애니메이션 감소
    if (settings.reducedMotion) {
      body.classList.add('reduced-motion');
    } else {
      body.classList.remove('reduced-motion');
    }

    // 큰 텍스트
    if (settings.largeText) {
      body.classList.add('large-text');
    } else {
      body.classList.remove('large-text');
    }

    // 키보드 네비게이션
    if (settings.keyboardNavigation) {
      body.classList.add('keyboard-navigation');
    } else {
      body.classList.remove('keyboard-navigation');
    }
  }, [settings]);

  // 스크린 리더 공지
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!ariaLive || !announceRef.current) return;

    const announcer = announceRef.current;
    announcer.setAttribute('aria-live', priority);
    announcer.textContent = message;

    // 메시지 초기화 (스크린 리더가 같은 메시지를 반복 읽지 않도록)
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  }, [ariaLive]);

  // 페이지 변경 공지
  const announcePageChange = useCallback((pageName: string) => {
    if (announcePageChanges && isScreenReaderActive) {
      announce(`${pageName} 페이지로 이동했습니다`, 'polite');
    }
  }, [announcePageChanges, isScreenReaderActive, announce]);

  // 포커스 관리
  const manageFocus = useCallback((element: HTMLElement | string) => {
    if (!focusManagement) return;

    let targetElement: HTMLElement | null = null;

    if (typeof element === 'string') {
      targetElement = document.querySelector(element);
    } else {
      targetElement = element;
    }

    if (targetElement) {
      targetElement.focus();
      setCurrentFocus(targetElement);
    }
  }, [focusManagement]);

  // 키보드 이벤트 처리
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!settings.keyboardNavigation) return;

    // Escape 키로 모달/오버레이 닫기
    if (event.key === 'Escape') {
      const activeModal = document.querySelector('[role="dialog"]:not([aria-hidden="true"])');
      if (activeModal) {
        const closeButton = activeModal.querySelector('[aria-label*="닫기"], [aria-label*="close"]');
        if (closeButton instanceof HTMLElement) {
          closeButton.click();
        }
      }
    }

    // Tab 키로 포커스 트래핑 (모달 내에서)
    if (event.key === 'Tab') {
      const activeModal = document.querySelector('[role="dialog"]:not([aria-hidden="true"])');
      if (activeModal) {
        const focusableElements = activeModal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
          
          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }
  }, [settings.keyboardNavigation]);

  // 키보드 이벤트 리스너 등록
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 스킵 링크 처리
  const handleSkipToContent = useCallback(() => {
    const mainContent = document.querySelector('main, [role="main"], #main-content');
    if (mainContent instanceof HTMLElement) {
      mainContent.focus();
      mainContent.scrollIntoView();
    }
  }, []);

  // 설정 업데이트 함수들
  const toggleHighContrast = useCallback(() => {
    setSettings(prev => ({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setSettings(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }));
  }, []);

  const toggleLargeText = useCallback(() => {
    setSettings(prev => ({ ...prev, largeText: !prev.largeText }));
  }, []);

  const toggleKeyboardNavigation = useCallback(() => {
    setSettings(prev => ({ ...prev, keyboardNavigation: !prev.keyboardNavigation }));
  }, []);

  // 접근성 컴포넌트 렌더링 함수
  const AccessibilityComponents = useCallback(() => {
    return React.createElement(React.Fragment, null,
      // 스크린 리더 공지 영역
      ariaLive && React.createElement('div', {
        ref: announceRef,
        'aria-live': 'polite',
        'aria-atomic': 'true',
        className: 'sr-only',
        style: {
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }
      }),
      
      // 스킵 링크
      skipLinks && React.createElement('a', {
        ref: skipLinkRef,
        href: '#main-content',
        className: 'skip-link',
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          handleSkipToContent();
        },
        style: {
          position: 'absolute',
          left: '-10000px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          zIndex: 999999,
          padding: '8px 16px',
          background: 'var(--color-primary)',
          color: 'var(--color-text-inverse)',
          textDecoration: 'none',
          borderRadius: '4px'
        },
        onFocus: (e: React.FocusEvent) => {
          const target = e.target as HTMLElement;
          target.style.left = '6px';
          target.style.top = '6px';
          target.style.width = 'auto';
          target.style.height = 'auto';
        },
        onBlur: (e: React.FocusEvent) => {
          const target = e.target as HTMLElement;
          target.style.left = '-10000px';
          target.style.top = 'auto';
          target.style.width = '1px';
          target.style.height = '1px';
        }
      }, '메인 콘텐츠로 바로가기')
    );
  }, [ariaLive, skipLinks, handleSkipToContent]);

  return {
    settings,
    isScreenReaderActive,
    currentFocus,
    announce,
    announcePageChange,
    manageFocus,
    toggleHighContrast,
    toggleReducedMotion,
    toggleLargeText,
    toggleKeyboardNavigation,
    AccessibilityComponents
  };
};
