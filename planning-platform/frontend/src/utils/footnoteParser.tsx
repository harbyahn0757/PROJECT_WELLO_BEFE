/**
 * 각주 파서 유틸리티
 * 텍스트에서 [1], [2] 형식의 각주를 찾아 파싱하고 렌더링
 */
import React from 'react';

export interface FootnoteMatch {
  index: number; // 각주 번호 (1, 2, 3...)
  start: number; // 텍스트 내 시작 위치
  end: number; // 텍스트 내 끝 위치
  text: string; // 각주 표시 텍스트 "[1]"
}

export interface ParsedText {
  parts: Array<{
    text: string;
    isFootnote?: boolean;
    footnoteIndex?: number;
  }>;
  footnotes: Map<number, string>; // 각주 번호 -> 링크
}

/**
 * 텍스트에서 각주 패턴 [1], [2] 등을 찾아 파싱
 */
export function parseFootnotes(text: string, references?: string[]): ParsedText {
  const parts: Array<{ text: string; isFootnote?: boolean; footnoteIndex?: number }> = [];
  const footnotes = new Map<number, string>();
  
  if (!text) {
    return { parts: [{ text: '' }], footnotes };
  }
  
  // 각주 패턴 찾기: [1], [2], [10] 등
  const footnoteRegex = /\[(\d+)\]/g;
  const matches: FootnoteMatch[] = [];
  let match;
  
  while ((match = footnoteRegex.exec(text)) !== null) {
    matches.push({
      index: parseInt(match[1], 10),
      start: match.index,
      end: match.index + match[0].length,
      text: match[0]
    });
  }
  
  // 각주가 없으면 원본 텍스트 반환
  if (matches.length === 0) {
    return { parts: [{ text }], footnotes };
  }
  
  // 텍스트를 각주 기준으로 분할
  let lastIndex = 0;
  matches.forEach((match) => {
    // 각주 이전 텍스트
    if (match.start > lastIndex) {
      parts.push({ text: text.substring(lastIndex, match.start) });
    }
    
    // 각주 번호 저장 (각주 번호는 1부터 시작, 배열은 0부터 시작)
    const footnoteNumber = match.index; // 각주 번호 (1, 2, 3...) - FootnoteMatch 객체의 index 필드 사용
    if (references && references.length >= footnoteNumber) {
      // 각주 번호 [1] = references[0], [2] = references[1] ...
      const refUrl = references[footnoteNumber - 1];
      if (refUrl) {
        footnotes.set(footnoteNumber, refUrl);
      }
    }
    
    // 각주 표시
    parts.push({
      text: match.text,
      isFootnote: true,
      footnoteIndex: footnoteNumber // 각주 번호 저장
    });
    
    lastIndex = match.end;
  });
  
  // 마지막 텍스트
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex) });
  }
  
  return { parts, footnotes };
}

/**
 * 각주가 포함된 텍스트를 React 컴포넌트로 렌더링
 */
export function renderTextWithFootnotes(
  text: string,
  references?: string[],
  onFootnoteClick?: (index: number, url: string) => void
): React.ReactNode[] {
  if (!text) {
    return [<span key="empty"> </span>];
  }
  
  const { parts, footnotes } = parseFootnotes(text, references);
  
  return parts.map((part, idx) => {
    if (part.isFootnote && part.footnoteIndex) {
      const url = footnotes.get(part.footnoteIndex);
      if (url) {
        return (
          <sup
            key={idx}
            className="checkup-recommendations__footnote-link"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              if (onFootnoteClick) {
                onFootnoteClick(part.footnoteIndex!, url);
              } else {
                window.open(url, '_blank', 'noopener,noreferrer');
              }
            }}
            title={url}
            role="button"
            tabIndex={0}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                if (onFootnoteClick) {
                  onFootnoteClick(part.footnoteIndex!, url);
                } else {
                  window.open(url, '_blank', 'noopener,noreferrer');
                }
              }
            }}
          >
            {part.text}
          </sup>
        );
      }
      // 링크가 없으면 일반 텍스트로 표시
      return <sup key={idx} className="checkup-recommendations__footnote">{part.text}</sup>;
    }
    return <span key={idx}>{part.text}</span>;
  });
}

