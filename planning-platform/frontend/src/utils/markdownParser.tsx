import React from 'react';

/**
 * 간단한 마크다운 파서 (정규식 기반)
 * **텍스트** -> <strong>, *텍스트* -> <em>, - 리스트 -> <ul><li>
 */
export const parseMarkdown = (text: string): React.ReactNode[] => {
  if (!text) return [];

  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // **텍스트** (굵은 텍스트) 처리
  const boldRegex = /\*\*(.+?)\*\*/g;
  const boldMatches: Array<{ start: number; end: number; text: string }> = [];
  let match: RegExpExecArray | null;
  
  while ((match = boldRegex.exec(text)) !== null) {
    boldMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[1]
    });
  }

  // *텍스트* (기울임) 처리
  const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
  const italicMatches: Array<{ start: number; end: number; text: string }> = [];
  
  while ((match = italicRegex.exec(text)) !== null) {
    // **와 겹치지 않는지 확인
    const isOverlapping = boldMatches.some(b => 
      match!.index >= b.start && match!.index < b.end
    );
    if (!isOverlapping) {
      italicMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[1]
      });
    }
  }

  // 모든 매치를 하나의 배열로 합치고 정렬
  const allMatches: Array<{ start: number; end: number; text: string; type: 'bold' | 'italic' }> = [
    ...boldMatches.map(m => ({ ...m, type: 'bold' as const })),
    ...italicMatches.map(m => ({ ...m, type: 'italic' as const }))
  ].sort((a, b) => a.start - b.start);

  // 텍스트를 파싱하여 React 노드 생성
  let lastIndex = 0;
  
  for (const match of allMatches) {
    // 매치 전의 일반 텍스트
    if (match.start > lastIndex) {
      const plainText = text.substring(lastIndex, match.start);
      if (plainText) {
        parts.push(<span key={key++}>{plainText}</span>);
      }
    }
    
    // 매치된 텍스트 (굵게 또는 기울임)
    if (match.type === 'bold') {
      parts.push(<strong key={key++} className="markdown-bold">{match.text}</strong>);
    } else {
      parts.push(<em key={key++} className="markdown-italic">{match.text}</em>);
    }
    
    lastIndex = match.end;
  }
  
  // 마지막 남은 텍스트
  if (lastIndex < text.length) {
    const plainText = text.substring(lastIndex);
    if (plainText) {
      parts.push(<span key={key++}>{plainText}</span>);
    }
  }

  return parts.length > 0 ? parts : [text];
};

/**
 * 리스트 파싱 (줄 단위로 처리)
 */
export const parseMarkdownWithLists = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let key = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={key++} className="markdown-list">
          {currentList.map((item, idx) => (
            <li key={idx} className="markdown-list-item">
              {parseMarkdown(item.trim())}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    
    // 리스트 아이템 (- 또는 *로 시작)
    if (trimmed.match(/^[-*]\s+/)) {
      const itemText = trimmed.replace(/^[-*]\s+/, '');
      currentList.push(itemText);
    } else {
      // 리스트가 끝나면 플러시
      flushList();
      
      // ### 헤더 처리 (볼드 처리만)
      if (trimmed.match(/^###\s+(.+)$/)) {
        const headerText = trimmed.replace(/^###\s+/, '');
        elements.push(
          <div key={key++} className="markdown-paragraph">
            <strong className="markdown-bold">{headerText}</strong>
          </div>
        );
      } else if (trimmed) {
        // 일반 텍스트 또는 빈 줄
        elements.push(
          <div key={key++} className="markdown-paragraph">
            {parseMarkdown(trimmed)}
          </div>
        );
      } else {
        elements.push(<br key={key++} />);
      }
    }
  }

  // 마지막 리스트 플러시
  flushList();

  return <>{elements}</>;
};
