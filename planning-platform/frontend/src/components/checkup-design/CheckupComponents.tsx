import React from 'react';
import { renderTextWithFootnotes } from '../../utils/footnoteParser';

// --- [타입 정의] ---
interface CheckupItem {
  id: string;
  name: string;
  subtitle?: string; // 의사 메시지용 서브타이틀
  description?: string;
  reason?: string;
  evidence?: string;
  references?: string[];
  recommended: boolean;
  difficulty_level?: 'Low' | 'Mid' | 'High';
  difficulty_badge?: string;
}

// --- [유틸리티 함수: 각주 번호 추출] ---
const extractFootnoteNumbers = (text: string): number[] => {
  if (!text) return [];
  const footnoteRegex = /\[(\d+)\]/g;
  const matches: number[] = [];
  let match;
  while ((match = footnoteRegex.exec(text)) !== null) {
    const footnoteNum = parseInt(match[1], 10);
    if (!matches.includes(footnoteNum)) {
      matches.push(footnoteNum);
    }
  }
  return matches.sort((a, b) => a - b);
};

// --- [컴포넌트 1: 각주 리스트 표시] ---
interface FootnoteDisplayProps {
  text?: string;
  references?: string[];
}

export const FootnoteDisplay: React.FC<FootnoteDisplayProps> = ({ text, references }) => {
  if (!text || !references || references.length === 0) return null;
  
  const usedFootnoteNumbers = extractFootnoteNumbers(text);
  if (usedFootnoteNumbers.length === 0) return null;

  return (
    <div className="checkup-recommendations__footnotes">
      {usedFootnoteNumbers.map((footnoteNum) => {
        const refIndex = footnoteNum - 1;
        const ref = references[refIndex];
        if (!ref) return null;

        return (
          <div key={footnoteNum} className="checkup-recommendations__footnote-item">
            <span className="checkup-recommendations__footnote-number">[{footnoteNum}]</span>
            {(ref.startsWith('http://') || ref.startsWith('https://')) ? (
              <a href={ref} target="_blank" rel="noopener noreferrer" className="checkup-recommendations__footnote-link">
                [링크]
              </a>
            ) : (
              <span className="checkup-recommendations__footnote-text">{ref}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// --- [컴포넌트 2: 의사/간호사 말풍선 박스] ---
interface DoctorMessageBoxProps {
  message: string;
  highlightedText?: string;
  imageSrc: string;
  isCollapsed?: boolean;
}

export const DoctorMessageBox: React.FC<DoctorMessageBoxProps> = ({ message, highlightedText, imageSrc, isCollapsed = false }) => {
  const renderHighlighted = () => {
    if (!highlightedText) return <span>{message}</span>;
    const parts = message.split(highlightedText);
    if (parts.length === 1) return <span>{message}</span>;
    return (
      <>
        {parts[0]}
        <span className="checkup-recommendations__doctor-box-highlight">{highlightedText}</span>
        {parts[1]}
      </>
    );
  };

  return (
    <div className={`checkup-recommendations__doctor-box ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="checkup-recommendations__doctor-box-image">
        <img src={imageSrc} alt="의료진 일러스트" className="checkup-recommendations__doctor-illustration" />
      </div>
      <div className="checkup-recommendations__doctor-box-text">
        {renderHighlighted()}
      </div>
    </div>
  );
};

// --- [컴포넌트 3: 검진 항목 카드 (핵심)] ---
interface CheckupItemCardProps {
  item: CheckupItem;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  hideReason?: boolean;
}

export const CheckupItemCard: React.FC<CheckupItemCardProps> = ({ item, isExpanded, onToggle, hideReason = false }) => {
  return (
    <div className={`checkup-recommendations__item-accordion ${isExpanded ? 'checkup-recommendations__item-accordion--expanded' : ''}`}>
      {/* 헤더 */}
      <div className="checkup-recommendations__item-accordion-header" onClick={() => onToggle(item.id)}>
        <div className="checkup-recommendations__checkbox-wrapper">
          <input
            type="checkbox"
            id={item.id}
            className="checkup-recommendations__checkbox"
            defaultChecked={item.recommended}
            onClick={(e) => e.stopPropagation()}
          />
          <label htmlFor={item.id} className="checkup-recommendations__checkbox-label" onClick={(e) => e.stopPropagation()}>
            <div>
              <span className="checkup-recommendations__item-name">
                {item.name}
                {item.difficulty_level && (
                  <span className={`checkup-recommendations__difficulty-badge checkup-recommendations__difficulty-badge--${item.difficulty_level.toLowerCase()}`}>
                    {item.difficulty_badge || (item.difficulty_level === 'Low' ? '부담없는' : item.difficulty_level === 'Mid' ? '추천' : '프리미엄')}
                  </span>
                )}
              </span>
              {/* 서브타이틀 (의사 메시지) */}
              {item.subtitle && (
                <div className="checkup-recommendations__item-subtitle">
                  <span className="checkup-recommendations__item-subtitle-icon">ⓘ</span>
                  {item.subtitle}
                </div>
              )}
            </div>
          </label>
        </div>
        <div className="checkup-recommendations__item-accordion-arrow">
          <svg className={`checkup-recommendations__item-accordion-arrow-icon ${isExpanded ? 'expanded' : 'collapsed'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        </div>
      </div>

      {/* 상세 내용 */}
      {isExpanded && (
        <div className="checkup-recommendations__item-accordion-content">
          {item.description && (
            <div className="checkup-recommendations__item-description">
              <span className="checkup-recommendations__item-info-icon">ⓘ</span>
              <span className="checkup-recommendations__item-description-text">{item.description}</span>
            </div>
          )}
          {item.reason && !hideReason && (
            <div className="checkup-recommendations__item-reason">
              <span className="checkup-recommendations__item-reason-label">추천 이유:</span>
              <span className="checkup-recommendations__item-reason-text">
                {renderTextWithFootnotes(item.reason, item.references)}
              </span>
              <FootnoteDisplay text={item.reason} references={item.references} />
            </div>
          )}
          {item.evidence && (
            <div className="checkup-recommendations__item-evidence">
              <span className="checkup-recommendations__item-evidence-label">의학적 근거:</span>
              <span className="checkup-recommendations__item-evidence-text">
                {renderTextWithFootnotes(item.evidence, item.references)}
              </span>
              <FootnoteDisplay text={item.evidence} references={item.references} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

