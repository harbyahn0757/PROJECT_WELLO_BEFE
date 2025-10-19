/**
 * AccessibilityPanel - 접근성 설정 패널
 * 사용자가 접근성 옵션을 조정할 수 있는 UI
 */
import React, { useState } from 'react';
import { useAccessibility } from '../../../hooks/useAccessibility';
import './styles.scss';

export interface AccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({
  isOpen,
  onClose,
  position = 'top-right'
}) => {
  const {
    settings,
    toggleHighContrast,
    toggleReducedMotion,
    toggleLargeText,
    toggleKeyboardNavigation,
    announce
  } = useAccessibility();

  const [fontSize, setFontSize] = useState(16);

  // 폰트 크기 조정
  const handleFontSizeChange = (size: number) => {
    setFontSize(size);
    document.documentElement.style.fontSize = `${size}px`;
    announce(`폰트 크기가 ${size}픽셀로 변경되었습니다`);
  };

  // 패널 닫기
  const handleClose = () => {
    onClose();
    announce('접근성 설정 패널이 닫혔습니다');
  };

  // ESC 키로 패널 닫기
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 오버레이 */}
      <div 
        className="accessibility-panel-overlay"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* 접근성 패널 */}
      <div
        className={`accessibility-panel accessibility-panel--${position}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="accessibility-panel-title"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* 헤더 */}
        <div className="accessibility-panel__header">
          <h2 id="accessibility-panel-title" className="accessibility-panel__title">
            접근성 설정
          </h2>
          <button
            className="accessibility-panel__close"
            onClick={handleClose}
            aria-label="접근성 설정 패널 닫기"
          >
            ✕
          </button>
        </div>

        {/* 설정 목록 */}
        <div className="accessibility-panel__content">
          {/* 시각적 설정 */}
          <section className="setting-section">
            <h3 className="setting-section__title">시각적 설정</h3>
            
            {/* 고대비 모드 */}
            <div className="setting-item">
              <div className="setting-item__info">
                <label htmlFor="high-contrast-toggle" className="setting-item__label">
                  고대비 모드
                </label>
                <p className="setting-item__description">
                  텍스트와 배경의 대비를 높여 가독성을 개선합니다
                </p>
              </div>
              <button
                id="high-contrast-toggle"
                className={`toggle-button ${settings.highContrast ? 'toggle-button--active' : ''}`}
                onClick={() => {
                  toggleHighContrast();
                  announce(settings.highContrast ? '고대비 모드가 해제되었습니다' : '고대비 모드가 활성화되었습니다');
                }}
                aria-pressed={settings.highContrast}
                aria-describedby="high-contrast-desc"
              >
                <span className="toggle-button__slider" />
                <span className="sr-only">
                  {settings.highContrast ? '고대비 모드 해제' : '고대비 모드 활성화'}
                </span>
              </button>
            </div>

            {/* 큰 텍스트 */}
            <div className="setting-item">
              <div className="setting-item__info">
                <label htmlFor="large-text-toggle" className="setting-item__label">
                  큰 텍스트
                </label>
                <p className="setting-item__description">
                  텍스트 크기를 크게 하여 읽기 쉽게 만듭니다
                </p>
              </div>
              <button
                id="large-text-toggle"
                className={`toggle-button ${settings.largeText ? 'toggle-button--active' : ''}`}
                onClick={() => {
                  toggleLargeText();
                  announce(settings.largeText ? '큰 텍스트가 해제되었습니다' : '큰 텍스트가 활성화되었습니다');
                }}
                aria-pressed={settings.largeText}
              >
                <span className="toggle-button__slider" />
                <span className="sr-only">
                  {settings.largeText ? '큰 텍스트 해제' : '큰 텍스트 활성화'}
                </span>
              </button>
            </div>

            {/* 폰트 크기 조정 */}
            <div className="setting-item">
              <div className="setting-item__info">
                <label htmlFor="font-size-slider" className="setting-item__label">
                  폰트 크기 조정
                </label>
                <p className="setting-item__description">
                  전체 텍스트 크기를 세밀하게 조정합니다
                </p>
              </div>
              <div className="font-size-controls">
                <button
                  className="font-size-button"
                  onClick={() => handleFontSizeChange(Math.max(12, fontSize - 2))}
                  aria-label="폰트 크기 줄이기"
                >
                  A-
                </button>
                <span className="font-size-display" aria-live="polite">
                  {fontSize}px
                </span>
                <button
                  className="font-size-button"
                  onClick={() => handleFontSizeChange(Math.min(24, fontSize + 2))}
                  aria-label="폰트 크기 늘리기"
                >
                  A+
                </button>
              </div>
            </div>
          </section>

          {/* 동작 설정 */}
          <section className="setting-section">
            <h3 className="setting-section__title">동작 설정</h3>
            
            {/* 애니메이션 감소 */}
            <div className="setting-item">
              <div className="setting-item__info">
                <label htmlFor="reduced-motion-toggle" className="setting-item__label">
                  애니메이션 감소
                </label>
                <p className="setting-item__description">
                  화면 전환과 애니메이션을 최소화합니다
                </p>
              </div>
              <button
                id="reduced-motion-toggle"
                className={`toggle-button ${settings.reducedMotion ? 'toggle-button--active' : ''}`}
                onClick={() => {
                  toggleReducedMotion();
                  announce(settings.reducedMotion ? '애니메이션 감소가 해제되었습니다' : '애니메이션 감소가 활성화되었습니다');
                }}
                aria-pressed={settings.reducedMotion}
              >
                <span className="toggle-button__slider" />
                <span className="sr-only">
                  {settings.reducedMotion ? '애니메이션 감소 해제' : '애니메이션 감소 활성화'}
                </span>
              </button>
            </div>
          </section>

          {/* 네비게이션 설정 */}
          <section className="setting-section">
            <h3 className="setting-section__title">네비게이션 설정</h3>
            
            {/* 키보드 네비게이션 */}
            <div className="setting-item">
              <div className="setting-item__info">
                <label htmlFor="keyboard-nav-toggle" className="setting-item__label">
                  키보드 네비게이션 강화
                </label>
                <p className="setting-item__description">
                  키보드만으로 모든 기능을 사용할 수 있도록 합니다
                </p>
              </div>
              <button
                id="keyboard-nav-toggle"
                className={`toggle-button ${settings.keyboardNavigation ? 'toggle-button--active' : ''}`}
                onClick={() => {
                  toggleKeyboardNavigation();
                  announce(settings.keyboardNavigation ? '키보드 네비게이션 강화가 해제되었습니다' : '키보드 네비게이션 강화가 활성화되었습니다');
                }}
                aria-pressed={settings.keyboardNavigation}
              >
                <span className="toggle-button__slider" />
                <span className="sr-only">
                  {settings.keyboardNavigation ? '키보드 네비게이션 강화 해제' : '키보드 네비게이션 강화 활성화'}
                </span>
              </button>
            </div>
          </section>

          {/* 도움말 */}
          <section className="setting-section">
            <h3 className="setting-section__title">키보드 단축키</h3>
            <div className="keyboard-shortcuts">
              <div className="shortcut-item">
                <kbd>Tab</kbd>
                <span>다음 요소로 이동</span>
              </div>
              <div className="shortcut-item">
                <kbd>Shift + Tab</kbd>
                <span>이전 요소로 이동</span>
              </div>
              <div className="shortcut-item">
                <kbd>Enter</kbd>
                <span>선택/활성화</span>
              </div>
              <div className="shortcut-item">
                <kbd>Space</kbd>
                <span>체크박스/버튼 토글</span>
              </div>
              <div className="shortcut-item">
                <kbd>Esc</kbd>
                <span>모달/메뉴 닫기</span>
              </div>
            </div>
          </section>
        </div>

        {/* 푸터 */}
        <div className="accessibility-panel__footer">
          <p className="accessibility-panel__info">
            설정은 자동으로 저장됩니다
          </p>
        </div>
      </div>
    </>
  );
};

export default AccessibilityPanel;
