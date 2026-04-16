/**
 * Term — 전문 용어 tooltip 컴포넌트
 * hover/focus/tap 시 glossary 설명 표시
 * 접근성: role="term", aria-describedby 연결, focus-visible 지원
 */
import { useState, useId } from 'react';
import { GLOSSARY } from './glossary';

interface TermProps {
  /** GLOSSARY 키 (예: 'ARR', '건강나이') */
  keyword: string;
  /** 화면에 표시할 텍스트 (children) */
  children: React.ReactNode;
}

export default function Term({ keyword, children }: TermProps) {
  const tooltipId = useId();
  const description = GLOSSARY[keyword];
  const [visible, setVisible] = useState(false);

  // glossary에 없는 키워드면 그냥 렌더
  if (!description) {
    return <>{children}</>;
  }

  const show = () => setVisible(true);
  const hide = () => setVisible(false);
  const toggle = () => setVisible((v) => !v);

  return (
    <span
      className="report-view__term"
      role="term"
      tabIndex={0}
      aria-describedby={visible ? tooltipId : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      // 터치: tap으로 토글
      onTouchStart={(e) => {
        e.preventDefault();
        toggle();
      }}
    >
      {children}
      <span
        id={tooltipId}
        className="report-view__term-tooltip"
        role="tooltip"
        aria-hidden={!visible}
        style={visible ? { opacity: 1, visibility: 'visible', transform: 'translateX(-50%) translateY(0)' } : undefined}
      >
        {description}
      </span>
    </span>
  );
}
