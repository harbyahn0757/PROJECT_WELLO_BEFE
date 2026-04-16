import React from 'react';

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
  // ⭐ Bridge 전략 3단계 추가
  bridge_strategy?: {
    step1_anchor?: string;  // 1단계: 기본 검사의 가치
    step2_gap?: string;      // 2단계: 한계점
    step3_offer?: string;    // 3단계: 제안
    evidence_id?: string;    // RAG 근거 매핑용 ID
  };
}

// --- [컴포넌트 1: 각주 리스트 표시] ---
interface FootnoteDisplayProps {
  text?: string;
  references?: string[];
}

export const FootnoteDisplay: React.FC<FootnoteDisplayProps> = ({ text, references }) => {
  // 간단한 구현: 텍스트에 [1], [2] 등이 있으면 해당 인덱스의 레퍼런스를 표시
  if (!text || !references || references.length === 0) return null;
  
  const footnoteRegex = /\[(\d+)\]/g;
  const matches: number[] = [];
  let match;
  while ((match = footnoteRegex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (!matches.includes(num)) matches.push(num);
  }
  matches.sort((a, b) => a - b);
  
  if (matches.length === 0) return null;

  return (
    <div className="checkup-recommendations__footnotes">
      {matches.map((num) => {
        const ref = references[num - 1];
        if (!ref) return null;
        return (
          <div key={num} className="checkup-recommendations__footnote-item">
            <span className="checkup-recommendations__footnote-number">[{num}]</span>
            <span className="checkup-recommendations__footnote-text">{ref}</span>
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
        <img src={imageSrc} alt="Doctor" />
      </div>
      <div className="checkup-recommendations__doctor-box-content">
        <div className="checkup-recommendations__doctor-box-text">
          {renderHighlighted()}
        </div>
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
  onShowEvidence?: (evidenceId: string) => void;
}

export const CheckupItemCard: React.FC<CheckupItemCardProps> = ({ item, isExpanded, onToggle, hideReason = false, onShowEvidence }) => {
  
  // [1] 형태의 텍스트를 클릭 가능한 링크로 변환하는 함수
  const renderContentWithCitations = (text: string) => {
    if (!text) return null;
    
    // [숫자] 패턴으로 분리 (캡처 그룹 사용)
    const parts = text.split(/(\[\d+\])/g);
    
    return parts.map((part, index) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        return (
          <span 
            key={index} 
            className="citation-link" 
            onClick={(e) => {
              e.stopPropagation();
              // [1] 클릭 시 onShowEvidence 호출
              if (onShowEvidence) {
                // 숫자를 넘기거나 전체 텍스트를 넘김 (여기서는 텍스트)
                onShowEvidence(part);
              }
            }}
            title="관련 의학적 근거 보기"
            style={{ 
              color: '#2563eb', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              margin: '0 2px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              borderRadius: '4px',
              padding: '0 4px',
              fontSize: '0.9em'
            }}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div
      className={`checkup-recommendations__item-accordion ${isExpanded ? 'checkup-recommendations__item-accordion--expanded' : ''}`}
      data-testid={`recommendation-card-${item.id}`}
    >
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
          
          {/* ⭐ Bridge 전략 (통합 박스) */}
          {item.bridge_strategy && (
            <div className="bridge-strategy-unified">
              {/* 첫 번째 + 두 번째 텍스트 연결 (줄바꿈 없음) */}
              {(item.bridge_strategy.step1_anchor || item.bridge_strategy.step2_gap) && (
                <p className="bridge-text-inline">
                  {item.bridge_strategy.step1_anchor && 
                    item.bridge_strategy.step1_anchor.replace(/^(가이드라인형으로 시작|통계형으로 시작|설문형으로 시작|증상형으로 시작):\s*/i, '')}
                  {item.bridge_strategy.step1_anchor && item.bridge_strategy.step2_gap && ' '}
                  {item.bridge_strategy.step2_gap && 
                    item.bridge_strategy.step2_gap.replace(/^(가이드라인형으로 시작|통계형으로 시작|설문형으로 시작|증상형으로 시작):\s*/i, '')}
                </p>
              )}
              
              {/* 마지막 텍스트 (줄바꿈 + 갈색 볼드) */}
              {item.bridge_strategy.step3_offer && (
                <p className="bridge-text-bold">
                  {item.bridge_strategy.step3_offer.replace(/^(가이드라인형으로 시작|통계형으로 시작|설문형으로 시작|증상형으로 시작):\s*/i, '')}
                </p>
              )}
              
              {/* 근거 보기 버튼 */}
              {onShowEvidence && (
                <div className="bridge-evidence-button-wrapper" style={{ marginTop: '8px', textAlign: 'right' }}>
                  <button 
                    className="bridge-evidence-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // 임시: evidence_id가 없으면 item.name이나 id를 사용
                      onShowEvidence(item.bridge_strategy?.evidence_id || item.name);
                    }}
                    style={{
                      backgroundColor: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #dcfce7',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>📑</span> 관련 의학적 근거 보기
                  </button>
                </div>
              )}
            </div>
          )}
          
          {item.reason && !hideReason && (
            <div className="checkup-recommendations__item-reason">
              <span className="checkup-recommendations__item-reason-label">추천 이유:</span>
              <span className="checkup-recommendations__item-reason-text">
                {/* 렌더링 함수 교체 */}
                {renderContentWithCitations(item.reason)}
              </span>
            </div>
          )}
          {item.evidence && (
            <div className="checkup-recommendations__item-evidence">
              <span className="checkup-recommendations__item-evidence-label">의학적 근거:</span>
              <span className="checkup-recommendations__item-evidence-text">
                {/* 렌더링 함수 교체 */}
                {renderContentWithCitations(item.evidence)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
